"""
lstm_model.py
-------------
PyTorch LSTM for 5-year multi-variable trajectory forecasting.

Architecture:
  Input:  (batch, seq_len=15, features=12)
  LSTM:   hidden=128, layers=2, dropout=0.2
  Output: (batch, 5)  → delta_{population, economy, climate, disease, legitimacy}

Usage:
  from src.lstm_model import CivLSTM, train_lstm, load_lstm, predict_trajectory
"""

import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset, random_split

LSTM_PATH = "models/lstm_forecaster.pt"
FEAT_DIM  = 12   # 11 state vars + policy index
OUTPUT_DIM = 5   # population, economy, climate, disease, legitimacy deltas


class CivLSTM(nn.Module):
    """Sequence-to-vector LSTM for trajectory forecasting."""

    def __init__(self, input_dim=FEAT_DIM, hidden=128, layers=2, output_dim=OUTPUT_DIM, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden, layers, batch_first=True,
                            dropout=dropout, bidirectional=False)
        self.head = nn.Sequential(
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, output_dim),
        )

    def forward(self, x):
        _, (h, _) = self.lstm(x)   # h: (layers, batch, hidden)
        return self.head(h[-1])    # last layer hidden state


def train_lstm(data_path: str = "data/lstm_sequences.npz",
               epochs: int = 60,
               batch_size: int = 256,
               lr: float = 1e-3) -> "CivLSTM":
    """Train LSTM from saved sequences, return trained model."""
    os.makedirs("models", exist_ok=True)

    data   = np.load(data_path)
    X_raw  = torch.tensor(data["X"], dtype=torch.float32)
    y_raw  = torch.tensor(data["y"], dtype=torch.float32)

    # Normalise features
    X_mean = X_raw.mean(dim=(0, 1), keepdim=True)
    X_std  = X_raw.std(dim=(0, 1), keepdim=True) + 1e-8
    X_norm = (X_raw - X_mean) / X_std

    # Save normalisation stats
    torch.save({"mean": X_mean, "std": X_std}, "models/lstm_norm.pt")

    dataset    = TensorDataset(X_norm, y_raw)
    val_size   = int(0.15 * len(dataset))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl   = DataLoader(val_ds,   batch_size=batch_size)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model  = CivLSTM().to(device)
    opt    = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    sched  = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.MSELoss()

    best_val = float("inf")
    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_dl:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad()
            loss_fn(model(xb), yb).backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        sched.step()

        model.eval()
        with torch.no_grad():
            val_loss = sum(loss_fn(model(xb.to(device)), yb.to(device)).item() * len(xb)
                           for xb, yb in val_dl) / val_size

        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), LSTM_PATH)

        if epoch % 10 == 0:
            print(f"  Epoch {epoch:3d}/{epochs} | val loss: {val_loss:.2f}")

    print(f"LSTM saved → {LSTM_PATH}  (best val loss: {best_val:.2f})")
    model.load_state_dict(torch.load(LSTM_PATH, map_location=device))
    return model


def load_lstm():
    """Load trained LSTM and normalisation stats, return (model, norm_dict)."""
    if not os.path.exists(LSTM_PATH):
        return None, None
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model  = CivLSTM()
    model.load_state_dict(torch.load(LSTM_PATH, map_location=device))
    model.eval()
    norm = torch.load("models/lstm_norm.pt", map_location=device) if os.path.exists("models/lstm_norm.pt") else None
    return model, norm


def predict_trajectory(model, norm, history_sequence: np.ndarray):
    """
    Predict 5 deltas from a history sequence.

    Parameters
    ----------
    history_sequence : np.ndarray, shape (seq_len, 12)
        Recent state vectors including policy index.

    Returns
    -------
    dict: {label: predicted_delta}
    """
    if model is None:
        return None

    device = next(model.parameters()).device
    x = torch.tensor(history_sequence, dtype=torch.float32).unsqueeze(0).to(device)

    if norm:
        x = (x - norm["mean"].to(device)) / (norm["std"].to(device) + 1e-8)

    with torch.no_grad():
        pred = model(x).squeeze().cpu().numpy()

    labels = ["Δ Population", "Δ Economy", "Δ Climate", "Δ Disease", "Δ Legitimacy"]
    return dict(zip(labels, pred.tolist()))
