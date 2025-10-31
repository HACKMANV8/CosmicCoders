# backend/routers/naivebayes.py
import pandas as pd
from collections import defaultdict
from fastapi import APIRouter, Request, HTTPException
from utils.helpers import find_dataset_path, read_tabular_file

router = APIRouter()

@router.post("/naivebayes")
async def naive_bayes(request: Request):
    body = await request.json()
    dataset_id = body.get("dataset_id")
    params = body.get("params", {})
    target = params.get("target")
    example = params.get("example", {})

    # --- Validation ---
    if not dataset_id:
        raise HTTPException(status_code=400, detail="dataset_id is required")
    if not target:
        raise HTTPException(status_code=400, detail="params.target is required")

    # --- Load dataset ---
    try:
        csv_path = find_dataset_path(dataset_id)
        df = read_tabular_file(csv_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading dataset: {str(e)}")

    if target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target}' not found in dataset")

    dataset_preview = df.head(5).to_dict(orient="records")

    # --- Step 1: Priors ---
    priors = df[target].value_counts(normalize=True).to_dict()
    step1 = {
        "step": 1,
        "title": "Compute Prior Probabilities",
        "result": {"priors": priors},
        "description": "Calculate P(Class) = count(Class)/N"
    }

    # --- Step 2: Conditional Probabilities ---
    likelihoods = defaultdict(dict)
    for feature in df.columns:
        if feature == target:
            continue
        for cls in df[target].unique():
            subset = df[df[target] == cls]
            probs = subset[feature].value_counts(normalize=True).to_dict()
            # Ensure all features have at least an empty dict for uniform access
            likelihoods[cls][feature] = probs

    step2 = {
        "step": 2,
        "title": "Compute Conditional Probabilities",
        "result": {"details": likelihoods},
        "description": "For each class and feature, compute P(Feature|Class)"
    }

    # --- Step 3: Compute Unnormalized Posteriors ---
    per_class = {}
    for cls in df[target].unique():
        prior = priors[cls]
        prob = prior
        multipliers = []
        for feature, value in example.items():
            cond_probs = likelihoods[cls].get(feature, {})
            p = cond_probs.get(value, 1e-6)  # Laplace smoothing
            prob *= p
            multipliers.append({"feature": feature, "value": value, "p": round(p, 6)})
        per_class[cls] = {
            "unnormalized": round(prob, 8),
            "multipliers": multipliers
        }

    step3 = {
        "step": 3,
        "title": "Calculate Unnormalized Posterior",
        "result": {"per_class": per_class},
        "description": "Multiply priors and conditionals for each class"
    }

    # --- Step 4: Normalize ---
    total = sum(v["unnormalized"] for v in per_class.values())
    if total == 0:
        raise HTTPException(status_code=400, detail="Total probability is zero — check dataset or example values.")

    posteriors = {cls: round(v["unnormalized"] / total, 8) for cls, v in per_class.items()}
    step4 = {
        "step": 4,
        "title": "Normalize to Get Posterior Probabilities",
        "vars": {"evidence": round(total, 8)},
        "result": {"posteriors": posteriors},
        "description": "Normalize so all class probabilities sum to 1"
    }

    # --- Step 5: Final Prediction ---
    predicted = max(posteriors, key=posteriors.get)
    confidence = posteriors[predicted]
    step5 = {
        "step": 5,
        "title": "Make Final Prediction",
        "result": {"predicted": predicted, "confidence": round(confidence, 8)},
        "description": "Choose the class with the highest posterior probability"
    }

    # --- Final Response ---
    return {
        "dataset_preview": dataset_preview,
        "steps": [step1, step2, step3, step4, step5]
    }
