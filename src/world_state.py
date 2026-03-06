"""
world_state.py
--------------
Defines the WorldState dataclass — the complete snapshot of the civilization
at any point in the simulation.

v2 additions:
  - disease_rate  : epidemic pressure (0–100)
  - military      : defense & order capability (0–100)
  - climate       : long-run climate damage index (0–100)
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any
import numpy as np


POLICY_NAMES = ["agriculture", "industry", "education", "environment", "military_buildup", "healthcare"]
POLICY_INDEX = {name: idx for idx, name in enumerate(POLICY_NAMES)}

FEATURE_NAMES = [
    "population", "food", "energy", "technology",
    "pollution", "economy", "happiness", "legitimacy",
    "disease_rate", "military", "climate", "policy"
]


@dataclass
class WorldState:
    """
    11-variable continuous state vector representing civilization health.
    All bounds are enforced by apply_bounds() after every simulation step.
    """
    # --- Original 8 variables ---
    population:  int   = 1_000_000
    food:        float = 500_000.0
    energy:      float = 300_000.0
    technology:  float = 20.0
    pollution:   float = 10.0       # 0–100 index
    economy:     float = 40.0
    happiness:   float = 60.0       # 0–100 index
    legitimacy:  float = 80.0       # 0–100 index
    # --- New v2 variables ---
    disease_rate: float = 5.0       # 0–100: epidemic pressure; high = active outbreak risk
    military:     float = 40.0      # 0–100: defense strength; low = vulnerable to events
    climate:      float = 8.0       # 0–100: climate damage; rises with pollution, near-irreversible
    # --- Meta ---
    year: int = 1

    # ------------------------------------------------------------------ helpers

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def as_feature_vector(self, policy: str) -> np.ndarray:
        policy_idx = POLICY_INDEX.get(policy, 0)
        return np.array([
            self.population, self.food, self.energy, self.technology,
            self.pollution, self.economy, self.happiness, self.legitimacy,
            self.disease_rate, self.military, self.climate, policy_idx,
        ], dtype=np.float64)

    def apply_bounds(self) -> "WorldState":
        self.population  = max(0, int(self.population))
        self.food        = max(0.0, self.food)
        self.energy      = max(0.0, self.energy)
        self.technology  = max(0.0, min(500.0, self.technology))
        self.pollution   = max(0.0, min(100.0, self.pollution))
        self.economy     = max(0.0, self.economy)
        self.happiness   = max(0.0, min(100.0, self.happiness))
        self.legitimacy  = max(0.0, min(100.0, self.legitimacy))
        self.disease_rate = max(0.0, min(100.0, self.disease_rate))
        self.military    = max(0.0, min(100.0, self.military))
        self.climate     = max(0.0, min(100.0, self.climate))
        return self

    def food_per_capita(self) -> float:
        return self.food / max(self.population, 1)

    def is_collapsed(self) -> bool:
        total_resources = self.food + self.energy + self.economy
        return self.population == 0 or total_resources == 0

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "WorldState":
        valid = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in valid})


# ---------------------------------------------------------------- Scenario Seeds

SCENARIO_SEEDS = {
    "Balanced Start": WorldState(),
    "Post-War Ruins": WorldState(
        population=200_000, food=80_000, energy=50_000,
        technology=10.0, pollution=5.0, economy=8.0,
        happiness=30.0, legitimacy=40.0,
        disease_rate=25.0, military=60.0, climate=5.0,
    ),
    "Industrial Boom": WorldState(
        population=1_500_000, food=400_000, energy=800_000,
        technology=45.0, pollution=72.0, economy=150.0,
        happiness=50.0, legitimacy=65.0,
        disease_rate=10.0, military=50.0, climate=35.0,
    ),
    "Overcrowded Megacity": WorldState(
        population=5_000_000, food=200_000, energy=250_000,
        technology=60.0, pollution=55.0, economy=90.0,
        happiness=35.0, legitimacy=50.0,
        disease_rate=40.0, military=30.0, climate=28.0,
    ),
    "Green Utopia": WorldState(
        population=800_000, food=900_000, energy=600_000,
        technology=120.0, pollution=8.0, economy=70.0,
        happiness=90.0, legitimacy=95.0,
        disease_rate=3.0, military=20.0, climate=6.0,
    ),
    "Plague State": WorldState(
        population=3_000_000, food=300_000, energy=200_000,
        technology=35.0, pollution=30.0, economy=45.0,
        happiness=25.0, legitimacy=35.0,
        disease_rate=80.0, military=25.0, climate=15.0,
    ),
    "Militarised Empire": WorldState(
        population=2_000_000, food=450_000, energy=700_000,
        technology=50.0, pollution=40.0, economy=80.0,
        happiness=40.0, legitimacy=55.0,
        disease_rate=8.0, military=95.0, climate=20.0,
    ),
}
