import pandas as pd
import numpy as np
from collections import defaultdict
from fastapi import HTTPException
import uuid

def detect_feature_target_columns(df):
    """
    Auto-detect feature and target columns for classification
    """
    # Common target column names for classification
    target_candidates = ["class", "target", "label", "category", "type", "species", "outcome"]
    target_col = None
    
    for candidate in target_candidates:
        for col in df.columns:
            if candidate.lower() in col.lower():
                target_col = col
                break
        if target_col:
            break
    
    # If no obvious target found, use the last column
    if not target_col:
        target_col = df.columns[-1]
    
    # Feature columns are all columns except target
    feature_cols = [col for col in df.columns if col != target_col]
    
    return feature_cols, target_col

def run_naive_bayes(df, params):
    """
    Complete Naive Bayes implementation with step-by-step explanation
    """
    # Get parameters
    target_col = params.get("target")
    feature_cols = params.get("features")
    test_example = params.get("example", {})
    
    # Auto-detect columns if not provided
    if not feature_cols or not target_col:
        detected_features, detected_target = detect_feature_target_columns(df)
        feature_cols = feature_cols or detected_features
        target_col = target_col or detected_target
    
    if target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found")
    
    # Validate feature columns
    missing_features = [col for col in feature_cols if col not in df.columns]
    if missing_features:
        raise HTTPException(status_code=400, detail=f"Feature columns not found: {missing_features}")
    
    # Create default test example if not provided
    if not test_example:
        test_example = {}
        for col in feature_cols:
            # Use the most common value as default
            most_common = df[col].mode().iloc[0] if not df[col].mode().empty else df[col].iloc[0]
            test_example[col] = most_common
    
    # Get unique classes
    classes = df[target_col].unique()
    n_samples = len(df)
    
    # Step 1: Calculate Prior Probabilities
    class_counts = df[target_col].value_counts().to_dict()
    # Convert numpy integers to Python integers for JSON serialization
    class_counts = {k: int(v) for k, v in class_counts.items()}
    priors = {cls: count / n_samples for cls, count in class_counts.items()}
    
    # Step 2: Calculate Conditional Probabilities (Likelihoods)
    likelihoods = defaultdict(lambda: defaultdict(dict))
    
    for feature in feature_cols:
        for cls in classes:
            subset = df[df[target_col] == cls]
            feature_counts = subset[feature].value_counts().to_dict()
            total_class_samples = len(subset)
            
            # Calculate P(feature_value|class) for each unique value
            unique_values = df[feature].unique()
            for value in unique_values:
                count = feature_counts.get(value, 0)
                # Add Laplace smoothing to avoid zero probabilities
                probability = (count + 1) / (total_class_samples + len(unique_values))
                likelihoods[cls][feature][str(value)] = float(probability)
    
    # Step 3: Calculate Posterior Probabilities for Test Example
    posteriors = {}
    evidence_terms = {}
    
    for cls in classes:
        # Start with prior
        posterior = priors[cls]
        calculation_steps = [f"P({cls}) = {priors[cls]:.4f}"]
        
        # Multiply by likelihoods
        for feature, value in test_example.items():
            if feature in feature_cols:
                likelihood = likelihoods[cls][feature].get(str(value), 1e-6)
                posterior *= likelihood
                calculation_steps.append(f"P({feature}={value}|{cls}) = {likelihood:.4f}")
        
        evidence_terms[cls] = {
            "unnormalized_posterior": float(posterior),
            "calculation": " × ".join(calculation_steps),
            "steps": calculation_steps
        }
        posteriors[cls] = float(posterior)
    
    # Step 4: Normalize Posteriors
    evidence = sum(posteriors.values())
    if evidence == 0:
        evidence = 1e-10  # Prevent division by zero
    
    normalized_posteriors = {cls: float(prob / evidence) for cls, prob in posteriors.items()}
    
    # Step 5: Make Prediction
    predicted_class = max(normalized_posteriors, key=normalized_posteriors.get)
    confidence = float(normalized_posteriors[predicted_class])
    
    # Prepare dataset preview
    dataset_preview = df.head(10).to_dict(orient="records")
    
    return {
        "steps": [
            {
                "step_number": 1,
                "title": "Calculate Prior Probabilities",
                "description": "Calculate P(Class) for each class based on training data",
                "formula": "P(Class) = count(Class) / total_samples",
                "class_counts": class_counts,
                "priors": priors,
                "total_samples": n_samples
            },
            {
                "step_number": 2,
                "title": "Calculate Conditional Probabilities (Likelihoods)",
                "description": "Calculate P(Feature=value|Class) for each feature value and class",
                "formula": "P(Feature=value|Class) = (count(Feature=value, Class) + 1) / (count(Class) + unique_values)",
                "likelihoods": dict(likelihoods),
                "note": "Using Laplace smoothing (+1) to handle unseen feature values"
            },
            {
                "step_number": 3,
                "title": "Calculate Unnormalized Posteriors",
                "description": "For the test example, multiply prior by all likelihoods",
                "formula": "P(Class|X) ∝ P(Class) × ∏P(Feature_i|Class)",
                "test_example": test_example,
                "evidence_terms": evidence_terms,
                "unnormalized_posteriors": posteriors
            },
            {
                "step_number": 4,
                "title": "Normalize Posterior Probabilities",
                "description": "Divide each unnormalized posterior by the evidence (sum of all unnormalized posteriors)",
                "formula": "P(Class|X) = P(Class|X)_unnormalized / Evidence",
                "evidence": float(evidence),
                "normalized_posteriors": normalized_posteriors
            },
            {
                "step_number": 5,
                "title": "Make Final Prediction",
                "description": "Choose the class with the highest posterior probability",
                "predicted_class": predicted_class,
                "confidence": confidence,
                "all_probabilities": normalized_posteriors,
                "summary": {
                    "prediction": predicted_class,
                    "confidence": round(confidence * 100, 2),
                    "test_example": test_example
                }
            }
        ],
        "dataset_preview": dataset_preview,
        "summary": {
            "algorithm": "Naive Bayes",
            "prediction": predicted_class,
            "confidence": round(confidence * 100, 2),
            "features_used": feature_cols,
            "target_column": target_col,
            "classes": [str(cls) for cls in classes],
            "dataset_size": int(n_samples)
        },
        "metadata": {
            "features": feature_cols,
            "target": target_col,
            "test_example": test_example,
            "prediction": predicted_class,
            "confidence": confidence,
            "n_classes": int(len(classes)),
            "n_samples": int(n_samples)
        }
    }