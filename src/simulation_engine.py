"""
simulation_engine.py
--------------------
Deterministic physics engine — v2 with 11 state variables and 6 policies.

New dynamics in v2:
  - disease_rate   : builds under crowding, low food, low happiness
  - military       : decays without investment; protects against event penalties
  - climate        : slow irreversible accumulation from pollution
  - expanded policy table (adds military_buildup, healthcare)
  - disease-driven mortality
  - climate-driven food/economy penalties
"""

import random
from src.world_state import WorldState


# ------------------------------------------------------------------ Policy table

POLICY_EFFECTS = {
    "agriculture": {
        "food_mult":        1.05,
        "pollution_add":    1.0,
        "happiness_add":    1.0,
        "disease_add":     -2.0,   # better food = lower disease
    },
    "industry": {
        "economy_mult":     1.06,
        "pollution_add":    4.0,
        "energy_mult":      0.97,
        "happiness_add":   -1.0,
        "climate_add":      0.5,
    },
    "education": {
        "technology_add":   2.5,
        "pop_mult":         0.995,
        "happiness_add":    2.0,
        "disease_add":     -1.5,   # better education lowers disease spread
    },
    "environment": {
        "pollution_mult":   0.93,
        "climate_add":     -0.3,   # active climate remediation
        "economy_mult":     0.98,
        "happiness_add":    3.0,
        "disease_add":     -1.0,
    },
    "military_buildup": {
        "military_add":     8.0,
        "economy_mult":     0.96,  # military spending strains economy
        "happiness_add":   -2.0,
    },
    "healthcare": {
        "disease_add":     -10.0,  # strongest single counter to disease
        "happiness_add":    4.0,
        "economy_mult":     0.97,
        "pop_mult":         1.002,  # healthcare improves birth survival rate
    },
}


def apply_policy(state: WorldState, policy: str) -> WorldState:
    fx = POLICY_EFFECTS.get(policy, {})

    state.food        *= fx.get("food_mult",       1.0)
    state.economy     *= fx.get("economy_mult",    1.0)
    state.energy      *= fx.get("energy_mult",     1.0)
    state.pollution   *= fx.get("pollution_mult",  1.0)
    state.pollution   += fx.get("pollution_add",   0.0)
    state.climate     += fx.get("climate_add",     0.0)
    state.technology  += fx.get("technology_add",  0.0)
    state.disease_rate += fx.get("disease_add",    0.0)
    state.military    += fx.get("military_add",    0.0)
    state.population   = int(state.population * fx.get("pop_mult", 1.0))
    state.happiness   += fx.get("happiness_add",   0.0)

    # ---- Technology Multipliers (Tier 1: tech > 50) ----
    if state.technology > 50:
        bonus = state.technology - 50
        state.food    += state.food    * 0.001 * bonus
        state.economy += state.economy * 0.0005 * bonus

    # ---- Technology Multipliers (Tier 2: clean-tech, tech > 100) ----
    if state.technology > 100:
        clean = state.technology - 100
        state.pollution   = max(0.0, state.pollution - 0.015 * clean)
        state.disease_rate = max(0.0, state.disease_rate - 0.005 * clean)

    return state


def population_dynamics(state: WorldState) -> WorldState:
    """
    Population update including disease mortality on top of base dynamics.

    New v2 terms:
      disease_mortality : scales with disease_rate and population density
      climate_mortality : long-run death rate from climate degradation (food/energy penalty)
    """
    fpc = state.food_per_capita()

    birth_rate  = 0.02 * min(fpc * 2.0, 1.5)
    death_rate  = 0.01 + 0.005 * (state.pollution / 100.0)
    starvation  = 0.05  * max(0.0, 0.5 - fpc)

    # Disease mortality: rises with disease_rate; partially contained by military/healthcare proxy
    disease_mortality = 0.001 * (state.disease_rate / 100.0) * (state.disease_rate / 10.0)

    # Climate mortality: long-run slow burn — extreme climate degrades food chains
    climate_mortality = 0.0003 * max(0.0, state.climate - 30.0)

    net_growth = birth_rate - death_rate - starvation - disease_mortality - climate_mortality
    state.population = max(0, int(state.population * (1.0 + net_growth)))

    # Annual food consumption — scales with population
    state.food = max(0.0, state.food - state.population * 0.25)

    return state


def update_secondary_vars(state: WorldState) -> WorldState:
    """
    Annual passive dynamics for v2 variables.

    disease_rate:
      - Grows with population density (more crowding = faster spread)
      - Grows faster if food_per_capita < 0.5 (malnutrition immunity drop)
      - Grows faster if happiness < 40 (neglected healthcare)
      - Passively decays at base rate

    military:
      - Decays every year without investment (desertion, equipment aging)

    climate:
      - Slowly ratchets up with pollution (near-irreversible)
      - Reduces food productivity when > 50
    """
    fpc = state.food_per_capita()
    density_factor = min(state.population / 2_000_000.0, 3.0)

    disease_growth = (
        0.5 * density_factor
        + 1.5 * max(0.0, 0.5 - fpc)           # malnutrition boosts spread
        + 0.8 * max(0.0, (40.0 - state.happiness) / 40.0)  # neglect
    )
    disease_decay = 2.0   # base annual recovery
    state.disease_rate += disease_growth - disease_decay

    # Military decays without investment
    state.military -= 1.5

    # Climate ratchets slowly with pollution
    climate_pressure = 0.02 * (state.pollution / 100.0) * state.pollution
    state.climate += climate_pressure

    # Extreme climate hits food + economy
    if state.climate > 50.0:
        climate_damage = (state.climate - 50.0) / 100.0
        state.food    *= (1.0 - climate_damage * 0.02)
        state.economy *= (1.0 - climate_damage * 0.01)

    return state


def update_legitimacy(state: WorldState) -> WorldState:
    """Legitimacy tied to happiness; revolution fires when it hits 0."""
    delta = (state.happiness - 50.0) * 0.10
    state.legitimacy += delta

    # Equilibrium happiness based on economy, pollution, disease
    eq = max(0.0, min(100.0,
        40.0
        + (state.economy / 500.0) * 30.0
        - (state.pollution / 100.0) * 15.0
        - (state.disease_rate / 100.0) * 10.0
        - (state.climate / 100.0) * 8.0
    ))
    state.happiness += (eq - state.happiness) * 0.15
    return state


def is_revolution_triggered(state: WorldState) -> bool:
    return state.legitimacy <= 0.0


def apply_event(state: WorldState, effects: dict) -> WorldState:
    """Apply structured event effects dict to the world state."""
    for field, delta in effects.items():
        if hasattr(state, field):
            setattr(state, field, getattr(state, field) + delta)
    return state


def step(state: WorldState, policy: str) -> WorldState:
    """Full 1-year simulation step: policy → population → secondary vars → legitimacy → bounds → year++"""
    state = apply_policy(state, policy)
    state = population_dynamics(state)
    state = update_secondary_vars(state)
    state = update_legitimacy(state)
    state = state.apply_bounds()
    state.year += 1
    return state
