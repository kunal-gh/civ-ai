"""
train.py
--------
Master training pipeline for CIV-AI v3.

Trains in sequence:
  1. Multi-output Random Forest  (fast — < 30s)
  2. Isolation Forest anomaly detector (< 5s)
  3. LSTM 5-year forecaster       (< 3 min on CPU)
  4. PPO RL agent advisor         (< 5 min on CPU)
"""

import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from src.data_pipeline import generate_dataset, generate_episode_sequences
from src.ml_model import train, evaluate

BANNER = "=" * 60

def main():
    print(f"\n{BANNER}\n  CIV-AI v3 Training Pipeline\n{BANNER}\n")
    os.makedirs("models", exist_ok=True)
    os.makedirs("data",   exist_ok=True)

    ###########################################################################
    # Step 1 — Synthetic tabular dataset
    ###########################################################################
    print("[1/4] Generating tabular dataset (6,000 episodes) …")
    df = generate_dataset(n=6000)

    FEATURE_COLS = ["population","food","energy","technology","pollution",
                    "economy","happiness","legitimacy","disease_rate","military","climate","policy"]
    TARGET_COLS  = ["delta_population","delta_economy","delta_climate",
                    "delta_disease_rate","delta_legitimacy"]

    X = df[FEATURE_COLS].values
    Y = df[TARGET_COLS].values
    X_tr, X_te, Y_tr, Y_te = train_test_split(X, Y, test_size=0.2, random_state=42)

    ###########################################################################
    # Step 2 — Multi-output Random Forest + Anomaly detector
    ###########################################################################
    print("\n[2/4] Training MultiOutputRF + IsolationForest …")
    multi_model = train(X_tr, Y_tr)
    metrics = evaluate(multi_model, X_te, Y_te)
    print("\n  Multi-target RF results:")
    for target, m in metrics.items():
        print(f"    {target:<22}  R²={m['r2']:.4f}  RMSE={m['rmse']:.2f}")

    ###########################################################################
    # Step 3 — LSTM sequences + training
    ###########################################################################
    print("\n[3/4] Generating LSTM sequences (3,000 episodes × 15 years) …")
    generate_episode_sequences(n_episodes=3000, sequence_len=15)
    print("  Training LSTM …")
    from src.lstm_model import train_lstm
    train_lstm(epochs=60)

    ###########################################################################
    # Step 4 — PPO RL agent
    ###########################################################################
    print("\n[4/4] Training PPO RL agent (50k timesteps) …")
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.env_util import make_vec_env
        from src.rl_env import CivAIEnv

        vec_env = make_vec_env(CivAIEnv, n_envs=4)
        agent   = PPO("MlpPolicy", vec_env, verbose=0,
                      n_steps=512, batch_size=64, n_epochs=10,
                      learning_rate=3e-4, ent_coef=0.01)
        agent.learn(total_timesteps=50_000, progress_bar=True)
        agent.save("models/ppo_advisor")
        print("  PPO agent saved → models/ppo_advisor.zip")
    except Exception as e:
        print(f"  [skipped] PPO training failed: {e}")

    print(f"\n{BANNER}\n  Training Complete — all models in models/\n{BANNER}\n")

if __name__ == "__main__":
    main()
