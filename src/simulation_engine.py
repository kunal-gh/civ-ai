"""
simulation_engine.py
--------------------
Deterministic physics engine that advances the WorldState by one year.

All policy effects are applied first, then population dynamics are
recalculated, then the legitimacy engine runs. Results are bounded
by WorldState.apply_bounds() at the end of every step.

Novel features implemented here:
  - Technology multipliers (clean-tech threshold at tech > 100)
  - Legitimacy decay/growth tied to happiness
  - Revolution trigger when legitimacy hits zero
"""

import random
from src.world_state import WorldState


# ---------------------------------------------------------------------------
# Policy Effect Constants
# ---------------------------------------------------------------------------

POLICY_EFFECTS = {
    "agriculture": {
        "food_mult":     1.05,
        "pollution_add": 1.0,
        "happiness_add": 1.0,
    },
    "industry": {
        "economy_mult":  1.05,
        "pollution_add": 3.0,
        "energy_mult":   0.97,   # energy consumed in industrial expansion
        "happiness_add": -1.0,
    },
    "education": {
        "technology_add": 2.0,
        "pop_mult":       0.995,  # demographic shift reduces birth rate
        "happiness_add":  2.0,
    },
    "environment": {
        "pollution_mult":  0.95,
        "economy_mult":    0.98,
        "happiness_add":   3.0,
    },
}


def apply_policy(state: WorldState, policy: str) -> WorldState:
    """
    Apply one year of policy-driven changes to the world state.
    Returns the modified state (in-place mutation + return for clarity).
    """
    effects = POLICY_EFFECTS.get(policy, {})

    state.food       *= effects.get("food_mult",      1.0)
    state.economy    *= effects.get("economy_mult",   1.0)
    state.energy     *= effects.get("energy_mult",    1.0)
    state.pollution  *= effects.get("pollution_mult", 1.0)
    state.pollution  += effects.get("pollution_add",  0.0)
    state.technology += effects.get("technology_add", 0.0)
    state.population  = int(state.population * effects.get("pop_mult", 1.0))
    state.happiness  += effects.get("happiness_add",  0.0)

    # ---- Technology Multipliers (Novel Feature #2) ----
    if state.technology > 50:
        tech_bonus = state.technology - 50
        state.food    += state.food    * 0.001 * tech_bonus
        state.economy += state.economy * 0.0005 * tech_bonus

    if state.technology > 100:
        # Clean-tech threshold: advanced tech passively reduces pollution
        cleantech_bonus = state.technology - 100
        state.pollution = max(0.0, state.pollution - 0.01 * cleantech_bonus)

    return state


def population_dynamics(state: WorldState) -> WorldState:
    """
    Compute net population change based on food availability and pollution.

    birth_rate:  proportional to food-per-capita ratio (capped)
    death_rate:  baseline + pollution penalty
    starvation:  extra mortality when food_per_capita < 0.5
    """
    fpc = state.food_per_capita()

    birth_rate  = 0.02 * min(fpc * 2.0, 1.5)
    death_rate  = 0.01 + 0.005 * (state.pollution / 100.0)
    starvation  = 0.05 * max(0.0, 0.5 - fpc)

    net_growth  = birth_rate - death_rate - starvation
    state.population = max(0, int(state.population * (1.0 + net_growth)))

    # Annual food consumption
    state.food = max(0.0, state.food - state.population * 0.25)

    return state


def update_legitimacy(state: WorldState) -> WorldState:
    """
    Legitimacy (Novel Feature #1): tracks public trust.

    - Rises when happiness > 50
    - Falls when happiness < 50
    - Rate scales with how far happiness deviates from the midpoint
    """
    delta = (state.happiness - 50.0) * 0.10
    state.legitimacy += delta

    # Happiness itself drifts toward economy/pollution equilibrium
    equilibrium_happiness = max(0.0, min(100.0,
        40.0 + (state.economy / 500.0) * 30.0 - (state.pollution / 100.0) * 20.0
    ))
    state.happiness += (equilibrium_happiness - state.happiness) * 0.15

    return state


def is_revolution_triggered(state: WorldState) -> bool:
    """Return True if legitimacy collapse causes a forced revolution event."""
    return state.legitimacy <= 0.0


def apply_event(state: WorldState, effects: dict) -> WorldState:
    """
    Apply structured event effects to the world state.
    Accepts a dict of {field_name: numeric_delta}.
    """
    for field, delta in effects.items():
        if hasattr(state, field):
            current = getattr(state, field)
            setattr(state, field, current + delta)
    return state


def step(state: WorldState, policy: str) -> WorldState:
    """
    Full one-year simulation step (without event engine — that's in app.py).

    1. Apply policy effects
    2. Recalculate population dynamics
    3. Update legitimacy
    4. Enforce bounds
    5. Advance year counter
    """
    state = apply_policy(state, policy)
    state = population_dynamics(state)
    state = update_legitimacy(state)
    state = state.apply_bounds()
    state.year += 1
    return state
