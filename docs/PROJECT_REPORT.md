# CIV-AI: Research & Engineering Project Report

## Abstract

This report describes the design, architecture, and engineering implementation of CIV-AI — a machine learning–driven civilization simulator built as a research-grade portfolio system. The platform combines a deterministic socio-economic simulation engine, a supervised Random Forest population predictor, a Gemini 2.0 Flash generative event system, explainable AI feature importance analysis, and an interactive Streamlit visualization dashboard. The system runs entirely on commodity laptop hardware and demonstrates a complete applied AI engineering pipeline from data generation through model deployment.

---

## 1. Introduction

Modern AI engineering requires the orchestration of multiple system components: simulation environments, data pipelines, predictive models, generative AI, explainability layers, and user interfaces. Most academic ML projects isolate one of these concerns. CIV-AI integrates all of them into a single cohesive platform organized around a civilization simulation loop.

The system is designed to answer a specific research question: *can a Random Forest regressor, trained on synthetic simulation data, produce sufficiently accurate population forecasts to meaningfully inform decision-making within an interactive simulation?*

Secondary objectives include demonstrating structured prompt engineering for generative AI, implementing lightweight out-of-distribution detection, and surfacing feature importance as an accessible explainable AI layer.

---

## 2. System Architecture

The architecture consists of six independent modules communicating through a shared WorldState object:

| Module | File | Responsibility |
|---|---|---|
| World State | `src/world_state.py` | Shared data model, feature extraction |
| Simulation Engine | `src/simulation_engine.py` | Deterministic physics, policy application |
| Data Pipeline | `src/data_pipeline.py` | Synthetic training data generation |
| ML Model | `src/ml_model.py` | Training, inference, explainability |
| Event Engine | `src/event_engine.py` | Gemini generative events + fallback |
| Dashboard | `ui/app.py` | Interactive Streamlit UI |

---

## 3. World State Design

The civilization is represented as an 8-dimensional continuous state vector:

```
s = (population, food, energy, technology, pollution, economy, happiness, legitimacy)
```

Each variable is bounded. `legitimacy` is an original addition to the canonical 7-variable spec — it models public trust in institutions and creates a second survival axis beyond raw resource management. When legitimacy reaches zero a forced revolution event fires, resetting it partially at the cost of economic output.

---

## 4. Simulation Engine

The simulation engine applies deterministic rules encoding simplified Malthusian and Keynesian dynamics:

**Population dynamics:**
```
fpc         = food / population
birth_rate  = 0.02 × min(2 × fpc, 1.5)
death_rate  = 0.01 + 0.005 × (pollution / 100)
starvation  = 0.05 × max(0, 0.5 − fpc)
pop_new     = pop × (1 + birth_rate − death_rate − starvation)
```

**Technology multipliers** (original feature): technology levels above 50 generate compounding food and economy bonuses; above 100, clean-tech effects passively reduce pollution, creating a long-game incentive for Education policy investment.

---

## 5. Machine Learning Model

### 5.1 Data Generation

5,000 simulation episodes are generated with randomized starting states uniformly sampled across the full valid range of all 8 variables. This ensures the training set covers edge cases (famine, pollution collapse, technology booms) and not just the neighbourhood of default starting conditions.

### 5.2 Model Selection and Training

A `RandomForestRegressor` (scikit-learn) was selected for its interpretability, robustness to outliers, and native feature importance support — essential for the explainability requirement. Training completes in under 10 seconds on a standard laptop CPU.

Training configuration: 150 estimators, max depth 10, minimum 5 samples per leaf, random state 42.

### 5.3 Evaluation

Trained model evaluated on a held-out 20% test split. Target metric: R² > 0.95.

### 5.4 Explainability

Per-prediction feature importances are extracted from the forest's impurity-based importance scores. These are rendered as a bar chart in the dashboard, enabling users to observe which variables — food supply, pollution, economy, policy choice — most strongly influenced the current population forecast.

### 5.5 OOD Confidence Detection (Original Feature)

A normalised Euclidean distance from the training centroid flags predictions on unfamiliar state regions:

```
confidence = distance_from_centroid(x_current, μ_train, σ_train)
```

LOW confidence triggers a warning in the dashboard — a practical demonstration of out-of-distribution detection without requiring conformal prediction or Monte Carlo methods.

---

## 6. Generative AI Event Engine

Events are generated by **Gemini 2.0 Flash** conditioned on the full WorldState. The prompt enforces structured JSON output containing a narrative description, severity level, and numeric effects on state variables. This enforces a separation between creative generation and deterministic state application.

A local heuristic fallback engine activates automatically when the API is unavailable, ensuring the simulation is never blocked by external dependencies.

---

## 7. Limitations and Future Work

- The synthetic training data, while covering the full variable range, cannot represent all emergent multi-year trajectories
- The OOD detector uses a simple distance metric; conformal prediction intervals would provide error bounds
- Future work: reinforcement learning agents as autonomous policy-makers; multi-civilization competition; climate models

---

## 8. Conclusion

CIV-AI demonstrates that a complete, research-grade AI engineering pipeline can be implemented on commodity hardware within a bounded scope. The integration of supervised ML, generative AI, and explainability within a single interactive loop produces a system that is simultaneously a playable simulation and a working demonstration of applied ML engineering principles.
