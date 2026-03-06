"""
test_simulation.py
------------------
Unit tests for the v2 WorldState dataclass and simulation engine.
Now covers 11 parameters, 6 policies, disease_rate, and climate.
"""

import pytest
from src.world_state import WorldState, POLICY_INDEX
from src.simulation_engine import (
    apply_policy, population_dynamics, update_secondary_vars,
    update_legitimacy, apply_event, step, is_revolution_triggered
)

class TestWorldState:
    def test_default_state_values(self):
        ws = WorldState()
        assert ws.population == 1_000_000
        assert ws.disease_rate == 5.0
        assert ws.military == 40.0

    def test_apply_bounds_clamps_negatives(self):
        ws = WorldState(population=-500, disease_rate=150, climate=-20)
        ws.apply_bounds()
        assert ws.population == 0
        assert ws.disease_rate == 100.0
        assert ws.climate == 0.0

    def test_feature_vector_length(self):
        ws = WorldState()
        vec = ws.as_feature_vector("healthcare")
        assert len(vec) == 12   # 11 state vars + policy index

class TestApplyPolicy:
    def test_healthcare_reduces_disease(self):
        ws = WorldState(disease_rate=50.0)
        apply_policy(ws, "healthcare")
        assert ws.disease_rate < 50.0

    def test_military_buildup_increases_military(self):
        ws = WorldState(military=20.0)
        apply_policy(ws, "military_buildup")
        assert ws.military > 20.0

    def test_industry_increases_climate(self):
        ws = WorldState()
        clim_before = ws.climate
        apply_policy(ws, "industry")
        assert ws.climate > clim_before

class TestPopulationDynamics:
    def test_high_disease_causes_mortality(self):
        ws_healthy = WorldState(disease_rate=0.0)
        ws_sick    = WorldState(disease_rate=80.0)
        population_dynamics(ws_healthy)
        population_dynamics(ws_sick)
        assert ws_sick.population < ws_healthy.population

    def test_starvation_reduces_population(self):
        ws = WorldState(population=1_000_000, food=0.0)
        pop_before = ws.population
        population_dynamics(ws)
        assert ws.population < pop_before

class TestSecondaryVars:
    def test_military_decays_over_time(self):
        ws = WorldState(military=80.0)
        update_secondary_vars(ws)
        assert ws.military < 80.0

    def test_extreme_climate_damages_economy(self):
        ws = WorldState(climate=80.0, economy=100.0)
        update_secondary_vars(ws)
        assert ws.economy < 100.0

class TestLegitimacy:
    def test_high_happiness_grows_legitimacy(self):
        ws = WorldState(happiness=90.0, legitimacy=50.0)
        update_legitimacy(ws)
        assert ws.legitimacy > 50.0

    def test_revolution_triggers_at_zero(self):
        ws = WorldState(legitimacy=0.0)
        assert is_revolution_triggered(ws)
