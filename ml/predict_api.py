"""
FastAPI Prediction Server — Delhi Electricity Demand
Dataset: delhi_features.csv
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

app = FastAPI(title="Delhi Electricity Demand Forecast API", version="3.0.0")

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
            m._expected_n_features = m.input_shape[-1]
            models[name] = m

    print(f"Loaded models: {list(models.keys())}")

@app.on_event("startup")
def startup_event():
    load_artifacts()

# Feature column order — must match train.py exactly
FEATURE_COLS = [
    "temperature_c", "humidity_pct", "apparent_temp_c",
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "DELHI_lag_1h", "DELHI_lag_2h", "DELHI_lag_3h",
    "DELHI_lag_24h", "DELHI_lag_48h", "DELHI_lag_168h",
    "DELHI_roll_mean_3h", "DELHI_roll_mean_24h",
    "DELHI_roll_std_24h", "DELHI_roll_max_24h",
]

SEQ_LEN = 24

# Delhi typical demand mean (MW) — derived from dataset
TYPICAL_DEMAND = 5500.0

# Hourly demand profile for Delhi (index = hour 0–23)
HOURLY_PROFILE = [
    0.82, 0.78, 0.75, 0.73, 0.74, 0.78,   # 0–5  night/early
    0.84, 0.88, 0.92, 0.96, 1.00, 1.03,   # 6–11 morning ramp
    1.05, 1.04, 1.06, 1.08, 1.07, 1.05,   # 12–17 afternoon/evening
    1.04, 1.03, 1.02, 0.98, 0.94, 0.88,   # 18–23 evening taper
]

def hour_demand(h: int) -> float:
    return TYPICAL_DEMAND * HOURLY_PROFILE[h % 24]

class PredictRequest(BaseModel):
    temperature_c:    float
    hour:             int
    month:            int
    day_of_week:      int
    humidity_pct:     float = 70.0
    apparent_temp_c:  float = 30.0
    is_weekend:       int   = 0
    DELHI_lag_1h:     Optional[float] = None
    DELHI_lag_2h:     Optional[float] = None
    DELHI_lag_3h:     Optional[float] = None
    DELHI_lag_24h:    Optional[float] = None
    DELHI_lag_48h:    Optional[float] = None
    DELHI_lag_168h:   Optional[float] = None
    DELHI_roll_mean_3h:  Optional[float] = None
    DELHI_roll_mean_24h: Optional[float] = None
    DELHI_roll_std_24h:  Optional[float] = None
    DELHI_roll_max_24h:  Optional[float] = None
    model_name: str = "xgboost"

class PredictResponse(BaseModel):
    model_used:       str
    predicted_demand: float
    unit:             str = "MW"

def derive_features(req: PredictRequest) -> np.ndarray:
    base = hour_demand(req.hour)

    hour_sin  = np.sin(2 * np.pi * req.hour       / 24)
    hour_cos  = np.cos(2 * np.pi * req.hour       / 24)
    dow_sin   = np.sin(2 * np.pi * req.day_of_week / 7)
    dow_cos   = np.cos(2 * np.pi * req.day_of_week / 7)

    lag_default = req.DELHI_roll_mean_24h if req.DELHI_roll_mean_24h else base

    row = [
        req.temperature_c,
        req.humidity_pct,
        req.apparent_temp_c,
        req.hour,
        req.day_of_week,
        req.month,
        req.is_weekend,
        hour_sin, hour_cos,
        dow_sin,  dow_cos,
        req.DELHI_lag_1h    or hour_demand(req.hour - 1),
        req.DELHI_lag_2h    or hour_demand(req.hour - 2),
        req.DELHI_lag_3h    or hour_demand(req.hour - 3),
        req.DELHI_lag_24h   or base,
        req.DELHI_lag_48h   or base,
        req.DELHI_lag_168h  or base,
        req.DELHI_roll_mean_3h  or lag_default,
        req.DELHI_roll_mean_24h or lag_default,
        req.DELHI_roll_std_24h  or 400.0,
        req.DELHI_roll_max_24h  or lag_default * 1.15,
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
        seq_len    = SEQ_LEN
        n_expected = getattr(model, "_expected_n_features", X_sc.shape[1])
        X_in       = X_sc[:, :n_expected]
        X_seq      = np.repeat(X_in, seq_len, axis=0).reshape(1, seq_len, n_expected)
        pred_sc    = model.predict(X_seq, verbose=0).ravel()[0]
        pred       = float(tgt_scaler.inverse_transform([[pred_sc]])[0][0])

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
