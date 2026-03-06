"""
event_engine.py
---------------
Generative AI event system powered by Google Gemini 2.0 Flash.

Each year, the engine receives the current WorldState and generates a
contextual world event with:
  - A 2–3 sentence narrative description
  - Structured numeric effects on world state variables

Automatic local fallback activates when the Gemini API is unavailable
(rate limit, no internet, bad key) so the simulation never stalls.
"""

import os
import json
import random
import re
import google.generativeai as genai
from dotenv import load_dotenv
from src.world_state import WorldState

load_dotenv()

# ---------------------------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------------------------

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
  - Food supply : {food_level} (ratio to population: {fpc:.2f})
  - Pollution   : {pollution:.0f}/100
  - Economy     : ${economy:.1f}T
  - Happiness   : {happiness:.0f}%
  - Legitimacy  : {legitimacy:.0f}%
  - Technology  : Level {technology:.0f}

Generate ONE geopolitically realistic event as VALID JSON (no markdown, no explanation):
{{
  "event": "<2-3 sentence narrative description of what happened>",
  "severity": "<minor|moderate|major>",
  "effects": {{
    "food": <integer delta, can be negative>,
    "population": <integer delta, can be negative>,
    "economy": <float delta>,
    "happiness": <float delta -30 to +20>,
    "pollution": <float delta>,
    "legitimacy": <float delta -20 to +15>
  }}
}}

Rules:
- Effects must be proportional to severity: minor ±5%, moderate ±15%, major ±30%
- Use the current state to make the event contextually relevant
- Do NOT include fields outside the effects dict above
- Return ONLY the JSON object, nothing else"""


def _build_prompt(state: WorldState) -> str:
    fpc = state.food_per_capita()
    food_level = "critical" if fpc < 0.3 else "low" if fpc < 0.7 else "adequate" if fpc < 1.5 else "abundant"
    return _PROMPT_TEMPLATE.format(
        year       = state.year,
        population = state.population,
        food_level = food_level,
        fpc        = fpc,
        pollution  = state.pollution,
        economy    = state.economy,
        happiness  = state.happiness,
        legitimacy = state.legitimacy,
        technology = state.technology,
    )


def _gemini_event(state: WorldState) -> dict:
    """Call Gemini 2.0 Flash and parse the structured JSON response."""
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = _build_prompt(state)
    response = model.generate_content(prompt)
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"```[a-z]*\n?", "", text).strip("`").strip()

    event = json.loads(text)
    return event


# ---------------------------------------------------------------------------
# Local heuristic fallback
# ---------------------------------------------------------------------------

def _local_event(state: WorldState) -> dict:
    """
    Contextual rule-based event generator used when Gemini is unavailable.
    Reads current state and fires the most thematically relevant event.
    """
    candidates = []

    # State-conditional contextual events
    fpc = state.food_per_capita()
    if fpc < 0.3:
        candidates.append({
            "event": "A severe famine grips the nation as food stores collapse. "
                     "Mass exodus begins from rural areas as communities disintegrate.",
            "severity": "major",
            "effects": {"population": -int(state.population * 0.12), "happiness": -25.0, "legitimacy": -15.0}
        })

    if state.pollution > 80:
        candidates.append({
            "event": "Toxic smog blankets major urban centres, causing widespread "
                     "respiratory illness and sparking environmental protests.",
            "severity": "major",
            "effects": {"population": -int(state.population * 0.05), "happiness": -18.0,
                        "economy": -12.0, "legitimacy": -10.0}
        })

    if state.legitimacy < 15:
        candidates.append({
            "event": "A military coup overthrows the central government amid mass protests. "
                     "Infrastructure collapses and foreign investors flee the country.",
            "severity": "major",
            "effects": {"economy": -30.0, "happiness": -20.0, "legitimacy": 20.0,  # resets after coup
                        "food": -int(state.food * 0.1)}
        })

    if state.technology > 150 and state.happiness < 30:
        candidates.append({
            "event": "Automation displaces 40% of the workforce. Public anger at tech "
                     "corporations peaks as unemployment lines snake through city streets.",
            "severity": "major",
            "effects": {"happiness": -15.0, "economy": -10.0, "legitimacy": -12.0}
        })

    if state.food > state.population * 1.5 and state.happiness > 75:
        candidates.append({
            "event": "A cultural and scientific renaissance begins. Lower stress levels and "
                     "abundant resources spark an era of unprecedented innovation.",
            "severity": "moderate",
            "effects": {"technology": 20.0, "happiness": 8.0, "economy": 15.0, "legitimacy": 5.0}
        })

    # Generic random events (always available)
    random_pool = [
        {"event": "Mild flooding damages croplands but government relief arrives quickly.",
         "severity": "minor", "effects": {"food": -int(state.food * 0.08), "happiness": -3.0}},
        {"event": "A surprise trade agreement opens lucrative export markets, boosting the treasury.",
         "severity": "moderate", "effects": {"economy": 18.0, "happiness": 5.0, "legitimacy": 4.0}},
        {"event": "A talented research team announces a breakthrough in renewable energy storage.",
         "severity": "moderate", "effects": {"technology": 15.0, "energy": int(state.energy * 0.12), "pollution": -5.0}},
        {"event": "A mild pandemic spreads through dense urban areas, straining healthcare systems.",
         "severity": "moderate", "effects": {"population": -int(state.population * 0.03), "happiness": -8.0, "economy": -6.0}},
        {"event": "Bumper harvests exceed forecasts, filling national food reserves to capacity.",
         "severity": "minor", "effects": {"food": int(state.food * 0.18), "happiness": 4.0}},
        {"event": "A major earthquake damages infrastructure in an industrial region.",
         "severity": "moderate", "effects": {"energy": -int(state.energy * 0.1), "economy": -10.0, "happiness": -6.0}},
    ]

    # Weight: if contextual events exist, 70% chance to use one
    if candidates and random.random() < 0.70:
        return random.choice(candidates)
    return random.choice(random_pool)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_event(state: WorldState) -> dict:
    """
    Generate a contextual world event for the current civilization state.
    Tries Gemini 2.0 Flash first; falls back to local engine on any error.

    Returns:
        dict with keys: 'event' (str), 'severity' (str), 'effects' (dict)
    """
    if _ensure_gemini():
        try:
            return _gemini_event(state)
        except Exception as exc:
            # Log to console but never crash the simulation
            print(f"[EventEngine] Gemini unavailable ({type(exc).__name__}), using local fallback.")

    return _local_event(state)
