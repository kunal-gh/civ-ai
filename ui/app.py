"""
app.py
------
CIV-AI Streamlit Dashboard

Interactive civilization simulator combining:
  - Deterministic simulation engine
  - Random Forest ML predictor with feature importance (XAI)
  - Gemini 2.0 Flash generative event engine
  - 8-variable historical tracking and time-series charts
  - Legitimacy / revolution system
  - Scenario seed selection
"""

import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

from src.world_state import WorldState, POLICY_NAMES, SCENARIO_SEEDS
from src.simulation_engine import step, apply_event, is_revolution_triggered
from src.event_engine import generate_event
from src.ml_model import load_model, predict_and_explain

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="CIV-AI Civilization Simulator",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------

st.markdown("""
<style>
    .main-title { font-size: 2.4rem; font-weight: 800; }
    .subtitle   { color: #888; font-size: 1rem; margin-top: -12px; }
    .event-box  { background: #1a1a2e; border-left: 4px solid #e94560;
                  padding: 12px 16px; border-radius: 6px; margin-top: 12px; }
    .revolution { background: #3b0d0d; border-left: 4px solid #ff0000;
                  padding: 12px 16px; border-radius: 6px; }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------

def _init_session(scenario_name: str = "Balanced Start"):
    ws = SCENARIO_SEEDS[scenario_name]
    st.session_state.state    = ws.to_dict()
    st.session_state.year     = ws.year
    st.session_state.history  = {k: [] for k in
        ["year", "population", "food", "energy", "technology",
         "pollution", "economy", "happiness", "legitimacy"]}
    st.session_state.last_event     = None
    st.session_state.revolution     = False
    st.session_state.era_reports    = []
    st.session_state.started        = True


if "started" not in st.session_state:
    _init_session()

# Load ML model once
if "model" not in st.session_state:
    model, centroid_data = load_model()
    st.session_state.model         = model
    st.session_state.centroid_data = centroid_data


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("## ⚙️ Simulation Controls")

    # Scenario seed picker (only before year 2)
    if st.session_state.year <= 1:
        scenario = st.selectbox("Starting Scenario", list(SCENARIO_SEEDS.keys()))
        if st.button("🔄 New Game"):
            _init_session(scenario)
            st.rerun()

    st.divider()

    policy_label = st.radio(
        "📜 National Policy",
        ["🌾 Agriculture", "🏭 Industry", "🎓 Education", "🌿 Environment"],
    )
    policy_map = {
        "🌾 Agriculture": "agriculture",
        "🏭 Industry":    "industry",
        "🎓 Education":   "education",
        "🌿 Environment": "environment",
    }
    policy = policy_map[policy_label]

    run_btn = st.button("▶️  Advance One Year", use_container_width=True, type="primary")

    st.divider()
    if st.session_state.last_event:
        ev = st.session_state.last_event
        sev_color = {"minor": "#4CAF50", "moderate": "#FF9800", "major": "#F44336"}.get(ev.get("severity","minor"), "#888")
        st.markdown(f"""
        <div class="event-box">
        <b style="color:{sev_color}">📰 Year {st.session_state.year - 1} Event — {ev.get('severity','?').upper()}</b><br><br>
        {ev.get('event','No event description.')}
        </div>""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Main header
# ---------------------------------------------------------------------------

state_dict = st.session_state.state
ws         = WorldState.from_dict(state_dict)

st.markdown(f'<div class="main-title">🌍 CIV-AI — Year {ws.year}</div>', unsafe_allow_html=True)

# Collapse check
if ws.is_collapsed():
    st.error("💀 **Civilisation Collapse** — Your society has ceased to exist. Start a new game.")
    if st.button("Restart"):
        _init_session()
        st.rerun()
    st.stop()

# Revolution check
if st.session_state.revolution:
    st.markdown('<div class="revolution"><b>🔥 REVOLUTION!</b> Public trust collapsed to zero. '
                "A forced governmental change has occurred — legitimacy reset, but economy took a heavy hit.</div>",
                unsafe_allow_html=True)
    st.session_state.revolution = False


# ---------------------------------------------------------------------------
# Metrics row
# ---------------------------------------------------------------------------

m_cols = st.columns(8)
fields = [
    ("🧑‍🤝‍🧑 People",  f"{ws.population:,}"),
    ("🌾 Food",       f"{ws.food:,.0f}"),
    ("⚡ Energy",     f"{ws.energy:,.0f}"),
    ("🔬 Tech",       f"Lv {ws.technology:.0f}"),
    ("🌫 Pollution",  f"{ws.pollution:.1f}/100"),
    ("💰 Economy",    f"${ws.economy:.1f}T"),
    ("😊 Happiness",  f"{ws.happiness:.1f}%"),
    ("🏛 Legitimacy", f"{ws.legitimacy:.1f}%"),
]
for col, (label, val) in zip(m_cols, fields):
    col.metric(label, val)


# ---------------------------------------------------------------------------
# ML Prediction & Explainability
# ---------------------------------------------------------------------------

st.divider()
ml_col, xai_col = st.columns([1, 2])

with ml_col:
    st.subheader("🤖 ML Prediction")
    if st.session_state.model:
        pred_delta, importances, confidence = predict_and_explain(
            st.session_state.model,
            st.session_state.centroid_data,
            ws, policy
        )
        conf_color = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴", "UNKNOWN": "⚪"}.get(confidence, "⚪")
        direction = "📈 +" if pred_delta >= 0 else "📉 "
        st.metric("Predicted Population Δ", f"{direction}{pred_delta:,}")
        st.caption(f"Model Confidence: {conf_color} **{confidence}**")
        if confidence == "LOW":
            st.warning("⚠️ The current state is far outside the training distribution. "
                       "Prediction reliability is reduced.")
    else:
        st.info("Run `python training/train.py` to activate ML predictions.")
        importances = {}

with xai_col:
    st.subheader("📊 Feature Importance (Explainability)")
    if importances:
        imp_df = pd.DataFrame({
            "Feature":    list(importances.keys()),
            "Importance": list(importances.values()),
        }).sort_values("Importance", ascending=True)

        fig, ax = plt.subplots(figsize=(6, 3.5))
        bars = ax.barh(imp_df["Feature"], imp_df["Importance"],
                       color=["#4fc3f7" if i < len(imp_df)-1 else "#e94560"
                              for i in range(len(imp_df))])
        ax.set_xlabel("Feature Importance")
        ax.set_title("What's driving this prediction?", fontsize=11)
        ax.xaxis.set_major_formatter(ticker.PercentFormatter(xmax=1))
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)
    else:
        st.caption("Feature importance chart appears after model is trained.")


