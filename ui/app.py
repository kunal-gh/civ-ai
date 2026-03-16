"""
app.py — AXIOM Streamlit Dashboard v3
Adds: Multi-target ML predictions, LSTM 5-year forecast, Anomaly detection, PPO RL Advisor
"""

import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

from src.world_state import WorldState, SCENARIO_SEEDS
from src.simulation_engine import step, apply_event, is_revolution_triggered
from src.event_engine import generate_event
from src.ml_model import load_model, predict_and_explain, TARGET_LABELS

# ---------------------------------------------------------------------------
# Page config & CSS
# ---------------------------------------------------------------------------
st.set_page_config(page_title="AXIOM v3", page_icon="🌍", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Inter:wght@400;600&display=swap');
    html, body, .stApp { background:#0a0a14; color:#e0e0f0; font-family:'Inter',sans-serif; }
    h1,h2,h3 { font-family:'Orbitron',sans-serif; }
    .main-title { font-size:2.6rem; font-weight:800; font-family:'Orbitron',sans-serif;
                  background:linear-gradient(135deg,#00e5ff,#7c4dff); -webkit-background-clip:text;
                  -webkit-text-fill-color:transparent; }
    .event-box  { background:#0f1a2a; border-left:4px solid #00e5ff; padding:12px 16px; border-radius:6px; margin-top:8px; }
    .boss-box   { background:#1a0505; border-left:6px solid #ff1744; padding:16px; border-radius:8px;
                  margin-top:12px; animation:pulse 2s infinite; }
    .anomaly-box{ background:#1a1200; border-left:4px solid #ffb300; padding:10px 14px; border-radius:6px; margin-top:6px; }
    .revolution { background:#2a0000; border-left:4px solid #ff1744; padding:12px 16px; border-radius:6px; }
    .rl-box     { background:#0a1a0a; border-left:4px solid #00e676; padding:10px 14px; border-radius:6px; margin-top:6px; }
    @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(255,23,68,.4)} 70%{box-shadow:0 0 0 10px rgba(255,23,68,0)} 100%{box-shadow:0 0 0 0 rgba(255,23,68,0)} }
    div[data-testid="metric-container"] { background:#111126; border:1px solid #1e1e3a; border-radius:8px; padding:8px; }
    div[data-testid="stSidebar"] { background:#0d0d1f; }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Session State Init
# ---------------------------------------------------------------------------
def _init_session(scenario_name: str = "Balanced Start"):
    ws = SCENARIO_SEEDS[scenario_name]
    st.session_state.state   = ws.to_dict()
    st.session_state.year    = ws.year
    st.session_state.history = {k: [] for k in
        ["year","population","food","energy","technology","pollution",
         "economy","happiness","legitimacy","disease_rate","military","climate"]}
    st.session_state.seq_buffer  = []   # rolling 15-year window for LSTM
    st.session_state.last_event  = None
    st.session_state.boss_active = False
    st.session_state.revolution  = False
    st.session_state.era_reports = []
    st.session_state.started     = True

if "started" not in st.session_state:
    _init_session()

# Load all models once
if "models_loaded" not in st.session_state:
    multi_rf, single_rf, centroid_data, anomaly_model = load_model()
    st.session_state.multi_rf      = multi_rf
    st.session_state.single_rf     = single_rf
    st.session_state.centroid_data = centroid_data
    st.session_state.anomaly_model = anomaly_model

    # LSTM
    try:
        from src.lstm_model import load_lstm
        lstm_model, lstm_norm = load_lstm()
    except Exception:
        lstm_model, lstm_norm = None, None
    st.session_state.lstm_model = lstm_model
    st.session_state.lstm_norm  = lstm_norm

    # PPO agent
    try:
        from stable_baselines3 import PPO
        agent = PPO.load("models/ppo_advisor") if __import__("os").path.exists("models/ppo_advisor.zip") else None
    except Exception:
        agent = None
    st.session_state.ppo_agent = agent
    st.session_state.models_loaded = True

ws = WorldState.from_dict(st.session_state.state)

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## ⚙️ AXIOM v3")

    if st.session_state.year % 8 == 0 and st.session_state.year > 1:
        st.session_state.boss_active = True

    if st.session_state.year <= 1:
        scenario = st.selectbox("Starting Scenario", list(SCENARIO_SEEDS.keys()))
        if st.button("🔄 New Game"):
            _init_session(scenario)
            st.rerun()

    st.divider()

    if st.session_state.boss_active:
        st.error("🚨 **GLOBAL CRISIS — BOSS SHIFT**")
        boss_choice = st.selectbox("Choose Trajectory", ["(Select)"] + list(SCENARIO_SEEDS.keys()))
        if st.button("⚡ EXECUTE SHIFT", type="primary") and boss_choice != "(Select)":
            seed = SCENARIO_SEEDS[boss_choice]
            ws.population    = int(ws.population * 0.7 + seed.population * 0.3)
            ws.disease_rate  = max(ws.disease_rate, seed.disease_rate)
            ws.military      = max(ws.military, seed.military)
            ws.climate       = max(ws.climate, seed.climate)
            ws.technology   += seed.technology * 0.2
            ws.year         += 1
            st.session_state.state = ws.to_dict()
            st.session_state.boss_active = False
            st.session_state.last_event  = {"event":f"Paradigm shifted to **{boss_choice}**.","severity":"BOSS"}
            st.rerun()
    else:
        policy_label = st.radio("📜 National Policy",
            ["🌾 Agriculture","🏭 Industry","🎓 Education","🌿 Environment","🛡️ Military","🏥 Healthcare"])
        policy_map = {
            "🌾 Agriculture":"agriculture","🏭 Industry":"industry","🎓 Education":"education",
            "🌿 Environment":"environment","🛡️ Military":"military_buildup","🏥 Healthcare":"healthcare"}
        policy = policy_map[policy_label]

        # PPO advisor hint
        if st.session_state.ppo_agent:
            from src.rl_env import OBS_KEYS
            obs = np.array([getattr(ws, k) for k in OBS_KEYS], dtype=np.float32) / 1e5
            obs = np.clip(obs, 0, 1)
            action, _ = st.session_state.ppo_agent.predict(obs, deterministic=True)
            from src.world_state import POLICY_NAMES
            suggested = POLICY_NAMES[int(action)]
            st.markdown(f'<div class="rl-box">🤖 <b>AI Advisor suggests:</b> {suggested}</div>', unsafe_allow_html=True)

        if st.button("▶️ Advance One Year", use_container_width=True, type="primary"):
            for key in st.session_state.history:
                val = getattr(ws, key) if hasattr(ws, key) else ws.year
                st.session_state.history[key].append(val)

            # Build seq buffer for LSTM
            feat_vec = ws.as_feature_vector(policy).tolist()
            st.session_state.seq_buffer.append(feat_vec)
            if len(st.session_state.seq_buffer) > 15:
                st.session_state.seq_buffer = st.session_state.seq_buffer[-15:]

            ws_new = step(ws, policy)
            is_boss_year = (ws_new.year % 12 == 0)
            event  = generate_event(ws_new, is_boss=is_boss_year)
            ws_new = apply_event(ws_new, event.get("effects", {}))
            ws_new = ws_new.apply_bounds()
            st.session_state.last_event = event

            if is_revolution_triggered(ws_new):
                ws_new.legitimacy = 35.0
                ws_new.economy   *= 0.60
                ws_new.military  *= 0.50
                st.session_state.revolution = True

            if ws_new.year % 10 == 0:
                tone = "prosperity" if ws_new.happiness > 60 else "struggle"
                st.session_state.era_reports.append(
                    {"title":f"Era {ws_new.year}","body":f"Decade of {tone}. Pop:{ws_new.population:,} | Tech:{ws_new.technology:.0f}"})

            st.session_state.state = ws_new.to_dict()
            st.rerun()

    st.divider()
    if st.session_state.last_event:
        ev = st.session_state.last_event
        is_boss = ev.get("severity") == "BOSS"
        box_class = "boss-box" if is_boss else "event-box"
        color = "#ff1744" if is_boss else "#00e5ff"
        st.markdown(f"""<div class="{box_class}">
        <b style="color:{color}">📰 Year {st.session_state.year - 1} — {ev.get('severity','?').upper()}</b><br><br>
        {ev.get('event','')}</div>""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Main UI
# ---------------------------------------------------------------------------
st.markdown(f'<div class="main-title">🌍 AXIOM v3 — Year {ws.year}</div>', unsafe_allow_html=True)

if ws.is_collapsed():
    st.error("💀 **Civilization Collapse** — Society ceased to exist.")
    st.stop()
if st.session_state.revolution:
    st.markdown('<div class="revolution"><b>🔥 REVOLUTION!</b> Legitimacy collapsed. Economy and military devastated.</div>', unsafe_allow_html=True)
    st.session_state.revolution = False

def get_delta(metric):
    hist = st.session_state.history[metric]
    if len(hist) < 1: return None
    diff = getattr(ws, metric) - hist[-1]
    return None if abs(diff) < 0.01 else (int(diff) if metric == "population" else float(round(diff, 2)))

# Row 1 — Primary Metrics
r1 = st.columns(6)
r1[0].metric("🧑 Population",  f"{ws.population:,}",       delta=get_delta("population"))
r1[1].metric("🌾 Food",        f"{ws.food:,.0f}",          delta=get_delta("food"))
r1[2].metric("⚡ Energy",      f"{ws.energy:,.0f}",        delta=get_delta("energy"))
r1[3].metric("💰 Economy",     f"${ws.economy:.1f}T",      delta=get_delta("economy"))
r1[4].metric("😊 Happiness",   f"{ws.happiness:.1f}%",     delta=get_delta("happiness"))
r1[5].metric("🏛 Legitimacy",  f"{ws.legitimacy:.1f}%",    delta=get_delta("legitimacy"))

st.markdown("<div style='height:6px'></div>", unsafe_allow_html=True)

# Row 2 — Threat Metrics
r2 = st.columns(5)
r2[0].metric("🔬 Technology",  f"Lv {ws.technology:.0f}", delta=get_delta("technology"))
r2[1].metric("🌫 Pollution",   f"{ws.pollution:.1f}/100",  delta=get_delta("pollution"),   delta_color="inverse")
r2[2].metric("🛡️ Military",    f"{ws.military:.1f}/100",   delta=get_delta("military"))
r2[3].metric("🦠 Disease",     f"{ws.disease_rate:.1f}/100",delta=get_delta("disease_rate"),delta_color="inverse")
r2[4].metric("🔥 Climate",     f"{ws.climate:.1f}/100",    delta=get_delta("climate"),      delta_color="inverse")

st.divider()

# ---------------------------------------------------------------------------
# ML Panels — 4 columns
# ---------------------------------------------------------------------------
policy_current = "agriculture" if st.session_state.boss_active else policy_map.get(policy_label, "agriculture")

c1, c2, c3, c4 = st.columns([1, 1.2, 1.5, 1.5])

with c1:
    st.subheader("🤖 Multi-target Predictor")
    if st.session_state.multi_rf and not st.session_state.boss_active:
        preds, importances, conf, is_anomaly = predict_and_explain(
            st.session_state.multi_rf, st.session_state.single_rf,
            st.session_state.centroid_data, st.session_state.anomaly_model,
            ws, policy_current)
        conf_color = {"HIGH":"🟢","MEDIUM":"🟡","LOW":"🔴"}.get(conf,"⚪")
        st.caption(f"OOD Confidence: {conf_color} **{conf}**")

        for label, val in preds.items():
            short = label.replace("Δ ","").lower()
            icon = {"population":"👥","economy":"💰","climate":"🔥","disease rate":"🦠","legitimacy":"🏛"}.get(short, "→")
            delta_color = "inverse" if short in ("climate","disease rate") else "normal"
            st.metric(f"{icon} {label}", f"{val:+.1f}", delta=round(val, 1), delta_color=delta_color)

        if is_anomaly:
            st.markdown('<div class="anomaly-box">⚠️ <b>Anomaly Detected</b> — Unusual state combo. High risk of cascading failure.</div>', unsafe_allow_html=True)
    else:
        importances = {}
        st.info("ML paused during Boss event or model not found.")

with c2:
    st.subheader("📊 XAI — Feature Importance")
    if importances and not st.session_state.boss_active:
        top_features = dict(list(importances.items())[:8])
        imp_df = pd.DataFrame({"Feature": list(top_features.keys()),
                               "Importance": list(top_features.values())}).sort_values("Importance")
        fig, ax = plt.subplots(figsize=(4, 3.5))
        bars = ax.barh(imp_df["Feature"], imp_df["Importance"],
                       color=[f"hsl({int(200+100*v)}, 80%, 60%)" for v in imp_df["Importance"]])
        ax.xaxis.set_major_formatter(ticker.PercentFormatter(xmax=1))
        ax.set_facecolor("#0a0a14"); fig.patch.set_facecolor("#0a0a14")
        ax.tick_params(colors="#aaaadd"); ax.spines[:].set_color("#333355")
        ax.set_title("Top Feature Influence", color="#00e5ff", fontsize=9)
        fig.tight_layout()
        st.pyplot(fig); plt.close(fig)

with c3:
    st.subheader("🔮 LSTM 5-Year Forecast")
    lstm = st.session_state.lstm_model
    buf  = st.session_state.seq_buffer
    if lstm and len(buf) >= 3 and not st.session_state.boss_active:
        try:
            from src.lstm_model import predict_trajectory
            # Pad short sequences to 15
            pad  = [buf[0]] * max(0, 15 - len(buf)) + buf[-15:]
            pred = predict_trajectory(lstm, st.session_state.lstm_norm, np.array(pad))
            if pred:
                fig2, ax2 = plt.subplots(figsize=(5, 3.2))
                colors = ["#00e5ff","#00e676","#ff6d00","#ff1744","#7c4dff"]
                for i, (lbl, val) in enumerate(pred.items()):
                    ax2.bar(lbl.replace("Δ ",""), val, color=colors[i % len(colors)])
                ax2.axhline(0, color="#555577", linewidth=0.8)
                ax2.set_ylabel("Predicted Δ", color="#aaaadd")
                ax2.set_facecolor("#0a0a14"); fig2.patch.set_facecolor("#0a0a14")
                ax2.tick_params(colors="#aaaadd", axis="x", rotation=20)
                ax2.spines[:].set_color("#333355")
                ax2.set_title("Projected Changes", color="#00e5ff", fontsize=9)
                fig2.tight_layout()
                st.pyplot(fig2); plt.close(fig2)
        except Exception as e:
            st.caption(f"LSTM preview: {e}")
    else:
        st.info("Play 3+ years for LSTM forecast." if not lstm else "LSTM model not found — run training/train.py.")

with c4:
    st.subheader("📈 Historical Trends")
    if len(st.session_state.history["year"]) > 0:
        hist = st.session_state.history
        df   = pd.DataFrame(hist).set_index("year")
        fig3, ax3 = plt.subplots(figsize=(5.5, 3.5))
        ax3.plot(df.index, df["population"], color="#00e5ff", label="Population", linewidth=2)
        ax4 = ax3.twinx()
        ax4.plot(df.index, df["disease_rate"], "r--", label="Disease", linewidth=1.4)
        ax4.plot(df.index, df["climate"],      color="#ff6d00", linestyle="-.", label="Climate", linewidth=1.4)
        ax4.plot(df.index, df["legitimacy"],   color="#00e676", linestyle=":",  label="Legitimacy", linewidth=1.4)
        ax4.set_ylim(0, 100)
        for ax in (ax3, ax4):
            ax.set_facecolor("#0a0a14"); ax.tick_params(colors="#aaaadd"); ax.spines[:].set_color("#333355")
        fig3.patch.set_facecolor("#0a0a14")
        lines_a, lab_a = ax3.get_legend_handles_labels()
        lines_b, lab_b = ax4.get_legend_handles_labels()
        ax3.legend(lines_a+lines_b, lab_a+lab_b, loc="upper left", fontsize=7,
                   facecolor="#0a0a14", labelcolor="#aaaadd")
        fig3.tight_layout()
        st.pyplot(fig3); plt.close(fig3)

# Era Reports
if st.session_state.era_reports:
    with st.expander(f"📜 Era Archives ({len(st.session_state.era_reports)})"):
        for r in reversed(st.session_state.era_reports):
            st.markdown(f"**{r['title']}**: {r['body']}")
