"""
test_simulation.py
------------------
Unit tests for the WorldState dataclass and simulation engine.

Tests cover:
  - Default state validity
  - Policy effects (bounds, directions)
  - Population dynamics (starvation, normal growth)
  - Technology multipliers
  - Legitimacy mechanics
  - Collapse detection
  - Event application
"""

import pytest
from src.world_state import WorldState, POLICY_INDEX
from src.simulation_engine import (
    apply_policy, population_dynamics, update_legitimacy,
    apply_event, step, is_revolution_triggered
)


# ---------------------------------------------------------------------------
# WorldState tests
# ---------------------------------------------------------------------------

class TestWorldState:
    def test_default_state_values(self):
        ws = WorldState()
        assert ws.population == 1_000_000
        assert ws.food == 500_000.0
        assert 0 <= ws.happiness <= 100
        assert 0 <= ws.legitimacy <= 100

    def test_apply_bounds_clamps_negatives(self):
        ws = WorldState(population=-500, food=-1000, pollution=150, happiness=-20)
        ws.apply_bounds()
        assert ws.population == 0
        assert ws.food == 0.0
        assert ws.pollution == 100.0
        assert ws.happiness == 0.0

    def test_feature_vector_length(self):
        ws = WorldState()
        vec = ws.as_feature_vector("agriculture")
        assert len(vec) == 9   # 8 state vars + policy index

    def test_from_dict_roundtrip(self):
        ws = WorldState(population=999_999, year=42)
        d = ws.to_dict()
        ws2 = WorldState.from_dict(d)
        assert ws2.population == 999_999
        assert ws2.year == 42

    def test_collapse_at_zero_population(self):
        ws = WorldState(population=0)
        assert ws.is_collapsed()

    def test_collapse_at_zero_resources(self):
        ws = WorldState(food=0.0, energy=0.0, economy=0.0)
        assert ws.is_collapsed()

    def test_healthy_state_not_collapsed(self):
        ws = WorldState()
        assert not ws.is_collapsed()


# ---------------------------------------------------------------------------
# Policy effect tests
# ---------------------------------------------------------------------------

class TestApplyPolicy:
    def test_agriculture_increases_food(self):
        ws = WorldState()
        food_before = ws.food
        apply_policy(ws, "agriculture")
        assert ws.food > food_before

    def test_agriculture_increases_pollution(self):
        ws = WorldState()
        poll_before = ws.pollution
        apply_policy(ws, "agriculture")
        assert ws.pollution > poll_before

    def test_industry_grows_economy(self):
        ws = WorldState()
        econ_before = ws.economy
        apply_policy(ws, "industry")
        assert ws.economy > econ_before

    def test_industry_increase_pollution(self):
        ws = WorldState()
        poll_before = ws.pollution
        apply_policy(ws, "industry")
        assert ws.pollution > poll_before

    def test_environment_reduces_pollution(self):
        ws = WorldState(pollution=50.0)
        apply_policy(ws, "environment")
        assert ws.pollution < 50.0

    def test_education_raises_technology(self):
        ws = WorldState()
        tech_before = ws.technology
        apply_policy(ws, "education")
        assert ws.technology > tech_before


# ---------------------------------------------------------------------------
# Population dynamics tests
# ---------------------------------------------------------------------------

class TestPopulationDynamics:
    def test_normal_conditions_population_grows(self):
        ws = WorldState()
        pop_before = ws.population
        population_dynamics(ws)
        assert ws.population > pop_before

    def test_starvation_reduces_population(self):
        ws = WorldState(population=1_000_000, food=0.0)
        pop_before = ws.population
        population_dynamics(ws)
        assert ws.population < pop_before

    def test_food_consumed_annually(self):
        ws = WorldState(population=1_000_000, food=1_000_000.0)
        population_dynamics(ws)
        assert ws.food < 1_000_000.0

    def test_population_never_negative(self):
        ws = WorldState(population=1, food=0.0, pollution=100.0)
        for _ in range(10):
            population_dynamics(ws)
        assert ws.population >= 0


# ---------------------------------------------------------------------------
# Technology multiplier tests
# ---------------------------------------------------------------------------

class TestTechnologyMultipliers:
    def test_high_tech_boosts_food(self):
        ws_low  = WorldState(technology=30.0)
        ws_high = WorldState(technology=150.0)
        apply_policy(ws_low,  "education")
        apply_policy(ws_high, "education")
        # After same policy, high-tech state should have more food/economy gains
        assert ws_high.economy >= ws_low.economy

    def test_cleantech_reduces_pollution(self):
        ws = WorldState(technology=120.0, pollution=50.0)
        apply_policy(ws, "agriculture")
        # pollution should be lower than it would be without clean-tech
        ws_no_tech = WorldState(technology=10.0, pollution=50.0)
        apply_policy(ws_no_tech, "agriculture")
        assert ws.pollution <= ws_no_tech.pollution


# ---------------------------------------------------------------------------
# Legitimacy tests
# ---------------------------------------------------------------------------

class TestLegitimacy:
    def test_high_happiness_grows_legitimacy(self):
        ws = WorldState(happiness=90.0, legitimacy=50.0)
        leg_before = ws.legitimacy
        update_legitimacy(ws)
        assert ws.legitimacy > leg_before

    def test_low_happiness_erodes_legitimacy(self):
        ws = WorldState(happiness=10.0, legitimacy=80.0)
        leg_before = ws.legitimacy
        update_legitimacy(ws)
        assert ws.legitimacy < leg_before

    def test_revolution_triggers_at_zero(self):
        ws = WorldState(legitimacy=0.0)
        assert is_revolution_triggered(ws)

    def test_no_revolution_normally(self):
        ws = WorldState(legitimacy=50.0)
        assert not is_revolution_triggered(ws)


# ---------------------------------------------------------------------------
# Event application tests
# ---------------------------------------------------------------------------

class TestApplyEvent:
    def test_food_reduction_event(self):
        ws = WorldState(food=500_000.0)
        apply_event(ws, {"food": -50_000.0})
        assert ws.food == 450_000.0

    def test_bounds_enforced_after_event(self):
        ws = WorldState(food=100.0)
        apply_event(ws, {"food": -99_999_999.0})
        ws.apply_bounds()
        assert ws.food == 0.0

    def test_unknown_field_ignored(self):
        ws = WorldState()
        # Should not raise
        apply_event(ws, {"nonexistent_field": 999})
