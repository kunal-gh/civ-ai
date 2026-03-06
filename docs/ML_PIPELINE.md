# CIV-AI: ML Pipeline Deep-Dive

## Overview

The ML pipeline answers one question: *given the current civilization state and the policy the player just chose, how much will the population change next year?*

## Feature Engineering

| Feature | Type | Rationale |
|---|---|---|
| `population` | continuous int | Scale context for absolute changes |
| `food` | continuous float | Primary survival driver |
| `energy` | continuous float | Industrial/infrastructure proxy |
| `technology` | continuous float | Long-game multiplier |
| `pollution` | 0–100 float | Mortality pressure |
| `economy` | continuous float | Stability + happiness driver |
| `happiness` | 0–100 float | Secondary legitimacy input |
| `legitimacy` | 0–100 float | Social stability — collapses cause sudden pop drops |
| `policy` | categorical int (0–3) | Encodes the player's strategic choice |

No normalisation is applied — Random Forests are scale-invariant by construction.

## Why Random Forest?

| Criterion | Random Forest | Linear Reg | Neural Net |
|---|---|---|---|
| No GPU needed | ✅ | ✅ | ❌ |
| Non-linear relationships | ✅ | ❌ | ✅ |
| Feature importance built-in | ✅ | ❌ (coefficients) | ❌ |
| Robust to outliers | ✅ | ❌ | ❌ |
| Training time < 10s | ✅ | ✅ | ❌ |
| Interpretable predictions | ✅ | ✅ | ❌ |

## Hyperparameter Choices

| Parameter | Value | Reasoning |
|---|---|---|
| `n_estimators` | 150 | Variance stabilises beyond 100; 150 is safe on a laptop |
| `max_depth` | 10 | Prevents memorisation of synthetic data patterns |
| `min_samples_leaf` | 5 | Smooths prediction at leaf level |
| `n_jobs` | -1 | Uses all CPU cores for training speed |
| `random_state` | 42 | Reproducibility |

## Training Data Design

- **5,000 episodes** each with a fully randomized starting WorldState
- Variable ranges cover the complete valid domain (not just neighbourhood of defaults)
- This forces the model to learn general dynamics, not memorise one trajectory
- 80/20 train-test split; `random_state=42` for reproducibility

## Explainability

Feature importances are computed using the Random Forest's impurity-based method (mean decrease in Gini/MSE across all trees and split points). This gives a global importance score per feature.

For per-prediction explanation (local), the same global importances are displayed — this is a valid approximation for homogeneous simulation data where the feature relationships are relatively stable across the state space.

## OOD Detection

A normalised Euclidean distance from the training centroid flags when the model is predicting on an unfamiliar region of state space:

```python
dist = || (x - μ_train) / σ_train ||₂
```

- `dist < 2.0` → **HIGH** confidence
- `dist < 4.0` → **MEDIUM** confidence  
- `dist ≥ 4.0` → **LOW** confidence (warning shown to user)

This is a lightweight, zero-cost alternative to conformal prediction or MC-Dropout — appropriate for the computational budget of this project while still teaching an important ML engineering concept.
