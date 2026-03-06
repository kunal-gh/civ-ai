"""
event_engine.py
---------------
Generative AI event system powered by Google Gemini 2.0 Flash.

v2 additions:
  - Supports new variables (disease_rate, military, climate)
  - Boss Scenarios: Every 8-12 years, a massive unpredictable event triggers,
    forcing player adaptation (Plague Inc style random mutations/disasters).
"""

import os
import json
import random
import re
import google.generativeai as genai
from dotenv import load_dotenv
from src.world_state import WorldState

load_dotenv()

_GEMINI_CONFIGURED = False

def _ensure_gemini():
    global _GEMINI_CONFIGURED
    if not _GEMINI_CONFIGURED:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            genai.configure(api_key=api_key)
            _GEMINI_CONFIGURED = True
    return _GEMINI_CONFIGURED


_PROMPT_TEMPLATE = """You are a world-event generator for a civilization simulation game.
Current civilization state (Year {year}):
  - Population  : {population:,}
  - Food        : {fpc:.2f} per capita
  - Pollution   : {pollution:.0f}/100
  - Economy     : ${economy:.1f}T
  - Happiness   : {happiness:.0f}%
  - Legitimacy  : {legitimacy:.0f}%
  - Technology  : Level {technology:.0f}
  - Disease Rate: {disease_rate:.0f}/100 (epidemic pressure)
  - Military    : {military:.0f}/100 (defense capability)
  - Climate     : {climate:.0f}/100 (ecological damage)

IS BOSS EVENT: {is_boss}
(If TRUE: Generate a MASSIVE, history-altering disaster or breakthrough that drastically shifts multiple variables.
 If FALSE: Generate a standard geopolitically realistic annual event.)

Generate ONE event as VALID JSON (no markdown, no explanation):
{{
  "event": "<2-3 sentence narrative description>",
  "severity": "<minor|moderate|major|BOSS>",
  "effects": {{
    "population": <integer delta>,
    "food": <integer delta>,
    "economy": <float delta>,
    "happiness": <float delta>,
    "pollution": <float delta>,
    "legitimacy": <float delta>,
    "disease_rate": <float delta (positive means worse disease)>,
    "military": <float delta>,
    "climate": <float delta>,
    "technology": <float delta>
  }}
}}
Return ONLY the JSON object. Effects for BOSS events should be extreme (e.g. ±40%)."""


def _build_prompt(state: WorldState, is_boss: bool) -> str:
    return _PROMPT_TEMPLATE.format(
        year         = state.year,
        population   = state.population,
        fpc          = state.food_per_capita(),
        pollution    = state.pollution,
        economy      = state.economy,
        happiness    = state.happiness,
        legitimacy   = state.legitimacy,
        technology   = state.technology,
        disease_rate = state.disease_rate,
        military     = state.military,
        climate      = state.climate,
        is_boss      = "TRUE" if is_boss else "FALSE"
    )

def _gemini_event(state: WorldState, is_boss: bool) -> dict:
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = _build_prompt(state, is_boss)
    response = model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```"):
        text = re.sub(r"```[a-z]*\n?", "", text).strip("`").strip()
    return json.loads(text)

# ----------------- Heuristic Fallbacks -----------------

def _local_boss_event(state: WorldState) -> dict:
    """Hardcoded massive shifts if Gemini is offline."""
    boss_pool = [
        {
            "event": "A highly contagious novel virus leaps from an animal reservoir. "
                     "Hospitals are completely overrun, borders shut down, and the economy paralyzes.",
            "severity": "BOSS",
            "effects": {"disease_rate": 60.0, "population": -int(state.population * 0.25),
                        "economy": -state.economy * 0.4, "happiness": -30.0, "military": -20.0}
        },
        {
            "event": "A coordinated cyber-kinetic attack by an unknown superpower cripples "
                     "the national grid and destroys military installations.",
            "severity": "BOSS",
            "effects": {"military": -state.military * 0.7, "energy": -state.energy * 0.6,
                        "economy": -state.economy * 0.3, "legitimacy": -25.0}
        },
        {
            "event": "Decades of pollution trigger an irreversible ecological tipping point. "
                     "Super-storms ravage the coasts, permanently destroying agricultural yields.",
            "severity": "BOSS",
            "effects": {"climate": 40.0, "food": -state.food * 0.5, "pollution": 20.0,
                        "population": -int(state.population * 0.1)}
        },
        {
            "event": "An unexpected breakthrough in quantum computing and synthetic biology "
                     "creates a utopian technological leap, revolutionizing all industries overnight.",
            "severity": "BOSS",
            "effects": {"technology": 150.0, "economy": state.economy * 1.0, "energy": state.energy * 1.5,
                        "disease_rate": -40.0, "happiness": 40.0}
        }
    ]
    return random.choice(boss_pool)


def _local_event(state: WorldState) -> dict:
    """Standard random generic event."""
    pool = [
        {"event": "A localized crop blight reduces harvests slightly.", "severity": "minor", "effects": {"food": -int(state.food * 0.1)}},
        {"event": "Military exercises reveal vulnerabilities, lowering morale.", "severity": "minor", "effects": {"military": -5.0, "happiness": -2.0}},
        {"event": "A minor flu outbreak strains local clinics.", "severity": "minor", "effects": {"disease_rate": 8.0, "happiness": -3.0}},
        {"event": "Tech sector booms after a new patent filing.", "severity": "moderate", "effects": {"technology": 10.0, "economy": state.economy * 0.1}},
        {"event": "Climate protests force factories to temporarily close.", "severity": "moderate", "effects": {"pollution": -5.0, "economy": -state.economy * 0.05, "climate": -2.0}}
    ]
    return random.choice(pool)


def generate_event(state: WorldState, is_boss: bool = False) -> dict:
    if _ensure_gemini():
        try:
            return _gemini_event(state, is_boss)
        except Exception as exc:
            print(f"[EventEngine] Gemini unavailable ({type(exc).__name__}), using local fallback.")

    return _local_boss_event(state) if is_boss else _local_event(state)
