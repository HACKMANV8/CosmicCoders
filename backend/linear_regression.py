import pandas as pd
import numpy as np
from fastapi import HTTPException

def run_linear_regression(df, params):
    """
    Linear regression for any dataset with automatic column detection
    """
    # Try to detect appropriate columns
    feature_col = params.get("feature")
    target_col = params.get("target")
    
    # Auto-detect if not specified
    if not feature_col:
        # Look for common feature column names
        possible_features = ["YearsExperience", "Experience", "Years", "X", "x"]
        for col in possible_features:
            if col in df.columns:
                feature_col = col
                break
        if not feature_col:
            # Use first numeric column
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) >= 2:
                feature_col = numeric_cols[0]
    
    if not target_col:
        # Look for common target column names  
        possible_targets = ["value", "Salary", "Price", "Target", "Y", "y"]
        for col in possible_targets:
            if col in df.columns:
                target_col = col
                break
        if not target_col:
            # Use second numeric column or last column
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) >= 2:
                target_col = numeric_cols[1]
            elif len(numeric_cols) == 1:
                target_col = numeric_cols[0]
    
    if not feature_col or not target_col:
        raise HTTPException(status_code=400, detail=f"Could not find suitable columns. Available columns: {list(df.columns)}")
    
    if feature_col not in df.columns or target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Columns {feature_col} or {target_col} not found in dataset. Available: {list(df.columns)}")

    x = df[feature_col].values
    y = df[target_col].values
    n = len(x)

    # Step 1: Calculate means
    x_mean = np.mean(x)
    y_mean = np.mean(y)

    # Step 2: Calculate slope (m) and intercept (c)
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    
    if denominator == 0:
        raise HTTPException(status_code=400, detail="Cannot calculate slope: denominator is zero")
    
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean

    # Step 3: Make predictions
    y_pred = slope * x + intercept

    # Step 4: Calculate R-squared
    ss_total = np.sum((y - y_mean) ** 2)
    ss_res = np.sum((y - y_pred) ** 2)
    r2 = 1 - (ss_res / ss_total) if ss_total != 0 else 0

    # Step 5: Calculate some sample predictions for display
    sample_indices = [0, 5, 10, 15, 20]  # Show 5 sample predictions
    sample_x = [x[i] for i in sample_indices if i < len(x)]
    sample_y_actual = [y[i] for i in sample_indices if i < len(y)]
    sample_y_pred = [y_pred[i] for i in sample_indices if i < len(y_pred)]

    return {
        "steps": [
            {
                "step_number": 1,
                "title": "Calculate Means",
                "description": f"Calculate mean of X ({feature_col}) and Y ({target_col})",
                "formula": "x̄ = Σx/n, ȳ = Σy/n",
                "calculation": f"x̄ = {x_mean:.3f}, ȳ = {y_mean:.3f}",
                "x_mean": float(x_mean),
                "y_mean": float(y_mean),
                "n": n
            },
            {
                "step_number": 2,
                "title": "Calculate Slope (m)",
                "description": "Calculate the slope of the regression line",
                "formula": "m = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²",
                "calculation": f"m = {numerator:.3f} / {denominator:.3f} = {slope:.3f}",
                "numerator": float(numerator),
                "denominator": float(denominator),
                "slope": float(slope)
            },
            {
                "step_number": 3,
                "title": "Calculate Intercept (c)",
                "description": "Calculate the y-intercept of the regression line",
                "formula": "c = ȳ - m×x̄",
                "calculation": f"c = {y_mean:.3f} - {slope:.3f}×{x_mean:.3f} = {intercept:.3f}",
                "intercept": float(intercept)
            },
            {
                "step_number": 4,
                "title": "Regression Equation",
                "description": "The final linear regression equation",
                "formula": "y = mx + c",
                "equation": f"{target_col} = {slope:.3f} × {feature_col} + {intercept:.3f}",
                "slope": float(slope),
                "intercept": float(intercept)
            },
            {
                "step_number": 5,
                "title": "Sample Predictions",
                "description": "Predictions for sample data points",
                "sample_data": [
                    {
                        "x": float(sample_x[i]),
                        "y_actual": float(sample_y_actual[i]),
                        "y_predicted": float(sample_y_pred[i]),
                        "calculation": f"{slope:.3f} × {sample_x[i]:.1f} + {intercept:.3f} = {sample_y_pred[i]:.0f}"
                    }
                    for i in range(min(5, len(sample_x)))
                ]
            },
            {
                "step_number": 6,
                "title": "Model Performance (R²)",
                "description": "Coefficient of determination (R-squared)",
                "formula": "R² = 1 - (SS_res / SS_tot)",
                "calculation": f"R² = 1 - ({ss_res:.3f} / {ss_total:.3f}) = {r2:.3f}",
                "r2_score": float(r2),
                "interpretation": f"The model explains {r2*100:.1f}% of the variance in {target_col}",
                "summary": {
                    "equation": f"{target_col} = {slope:.3f} × {feature_col} + {intercept:.3f}",
                    "slope": float(slope),
                    "intercept": float(intercept),
                    "r2_score": float(r2),
                    "dataset_size": n
                }
            }
        ]
    }