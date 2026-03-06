"""
ml_model.py
-----------
Random Forest regressor for predicting annual population change.

Responsibilities:
  - Train and persist the model
  - Load for inference
  - Predict delta_population given (state, policy)
  - Extract feature importances for the Explainability Engine
  - Flag out-of-distribution (OOD) inputs (Novel Feature #3)
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from typing import Tuple, Dict

from src.world_state import WorldState, FEATURE_NAMES, POLICY_INDEX

MODEL_PATH    = "models/population_model.pkl"
CENTROID_PATH = "models/training_centroid.pkl"   # for OOD detection


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(X: np.ndarray, y: np.ndarray) -> RandomForestRegressor:
    """
    Fit the RandomForestRegressor on the provided feature matrix / targets.
    Saves the trained model and training centroid to disk.
    """
    os.makedirs("models", exist_ok=True)

    model = RandomForestRegressor(
        n_estimators   = 150,
        max_depth      = 10,
        min_samples_leaf = 5,
        n_jobs         = -1,
        random_state   = 42,
    )
    model.fit(X, y)

    # Persist model
    joblib.dump(model, MODEL_PATH)

    # Persist centroid for OOD detection
    centroid = X.mean(axis=0)
    std      = X.std(axis=0) + 1e-8          # avoid div-by-zero
    joblib.dump({"centroid": centroid, "std": std}, CENTROID_PATH)

    return model


def evaluate(model: RandomForestRegressor, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
    """Return evaluation metrics on a held-out test split."""
    y_pred = model.predict(X_test)
    return {
        "r2":   round(r2_score(y_test, y_pred), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 2),
    }


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def load_model() -> Tuple[RandomForestRegressor, Dict]:
    """Load persisted model + centroid stats. Returns (None, {}) if not found."""
    model    = None
    centroid_data = {}
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    if os.path.exists(CENTROID_PATH):
        centroid_data = joblib.load(CENTROID_PATH)
    return model, centroid_data


def _ood_confidence(x: np.ndarray, centroid_data: Dict) -> str:
    """
    Approximate OOD detection via normalised Euclidean distance from the
    training centroid.

    Returns 'HIGH', 'MEDIUM', or 'LOW' confidence label.
    (Novel Feature #3 — Model Confidence Warning)
    """
    if not centroid_data:
        return "UNKNOWN"
    centroid = centroid_data["centroid"]
    std      = centroid_data["std"]
    dist     = float(np.linalg.norm((x - centroid) / std))

    if dist < 2.0:
        return "HIGH"
    elif dist < 4.0:
        return "MEDIUM"
    else:
        return "LOW"


def predict_and_explain(
    model: RandomForestRegressor,
    centroid_data: Dict,
    state: WorldState,
    policy: str,
) -> Tuple[int, Dict[str, float], str]:
    """
    Run inference on current (state, policy) and return:
      - predicted_delta  : int, expected population change next year
      - importances      : dict {feature_name: importance_score}, sorted descending
      - confidence       : 'HIGH' | 'MEDIUM' | 'LOW'

    Feature importances are extracted from the forest's built-in
    impurity-based importance — equivalent to a simplified SHAP explanation
    at zero computational cost for this model size.
    """
    x = state.as_feature_vector(policy).reshape(1, -1)

    predicted_delta = int(model.predict(x)[0])
    importances_raw = model.feature_importances_   # shape (9,)

    importances = {
        FEATURE_NAMES[i]: round(float(importances_raw[i]), 4)
        for i in range(len(FEATURE_NAMES))
    }
    importances = dict(sorted(importances.items(), key=lambda kv: kv[1], reverse=True))

    confidence = _ood_confidence(x[0], centroid_data)

    return predicted_delta, importances, confidence
