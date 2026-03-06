"""
ml_model.py
-----------
Random Forest regressor.
v2: Handles 11-variable WorldState.
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from typing import Tuple, Dict

from src.world_state import WorldState, FEATURE_NAMES, POLICY_INDEX

MODEL_PATH    = "models/population_model.pkl"
CENTROID_PATH = "models/training_centroid.pkl"


def train(X: np.ndarray, y: np.ndarray) -> RandomForestRegressor:
    os.makedirs("models", exist_ok=True)
    model = RandomForestRegressor(
        n_estimators=150, max_depth=12, min_samples_leaf=4, n_jobs=-1, random_state=42
    )
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    centroid = X.mean(axis=0)
    std      = X.std(axis=0) + 1e-8
    joblib.dump({"centroid": centroid, "std": std}, CENTROID_PATH)
    return model


def evaluate(model: RandomForestRegressor, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
    y_pred = model.predict(X_test)
    return {
        "r2":   round(r2_score(y_test, y_pred), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 2),
    }


def load_model() -> Tuple[RandomForestRegressor, Dict]:
    model, centroid_data = None, {}
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    if os.path.exists(CENTROID_PATH):
        centroid_data = joblib.load(CENTROID_PATH)
    return model, centroid_data


def _ood_confidence(x: np.ndarray, centroid_data: Dict) -> str:
    if not centroid_data: return "UNKNOWN"
    dist = float(np.linalg.norm((x - centroid_data["centroid"]) / centroid_data["std"]))
    if dist < 2.5: return "HIGH"
    elif dist < 4.5: return "MEDIUM"
    else: return "LOW"


def predict_and_explain(
    model: RandomForestRegressor,
    centroid_data: Dict,
    state: WorldState,
    policy: str,
) -> Tuple[int, Dict[str, float], str]:
    x = state.as_feature_vector(policy).reshape(1, -1)
    predicted_delta = int(model.predict(x)[0])
    importances_raw = model.feature_importances_

    importances = {
        FEATURE_NAMES[i]: round(float(importances_raw[i]), 4)
        for i in range(len(FEATURE_NAMES))
    }
    importances = dict(sorted(importances.items(), key=lambda kv: kv[1], reverse=True))
    confidence = _ood_confidence(x[0], centroid_data)

    return predicted_delta, importances, confidence
