import pandas as pd
import numpy as np
from fastapi import HTTPException
from typing import Dict, List, Any

def euclidean_distance(point1, point2):
    """Calculate Euclidean distance between two points"""
    return np.sqrt(np.sum((np.array(point1) - np.array(point2)) ** 2))

def run_knn_regression(df, params):
    """
    K-Nearest Neighbors regression with step-by-step explanation
    """
    # Get parameters
    k = params.get("k", 3)
    feature_cols = params.get("features", [])
    target_col = params.get("target")
    test_point = params.get("test_point", {})
    
    # Auto-detect columns if not specified
    if not feature_cols:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if target_col in numeric_cols:
            numeric_cols.remove(target_col)
        feature_cols = numeric_cols[:2]  # Use first 2 numeric columns as features
    
    if not target_col:
        # Look for common target column names
        possible_targets = ["value", "Salary", "Price", "Target", "Y", "y"]
        for col in possible_targets:
            if col in df.columns:
                target_col = col
                break
        if not target_col:
            # Use last numeric column
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) > 0:
                target_col = numeric_cols[-1]
    
    if not feature_cols or not target_col:
        raise HTTPException(status_code=400, detail=f"Could not find suitable columns. Available: {list(df.columns)}")
    
    if target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found")
    
    for col in feature_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Feature column '{col}' not found")
    
    # Prepare data
    X = df[feature_cols].values
    y = df[target_col].values
    n_samples = len(X)
    
    # If no test point provided, use mean of features as test point
    if not test_point:
        test_point = {col: float(df[col].mean()) for col in feature_cols}
    
    # Ensure test point has all required features
    test_vector = []
    for col in feature_cols:
        if col not in test_point:
            test_point[col] = float(df[col].mean())
        test_vector.append(test_point[col])
    test_vector = np.array(test_vector)
    
    # Step 1: Calculate distances
    distances = []
    for i in range(n_samples):
        dist = euclidean_distance(X[i], test_vector)
        distances.append({
            "index": i,
            "point": {col: float(X[i][j]) for j, col in enumerate(feature_cols)},
            "target_value": float(y[i]),
            "distance": float(dist),
            "calculation": " + ".join([f"({test_vector[j]:.2f} - {X[i][j]:.2f})²" for j in range(len(feature_cols))])
        })
    
    # Step 2: Sort by distance and select K nearest neighbors
    distances.sort(key=lambda x: x["distance"])
    k_neighbors = distances[:k]
    
    # Step 3: Calculate prediction (average of K neighbors)
    neighbor_values = [neighbor["target_value"] for neighbor in k_neighbors]
    prediction = np.mean(neighbor_values)
    
    # Step 4: Calculate weights (inverse distance weighting)
    weighted_prediction = 0
    total_weight = 0
    weights = []
    
    for neighbor in k_neighbors:
        if neighbor["distance"] == 0:
            # If distance is 0, this point is identical - return its value
            weighted_prediction = neighbor["target_value"]
            total_weight = 1
            weights = [{"index": neighbor["index"], "weight": 1.0, "weighted_value": neighbor["target_value"]}]
            break
        else:
            weight = 1 / neighbor["distance"]
            weighted_value = weight * neighbor["target_value"]
            weighted_prediction += weighted_value
            total_weight += weight
            weights.append({
                "index": neighbor["index"],
                "weight": float(weight),
                "weighted_value": float(weighted_value)
            })
    
    if total_weight > 0:
        weighted_prediction = weighted_prediction / total_weight
    
    # Prepare chart data for visualization
    chart_data = []
    for i, (point, target) in enumerate(zip(X, y)):
        is_neighbor = i in [n["index"] for n in k_neighbors]
        chart_data.append({
            "index": i,
            feature_cols[0]: float(point[0]),
            feature_cols[1]: float(point[1]) if len(feature_cols) > 1 else 0,
            "target": float(target),
            "is_neighbor": is_neighbor,
            "distance": float(distances[i]["distance"]) if i < len(distances) else 0
        })
    
    # Add test point to chart data
    chart_data.append({
        "index": -1,
        feature_cols[0]: float(test_vector[0]),
        feature_cols[1]: float(test_vector[1]) if len(feature_cols) > 1 else 0,
        "target": float(prediction),
        "is_test_point": True,
        "distance": 0
    })
    
    return {
        "steps": [
            {
                "step_number": 1,
                "title": "Define Test Point and Features",
                "description": f"Test point: {test_point}, Features: {feature_cols}, Target: {target_col}",
                "formula": "Test point = (x₁, x₂, ...)",
                "test_point": test_point,
                "features": feature_cols,
                "target": target_col,
                "k": k,
                "dataset_size": n_samples
            },
            {
                "step_number": 2,
                "title": "Calculate Distances",
                "description": "Calculate Euclidean distance from test point to all training points",
                "formula": "d = √(Σ(xᵢ - yᵢ)²)",
                "distances": distances[:10],  # Show first 10 for brevity
                "total_distances": len(distances)
            },
            {
                "step_number": 3,
                "title": "Select K Nearest Neighbors",
                "description": f"Sort distances and select {k} nearest neighbors",
                "k_neighbors": k_neighbors,
                "k": k
            },
            {
                "step_number": 4,
                "title": "Simple Average Prediction",
                "description": "Calculate prediction as simple average of K neighbors",
                "formula": "ŷ = (1/k) × Σyᵢ",
                "calculation": f"ŷ = (1/{k}) × ({' + '.join([f'{v:.2f}' for v in neighbor_values])}) = {prediction:.3f}",
                "neighbor_values": neighbor_values,
                "prediction": float(prediction)
            },
            {
                "step_number": 5,
                "title": "Weighted Average Prediction",
                "description": "Calculate prediction using inverse distance weighting",
                "formula": "ŷ = Σ(wᵢ × yᵢ) / Σwᵢ, where wᵢ = 1/dᵢ",
                "weights": weights,
                "weighted_prediction": float(weighted_prediction),
                "total_weight": float(total_weight)
            },
            {
                "step_number": 6,
                "title": "Final Prediction",
                "description": "Compare simple vs weighted predictions",
                "simple_prediction": float(prediction),
                "weighted_prediction": float(weighted_prediction),
                "recommended": "weighted" if abs(weighted_prediction - prediction) > 0.01 else "simple",
                "summary": {
                    "test_point": test_point,
                    "k": k,
                    "simple_prediction": float(prediction),
                    "weighted_prediction": float(weighted_prediction),
                    "nearest_neighbors": len(k_neighbors)
                }
            }
        ],
        "chart_data": chart_data,
        "metadata": {
            "features": feature_cols,
            "target": target_col,
            "k": k,
            "test_point": test_point,
            "prediction": float(weighted_prediction),
            "n_samples": n_samples
        }
    }