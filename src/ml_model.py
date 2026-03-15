"""
ml_model.py
-----------
v3 expanded ML module:
  1. MultiOutputRegressor(RandomForestRegressor) — 5 simultaneous delta predictions
  2. IsolationForest anomaly detector — warns of dangerous state combos
  3. OOD centroid confidence (unchanged from v2)
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

from typing import Dict, Tuple, List, Optional
from src.world_state import WorldState, FEATURE_NAMES, POLICY_INDEX

# ---------------------------------------------------------------- Paths
MODEL_PATH       = "models/population_model.pkl"     # legacy single-target (kept for rollback)
MULTI_MODEL_PATH = "models/multi_rf.pkl"             # new multi-target RF
CENTROID_PATH    = "models/training_centroid.pkl"
ANOMALY_PATH     = "models/anomaly_detector.pkl"

# 5 targets
TARGET_NAMES = ["delta_population", "delta_economy", "delta_climate",
                "delta_disease_rate", "delta_legitimacy"]
TARGET_LABELS = ["Δ Population", "Δ Economy", "Δ Climate", "Δ Disease Rate", "Δ Legitimacy"]

FEATURE_COLS = [
    "population", "food", "energy", "technology",
    "pollution", "economy", "happiness", "legitimacy",
    "disease_rate", "military", "climate", "policy"
]


# ---------------------------------------------------------------- Training

def train(X: np.ndarray, Y: np.ndarray) -> "MultiOutputRegressor":
    """Train multi-output Random Forest on 5 targets simultaneously."""
    os.makedirs("models", exist_ok=True)

    base = RandomForestRegressor(n_estimators=150, max_depth=12,
                                 min_samples_leaf=4, n_jobs=-1, random_state=42)
    multi_model = MultiOutputRegressor(base, n_jobs=-1)
    multi_model.fit(X, Y)
    joblib.dump(multi_model, MULTI_MODEL_PATH)

    # Keep a legacy single-target model for backward compat
    single = RandomForestRegressor(n_estimators=150, max_depth=12,
                                   min_samples_leaf=4, n_jobs=-1, random_state=42)
    single.fit(X, Y[:, 0])
    joblib.dump(single, MODEL_PATH)

    # OOD centroid
    centroid = X.mean(axis=0)
    std      = X.std(axis=0) + 1e-8
    joblib.dump({"centroid": centroid, "std": std}, CENTROID_PATH)

    # Anomaly detector
    iso = IsolationForest(n_estimators=200, contamination=0.05, random_state=42, n_jobs=-1)
    iso.fit(X)
    joblib.dump(iso, ANOMALY_PATH)

    return multi_model


def evaluate(model, X_test: np.ndarray, Y_test: np.ndarray) -> Dict[str, Dict]:
    """Evaluate multi-output model; return per-target metrics."""
    Y_pred = model.predict(X_test)
    results = {}
    for i, name in enumerate(TARGET_NAMES):
        results[name] = {
            "r2":   round(float(r2_score(Y_test[:, i], Y_pred[:, i])), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(Y_test[:, i], Y_pred[:, i]))), 2),
        }
    return results


# ---------------------------------------------------------------- Loading

def load_model() -> Tuple[Optional["MultiOutputRegressor"], Optional[RandomForestRegressor], Dict, Optional[IsolationForest]]:
    """Load all model artifacts; gracefully handle missing files."""
    multi  = joblib.load(MULTI_MODEL_PATH) if os.path.exists(MULTI_MODEL_PATH) else None
    single = joblib.load(MODEL_PATH)       if os.path.exists(MODEL_PATH)       else None
    centroid_data = joblib.load(CENTROID_PATH) if os.path.exists(CENTROID_PATH) else {}
    anomaly = joblib.load(ANOMALY_PATH)    if os.path.exists(ANOMALY_PATH)     else None
    return multi, single, centroid_data, anomaly


# ---------------------------------------------------------------- Inference

def _ood_confidence(x: np.ndarray, centroid_data: Dict) -> str:
    if not centroid_data:
        return "UNKNOWN"
    dist = float(np.linalg.norm((x - centroid_data["centroid"]) / centroid_data["std"]))
    if dist < 2.5:  return "HIGH"
    elif dist < 4.5: return "MEDIUM"
    else:            return "LOW"


def predict_and_explain(
    multi_model,
    single_model,
    centroid_data: Dict,
    anomaly_model,
    state: WorldState,
    policy: str,
) -> Tuple[Dict[str, float], Dict[str, float], str, bool]:
    """
    Full v3 inference:
    Returns (predictions_dict, importances_dict, confidence_str, is_anomaly)
    """
    x = state.as_feature_vector(policy).reshape(1, -1)

    # --- Multi-target predictions ---
    predictions = {}
    if multi_model is not None:
        Y_pred = multi_model.predict(x)[0]
        predictions = {label: float(Y_pred[i]) for i, label in enumerate(TARGET_LABELS)}
    elif single_model is not None:
        # Fallback to legacy single-target
        predictions = {"Δ Population": float(single_model.predict(x)[0])}

    # --- Feature importances from the population estimator ---
    importances = {}
    try:
        if multi_model is not None:
            pop_estimator = multi_model.estimators_[0]
            raw_imp = pop_estimator.feature_importances_
            importances = {FEATURE_NAMES[i]: round(float(raw_imp[i]), 4)
                           for i in range(len(FEATURE_NAMES))}
            importances = dict(sorted(importances.items(), key=lambda kv: kv[1], reverse=True))
        elif single_model is not None:
            raw_imp = single_model.feature_importances_
            importances = {FEATURE_NAMES[i]: round(float(raw_imp[i]), 4)
                           for i in range(len(FEATURE_NAMES))}
            importances = dict(sorted(importances.items(), key=lambda kv: kv[1], reverse=True))
    except Exception:
        pass

    # --- OOD confidence ---
    confidence = _ood_confidence(x[0], centroid_data)

    # --- Anomaly check ---
    is_anomaly = False
    if anomaly_model is not None:
        score = anomaly_model.decision_function(x)[0]
        is_anomaly = bool(anomaly_model.predict(x)[0] == -1)

    return predictions, importances, confidence, is_anomaly
