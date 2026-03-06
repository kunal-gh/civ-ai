"""
data_pipeline.py
----------------
Generates a synthetic training dataset by running randomized simulation
episodes across the full valid range of the WorldState variables.

Design choices:
  - 5,000 episodes to cover sufficient state-space diversity
  - Each episode starts from a randomly perturbed WorldState so the model
    learns edge cases (famine, pollution spikes, tech booms) not just the default
  - Outputs: data/simulation_data.csv  (git-ignored — regenerate via train.py)
"""

import os
import random
import pandas as pd
from src.world_state import WorldState, POLICY_NAMES
from src.simulation_engine import apply_policy, population_dynamics


def _random_state() -> WorldState:
    """Sample a WorldState uniformly across realistic variable ranges."""
    return WorldState(
        population = random.randint(50_000, 10_000_000),
        food       = random.uniform(10_000, 8_000_000),
        energy     = random.uniform(10_000, 3_000_000),
        technology = random.uniform(0, 300),
        pollution  = random.uniform(0, 100),
        economy    = random.uniform(2, 500),
        happiness  = random.uniform(0, 100),
        legitimacy = random.uniform(10, 100),
    )


def generate_dataset(n: int = 5000, output_path: str = "data/simulation_data.csv") -> pd.DataFrame:
    """
    Run n simulation episodes and record (state, policy) → delta_population.

    Returns the resulting DataFrame and saves to output_path.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    rows = []

    for episode in range(n):
        state  = _random_state()
        policy = random.choice(POLICY_NAMES)

        # Capture state BEFORE policy application
        before = state.to_dict()
        pop_before = state.population
        food_before = state.food

        state = apply_policy(state, policy)
        state = population_dynamics(state)

        rows.append({
            # Features (8 state vars + policy index)
            "population":  before["population"],
            "food":        before["food"],
            "energy":      before["energy"],
            "technology":  before["technology"],
            "pollution":   before["pollution"],
            "economy":     before["economy"],
            "happiness":   before["happiness"],
            "legitimacy":  before["legitimacy"],
            "policy":      POLICY_NAMES.index(policy),
            # Targets
            "delta_population": state.population - pop_before,
            "delta_food":       state.food - food_before,
        })

        if (episode + 1) % 1000 == 0:
            print(f"  {episode + 1}/{n} episodes generated")

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"Dataset saved → {output_path}  ({len(df)} rows, {df.shape[1]} columns)")
    return df


if __name__ == "__main__":
    print("Generating CIV-AI training dataset...")
    generate_dataset()