# ---------------------------------------------------------------------------
# Historical Charts
# ---------------------------------------------------------------------------

st.divider()
st.subheader("📈 Civilization History")

if len(st.session_state.history["year"]) > 0:
    df_hist = pd.DataFrame(st.session_state.history).set_index("year")
    chart_cols = st.columns(4)

    for col, (metric, color) in zip(chart_cols, [
        ("population", "#4fc3f7"),
        ("pollution",  "#e94560"),
        ("economy",    "#66bb6a"),
        ("legitimacy", "#ffa726"),
    ]):
        with col:
            fig, ax = plt.subplots(figsize=(3.5, 2.5))
            ax.plot(df_hist.index, df_hist[metric], color=color, linewidth=2)
            ax.fill_between(df_hist.index, df_hist[metric], alpha=0.15, color=color)
            ax.set_title(metric.capitalize(), fontsize=10)
            ax.set_xlabel("Year", fontsize=8)
            ax.tick_params(labelsize=7)
            fig.tight_layout()
            col.pyplot(fig)
            plt.close(fig)
else:
    st.caption("Charts will appear after the first year is simulated.")


# ---------------------------------------------------------------------------
# Era Report Card (every 10 years) — Novel Feature #5
# ---------------------------------------------------------------------------

if st.session_state.era_reports:
    with st.expander(f"📜 Era Reports ({len(st.session_state.era_reports)} eras)", expanded=False):
        for report in reversed(st.session_state.era_reports):
            st.markdown(f"**{report['title']}**")
            st.markdown(report['body'])
            st.divider()


# ---------------------------------------------------------------------------
# Year advance logic
# ---------------------------------------------------------------------------

def _era_report(state: WorldState) -> dict:
    """Generate a brief narrative era report every 10 years."""
    pop_m = state.population / 1_000_000
    if state.happiness > 70 and state.economy > 60 and state.pollution < 30:
        tone = "a golden age of prosperity and clean skies"
    elif state.pollution > 70:
        tone = "an ecologically troubled era marked by toxic skies"
    elif state.legitimacy < 20:
        tone = "a period of deep political instability"
    elif state.population < 100_000:
        tone = "near-collapse — a shadow of former glory"
    else:
        tone = "steady if unspectacular development"

    return {
        "title": f"⏳ Era Report — End of Year {state.year - 1}",
        "body":  (f"The decade closed in {tone}. "
                  f"Population: **{pop_m:.2f}M** | "
                  f"Economy: ${state.economy:.1f}T | "
                  f"Pollution: {state.pollution:.0f}/100 | "
                  f"Happiness: {state.happiness:.0f}%"),
    }


if run_btn:
    ws_current = WorldState.from_dict(st.session_state.state)

    # Record history snapshot
    for key in st.session_state.history:
        val = getattr(ws_current, key) if hasattr(ws_current, key) else ws_current.year
        st.session_state.history[key].append(val)

    # Advance simulation (policy + population + legitimacy + bounds + year++)
    ws_new = step(ws_current, policy)

    # Generate event (Gemini or local fallback)
    event = generate_event(ws_new)
    ws_new = apply_event(ws_new, event.get("effects", {}))
    ws_new = ws_new.apply_bounds()
    st.session_state.last_event = event

    # Revolution check
    if is_revolution_triggered(ws_new):
        ws_new.legitimacy = 35.0   # stabilise after revolution
        ws_new.economy   *= 0.70
        st.session_state.revolution = True

    # Era report every 10 years
    if ws_new.year % 10 == 0:
        st.session_state.era_reports.append(_era_report(ws_new))

    st.session_state.state = ws_new.to_dict()
    st.rerun()
