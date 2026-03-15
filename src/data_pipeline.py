"""
data_pipeline.py
----------------
Generates synthetic training data for ALL ml models.

v3: Now outputs 5 delta targets simultaneously:
  delta_population, delta_economy, delta_climate, delta_disease_rate, delta_legitimacy
Also outputs full episode trajectories (for LSTM training).
"""

import os
import random
import pandas as pd
import numpy as np
from src.world_state import WorldState, POLICY_NAMES
from src.simulation_engine import apply_policy, population_dynamics, update_secondary_vars, update_legitimacy


def _random_state() -> WorldState:
    return WorldState(
        population   = random.randint(50_000, 10_000_000),
        food         = random.uniform(10_000, 8_000_000),
        energy       = random.uniform(10_000, 3_000_000),
        technology   = random.uniform(0, 300),
        pollution    = random.uniform(0, 100),
        economy      = random.uniform(2, 500),
        happiness    = random.uniform(0, 100),
        legitimacy   = random.uniform(10, 100),
        disease_rate = random.uniform(0, 100),
        military     = random.uniform(0, 100),
        climate      = random.uniform(0, 100),
    )


def generate_dataset(n: int = 6000, output_path: str = "data/simulation_data.csv") -> pd.DataFrame:
    """
    Run n simulation episodes.
    Returns a DataFrame with features + 5 delta targets.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    rows = []

    for episode in range(n):
        state  = _random_state()
        policy = random.choice(POLICY_NAMES)
        before = state.to_dict()

        # Apply physics
        state = apply_policy(state, policy)
        state = population_dynamics(state)
        state = update_secondary_vars(state)
        state = update_legitimacy(state)
        state = state.apply_bounds()

        rows.append({
            "population":          before["population"],
            "food":                before["food"],
            "energy":              before["energy"],
            "technology":          before["technology"],
            "pollution":           before["pollution"],
            "economy":             before["economy"],
            "happiness":           before["happiness"],
            "legitimacy":          before["legitimacy"],
            "disease_rate":        before["disease_rate"],
            "military":            before["military"],
            "climate":             before["climate"],
            "policy":              POLICY_NAMES.index(policy),
            # --- 5 target deltas ---
            "delta_population":    state.population  - before["population"],
            "delta_economy":       state.economy     - before["economy"],
            "delta_climate":       state.climate     - before["climate"],
            "delta_disease_rate":  state.disease_rate - before["disease_rate"],
            "delta_legitimacy":    state.legitimacy  - before["legitimacy"],
        })

        if (episode + 1) % 1000 == 0:
            print(f"  {episode + 1}/{n} episodes generated")

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"Dataset saved → {output_path}  ({len(df)} rows)")
    return df


def generate_episode_sequences(n_episodes: int = 3000,
                                sequence_len: int = 15,
                                output_path: str = "data/lstm_sequences.npz") -> None:
    """
    Generate fixed-length episode trajectories for LSTM training.
    Each episode: run from a random start for `sequence_len` years.
    Output shape: (n_episodes, sequence_len, 12)  — 12 feat including policy
    Target shape: (n_episodes, 5)                  — 5 deltas at step sequence_len
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sequences, targets = [], []
    FEAT_KEYS = ["population", "food", "energy", "technology",
                 "pollution", "economy", "happiness", "legitimacy",
                 "disease_rate", "military", "climate"]

    for ep in range(n_episodes):
        state  = _random_state()
        policy = random.choice(POLICY_NAMES)
        seq    = []

        for t in range(sequence_len):
            feat = [getattr(state, k) for k in FEAT_KEYS] + [POLICY_NAMES.index(policy)]
            seq.append(feat)
            state = apply_policy(state, policy)
            state = population_dynamics(state)
            state = update_secondary_vars(state)
            state = update_legitimacy(state)
            state = state.apply_bounds()
            policy = random.choice(POLICY_NAMES)  # Vary policy each year

        # Target = final state deltas
        init = seq[0]
        final_state = [getattr(state, k) for k in FEAT_KEYS]
        delta = [final_state[i] - init[i] for i in range(len(FEAT_KEYS))]
        targets.append([delta[0], delta[5], delta[10], delta[8], delta[7]])  # pop, econ, climate, disease, legit

        sequences.append(seq)

        if (ep + 1) % 500 == 0:
            print(f"  LSTM {ep + 1}/{n_episodes} episodes")

    np.savez(output_path,
             X=np.array(sequences, dtype=np.float32),
             y=np.array(targets,   dtype=np.float32))
    print(f"LSTM sequences saved → {output_path}")


if __name__ == "__main__":
    generate_dataset()
    generate_episode_sequences()
