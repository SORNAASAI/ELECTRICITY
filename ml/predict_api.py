"""
FastAPI Prediction Server — India National Electricity Demand
Dataset: Final_AI_Dataset_Cleaned.csv
Port: 8000
"""

import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import tensorflow as tf

tf.get_logger().setLevel("ERROR")

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")

app = FastAPI(title="India National Electricity Demand Forecast API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

feat_scaler = None
tgt_scaler  = None
models      = {}

def load_artifacts():
    global feat_scaler, tgt_scaler, models

    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    tgt_scaler  = joblib.load(os.path.join(MODELS_DIR, "tgt_scaler.pkl"))

    for name, fname in [
        ("linear_regression",   "linear_regression.pkl"),
        ("random_forest",       "random_forest.pkl"),
        ("xgboost",             "xgboost.pkl"),
        ("hybrid_xgb_residual", "hybrid_xgb_residual.pkl"),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            models[name] = joblib.load(path)

    for name, fname in [
        ("lstm",                      "lstm.keras"),
        ("bilstm",                    "bilstm.keras"),
        ("cnn_lstm",                  "cnn_lstm.keras"),
        ("tft",                       "tft.keras"),
        ("hybrid_transformer_bilstm", "hybrid_transformer_bilstm.keras"),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            m = tf.keras.models.load_model(path)
            # store expected feature count from the model's own input shape
            m._expected_n_features = m.input_shape[-1]
            models[name] = m

    print(f"Loaded models: {list(models.keys())}")

@app.on_event("startup")
def startup_event():
    load_artifacts()

# Feature column order — must match train.py exactly
FEATURE_COLS = [
    "temperature", "humidity", "wind_speed", "precipitation",
    "Holiday", "Festival", "Weekend", "Peak", "lockdown",
    "Hour", "Day", "Month", "DayOfWeek", "Year",
    "hour_sin", "hour_cos", "month_sin", "month_cos", "dow_sin", "dow_cos",
    "Lag_1", "Lag_2", "Lag_3", "Lag_6", "Lag_12",
    "Lag_24", "Lag_48", "Lag_72",
    "Rolling_Mean_24", "Rolling_STD_24", "Rolling_Max_24", "Rolling_Min_24",
    "temp_squared", "temp_x_hour", "temp_x_month",
]

SEQ_LEN = 24

TYPICAL_DEMAND = 153622.0  # India national train mean MW

# Hourly demand profile (index = hour 0–23), derived from train set mean
HOURLY_PROFILE = [
    0.88, 0.85, 0.83, 0.82, 0.83, 0.86,   # 0–5  night/early
    0.91, 0.95, 0.99, 1.02, 1.04, 1.05,   # 6–11 morning ramp
    1.05, 1.04, 1.03, 1.02, 1.03, 1.06,   # 12–17 afternoon
    1.08, 1.09, 1.08, 1.05, 1.00, 0.94,   # 18–23 evening peak
]

def hour_demand(h: int) -> float:
    return TYPICAL_DEMAND * HOURLY_PROFILE[h % 24]

class PredictRequest(BaseModel):
    temperature: float
    Hour:        int
    Month:       int
    Day:         int
    DayOfWeek:   int
    Year:        int = 2025
    humidity:      float = 60.0
    wind_speed:    float = 8.0
    precipitation: float = 0.0
    Holiday:  float = 0.0
    Festival: float = 0.0
    Weekend:  float = 0.0
    Peak:     float = 0.0
    lockdown: float = 0.0
    Lag_1:    Optional[float] = None
    Lag_2:    Optional[float] = None
    Lag_3:    Optional[float] = None
    Lag_6:    Optional[float] = None
    Lag_12:   Optional[float] = None
    Lag_24:   Optional[float] = None
    Lag_48:   Optional[float] = None
    Lag_72:   Optional[float] = None
    Rolling_Mean_24:  Optional[float] = None
    Rolling_STD_24:   Optional[float] = None
    Rolling_Max_24:   Optional[float] = None
    Rolling_Min_24:   Optional[float] = None
    model_name: str = "xgboost"

class PredictResponse(BaseModel):
    model_used:       str
    predicted_demand: float
    unit:             str = "MW"

def derive_features(req: PredictRequest) -> np.ndarray:
    base = hour_demand(req.Hour)
    lag_default = req.Rolling_Mean_24 if req.Rolling_Mean_24 else base

    # Cyclical encodings — derived from Hour/Month/DayOfWeek
    hour_sin  = np.sin(2 * np.pi * req.Hour     / 24)
    hour_cos  = np.cos(2 * np.pi * req.Hour     / 24)
    month_sin = np.sin(2 * np.pi * req.Month    / 12)
    month_cos = np.cos(2 * np.pi * req.Month    / 12)
    dow_sin   = np.sin(2 * np.pi * req.DayOfWeek / 7)
    dow_cos   = np.cos(2 * np.pi * req.DayOfWeek / 7)

    # Interaction features
    temp_sq      = req.temperature ** 2
    temp_x_hour  = req.temperature * req.Hour
    temp_x_month = req.temperature * req.Month

    row = [
        req.temperature, req.humidity, req.wind_speed, req.precipitation,
        req.Holiday, req.Festival, req.Weekend, req.Peak, req.lockdown,
        req.Hour, req.Day, req.Month, req.DayOfWeek, req.Year,
        hour_sin, hour_cos, month_sin, month_cos, dow_sin, dow_cos,
        req.Lag_1   or hour_demand(req.Hour - 1),
        req.Lag_2   or hour_demand(req.Hour - 2),
        req.Lag_3   or hour_demand(req.Hour - 3),
        req.Lag_6   or hour_demand(req.Hour - 6),
        req.Lag_12  or hour_demand(req.Hour - 12),
        req.Lag_24  or base,
        req.Lag_48  or base,
        req.Lag_72  or base,
        req.Rolling_Mean_24  or lag_default,
        req.Rolling_STD_24   or 12000.0,
        req.Rolling_Max_24   or lag_default * 1.10,
        req.Rolling_Min_24   or lag_default * 0.90,
        temp_sq, temp_x_hour, temp_x_month,
    ]
    return np.array(row, dtype=np.float32).reshape(1, -1)

MODEL_ALIASES = {
    "hybrid":            "hybrid_transformer_bilstm",
    "transformer":       "hybrid_transformer_bilstm",
    "bilstm":            "bilstm",
    "bi-lstm":           "bilstm",
    "lstm":              "lstm",
    "cnn_lstm":          "cnn_lstm",
    "cnn-lstm":          "cnn_lstm",
    "tft":               "tft",
    "xgboost":           "xgboost",
    "random_forest":     "random_forest",
    "rf":                "random_forest",
    "linear":            "linear_regression",
    "linear_regression": "linear_regression",
}

FALLBACK_ORDER = [
    "hybrid_transformer_bilstm", "tft", "bilstm", "cnn_lstm",
    "lstm", "xgboost", "random_forest", "linear_regression"
]

def resolve_model(requested: str) -> str:
    key = MODEL_ALIASES.get(requested.lower(), requested.lower())
    if key in models:
        return key
    for fallback in FALLBACK_ORDER:
        if fallback in models:
            print(f"[WARN] Model '{key}' not loaded, falling back to '{fallback}'")
            return fallback
    return None

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    model_key = resolve_model(req.model_name)
    if model_key is None:
        raise HTTPException(status_code=503, detail="No models loaded. Run train.py first.")

    X_raw = derive_features(req)
    X_sc  = feat_scaler.transform(X_raw)
    model = models[model_key]

    if model_key in ("lstm", "cnn_lstm", "tft", "hybrid_transformer_bilstm", "bilstm"):
        seq_len = SEQ_LEN

        # Trim features to what this saved model actually expects
        n_expected = getattr(model, "_expected_n_features", X_sc.shape[1])
        X_in = X_sc[:, :n_expected]

        X_seq   = np.repeat(X_in, seq_len, axis=0).reshape(1, seq_len, n_expected)
        pred_sc = model.predict(X_seq, verbose=0).ravel()[0]
        pred    = float(tgt_scaler.inverse_transform([[pred_sc]])[0][0])

        if model_key == "hybrid_transformer_bilstm" and "hybrid_xgb_residual" in models:
            pred += float(models["hybrid_xgb_residual"].predict(X_sc)[0])
    else:
        pred = float(model.predict(X_sc)[0])

    return PredictResponse(model_used=model_key, predicted_demand=round(pred, 2))

@app.get("/models")
def list_models():
    return {"available_models": list(models.keys())}

@app.get("/metrics")
def get_metrics():
    path = os.path.join(MODELS_DIR, "model_results.csv")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run train.py first.")
    return pd.read_csv(path).to_dict(orient="records")

@app.get("/shap")
def get_shap():
    path = os.path.join(MODELS_DIR, "shap_importance.csv")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run train.py first.")
    return pd.read_csv(path).to_dict(orient="records")

@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": len(models)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("predict_api:app", host="0.0.0.0", port=8000, reload=False)
