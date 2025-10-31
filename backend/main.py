from typing import Optional
from fastapi import Body
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Optional, Literal, Dict, Any, List, Mapping
from pydantic import BaseModel
from pathlib import Path
import io
from id3 import compute_id3_root_steps
import math
import csv
import pandas as pd
from fastapi import HTTPException
import json
import os

import glob
from linear_regression import run_linear_regression
from id3 import compute_id3_root_steps
from knn_regression import run_knn_regression
from pandas.api.types import (
    is_bool_dtype,
    is_object_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    CategoricalDtype,  
)
from fastapi.middleware.cors import CORSMiddleware

import uuid, shutil, re

def run_id3_root(df, params):
    """Placeholder for ID3 algorithm"""
    return {
        "steps": [
            {
                "step_number": 1,
                "title": "ID3 Decision Tree",
                "description": "ID3 algorithm implementation coming soon...",
                "formula": "Information Gain = Entropy(parent) - Weighted Average * Entropy(children)"
            }
        ]
    }

def run_naive_bayes(df, params):
    """Placeholder for Naive Bayes algorithm"""
    return {
        "steps": [
            {
                "step_number": 1,
                "title": "Naive Bayes Classification",
                "description": "Naive Bayes algorithm implementation coming soon...",
                "formula": "P(class|features) = P(features|class) * P(class) / P(features)"
            }
        ]
    }

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
CSV_MIME_OK = {
    "text/csv",
    "application/csv",
    "application/x-csv",
    "text/plain",                   
    "application/octet-stream",      
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

def infer_target_type(
    s: pd.Series,
    max_class_count: int = 20,
    max_unique_ratio: float = 0.05,
):

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

from typing import Any

def _guess_encoding(raw: bytes) -> str:
    try:
        import chardet 
    except Exception:
        return "latin1"

    det = chardet.detect(raw)  
    enc: str | None = None
    if isinstance(det, dict):
        v = det.get("encoding")  
        if isinstance(v, str) and v:
            enc = v

    return enc or "latin1"


def read_tabular_file(path: Path) -> pd.DataFrame:
    suf = path.suffix.lower()

    if suf in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    try:
        head = path.read_bytes()[:4]
        if head.startswith(b"PK\x03\x04"):  
            return pd.read_excel(path)
    except Exception:
        pass

    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin1"):
        try:
            return pd.read_csv(path, encoding=enc, sep=None, engine="python")
        except UnicodeDecodeError:
            continue
        except Exception:
            continue

    try:
        text = path.read_text(encoding="latin1", errors="replace")
        return pd.read_csv(io.StringIO(text), sep=None, engine="python")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file as CSV/XLSX: {e}")

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
        df = read_tabular_file(save_path)
    except HTTPException:
      raise
    except Exception as e:
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
            resp["suggested_algorithms"] = ["linear_regression", "knn_regression"]
        else:
            resp["suggested_algorithms"] = []

    return JSONResponse(resp, status_code=201)

class CalcRequest(BaseModel):
    algorithm: Literal["id3", "naive_bayes","linear_regression"]   
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/id3")
async def calculate(req: CalcRequest):
    csv_path = find_dataset_path(req.dataset_id)
    try:
        df = read_tabular_file(csv_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {e}")

    params = req.params or {}

    if req.algorithm == "id3":
        target = params.get("target")
        features = params.get("features")
        if not target:
            raise HTTPException(status_code=400, detail="params.target is required for ID3")

        result = compute_id3_root_steps(df, target=target, features=features)
    else:
        raise HTTPException(status_code=400, detail="Unsupported algorithm")

    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i

    return JSONResponse({
        "run_id": run_id,
        "algorithm": req.algorithm,
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        "tree": result.get("tree"),
    })

class LinearRegressionRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/simplelinearregression")
async def simple_linear_regression(req: LinearRegressionRequest = Body(...)):
    csv_path = find_dataset_path(req.dataset_id)
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {e}")

    params = req.params or {}

    result = run_linear_regression(df, params)

    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i

    return JSONResponse({
        "run_id": run_id,
        "algorithm": "linear_regression",
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        "summary": result.get("summary"),
        "chart_data": result.get("chart_data"),
        "metadata": result.get("metadata"),
    })



class KNNRegressionRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/knnregression")
async def knn_regression(req: KNNRegressionRequest = Body(...)):
    csv_path = find_dataset_path(req.dataset_id)
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {e}")

    params = req.params or {}

    result = run_knn_regression(df, params)

    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i

    return JSONResponse({
        "run_id": run_id,
        "algorithm": "knn_regression",
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        "summary": result.get("summary"),
        "chart_data": result.get("chart_data"),
        "metadata": result.get("metadata"),
    })


@app.post("/naivebayes")
def naive_bayes_calculation(request: dict):
    try:
        dataset_id: str | None = request.get("dataset_id")
        algo: str = (request.get("algorithm") or "").strip().lower()
        params: Dict[str, Any] = request.get("params", {}) or {}
        target_col: str | None = params.get("target")
        example: Dict[str, Any] = params.get("example", {}) or {}

        if not dataset_id:
            raise HTTPException(status_code=400, detail="dataset_id is required")
        if not target_col:
            raise HTTPException(status_code=400, detail="params.target is required")
        if algo != "naive_bayes":
            raise HTTPException(status_code=400, detail="Algorithm not supported in this route")

        # ✅ Use your saved uploads location
        csv_path = find_dataset_path(dataset_id)          # <— use helper
        df = read_tabular_file(csv_path)                  # <— robust reader

        if target_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found")

        # Treat all features as categorical for this simple NB (convert to string)
        y = df[target_col].astype("string")
        X = df.drop(columns=[target_col]).astype("string")

        classes: List[str] = sorted(y.dropna().unique().tolist())

        # ---- STEP 1: Priors P(class) ----
        priors: Dict[str, float] = {}
        total = float(len(y))
        for c in classes:
            priors[c] = round(float((y == c).sum()) / total, 6) if total > 0 else 0.0

        # ---- STEP 2: Likelihoods P(x_i=val | class) with Laplace smoothing ----
        likelihoods: Dict[str, Dict[str, float]] = {}
        for c in classes:
            subset = df[y == c]
            subset_X = subset.drop(columns=[target_col]).astype("string")
            likelihoods[c] = {}
            for feature in X.columns:
                # value requested to score with (stringified for consistency)
                val = str(example.get(feature, ""))
                # observed counts for this feature in class c
                vc = subset_X[feature].value_counts(dropna=False)
                count_val = int(vc.get(val, 0))
                k = int(subset_X[feature].nunique(dropna=False) or 1)
                n = int(len(subset_X))
                # Laplace smoothing: (count+1)/(n+k)
                prob = (count_val + 1.0) / (n + k) if (n + k) > 0 else 0.0
                likelihoods[c][feature] = round(prob, 6)

        # ---- STEP 3: Unnormalized posteriors ∝ P(class) * Π P(x_i|class) ----
        posteriors: Dict[str, float] = {}
        for c in classes:
            post = priors[c]
            for feature in X.columns:
                post *= likelihoods[c][feature]
            posteriors[c] = float(post)

        # ---- STEP 4: Normalize (evidence) ----
        evidence = float(sum(posteriors.values()))
        posteriors_norm: Dict[str, float] = {}
        if evidence > 0.0:
            for c in classes:
                posteriors_norm[c] = round(posteriors[c] / evidence, 8)
        else:
            # fallback to uniform if everything underflowed to zero
            uniform = round(1.0 / max(len(classes), 1), 8) if classes else 0.0
            for c in classes:
                posteriors_norm[c] = uniform

        # ---- STEP 5: Prediction ----
        # Avoid dict.get in max (typing ambiguity); use items() + key lambda
        if not posteriors_norm:
            raise HTTPException(status_code=422, detail="No classes available for prediction")
        predicted, confidence = max(posteriors_norm.items(), key=lambda kv: kv[1])

        # ---- Response shaped for frontend (render each value & calculation) ----
        return {
            "meta": {
                "dataset_id": dataset_id,
                "target": target_col,
                "features": list(X.columns),
                "classes": classes,
                "example": example,
            },
            "steps": [
                {
                    "step": 1,
                    "title": "Compute Priors",
                    "description": "P(C) = count(C)/N for each class",
                    "priors": priors,
                    "N": int(total),
                    "class_counts": {c: int((y == c).sum()) for c in classes},
                },
                {
                    "step": 2,
                    "title": "Compute Likelihoods with Laplace smoothing",
                    "description": "P(x_i = v | C) = (count + 1) / (n + k)",
                    "likelihoods": likelihoods,
                },
                {
                    "step": 3,
                    "title": "Unnormalized Posterior",
                    "description": "P(C) × Π_i P(x_i|C)",
                    "posteriors_unnormalized": posteriors,
                },
                {
                    "step": 4,
                    "title": "Normalize",
                    "description": "P(C|x) = numerator / evidence",
                    "evidence": evidence,
                    "posteriors": posteriors_norm,
                },
                {
                    "step": 5,
                    "title": "Prediction",
                    "description": "Choose class with max posterior",
                    "predicted": predicted,
                    "confidence": confidence,
                },
            ],
            "result": {
                "predicted": predicted,
                "confidence": confidence,
            },
            # small preview for UI
            "dataset_preview": df.head(5).to_dict(orient="records"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
