import pandas as pd
import numpy as np
from fastapi import HTTPException
from sklearn.svm import SVR as SklearnSVR
from sklearn.metrics import r2_score
from sklearn.preprocessing import StandardScaler

def run_svr(df, params):
    """
    Support Vector Regression (Linear) with auto column detection
    and step-by-step explanation.
    """
    # --- 1) Auto-detect columns ---
    feature_col = params.get("feature")
    target_col = params.get("target")

    if not feature_col:
        for col in ["YearsExperience", "Experience", "Years", "X", "x"]:
            if col in df.columns:
                feature_col = col
                break
        if not feature_col:
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) >= 2:
                feature_col = numeric_cols[0]

    if not target_col:
        for col in ["value", "Salary", "Price", "Target", "Y", "y"]:
            if col in df.columns:
                target_col = col
                break
        if not target_col:
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) >= 2:
                target_col = numeric_cols[1]
            elif len(numeric_cols) == 1:
                target_col = numeric_cols[0]

    if not feature_col or not target_col:
        raise HTTPException(status_code=400, detail=f"Could not find suitable SVR columns. Available: {list(df.columns)}")
    if feature_col not in df.columns or target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Columns {feature_col} or {target_col} not found. Available: {list(df.columns)}")

    # --- 2) Data + hyperparams ---
    epsilon = float(params.get("epsilon", 0.1))
    C = float(params.get("C", 1.0))

    x = df[feature_col].values
    y = df[target_col].values
    n = len(x)

    scaler_x = StandardScaler()
    scaler_y = StandardScaler()
    X_scaled = scaler_x.fit_transform(x.reshape(-1, 1))
    y_scaled = scaler_y.fit_transform(y.reshape(-1, 1)).ravel()

    # --- 3) Fit SVR (linear kernel) ---
    model = SklearnSVR(kernel="linear", C=C, epsilon=epsilon)
    try:
        model.fit(X_scaled, y_scaled)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during SVR model fitting: {e}")

    # --- 4) Unscale parameters ---
    # coef_ is (1, n_features) for linear kernel
    scaled_slope = float(model.coef_.ravel()[0])
    scaled_intercept = float(model.intercept_.ravel()[0])

    x_std = float(scaler_x.scale_[0])
    x_mean = float(scaler_x.mean_[0])
    y_std = float(scaler_y.scale_[0])
    y_mean = float(scaler_y.mean_[0])

    slope = (scaled_slope * y_std) / x_std
    intercept = scaled_intercept * y_std + y_mean - slope * x_mean

    # --- 5) Predictions (original scale) + boundaries ---
    y_pred = slope * x + intercept
    support_indices = model.support_
    r2 = float(r2_score(y, y_pred))

    unscaled_epsilon = float(epsilon * y_std)

    chart_data = []
    support_indices_set = set(map(int, support_indices))
    for i in range(n):
        pred_i = float(y_pred[i])
        chart_data.append({
            "x": float(x[i]),
            "y_actual": float(y[i]),
            "y_predicted": pred_i,
            "upper_boundary": pred_i + unscaled_epsilon,
            "lower_boundary": pred_i - unscaled_epsilon,
            "is_support_vector": i in support_indices_set,
            "index": int(i),
        })

    step3_calc = (
        
        f"w (slope) = {slope:.4f}\n"
        f"b (intercept) = {intercept:.4f}\n"
        f"ε (unscaled) = ±{unscaled_epsilon:.4f}\n"
        f"support vectors = {len(support_indices)} of {n}\n"
        f"C = {C:g}, R² = {r2:.4f}"
    )

    steps = [
        {
            "step_number": 1,
            "title": "Set Hyperparameters (ε and C)",
            "description": "SVR is controlled by two main parameters: Epsilon (ε) and C.",
            "formula": "ε = Width of 'insensitivity tube'. C = Penalty for errors.",
            "calculation": (
                f"Using ε = {epsilon:.3f} (scaled), C = {C:.3f}. "
                f"The unscaled tube width is ±{unscaled_epsilon:.3f} from the regression line."
            ),
            "epsilon": epsilon,
            "C": C,
            "unscaled_epsilon": unscaled_epsilon,
        },
        {
            "step_number": 2,
            "title": "Data Scaling (Standardization)",
            "description": "SVR is sensitive to the scale of data. We scale both X and Y before training.",
            "formula": "z = (x - μ) / σ",
            "calculation": (
                f"X Mean (μ_x) = {x_mean:.3f}, X Std (σ_x) = {x_std:.3f}\n"
                f"Y Mean (μ_y) = {y_mean:.3f}, Y Std (σ_y) = {y_std:.3f}"
            ),
        },
        {
            "step_number": 3,
            "title": "Find Optimal Line (Optimization)",
            "description": (
                "An algorithm (Quadratic Programming) finds the slope (w) and intercept (b) "
                "that create the 'flattest' tube while minimizing errors."
            ),
            "formula": "Minimize: ½||w||² + CΣ(ξᵢ + ξᵢ*)",
            "calculation": step3_calc,  # <-- fixed here
        },
        {
            "step_number": 4,
            "title": "Calculated Slope (w)",
            "description": "Unscaled slope (w) on original data.",
            "formula": "w = (w_scaled * σ_y) / σ_x",
            "calculation": f"w = ({scaled_slope:.3f} * {y_std:.3f}) / {x_std:.3f} = {slope:.3f}",
            "slope": float(slope),
        },
        {
            "step_number": 5,
            "title": "Calculated Intercept (b)",
            "description": "Unscaled intercept (b) on original data.",
            "formula": "b = b_scaled*σ_y + μ_y - w*μ_x",
            "calculation": (
                f"b = {scaled_intercept:.3f}*{y_std:.3f} + {y_mean:.3f} "
                f"- {slope:.3f}*{x_mean:.3f} = {intercept:.3f}"
            ),
            "intercept": float(intercept),
        },
        {
            "step_number": 6,
            "title": "Final SVR Equation",
            "description": f"The tube is ±{unscaled_epsilon:.3f} around this line.",
            "formula": "y = wx + b",
            "equation": f"{target_col} = {slope:.3f} × {feature_col} + {intercept:.3f}",
            "slope": float(slope),
            "intercept": float(intercept),
        },
        {
            "step_number": 7,
            "title": "Identify Support Vectors",
            "description": "Points on/ outside the ε-tube; they define the model.",
            "formula": "|yᵢ - (wxᵢ + b)| ≥ ε",
            "calculation": f"Found {len(support_indices)} support vectors out of {n} total points.",
            "support_vector_count": len(support_indices),
            "total_points": n,
        },
        {
            "step_number": 8,
            "title": "Model Performance (R²)",
            "description": "Coefficient of determination.",
            "formula": "R² = 1 - (SS_res / SS_tot)",
            "calculation": f"R² = {r2:.3f}",
            "r2_score": r2,
            "interpretation": f"The model explains {r2*100:.1f}% of the variance in {target_col}",
        },
    ]

    return {
        "steps": steps,
        "chart_data": chart_data,
        "metadata": {
            "feature_column": feature_col,
            "target_column": target_col,
            "equation": f"{target_col} = {slope:.3f} × {feature_col} + {intercept:.3f}",
            "slope": float(slope),
            "intercept": float(intercept),
            "r2_score": r2,
            "epsilon": float(epsilon),
            "C": float(C),
            "unscaled_epsilon": unscaled_epsilon,
            "support_vector_count": len(support_indices),
        },
    }
