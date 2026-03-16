# AXIOM 🌍 — Machine Learning & Emergent Systems Simulator

> **A research-grade AI engineering portfolio project** demonstrating a hybrid Edge/Serverless pipeline. AXIOM combines interactive WebGL/Three.js frontends, deterministic JavaScript simulation engines, Python-based Supervised Machine Learning predictors, and node-based LLM Generative AI event systems into a cohesive, zero-latency web application.

[![Deployed to Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&logoColor=white)](https://civ-ai-nine.vercel.app/)
[![HTML5/JS](https://img.shields.io/badge/Tech-HTML5_|_JS_|_Three.js-orange?logo=javascript&logoColor=white)]()
[![scikit-learn](https://img.shields.io/badge/scikit--learn-RandomForest-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.0%20Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🔬 System Architecture (Hybrid Serverless Pipeline)

AXIOM utilizes a distributed compute model. The high-frequency deterministic physics of the simulation run natively on the client edge in raw JavaScript (`engine.js`), while computationally heavy ML predictions and secure LLM inferencing are routed asynchronously to Vercel Serverless Functions. 

This guarantees a **100% stable framerate** and **zero-latency UI rendering** while waiting for cloud-based AI systems to respond.

```mermaid
flowchart TD
    %% Frontend Edge
    subgraph Client [Client Edge (Browser)]
        A["👤 Player\nPolicy Decision"] 
        B["⚙️ Deterministic Physics Engine\n(engine.js)"]
        C["🌍 17-Dimensional\nContinuous World State"]
        UI["🖥️ Three.js/Canvas\nRender Pipeline"]
    end

    %% Vercel Serverless Cluster
    subgraph Serverless [Vercel Serverless API]
        D["🤖 Python Microservice\npredict.py"]
        E["🧠 scikit-learn\nRandom Forest Regressor"]
        
        F["📡 Node.js Microservice\nevent.js"]
        G["✨ Google Gemini 2.0 Flash\nLLM Inferencing"]
    end

    %% Data Flow
    A --> B
    B --> C
    
    %% Async API Calls
    C -- "POST /api/predict" --> D
    D <--> E
    D -- "Population Forecast & Feature Imps" --> UI

    C -- "POST /api/event" --> F
    F <--> G
    F -- "Structured JSON Narrative" --> UI
    
    %% Local Fallbacks
    C -. "Fallback UI Update" .-> UI

    style Client fill:#1e1e2f,stroke:#4a4a8a,stroke-width:2px,color:#fff
    style Serverless fill:#1e1e2f,stroke:#7b2d8b,stroke-width:2px,color:#fff
    style E fill:#F7931E,stroke:#fff,stroke-width:1px,color:#fff
    style G fill:#8E75B2,stroke:#fff,stroke-width:1px,color:#fff
```

---

## 🧠 Subsystem 1: Supervised ML Demographic Forecaster

To predict the non-linear population dynamics of the civilization over a 5-year horizon, AXIOM employs a **Random Forest Regressor** served via a Python Vercel runtime.

### Methodology & Training Pipeline
1. **Synthetic Data Generation (`api/train_v6.py`)**: A purely mathematical script generated **5,000 independent civilization episodes**. The starting state vector (17 variables including `pollution`, `legitimacy`, `hope`, `minerals`) was randomized uniformly across the absolute structural bounds of the game logic to ensure the model learned boundary conditions and edge cases.
2. **Model Selection**: `scikit-learn` Random Forest Regressor (`n_estimators=100`, `max_depth=10`). Selected over Neural Networks due to its inherent scale-invariance, robustness to outliers in continuous synthetic data, and out-of-the-box explainability metrics.
3. **Target Variable**: $\Delta P$ (Net Change in Population).

### Explainable AI (XAI) Integration
The model doesn't just predict the future; it explains *why* the prediction was made. The Python endpoint (`/api/predict`) intercepts the `model.feature_importances_` array at runtime. 

By analyzing the Gini impurity decrease across the decision trees, the serverless function extracts the top 5 driving variables behind the specific prediction and returns them to the UI, rendering a live, human-readable **Feature Importance Bar Chart** in the Command Terminal.

---

## 🌐 Subsystem 2: Contextual Heuristic Event Engine (LLM)

Traditional games use hard-coded, static event pools. AXIOM utilizes a dynamic, generative narrative engine powered by **Google Gemini 2.0 Flash**.

### Structured JSON Inference
Every simulated decade (or upon triggering a specific threshold), the client `engine.js` packs the continuous 17-dimensional state vector into a JSON payload and POSTs it to the Node.js serverless route (`/api/event.js`).

The serverless function securely binds the API key and enforces a strict structural prompt constraint:
```json
// Prompt Output Constraint Example
{
  "event": "<A vivid 2-sentence news brief describing the event>",
  "severity": "<minor|moderate|major|catastrophic>",
  "effects": {
    "food": -450000,
    "happiness": -12.5,
    "legitimacy": -8.0
  }
}
```

The generative model assesses the provided metrics (e.g., *Is pollution critically high? Is the economy booming while water is scarce?*) and dynamically hallucinates a **contextually coherent geopolitical crisis or breakthrough**. It then maps that narrative back into mathematically precise structural penalties (`effects`) which are caught by the physics engine and permanently applied to the game state.

---

## ⚙️ Subsystem 3: Deterministic Physics Engine

At the core of AXIOM is a 0-dependency, ES6 JavaScript engine (`web/js/engine.js`).

The civilization state is an iterative vector $S_t$. Each policy $P$ chosen by the player applies an immediate vector transformation $T(P)$, followed by structural decay and interacting rules.

### Institutional Trust Mechanics
Unique to AXIOM is the modeling of social stability through **Legitimacy**. 

Modern civilizations rarely collapse simply from running out of food; they collapse from a loss of institutional trust. AXIOM calculates four continuous psychological vectors (`Trust`, `Fear`, `Anger`, `Hope`).
- Overpopulation and pollution drive `Disease`, which drives `Fear`.
- High economic disparity combined with low happiness drives `Anger`.
- Sustained `Anger` permanently erodes `Legitimacy`.
- If $Legitimacy_t \le 0$, the state fails. A revolution is triggered, resetting technology and economic progress.

---

## 🎨 UI & 3D WebGL Rendering

AXIOM abandons heavy frontend JS frameworks (React/Vue) in favor of vanilla JavaScript and **Three.js** to guarantee 60fps performance on low-end devices.

- **Start Screen:** Renders a 3D rotating particle galaxy. When the player initializes the simulation, a complex tweening function interpolates the `PerspectiveCamera.position.z` vector smoothly toward the central star, flashing seamlessly into the 2D CRT Command Terminal.
- **Data Visualization:** The `Data` tab binds `Chart.js` directly to the `WorldState.history` arrays, rendering an interactive, multi-axis time-series visualization covering the entire lifespan of the civilization.
- **Typography:** Custom WebFonts (`Bungee` for titles, `VT323` for data).

---

## 🚀 Quick Start (Local Run)

You can run the entire Edge-pipeline locally.

```bash
# 1. Clone the repository
git clone https://github.com/kunal-gh/civ-ai.git
cd civ-ai

# 2. View the pure frontend implementation locally
cd web
python -m http.server 8080
# Open http://localhost:8080
```

*Note: Running locally without the Vercel CLI will smoothly bypass the `/api` serverless functions. The frontend will automatically detect the absence of the Python/Node backend and elegantly fall back to local Javascript heuristics for predictions and events. You will not experience broken UI or crashes.*

**To view the full AI-integrated deployment, visit:**
[**https://civ-ai-nine.vercel.app/**](https://civ-ai-nine.vercel.app/)

---

## License
MIT — see [LICENSE](LICENSE)
