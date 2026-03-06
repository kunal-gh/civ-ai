"""
app.py
------
CIV-AI Streamlit Dashboard — v2 (Dynamic UI Expansion)
"""

import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import time

from src.world_state import WorldState, SCENARIO_SEEDS
from src.simulation_engine import step, apply_event, is_revolution_triggered
from src.event_engine import generate_event
from src.ml_model import load_model, predict_and_explain

# ---------------------------------------------------------------------------
# Page config & CSS
# ---------------------------------------------------------------------------

st.set_page_config(page_title="CIV-AI Simulator v2", page_icon="🌍", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
    .main-title { font-size: 2.4rem; font-weight: 800; }
    .event-box  { background: #1a1a2e; border-left: 4px solid #4fc3f7; padding: 12px 16px; border-radius: 6px; margin-top: 12px; }
    .boss-box   { background: #2a0a0a; border-left: 6px solid #ff0000; padding: 16px; border-radius: 8px; margin-top: 16px; 
                  animation: pulse 2s infinite; }
    .revolution { background: #3b0d0d; border-left: 4px solid #ff0000; padding: 12px 16px; border-radius: 6px; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); } }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Session State Init
# ---------------------------------------------------------------------------

def _init_session(scenario_name: str = "Balanced Start"):
    ws = SCENARIO_SEEDS[scenario_name]
    st.session_state.state    = ws.to_dict()
    st.session_state.year     = ws.year
    st.session_state.history  = {k: [] for k in
        ["year", "population", "food", "energy", "technology",
         "pollution", "economy", "happiness", "legitimacy",
         "disease_rate", "military", "climate"]}
    st.session_state.last_event   = None
    st.session_state.boss_active  = False
    st.session_state.revolution   = False
    st.session_state.era_reports  = []
    st.session_state.started      = True

if "started" not in st.session_state:
    _init_session()

if "model" not in st.session_state:
    model, centroid_data = load_model()
    st.session_state.model         = model
    st.session_state.centroid_data = centroid_data

ws = WorldState.from_dict(st.session_state.state)


# ---------------------------------------------------------------------------
# Sidebar (Simulation Controls & Boss Triggers)
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("## ⚙️ Simulation")

    # Boss Trigger (Every 8 Years)
    if st.session_state.year % 8 == 0 and st.session_state.year > 1:
        st.session_state.boss_active = True

    if st.session_state.year <= 1:
        scenario = st.selectbox("Starting Scenario", list(SCENARIO_SEEDS.keys()))
        if st.button("🔄 Restart Game"):
            _init_session(scenario)
            st.rerun()
            
    st.divider()

    if st.session_state.boss_active:
        st.error("⚠️ **GLOBAL SHIFT IMMINENT**")
        st.markdown("A major paradigm shift is occurring. Choose how your civilization adapts:")
        boss_choice = st.selectbox("Select Scenario Infusion", ["(Select Paradigm)"] + list(SCENARIO_SEEDS.keys()))
        if st.button("🚨 TRIGGER BOSS SHIFT", type="primary") and boss_choice != "(Select Paradigm)":
            # Apply the scenario properties over the current state
            seed = SCENARIO_SEEDS[boss_choice]
            ws.population = int(ws.population * 0.7 + seed.population * 0.3)
            ws.disease_rate = max(ws.disease_rate, seed.disease_rate)
            ws.military = max(ws.military, seed.military)
            ws.climate = max(ws.climate, seed.climate)
            ws.technology += seed.technology * 0.2
            ws.year += 1  # consume a year
            st.session_state.state = ws.to_dict()
            st.session_state.boss_active = False
            st.session_state.last_event = {
                "event": f"The world paradigm violently shifted towards a **{boss_choice}** reality. Demographics and baseline parameters have permanently altered.",
                "severity": "BOSS"
            }
            st.rerun()
    else:
        # Standard Turn
        policy_label = st.radio(
            "📜 National Policy",
            ["🌾 Agriculture", "🏭 Industry", "🎓 Education", "🌿 Environment", "🛡️ Military", "🏥 Healthcare"],
        )
        policy_map = {
            "🌾 Agriculture": "agriculture",  "🏭 Industry": "industry",
            "🎓 Education":   "education",    "🌿 Environment": "environment",
            "🛡️ Military":    "military_buildup", "🏥 Healthcare": "healthcare"
        }
        policy = policy_map[policy_label]

        if st.button("▶️ Advance One Year", use_container_width=True, type="primary"):
            # Record History
            for key in st.session_state.history:
                val = getattr(ws, key) if hasattr(ws, key) else ws.year
                st.session_state.history[key].append(val)

            ws_new = step(ws, policy)
            
            # Events
            is_boss_year = (ws_new.year % 12 == 0) # Natural boss events every 12 yrs besides the 8-yr player choice
            event = generate_event(ws_new, is_boss=is_boss_year)
            ws_new = apply_event(ws_new, event.get("effects", {}))
            ws_new = ws_new.apply_bounds()
            st.session_state.last_event = event

            if is_revolution_triggered(ws_new):
                ws_new.legitimacy = 35.0
                ws_new.economy *= 0.60
                ws_new.military *= 0.50
                st.session_state.revolution = True

            # Era Report
            if ws_new.year % 10 == 0:
                tone = "prosperity" if ws_new.happiness > 60 else "struggle"
                st.session_state.era_reports.append(
                    {"title": f"Era {ws_new.year}", "body": f"Decade ended in {tone}. Pop: {ws_new.population:,} | Tech: {ws_new.technology:.0f}"}
                )

            st.session_state.state = ws_new.to_dict()
            st.rerun()

    st.divider()
    if st.session_state.last_event:
        ev = st.session_state.last_event
        is_boss = ev.get("severity") == "BOSS"
        box_class = "boss-box" if is_boss else "event-box"
        color = "#ff4444" if is_boss else "#4fc3f7"
        st.markdown(f"""
        <div class="{box_class}">
        <b style="color:{color}">📰 Year {st.session_state.year - 1} — {ev.get('severity','?').upper()} EVENT</b><br><br>
        {ev.get('event','')}
        </div>""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Main UI - Dynamic Metric Visuals
# ---------------------------------------------------------------------------

st.markdown(f'<div class="main-title">🌍 CIV-AI — Year {ws.year}</div>', unsafe_allow_html=True)

if ws.is_collapsed():
    st.error("💀 **Civilization Collapse** — Your society has ceased to exist.")
    st.stop()
if st.session_state.revolution:
    st.markdown('<div class="revolution"><b>🔥 REVOLUTION!</b> Legitimacy collapsed. Military and Economy decimated.</div>', unsafe_allow_html=True)
    st.session_state.revolution = False

def get_delta(metric):
    hist = st.session_state.history[metric]
    if len(hist) < 1: return None
    diff = getattr(ws, metric) - hist[-1]
    if abs(diff) < 0.01: return None
    return int(diff) if isinstance(diff, int) or metric=="population" else float(diff)

m1, m2, m3, m4, m5, m6 = st.columns(6)
m1.metric("🧑‍🤝‍🧑 Population", f"{ws.population:,}", delta=get_delta("population"))
m2.metric("🌾 Food", f"{ws.food:,.0f}", delta=get_delta("food"))
m3.metric("⚡ Energy", f"{ws.energy:,.0f}", delta=get_delta("energy"))
m4.metric("💰 Economy", f"${ws.economy:.1f}T", delta=get_delta("economy"))
m5.metric("😊 Happiness", f"{ws.happiness:.1f}%", delta=get_delta("happiness"))
m6.metric("🏛 Legitimacy", f"{ws.legitimacy:.1f}%", delta=get_delta("legitimacy"))

st.markdown("<br>", unsafe_allow_html=True)

t1, t2, t3, t4, t5 = st.columns(5)
t1.metric("🔬 Technology", f"Lv {ws.technology:.0f}", delta=get_delta("technology"))
t2.metric("🌫 Pollution", f"{ws.pollution:.1f}/100", delta=get_delta("pollution"), delta_color="inverse")
t3.metric("🛡️ Military", f"{ws.military:.1f}/100", delta=get_delta("military"))
t4.metric("🦠 Disease", f"{ws.disease_rate:.1f}/100", delta=get_delta("disease_rate"), delta_color="inverse")
t5.metric("🔥 Climate", f"{ws.climate:.1f}/100", delta=get_delta("climate"), delta_color="inverse")

st.divider()

# ---------------------------------------------------------------------------
# ML Target Predictor & Dynamic Graphs
# ---------------------------------------------------------------------------

policy_current = "agriculture" if st.session_state.boss_active else policy_map.get(policy_label, "agriculture")

c1, c2, c3 = st.columns([1, 1.5, 1.5])

with c1:
    st.subheader("🤖 ML Predictor")
    if st.session_state.model and not st.session_state.boss_active:
        pred_delta, importances, conf = predict_and_explain(st.session_state.model, st.session_state.centroid_data, ws, policy_current)
        st.metric("Predicted Next Year Δ", f"{pred_delta:,}", delta=pred_delta)
        conf_color = {"HIGH":"🟢","MEDIUM":"🟡","LOW":"🔴"}.get(conf,"⚪")
        st.caption(f"Confidence: {conf_color} **{conf}**")
        if conf == "LOW": st.warning("State anomalous. Low reliability.")
    else:
        importances = {}
        st.info("Predictor paused during Boss events or missing model.")

with c2:
    st.subheader("📊 Model Explainability (XAI)")
    if importances and not st.session_state.boss_active:
        imp_df = pd.DataFrame({"Feature": list(importances.keys()), "Importance": list(importances.values())}).sort_values("Importance")
        fig, ax = plt.subplots(figsize=(5, 3))
        ax.barh(imp_df["Feature"], imp_df["Importance"], color="#4fc3f7")
        ax.xaxis.set_major_formatter(ticker.PercentFormatter(xmax=1))
        ax.set_title("Active Feature Influence")
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)

with c3:
    st.subheader("📈 Dynamic Analytics")
    if len(st.session_state.history["year"]) > 0:
        df = pd.DataFrame(st.session_state.history).set_index("year")
        
        # Using matplotlib instead of st.line_chart to avoid Altair compatibility bugs on Python 3.14
        fig, ax1 = plt.subplots(figsize=(8, 4))
        ax1.set_xlabel("Year")
        ax1.set_ylabel("Population", color="tab:blue")
        ax1.plot(df.index, df["population"], color="tab:blue", label="Population")
        ax1.tick_params(axis="y", labelcolor="tab:blue")
        
        # Secondary axis for the percentage/index metrics (0-100 scale)
        ax2 = ax1.twinx()
        ax2.set_ylabel("Index (0-100)", color="tab:gray")
        ax2.plot(df.index, df["disease_rate"], color="tab:red", linestyle="--", label="Disease Rate")
        ax2.plot(df.index, df["climate"], color="tab:orange", linestyle="-.", label="Climate")
        ax2.plot(df.index, df["legitimacy"], color="tab:green", linestyle=":", label="Legitimacy")
        ax2.set_ylim(0, 100)
        
        # Combine legends
        lines_1, labels_1 = ax1.get_legend_handles_labels()
        lines_2, labels_2 = ax2.get_legend_handles_labels()
        ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc="upper left", bbox_to_anchor=(1.05, 1))
        
        fig.tight_layout()
        st.pyplot(fig)
        plt.close(fig)

if st.session_state.era_reports:
    with st.expander(f"📜 Era Archives ({len(st.session_state.era_reports)})"):
        for r in reversed(st.session_state.era_reports):
            st.markdown(f"**{r['title']}**: {r['body']}")
