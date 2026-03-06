"""
train.py
--------
One-shot training pipeline: generates synthetic data, trains the Random
Forest model, evaluates it, and saves artifacts to disk.

Run this script once before launching the Streamlit app:
    python training/train.py

After successful training:
  models/population_model.pkl  — the trained regressor
  models/training_centroid.pkl — centroid data for OOD detection
  data/simulation_data.csv     — generated dataset
(all of the above are git-ignored)
"""

import sys
import os

# Make sure the project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
from sklearn.model_selection import train_test_split

from src.data_pipeline import generate_dataset
from src.ml_model import train, evaluate


def main():
    print("=" * 55)
    print("  CIV-AI Training Pipeline")
    print("=" * 55)

    # Step 1 — Generate dataset
    print("\n[1/3] Generating synthetic dataset (5,000 episodes)...")
    df = generate_dataset(n=5000)

    # Step 2 — Prepare features and target
    feature_cols = [
        "population", "food", "energy", "technology",
        "pollution", "economy", "happiness", "legitimacy",
        "disease_rate", "military", "climate", "policy"
    ]
    X = df[feature_cols].values
    y = df["delta_population"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Step 3 — Train and evaluate
    print("\n[2/3] Training RandomForestRegressor (n_estimators=150, max_depth=10)...")
    model = train(X_train, y_train)

    print("\n[3/3] Evaluating on held-out test split...")
    metrics = evaluate(model, X_test, y_test)

    print("\n" + "=" * 55)
    print("  Training Complete")
    print(f"  R²   : {metrics['r2']}")
    print(f"  RMSE : {metrics['rmse']:,.0f} people")
    print("=" * 55)
    print(f"\nArtifacts saved to  models/  (git-ignored)")


if __name__ == "__main__":
    main()
