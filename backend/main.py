from typing import Optional, Literal, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
<<<<<<< HEAD
from fastapi import HTTPException
import json
import os

import glob
from linear_regression import run_linear_regression
from id3 import compute_id3_root_steps
from knn_regression import run_knn_regression
=======
import uuid, shutil, io, math, glob, os, re
from collections import defaultdict
>>>>>>> b29ddb32a447b40d061887436a05bc6e12d5f7fe
from pandas.api.types import (
    is_bool_dtype,
    is_object_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    CategoricalDtype,
)
from id3 import compute_id3_root_steps
from linear_regression import run_linear_regression

# -----------------------------------------------------------
# App Setup
# -----------------------------------------------------------
app = FastAPI(title="ML Algorithms API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CSV_NAME_RE = re.compile(r".+\.csv$", re.IGNORECASE)
CSV_MIME_OK = {
    "text/csv", "application/csv", "application/x-csv",
    "text/plain", "application/octet-stream", "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# -----------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------
def _guess_encoding(raw: bytes) -> str:
    try:
        import chardet
        return chardet.detect(raw).get("encoding", "latin1")
    except Exception:
        return "latin1"

def read_tabular_file(path: Path) -> pd.DataFrame:
    suf = path.suffix.lower()
    if suf in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    try:
        return pd.read_csv(path, encoding="utf-8", sep=None, engine="python")
    except Exception:
        text = path.read_text(encoding="latin1", errors="replace")
        return pd.read_csv(io.StringIO(text), sep=None, engine="python")

def find_dataset_path(dataset_id: str) -> Path:
    pattern = str(UPLOAD_DIR / f"{dataset_id}__*.csv")
    matches = glob.glob(pattern)
    if not matches:
        raise HTTPException(status_code=404, detail="dataset_id not found")
    return Path(matches[0])

def infer_target_type(s: pd.Series, max_class_count: int = 20, max_unique_ratio: float = 0.05):
    n = len(s)
    s_nonnull = s.dropna()
    nunique = s_nonnull.nunique()
    if is_datetime64_any_dtype(s_nonnull):
        return {"inferred": "unsupported_datetime_target"}
    if is_bool_dtype(s_nonnull) or isinstance(s_nonnull.dtype, CategoricalDtype) or is_object_dtype(s_nonnull):
        return {"inferred": "classification"}
    coerced = pd.to_numeric(s_nonnull, errors="coerce")
    if coerced.isna().mean() < 0.05:
        if coerced.nunique() <= max_class_count or (coerced.nunique() / len(coerced)) <= max_unique_ratio:
            return {"inferred": "classification"}
        else:
            return {"inferred": "regression"}
    return {"inferred": "classification"}

def label_peek(s: pd.Series, top_k: int = 10):
    vc = s.astype("string").value_counts(dropna=True).head(top_k)
    return [{"label": k, "count": int(v)} for k, v in vc.items()]

# -----------------------------------------------------------
# Upload Dataset
# -----------------------------------------------------------
@app.post("/datasets")
async def upload_and_analyze_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target: Optional[str] = Form(None),
):
    orig = file.filename
    if not orig or not CSV_NAME_RE.match(orig):
        raise HTTPException(status_code=400, detail="Only .csv files accepted.")
    unique_id = uuid.uuid4().hex
    save_path = UPLOAD_DIR / f"{unique_id}__{Path(orig).name}"

    with save_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    await file.close()

    df = read_tabular_file(save_path)
    resp = {
        "dataset_id": unique_id,
        "filename": Path(orig).name,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "message": "Upload successful",
    }

    if target and target in df.columns:
        info = infer_target_type(df[target])
        resp["analysis"] = info
        if info["inferred"] == "classification":
            resp["label_preview"] = label_peek(df[target])
            resp["suggested_algorithms"] = ["id3", "naive_bayes", "knn"]
        elif info["inferred"] == "regression":
<<<<<<< HEAD
            resp["suggested_algorithms"] = ["linear_regression", "knn_regression"]
        else:
            resp["suggested_algorithms"] = []
=======
            resp["suggested_algorithms"] = ["linear_regression"]
>>>>>>> b29ddb32a447b40d061887436a05bc6e12d5f7fe

    return JSONResponse(resp, status_code=201)

# -----------------------------------------------------------
# ID3 Algorithm
# -----------------------------------------------------------
class CalcRequest(BaseModel):
    algorithm: Literal["id3", "naive_bayes", "linear_regression"]
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/id3")
async def id3_route(req: CalcRequest):
    csv_path = find_dataset_path(req.dataset_id)
    df = read_tabular_file(csv_path)
    params = req.params or {}
    target = params.get("target")
    features = params.get("features")
    if not target:
        raise HTTPException(status_code=400, detail="params.target required")
    result = compute_id3_root_steps(df, target=target, features=features)
    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i
    return {"run_id": run_id, "algorithm": "id3", "steps": result["steps"], "tree": result.get("tree")}

# -----------------------------------------------------------
# Linear Regression Algorithm
# -----------------------------------------------------------
class LinearRegressionRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/simplelinearregression")
async def simple_linear_regression(req: LinearRegressionRequest = Body(...)):
    csv_path = find_dataset_path(req.dataset_id)
    df = read_tabular_file(csv_path)
    result = run_linear_regression(df, req.params or {})
    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i
    return {
        "run_id": run_id,
        "algorithm": "linear_regression",
        "steps": result["steps"],
        "summary": result.get("summary"),
    }

<<<<<<< HEAD
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


=======
# -----------------------------------------------------------
# NAIVE BAYES ALGORITHM (final integrated working version)
# -----------------------------------------------------------
>>>>>>> b29ddb32a447b40d061887436a05bc6e12d5f7fe
@app.post("/naivebayes")
async def naive_bayes(request: Request):
    body = await request.json()
    dataset_id = body.get("dataset_id")
    params = body.get("params", {})
    target = params.get("target")
    example = params.get("example", {})

    if not dataset_id or not target or not example:
        raise HTTPException(status_code=400, detail="Missing dataset_id, target, or example")

    csv_path = find_dataset_path(dataset_id)
    df = read_tabular_file(csv_path)

    if target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target '{target}' not found")

    steps = []
    priors = df[target].value_counts(normalize=True).to_dict()
    steps.append({"step": 1, "title": "Calculate prior probabilities", "result": {"priors": priors}})

    details = defaultdict(lambda: defaultdict(dict))
    for cls in df[target].unique():
        subset = df[df[target] == cls]
        for feature in df.columns:
            if feature == target:
                continue
            probs = subset[feature].value_counts(normalize=True).to_dict()
            details[cls][feature] = probs

    steps.append({"step": 2, "title": "Calculate conditional probabilities", "result": {"details": details}})

    per_class = {}
    for cls, prior in priors.items():
        prob = prior
        multipliers = []
        for feature, value in example.items():
            feature_probs = details[cls].get(feature, {})
            p = feature_probs.get(value, 1e-6)
            prob *= p
            multipliers.append({"feature": feature, "value": value, "p": p})
        per_class[cls] = {"unnormalized": prob, "multipliers": multipliers}

    steps.append({"step": 3, "title": "Multiply prior with conditional probabilities", "result": {"per_class": per_class}})

    total = sum(v["unnormalized"] for v in per_class.values())
    posteriors = {cls: v["unnormalized"] / total for cls, v in per_class.items()}

    steps.append({"step": 4, "title": "Normalize to get posterior probabilities", "vars": {"evidence": total}, "result": {"posteriors": posteriors}})

    predicted = max(posteriors, key=posteriors.get)
    confidence = posteriors[predicted]
    steps.append({"step": 5, "title": "Final Prediction", "result": {"predicted": predicted, "confidence": confidence}})

    return {"dataset_preview": df.head(5).to_dict(orient="records"), "steps": steps}
