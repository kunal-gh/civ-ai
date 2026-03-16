import os
import random
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib

print("=======================================================")
print("  AXIOM V6 Serverless Training Pipeline")
print("=======================================================")

# Generate synthetic dataset reflecting V6 JavaScript Engine rules
N_SAMPLES = 5000
data = []

print(f"[1/3] Generating synthetic dataset ({N_SAMPLES} episodes)...")

for _ in range(N_SAMPLES):
    population = random.randint(50_000, 10_000_000)
    food = random.uniform(10_000, 8_000_000)
    energy = random.uniform(10_000, 8_000_000)
    technology = random.uniform(0, 300)
    pollution = random.uniform(0, 100)
    economy = random.uniform(0, 200)
    happiness = random.uniform(0, 100)
    legitimacy = random.uniform(0, 100)
    disease_rate = random.uniform(0, 100)
    military = random.uniform(0, 100)
    climate = random.uniform(0, 100)
    water = random.uniform(0, 100)
    minerals = random.uniform(0, 100)
    trust = random.uniform(0, 100)
    fear = random.uniform(0, 100)
    anger = random.uniform(0, 100)
    hope = random.uniform(0, 100)
    
    # 5) Population dynamics (Malthusian + Keynesian)
    fpc = food / max(population, 1)
    birth_rate = 0.022 * min(fpc * 2, 1.5)
    base_death = 0.010 + 0.004 * (pollution / 100)
    dis_death = 0.005 * (disease_rate / 100)
    starv_pen = 0.05 * (0.5 - fpc) if fpc < 0.5 else 0
    climate_pen = 0.003 * max(0, climate - 40) / 60
    
    death_rate = max(0, base_death + dis_death + starv_pen + climate_pen)
    target_pop_change = int(population * (birth_rate - death_rate))
    
    data.append([
        population, food, energy, technology, pollution, economy,
        happiness, legitimacy, disease_rate, military, climate,
        water, minerals, trust, fear, anger, hope, target_pop_change
    ])

cols = [
    'population', 'food', 'energy', 'technology', 'pollution', 'economy',
    'happiness', 'legitimacy', 'disease_rate', 'military', 'climate',
    'water', 'minerals', 'trust', 'fear', 'anger', 'hope', 'target_delta'
]
df = pd.DataFrame(data, columns=cols)

features = cols[:-1]
X = df[features]
y = df['target_delta']

print(f"[2/3] Training RandomForestRegressor (n_estimators=100)...")
model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
model.fit(X, y)

print(f"[3/3] Saving model artifacts...")
os.makedirs('api/models', exist_ok=True)
joblib.dump(model, 'api/models/rf_model.pkl')

# Save the centroid for OOD detection
centroid = {
    'mean': X.mean().to_dict(),
    'std': X.std().to_dict()
}
joblib.dump(centroid, 'api/models/centroid.pkl')

print("=======================================================")
print(f"  Training Complete. Model R2 Score: {model.score(X, y):.4f}")
print("  Saved to api/models/rf_model.pkl")
print("=======================================================")
