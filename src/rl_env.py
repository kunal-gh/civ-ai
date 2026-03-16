"""
rl_env.py
---------
OpenAI Gymnasium environment wrapping the AXIOM simulation engine.
Used to train a PPO agent from Stable-Baselines3 to act as an AI advisor.

Observation space : Box(11,) — normalised WorldState variables
Action space      : Discrete(6) — the 6 policies
Reward            : Population growth + economy growth - disease - climate penalties
Episode length    : 50 years
"""

import numpy as np
import gymnasium as gym
from gymnasium import spaces
from src.world_state import WorldState, POLICY_NAMES, SCENARIO_SEEDS
from src.simulation_engine import step as sim_step, is_revolution_triggered


OBS_KEYS = ["population", "food", "energy", "technology",
            "pollution", "economy", "happiness", "legitimacy",
            "disease_rate", "military", "climate"]

OBS_DIM   = len(OBS_KEYS)
OBS_HIGH  = np.array([1e7, 1e7, 5e6, 500, 100, 1000, 100, 100, 100, 100, 100], dtype=np.float32)
OBS_LOW   = np.zeros(OBS_DIM, dtype=np.float32)

MAX_YEARS = 50


class CivAIEnv(gym.Env):
    """
    AXIOM as a Gymnasium Reinforcement Learning environment.

    Episode: 50 simulated years from a random or fixed scenario.
    Goal: maximise population and legitimacy while minimising disease and climate.
    """

    metadata = {"render_modes": []}

    def __init__(self, scenario: str = None):
        super().__init__()
        self.scenario = scenario  # None = random each episode
        self.observation_space = spaces.Box(low=OBS_LOW, high=OBS_HIGH, dtype=np.float32)
        self.action_space      = spaces.Discrete(len(POLICY_NAMES))
        self._state: WorldState = None
        self._year = 0

    def _obs(self) -> np.ndarray:
        return np.array([getattr(self._state, k) for k in OBS_KEYS], dtype=np.float32)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if self.scenario:
            ws = SCENARIO_SEEDS.get(self.scenario, WorldState())
        else:
            # Random scenario each episode — forces agent to generalise
            ws = SCENARIO_SEEDS.get(
                self.np_random.choice(list(SCENARIO_SEEDS.keys())), WorldState()
            )
        self._state  = WorldState.from_dict(ws.to_dict())
        self._year   = 0
        return self._obs(), {}

    def step(self, action: int):
        policy = POLICY_NAMES[int(action)]

        prev_pop  = self._state.population
        prev_econ = self._state.economy

        self._state = sim_step(self._state, policy)
        self._year  += 1

        obs  = self._obs()
        done = self._year >= MAX_YEARS

        # --- Reward shaping ---
        pop_growth  = (self._state.population - prev_pop) / max(prev_pop, 1) * 100
        econ_growth = (self._state.economy - prev_econ) / max(prev_econ, 1) * 10
        disease_pen = - self._state.disease_rate * 0.02
        climate_pen = - max(0, self._state.climate - 30) * 0.03
        legit_bonus = (self._state.legitimacy - 50.0) * 0.02

        if is_revolution_triggered(self._state):
            reward = -20.0   # Hard penalty for revolution
            done   = True
        elif self._state.is_collapsed():
            reward = -50.0
            done   = True
        else:
            reward = float(pop_growth + econ_growth + disease_pen + climate_pen + legit_bonus)

        truncated = False
        return obs, reward, done, truncated, {}

    def render(self):
        print(f"Year {self._year}: Pop={self._state.population:,} | "
              f"Disease={self._state.disease_rate:.1f} | "
              f"Climate={self._state.climate:.1f} | "
              f"Legitimacy={self._state.legitimacy:.1f}")
