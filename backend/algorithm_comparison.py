import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.linear_model import LinearRegression
from sklearn.neighbors import KNeighborsRegressor
import traceback

def detect_feature_target_columns(df):
    """
    Auto-detect feature and target columns for regression
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    # Common target column names
    target_candidates = ["value", "price", "salary", "target", "y", "output", "result"]
    target_col = None
    
    for candidate in target_candidates:
        for col in df.columns:
            if candidate.lower() in col.lower():
                target_col = col
                break
        if target_col:
            break
    
    if not target_col and len(numeric_cols) > 0:
        # Use the last numeric column as target
        target_col = numeric_cols[-1]
    
    # Feature columns are all numeric columns except target
    feature_cols = [col for col in numeric_cols if col != target_col]
    
    return feature_cols, target_col

def calculate_regression_metrics(y_true, y_pred):
    """
    Calculate comprehensive regression metrics
    """
    try:
        r2 = r2_score(y_true, y_pred)
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)
        
        # Calculate percentage accuracy (100 - MAPE)
        mape = np.mean(np.abs((y_true - y_pred) / np.where(y_true != 0, y_true, 1))) * 100
        accuracy = max(0, 100 - mape)
        
        return {
            "r2_score": float(r2),
            "mse": float(mse),
            "rmse": float(rmse),
            "mae": float(mae),
            "mape": float(mape),
            "accuracy_percentage": float(accuracy)
        }
    except Exception as e:
        return {
            "r2_score": 0.0,
            "mse": float('inf'),
            "rmse": float('inf'),
            "mae": float('inf'),
            "mape": 100.0,
            "accuracy_percentage": 0.0,
            "error": str(e)
        }

def run_linear_regression_comparison(X_train, X_test, y_train, y_test):
    """
    Run Linear Regression and return metrics
    """
    try:
        model = LinearRegression()
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        metrics = calculate_regression_metrics(y_test, y_pred)
        
        return {
            "algorithm": "Linear Regression",
            "status": "success",
            "metrics": metrics,
            "model_params": {
                "slope": float(model.coef_[0]) if len(model.coef_) == 1 else model.coef_.tolist(),
                "intercept": float(model.intercept_)
            }
        }
    except Exception as e:
        return {
            "algorithm": "Linear Regression",
            "status": "error",
            "error": str(e),
            "metrics": calculate_regression_metrics([], [])
        }

def run_knn_regression_comparison(X_train, X_test, y_train, y_test, k=5):
    """
    Run KNN Regression with different k values and return best metrics
    """
    try:
        best_k = k
        best_score = -float('inf')
        best_metrics = None
        
        # Try different k values
        k_values = [3, 5, 7, 9, 11]
        
        for k_val in k_values:
            if k_val >= len(X_train):
                continue
                
            model = KNeighborsRegressor(n_neighbors=k_val)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            
            metrics = calculate_regression_metrics(y_test, y_pred)
            
            if metrics["r2_score"] > best_score:
                best_score = metrics["r2_score"]
                best_k = k_val
                best_metrics = metrics
        
        return {
            "algorithm": "KNN Regression",
            "status": "success",
            "metrics": best_metrics or calculate_regression_metrics([], []),
            "model_params": {
                "best_k": best_k,
                "k_values_tested": k_values
            }
        }
    except Exception as e:
        return {
            "algorithm": "KNN Regression",
            "status": "error",
            "error": str(e),
            "metrics": calculate_regression_metrics([], [])
        }

def compare_regression_algorithms(df, feature_cols=None, target_col=None, test_size=0.2, random_state=42):
    """
    Compare all available regression algorithms and return results with rankings
    """
    try:
        # Auto-detect columns if not provided
        if not feature_cols or not target_col:
            detected_features, detected_target = detect_feature_target_columns(df)
            feature_cols = feature_cols or detected_features
            target_col = target_col or detected_target
        
        if not feature_cols or not target_col:
            raise ValueError("Could not detect suitable feature and target columns")
        
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found in dataset")
        
        missing_features = [col for col in feature_cols if col not in df.columns]
        if missing_features:
            raise ValueError(f"Feature columns not found: {missing_features}")
        
        # Prepare data
        X = df[feature_cols].copy()
        y = df[target_col].copy()
        
        # Handle missing values
        X = X.fillna(X.mean())
        y = y.fillna(y.mean())
        
        # Split data
        if len(X) < 10:
            raise ValueError("Dataset too small for reliable comparison (minimum 10 samples required)")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )
        
        # Run algorithms
        results = []
        
        # Linear Regression
        lr_result = run_linear_regression_comparison(X_train, X_test, y_train, y_test)
        results.append(lr_result)
        
        # KNN Regression
        knn_result = run_knn_regression_comparison(X_train, X_test, y_train, y_test)
        results.append(knn_result)
        
        # Sort by R² score (descending)
        successful_results = [r for r in results if r["status"] == "success"]
        successful_results.sort(key=lambda x: x["metrics"]["r2_score"], reverse=True)
        
        # Add rankings
        for i, result in enumerate(successful_results):
            result["rank"] = i + 1
            result["is_best"] = i == 0
        
        # Add failed results at the end
        failed_results = [r for r in results if r["status"] == "error"]
        for result in failed_results:
            result["rank"] = len(successful_results) + 1
            result["is_best"] = False
        
        all_results = successful_results + failed_results
        
        return {
            "status": "success",
            "dataset_info": {
                "total_samples": len(df),
                "features": feature_cols,
                "target": target_col,
                "train_samples": len(X_train),
                "test_samples": len(X_test)
            },
            "algorithms": all_results,
            "best_algorithm": successful_results[0]["algorithm"] if successful_results else None,
            "summary": {
                "total_algorithms": len(results),
                "successful_algorithms": len(successful_results),
                "failed_algorithms": len(failed_results)
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
            "algorithms": [],
            "best_algorithm": None
        }