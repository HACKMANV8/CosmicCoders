from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import pandas as pd
from typing import Optional, Literal, Dict, Any, List
from pydantic import BaseModel
import math
import json
import glob
from pandas.api.types import (
    is_bool_dtype,
    is_object_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    CategoricalDtype,  
)
from fastapi.middleware.cors import CORSMiddleware

import uuid, shutil, re

app = FastAPI(title="CSV Upload + Inline Target Analysis")
origins = [
    "http://localhost:5173",
    
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       
    allow_credentials=True,      
    allow_methods=["*"],          
    allow_headers=["*"],         
)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CSV_NAME_RE = re.compile(r".+\.csv$", re.IGNORECASE)
CSV_MIME_OK = {"text/csv", "application/csv", "application/vnd.ms-excel"}  

def infer_target_type(
    s: pd.Series,
    max_class_count: int = 20,
    max_unique_ratio: float = 0.05,
):
    """
    Heuristic:
      - object/category/bool -> classification
      - numeric -> classification if few unique values or small unique ratio, else regression
      - datetime -> flagged as unsupported target
    """
    n = int(len(s))
    s_nonnull = s.dropna()
    nunique = int(s_nonnull.nunique())

    if is_datetime64_any_dtype(s_nonnull):
        return {
            "inferred": "unsupported_datetime_target",
            "reason": "Target is datetime-like; not a typical supervised target.",
            "n": n,
            "n_nonnull": int(s_nonnull.size),
            "n_unique": nunique,
            "unique_ratio": float(nunique / max(1, s_nonnull.size)),
        }

    if (
       is_bool_dtype(s_nonnull)
    or isinstance(s_nonnull.dtype, CategoricalDtype) 
    or is_object_dtype(s_nonnull)
    ):
        return {
             "inferred": "classification",
        "reason": "Target dtype is object/bool/category.",
        "n": int(n),
        "n_nonnull": int(s_nonnull.size),
        "n_unique": int(nunique),
        "unique_ratio": float(nunique / max(1, s_nonnull.size)),
        }

    coerced = pd.to_numeric(s_nonnull, errors="coerce")
    non_numeric_fraction = float(coerced.isna().mean())
    if non_numeric_fraction < 0.05:
        nunique_num = int(coerced.nunique(dropna=True))
        unique_ratio = float(nunique_num / max(1, coerced.size))
        if (nunique_num <= max_class_count) or (unique_ratio <= max_unique_ratio):
            return {
                "inferred": "classification",
                "reason": (
                    f"Numeric with limited unique values (<= {max_class_count}) "
                    f"or small unique ratio (<= {max_unique_ratio})."
                ),
                "n": n,
                "n_nonnull": int(s_nonnull.size),
                "n_unique": nunique_num,
                "unique_ratio": unique_ratio,
            }
        else:
            return {
                "inferred": "regression",
                "reason": "Numeric with large number/ratio of unique values.",
                "n": n,
                "n_nonnull": int(s_nonnull.size),
                "n_unique": nunique_num,
                "unique_ratio": unique_ratio,
            }

    return {
        "inferred": "classification",
        "reason": "Target failed numeric coercion (mixed/non-numeric values).",
        "n": n,
        "n_nonnull": int(s_nonnull.size),
        "n_unique": nunique,
        "unique_ratio": float(nunique / max(1, s_nonnull.size)),
    }


def label_peek(s: pd.Series, top_k: int = 10):
    vc = s.astype("string").value_counts(dropna=True).head(top_k)
    return [{"label": k, "count": int(v)} for k, v in vc.items()]

def find_dataset_path(dataset_id: str) -> Path:
    """
    Resolve saved CSV path from dataset_id. We saved as:
      uploads/<dataset_id>__<original>.csv
    This finds the matching file safely without needing a DB (for now).
    """
    pattern = str(UPLOAD_DIR / f"{dataset_id}__*.csv")
    matches = glob.glob(pattern)
    if not matches:
        raise HTTPException(status_code=404, detail="dataset_id not found")
    return Path(matches[0])

@app.post("/datasets")
async def upload_and_analyze_dataset(
    file: UploadFile = File(..., description="CSV file"),
    name: Optional[str] = Form(None, description="Optional friendly name"),
    target: Optional[str] = Form(None, description="Target column name (optional)"),
    max_class_count: int = Form(20),
    max_unique_ratio: float = Form(0.05),
):
    orig = file.filename
    if not orig or not CSV_NAME_RE.match(orig):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")
    if file.content_type and file.content_type.lower() not in CSV_MIME_OK:
        raise HTTPException(status_code=400, detail=f"Unexpected content-type: {file.content_type}")

    unique_id = uuid.uuid4().hex
    safe_original = Path(orig).name
    save_path = UPLOAD_DIR / f"{unique_id}__{safe_original}"
    try:
        with save_path.open("wb") as out:
            shutil.copyfileobj(file.file, out, length=1024 * 1024)
    except Exception as e:
        if save_path.exists():
            try: save_path.unlink()
            except: pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}") from e
    finally:
        await file.close()

    try:
        df = pd.read_csv(save_path)
    except Exception as e:
        try: save_path.unlink()
        except: pass
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    columns = df.columns.tolist()
    rows = int(len(df))

    resp: dict = {
        "dataset_id": unique_id,
        "filename": safe_original,
        "stored_at": str(save_path.resolve()),
        "name": name,
        "rows": rows,
        "columns": columns,
        "message": "Upload successful",
        "analysis": None,
        "label_preview": None,
        "suggested_algorithms": None,
    }

    if target:
        if target not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{target}' not found.")
        s = df[target]

        if s.dtype == "object":
            try:
                s_dt = pd.to_datetime(s, errors="raise")
                if s_dt.notna().mean() > 0.95:
                    s = s_dt
            except Exception:
                pass

        info = infer_target_type(
            s, max_class_count=max_class_count, max_unique_ratio=max_unique_ratio
        )
        resp["analysis"] = info

        if info["inferred"] == "classification":
            resp["label_preview"] = label_peek(s)
            resp["suggested_algorithms"] = ["id3", "c4.5", "cart", "naive_bayes", "knn"]
        elif info["inferred"] == "regression":
            resp["suggested_algorithms"] = ["cart_regression", "linear_regression"]
        else:
            resp["suggested_algorithms"] = []

    return JSONResponse(resp, status_code=201)




