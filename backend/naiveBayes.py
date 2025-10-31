from fastapi import APIRouter, HTTPException
import pandas as pd
import numpy as np
import os

router = APIRouter()

@router.post("/calculation")
def naive_bayes_calculation(request: dict):
    try:
        dataset_id = request.get("dataset_id")
        algorithm = request.get("algorithm")
        params = request.get("params", {})
        target_col = params.get("target")
        example = params.get("example", {})

        # ✅ Ensure algorithm is Naive Bayes
        if algorithm.lower() != "naive_bayes":
            raise HTTPException(status_code=400, detail="Algorithm not supported in this route")

        # ✅ Load dataset dynamically
        dataset_path = f"datasets/{dataset_id}.csv"
        if not os.path.exists(dataset_path):
            raise HTTPException(status_code=404, detail="Dataset not found")

        df = pd.read_csv(dataset_path)
        if target_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found in dataset")

        # ✅ Separate features and target
        X = df.drop(columns=[target_col])
        y = df[target_col]
        classes = y.unique()

        # --- STEP 1: PRIOR PROBABILITIES ---
        priors = {}
        total = len(y)
        for c in classes:
            priors[c] = round(len(y[y == c]) / total, 4)

        # --- STEP 2: CONDITIONAL PROBABILITIES ---
        likelihoods = {}
        for c in classes:
            subset = df[df[target_col] == c]
            likelihoods[c] = {}
            for feature in X.columns:
                val = example.get(feature)
                if val not in subset[feature].value_counts():
                    # Laplace smoothing if unseen value
                    prob = 1 / (len(subset) + len(subset[feature].unique()))
                else:
                    prob = subset[feature].value_counts()[val] / len(subset)
                likelihoods[c][feature] = round(prob, 4)

        # --- STEP 3: POSTERIOR PROBABILITIES ---
        posteriors = {}
        for c in classes:
            post_prob = priors[c]
            for feature, prob in likelihoods[c].items():
                post_prob *= prob
            posteriors[c] = post_prob

        # Normalize for comparison
        total_post = sum(posteriors.values())
        for c in posteriors:
            posteriors[c] = round(posteriors[c] / total_post, 6)

        # --- STEP 4: PREDICTION ---
        predicted = max(posteriors, key=posteriors.get)

        # ✅ Construct the response
        response = {
            "dataset": df.head(5).to_dict(orient="records"),
            "steps": {
                "priors": priors,
                "likelihoods": likelihoods,
                "posteriors": posteriors,
                "predicted": predicted
            }
        }
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
