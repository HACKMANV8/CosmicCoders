from typing import Optional, Literal, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
from fastapi import HTTPException
import json
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler, FunctionTransformer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, r2_score, mean_squared_error
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import SVR
import numpy as np
from sklearn.naive_bayes import GaussianNB
import uuid
import shutil
import io
from collections import defaultdict

import re
from svr import run_svr
import glob
from linear_regression import run_linear_regression
from id3 import compute_id3_root_steps
from knn_regression import run_knn_regression
from naive_bayes import run_naive_bayes
from knn_classification import run_knn_classification
from algorithm_comparison import compare_regression_algorithms
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
def _build_preprocessor(df: pd.DataFrame, target: str):
    features = [c for c in df.columns if c != target]
    X = df[features].copy()

    # Identify column types
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in features if c not in numeric_cols]

    # Preprocess: scale numerics, one-hot categoricals
    pre = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ],
        remainder="drop",
        sparse_threshold=1.0,  # keep sparse if any OHE
    )

    # Make sure final matrix is dense so KNN/SVR work
    to_dense = FunctionTransformer(lambda m: m.toarray() if hasattr(m, "toarray") else m)

    return pre, to_dense, features, numeric_cols, categorical_cols


def _evaluate_classification(df: pd.DataFrame, target: str):
    pre, to_dense, features, *_ = _build_preprocessor(df, target)
    X = df[features]
    y = df[target]

    # Train/test split (stratify when feasible/safe)
    stratify = y if y.nunique() > 1 and y.value_counts().min() >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=stratify
    )

    models = {
        "id3": DecisionTreeClassifier(criterion="entropy", random_state=42),
        # GaussianNB tolerates real-valued features (post-scaling); avoids negatives issue in MultinomialNB
        "naive_bayes": GaussianNB(),
        "knn_classification": KNeighborsClassifier(n_neighbors=5),
    }

    results = []
    for key, clf in models.items():
        pipe = Pipeline(steps=[
            ("pre", pre),
            ("dense", to_dense),  # ensure dense for KNN/NB
            ("model", clf),
        ])
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        results.append({
            "algorithm": key,
            "metrics": {
                "accuracy": float(acc),
                "accuracy_percentage": float(acc * 100.0),
                "samples_test": int(len(y_test)),
            }
        })

    best = max(results, key=lambda r: r["metrics"]["accuracy"])
    return results, best["algorithm"]


def _evaluate_regression(df: pd.DataFrame, target: str):
    pre, to_dense, features, *_ = _build_preprocessor(df, target)
    X = df[features]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    models = {
        "linear_regression": LinearRegression(),
        "knn_regression": KNeighborsRegressor(n_neighbors=5),
        "support vector regression": SVR(kernel="rbf", C=1.0, epsilon=0.1),
    }

    results = []
    for key, reg in models.items():
        pipe = Pipeline(steps=[
            ("pre", pre),
            ("dense", to_dense),
            ("model", reg),
        ])
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)

        r2 = r2_score(y_test, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))

        results.append({
            "algorithm": key,
            "metrics": {
                "r2": float(r2),
                "rmse": rmse,
                # For UI badge; this is R²-as-% (clearly label in frontend text if needed)
                "accuracy_percentage": float(max(-100.0, min(100.0, r2 * 100.0))),
                "samples_test": int(len(y_test)),
            }
        })

    # pick best by r2
    best = max(results, key=lambda r: r["metrics"]["r2"])
    return results, best["algorithm"]

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
    
    # Auto-detect target column if not provided or not found
    if not target or target not in df.columns:
        # Look for common target column names
        possible_targets = ["value", "Salary", "Price", "Target", "Y", "y", "target"]
        for col in possible_targets:
            if col in df.columns:
                target = col
                break
        if not target:
            # Use last numeric column as target
            numeric_cols = df.select_dtypes(include=['number']).columns
            if len(numeric_cols) >= 1:
                target = numeric_cols[-1]  # Use last numeric column as target
    
    resp = {
        "dataset_id": unique_id,
        "filename": Path(orig).name,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "message": "Upload successful",
        "detected_target": target  # Add this for debugging
    }

    if target and target in df.columns:
        info = infer_target_type(df[target])
        resp["analysis"] = info
        
        if info["inferred"] == "classification":
            resp["label_preview"] = label_peek(df[target])
            resp["suggested_algorithms"] = ["id3", "naive_bayes", "knn_classification"]
            try:
                algos, best_alg = _evaluate_classification(df, target)
                resp["algorithm_comparison"] = {
                    "type": "classification",
                    "algorithms": algos
                }
                resp["best_algorithm"] = best_alg
            except Exception as e:
             resp["algorithm_comparison_error"] = f"Classification benchmarking failed: {e}"
        elif info["inferred"] == "regression":
            resp["suggested_algorithms"] = ["knn_regression","support vector regression", "linear_regression"]
            
            # Run algorithm comparison for regression datasets
            try:
                comparison_result = compare_regression_algorithms(
                    df, 
                    target_col=target,
                    test_size=0.2,
                    random_state=42
                )
                resp["algorithm_comparison"] = comparison_result
                
                # Find the best algorithm based on R² score
                if comparison_result and "algorithms" in comparison_result:
                    best_algo = max(
                        comparison_result["algorithms"], 
                        key=lambda x: x["metrics"]["r2_score"]
                    )
                    resp["best_algorithm"] = best_algo["algorithm"]
                    
            except Exception as e:
                # Don't fail upload if comparison fails
                print(f"Algorithm comparison failed: {e}")
                resp["algorithm_comparison_error"] = str(e)
        else:
            resp["suggested_algorithms"] = []

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
    
    # Add run_id and step_id to each step
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i
    
    return {
        "run_id": run_id,
        "algorithm": "linear_regression",
        "steps": result["steps"],
        "chart_data": result.get("chart_data", []),  # ← ADD THIS
        "metadata": result.get("metadata", {}),       # ← ADD THIS
        "summary": result.get("summary"),
    }

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


class NaiveBayesRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/naivebayes")
async def naive_bayes_route(req: NaiveBayesRequest = Body(...)):
    csv_path = find_dataset_path(req.dataset_id)
    df = read_tabular_file(csv_path)
    
    params = req.params or {}
    result = run_naive_bayes(df, params)
    
    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i
    
    return JSONResponse({
        "run_id": run_id,
        "algorithm": "naive_bayes",
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        "summary": result.get("summary"),
        "dataset_preview": result.get("dataset_preview"),
        "metadata": result.get("metadata"),
    })

# -----------------------------------------------------------
# KNN Classification Algorithm
# -----------------------------------------------------------
class KNNClassificationRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/knnclassification")
async def knn_classification_route(req: KNNClassificationRequest = Body(...)):
    csv_path = find_dataset_path(req.dataset_id)
    df = read_tabular_file(csv_path)
    
    params = req.params or {}
    result = run_knn_classification(df, params)
    
    run_id = uuid.uuid4().hex
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i
    
    return JSONResponse({
        "run_id": run_id,
        "algorithm": "knn",
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        "summary": result.get("summary"),
        "dataset_preview": result.get("dataset_preview"),
        "metadata": result.get("metadata"),
    })

# -----------------------------------------------------------
# Algorithm Comparison for Regression
# -----------------------------------------------------------
class AlgorithmComparisonRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None

@app.post("/compare-regression-algorithms")
async def compare_algorithms(req: AlgorithmComparisonRequest = Body(...)):
    """
    Compare all available regression algorithms and return accuracy metrics
    """
    try:
        csv_path = find_dataset_path(req.dataset_id)
        df = read_tabular_file(csv_path)
        
        params = req.params or {}
        feature_cols = params.get("features")
        target_col = params.get("target")
        test_size = params.get("test_size", 0.2)
        random_state = params.get("random_state", 42)
        
        result = compare_regression_algorithms(
            df, 
            feature_cols=feature_cols, 
            target_col=target_col,
            test_size=test_size,
            random_state=random_state
        )
        
        return JSONResponse({
            "dataset_id": req.dataset_id,
            "comparison_result": result,
            "timestamp": pd.Timestamp.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



class SVRRequest(BaseModel):
    dataset_id: str
    params: Optional[Dict[str, Any]] = None



@app.post("/supportvectorregression")
async def support_vector_regression(req: SVRRequest = Body(...)):
    """
    Runs Support Vector Regression on a dataset and returns
    a step-by-step breakdown of the conceptual calculations.
    """
    
    # 1. Find and read the dataset
    
    # Assign csv_path *before* the try block to ensure it's bound in the
    # FileNotFoundError except block.
    # We assume find_dataset_path will either return a string or
    # raise its own exception (which we'd catch below if it's not FileNotFoundError).
    try:
        csv_path = find_dataset_path(req.dataset_id)
    except Exception as e:
        # Handle cases where find_dataset_path itself fails
        raise HTTPException(status_code=404, detail=f"Failed to find dataset path for ID '{req.dataset_id}': {e}")
    
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        # This block is now safe because csv_path is guaranteed to be assigned.
        raise HTTPException(status_code=404, detail=f"Dataset with ID '{req.dataset_id}' not found at path: {csv_path}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset from path {csv_path}: {e}")

    # 2. Get parameters or use defaults
    params = req.params or {}

    # 3. Call the SVR function (from svr_calculator.py)
    try:
        result = run_svr(df, params)
    except Exception as e:
        # Catch errors from the calculation function
        raise HTTPException(status_code=500, detail=f"Error during SVR calculation: {e}")

    # 4. Generate a unique ID for this run
    run_id = uuid.uuid4().hex
    
    # 5. Inject run_id and step_id into each step for tracking
    for i, s in enumerate(result["steps"], start=1):
        s["run_id"] = run_id
        s["step_id"] = i

    # 6. Return the structured JSON response
    return JSONResponse({
        "run_id": run_id,
        "algorithm": "support_vector_regression",  # Set algorithm name
        "dataset_id": req.dataset_id,
        "steps": result["steps"],
        
        # Following your LR endpoint pattern.
        # run_svr() doesn't return a top-level 'summary' key,
        # so this will be None. The key data is in 'metadata'.
        "summary": result.get("summary"),
        
        "chart_data": result.get("chart_data"),
        "metadata": result.get("metadata"),
    })
