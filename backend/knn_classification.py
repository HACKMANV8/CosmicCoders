import pandas as pd
import numpy as np
from fastapi import HTTPException
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import json

def run_knn_classification(df, params):
    """
    K-Nearest Neighbors Classification with step-by-step explanation
    """
    # Auto-detect columns
    target_col = params.get("target")
    feature_cols = params.get("features")
    k = int(params.get("k", 5))
    test_example = params.get("example", {})
    
    # Auto-detect target column if not provided
    if not target_col:
        possible_targets = ["class", "label", "target", "category", "species", "type", "outcome"]
        for col in possible_targets:
            if col in df.columns:
                target_col = col
                break
        if not target_col:
            # Use last column as target
            target_col = df.columns[-1]
    
    # Auto-detect feature columns if not provided
    if not feature_cols:
        feature_cols = [col for col in df.columns if col != target_col]
    
    if target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found. Available: {list(df.columns)}")
    
    # Prepare data
    X = df[feature_cols].copy()
    y = df[target_col].copy()
    
    # Handle missing values
    X = X.fillna(X.mean() if X.select_dtypes(include=[np.number]).shape[1] > 0 else X.mode().iloc[0])
    
    # Encode categorical features
    categorical_cols = X.select_dtypes(include=['object']).columns
    encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        encoders[col] = le
    
    # Encode target if categorical
    target_encoder = None
    if y.dtype == 'object':
        target_encoder = LabelEncoder()
        y = target_encoder.fit_transform(y)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train KNN model
    knn = KNeighborsClassifier(n_neighbors=k)
    knn.fit(X_train_scaled, y_train)
    
    # Get class names
    unique_classes = np.unique(y_train)
    if target_encoder:
        class_names = target_encoder.inverse_transform(unique_classes)
    else:
        class_names = unique_classes
    
    # Prepare test example
    if test_example:
        test_features = []
        for col in feature_cols:
            if col in test_example:
                value = test_example[col]
                if col in encoders:
                    try:
                        value = encoders[col].transform([str(value)])[0]
                    except ValueError:
                        # Handle unseen categorical value
                        value = 0
                test_features.append(float(value))
            else:
                test_features.append(X[col].mean())
        
        test_point = np.array(test_features).reshape(1, -1)
        test_point_scaled = scaler.transform(test_point)
        
        # Get k nearest neighbors
        distances, neighbor_indices = knn.kneighbors(test_point_scaled, n_neighbors=k)
        neighbor_classes = y_train[neighbor_indices[0]]
        
        # Make prediction
        prediction = knn.predict(test_point_scaled)[0]
        prediction_proba = knn.predict_proba(test_point_scaled)[0]
        
        if target_encoder:
            predicted_class = target_encoder.inverse_transform([prediction])[0]
            neighbor_class_names = target_encoder.inverse_transform(neighbor_classes)
        else:
            predicted_class = prediction
            neighbor_class_names = neighbor_classes
        
    else:
        # Use first test example if no example provided
        test_point_scaled = X_test_scaled[0:1]
        test_features = X_test.iloc[0].values
        distances, neighbor_indices = knn.kneighbors(test_point_scaled, n_neighbors=k)
        neighbor_classes = y_train[neighbor_indices[0]]
        prediction = knn.predict(test_point_scaled)[0]
        prediction_proba = knn.predict_proba(test_point_scaled)[0]
        
        if target_encoder:
            predicted_class = target_encoder.inverse_transform([prediction])[0]
            neighbor_class_names = target_encoder.inverse_transform(neighbor_classes)
        else:
            predicted_class = prediction
            neighbor_class_names = neighbor_classes
        
        # Create test example dict
        test_example = {col: float(val) for col, val in zip(feature_cols, test_features)}
    
    # Calculate overall accuracy
    y_pred = knn.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    
    # Prepare neighbor details
    neighbor_details = []
    for i, (dist, cls) in enumerate(zip(distances[0], neighbor_class_names)):
        neighbor_details.append({
            "neighbor": i + 1,
            "distance": float(dist),
            "class": str(cls),
            "index": int(neighbor_indices[0][i])
        })
    
    # Count votes
    unique_neighbor_classes, counts = np.unique(neighbor_class_names, return_counts=True)
    vote_counts = {str(cls): int(count) for cls, count in zip(unique_neighbor_classes, counts)}
    
    # Create probability distribution
    class_probabilities = {}
    for i, cls in enumerate(class_names):
        class_probabilities[str(cls)] = float(prediction_proba[i])
    
    steps = [
        {
            "step_number": 1,
            "title": "Algorithm Overview",
            "description": f"K-Nearest Neighbors classifies data points based on the class of their {k} nearest neighbors.",
            "k_value": k,
            "total_features": len(feature_cols),
            "feature_names": feature_cols,
            "total_classes": len(class_names),
            "class_names": [str(cls) for cls in class_names],
            "dataset_size": len(df),
            "train_size": len(X_train),
            "test_size": len(X_test)
        },
        {
            "step_number": 2,
            "title": "Data Preprocessing",
            "description": "Prepare the data by handling missing values, encoding categorical variables, and scaling features.",
            "preprocessing_steps": [
                f"Selected features: {', '.join(feature_cols)}",
                f"Target variable: {target_col}",
                f"Encoded {len(categorical_cols)} categorical features" if categorical_cols.any() else "No categorical features to encode",
                "Applied standardization to scale features",
                "Split data into 80% training and 20% testing"
            ],
            "scaling_info": {
                "method": "StandardScaler (mean=0, std=1)",
                "reason": "KNN is distance-based and sensitive to feature scales"
            }
        },
        {
            "step_number": 3,
            "title": "Test Example",
            "description": "The data point we want to classify using KNN.",
            "test_example": test_example,
            "scaled_features": [float(x) for x in test_point_scaled[0]]
        },
        {
            "step_number": 4,
            "title": "Find K Nearest Neighbors",
            "description": f"Calculate distances to all training points and find the {k} closest neighbors.",
            "k_value": k,
            "distance_metric": "Euclidean Distance",
            "formula": "√Σ(xᵢ - yᵢ)²",
            "neighbors": neighbor_details
        },
        {
            "step_number": 5,
            "title": "Vote Counting",
            "description": "Count the class votes from the k nearest neighbors.",
            "vote_counts": vote_counts,
            "total_votes": k,
            "majority_class": str(predicted_class),
            "vote_breakdown": [
                {
                    "class": cls,
                    "votes": vote_counts.get(str(cls), 0),
                    "percentage": round((vote_counts.get(str(cls), 0) / k) * 100, 1)
                }
                for cls in class_names
            ]
        },
        {
            "step_number": 6,
            "title": "Final Prediction",
            "description": "The class with the most votes becomes the prediction.",
            "predicted_class": str(predicted_class),
            "confidence": float(max(prediction_proba)),
            "all_probabilities": class_probabilities,
            "model_accuracy": float(accuracy),
            "interpretation": f"Based on the {k} nearest neighbors, the predicted class is '{predicted_class}' with {vote_counts.get(str(predicted_class), 0)} out of {k} votes."
        }
    ]
    
    # Create dataset preview
    dataset_preview = df.head(10).to_dict('records')
    for record in dataset_preview:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = "N/A"
            elif isinstance(value, (np.integer, np.floating)):
                record[key] = float(value)
            else:
                record[key] = str(value)
    
    return {
        "steps": steps,
        "dataset_preview": dataset_preview,
        "summary": {
            "algorithm": "K-Nearest Neighbors",
            "prediction": str(predicted_class),
            "confidence": f"{max(prediction_proba)*100:.1f}",
            "k_value": k,
            "accuracy": f"{accuracy*100:.1f}",
            "dataset_size": len(df),
            "features_used": feature_cols,
            "classes": [str(cls) for cls in class_names]
        },
        "metadata": {
            "target_column": target_col,
            "feature_columns": feature_cols,
            "k_value": k,
            "accuracy": float(accuracy),
            "class_names": [str(cls) for cls in class_names]
        }
    }