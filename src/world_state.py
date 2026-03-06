"""
world_state.py
--------------
Defines the WorldState dataclass that represents the complete state
of the civilization at any point in the simulation.

All 8 variables are bounded and typed. Helper methods provide clean
interfaces for ML feature extraction and serialization.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List
import numpy as np


POLICY_NAMES = ["agriculture", "industry", "education", "environment"]
POLICY_INDEX = {name: idx for idx, name in enumerate(POLICY_NAMES)}

# Feature names in the exact order fed to the ML model
FEATURE_NAMES = [
    "population", "food", "energy", "technology",
    "pollution", "economy", "happiness", "legitimacy", "policy"
]


@dataclass
class WorldState:
    """
    Encapsulates the full socioeconomic state of the civilization.

    All numeric bounds are enforced at update time by the simulation engine.
    The 'legitimacy' field is an original addition: it tracks social trust
    in governing institutions and decays when happiness stays low.
    """
    population: int   = 1_000_000
    food: float       = 500_000.0
    energy: float     = 300_000.0
    technology: float = 20.0
    pollution: float  = 10.0      # 0–100 index
    economy: float    = 40.0
    happiness: float  = 60.0      # 0–100 index
    legitimacy: float = 80.0      # 0–100 index (novel feature)
    year: int         = 1

    def to_dict(self) -> Dict[str, Any]:
        """Return plain dict for JSON serialisation / Streamlit session state."""
        return asdict(self)

    def as_feature_vector(self, policy: str) -> np.ndarray:
        """
        Flatten state + policy into a 1-D numpy array for ML inference.
        Order matches FEATURE_NAMES (excluding 'year').
        """
        policy_idx = POLICY_INDEX.get(policy, 0)
        return np.array([
            self.population,
            self.food,
            self.energy,
            self.technology,
            self.pollution,
            self.economy,
            self.happiness,
            self.legitimacy,
            policy_idx,
        ], dtype=np.float64)

    def apply_bounds(self) -> "WorldState":
        """Clamp all variables to their valid ranges. Called after every update."""
        self.population = max(0, int(self.population))
        self.food       = max(0.0, self.food)
        self.energy     = max(0.0, self.energy)
        self.technology = max(0.0, min(500.0, self.technology))
        self.pollution  = max(0.0, min(100.0, self.pollution))
        self.economy    = max(0.0, self.economy)
        self.happiness  = max(0.0, min(100.0, self.happiness))
        self.legitimacy = max(0.0, min(100.0, self.legitimacy))
        return self

    def food_per_capita(self) -> float:
        return self.food / max(self.population, 1)

    def is_collapsed(self) -> bool:
        """Civilization collapse: population at zero or total resource bankruptcy."""
        total_resources = self.food + self.energy + self.economy
        return self.population == 0 or total_resources == 0

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "WorldState":
        """Reconstruct from a plain dict (e.g., from Streamlit session state)."""
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in d.items() if k in valid_fields})


# ----- Scenario Seeds (Novel Feature #6) -----

SCENARIO_SEEDS = {
    "Balanced Start": WorldState(),
    "Post-War Ruins": WorldState(
        population=200_000, food=80_000, energy=50_000,
        technology=10.0, pollution=5.0, economy=8.0,
        happiness=30.0, legitimacy=40.0
    ),
    "Industrial Boom": WorldState(
        population=1_500_000, food=400_000, energy=800_000,
        technology=45.0, pollution=72.0, economy=150.0,
        happiness=50.0, legitimacy=65.0
    ),
    "Overcrowded Megacity": WorldState(
        population=5_000_000, food=200_000, energy=250_000,
        technology=60.0, pollution=55.0, economy=90.0,
        happiness=35.0, legitimacy=50.0
    ),
    "Green Utopia": WorldState(
        population=800_000, food=900_000, energy=600_000,
        technology=120.0, pollution=8.0, economy=70.0,
        happiness=90.0, legitimacy=95.0
    ),
}
