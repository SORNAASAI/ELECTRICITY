"""
FastAPI Prediction Server — Delhi Electricity Demand
Port: 8000
Endpoints:
  POST /predict          → predict using best/specified model
  GET  /models           → list available models
  GET  /metrics          → return evaluation metrics
  GET  /shap             → return SHAP feature importances
  GET  /health           → health check
"""

import os
import json
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

app = FastAPI(title="Delhi Electricity Demand Forecast API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load scalers & models at startup ─────────────────────────────────────────
feat_scaler = None
tgt_scaler  = None
models      = {}

def load_artifacts():
    global feat_scaler, tgt_scaler, models

    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    tgt_scaler  = joblib.load(os.path.join(MODELS_DIR, "tgt_scaler.pkl"))

    # ML models
    for name, fname in [
        ("linear_regression", "linear_regression.pkl"),
        ("random_forest",     "random_forest.pkl"),
        ("xgboost",           "xgboost.pkl"),
        ("hybrid_xgb_residual", "hybrid_xgb_residual.pkl"),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            models[name] = joblib.load(path)

    # DL models
    for name, fname in [
        ("lstm",                        "lstm.keras"),
        ("bilstm",                      "bilstm.keras"),
        ("cnn_lstm",                    "cnn_lstm.keras"),
        ("tft",                         "tft.keras"),
        ("hybrid_transformer_bilstm",   "hybrid_transformer_bilstm.keras"),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            models[name] = tf.keras.models.load_model(path)

    print(f"Loaded models: {list(models.keys())}")

@app.on_event("startup")
def startup_event():
    load_artifacts()

# ── Feature column order (must match training) ────────────────────────────────
FEATURE_COLS = [
    "temp", "dwpt", "rhum", "wspd", "pres",
    "Holiday", "Festival", "Weekend",
    "Hour", "Day", "Month", "Quarter", "Weekday", "WeekOfYear",
    "Hour_sin", "Hour_cos", "Month_sin", "Month_cos",
    "Lag_1", "Lag_2", "Lag_3", "Lag_6", "Lag_12", "Lag_24", "Lag_48", "Lag_168",
    "Rolling_Mean_24", "Rolling_STD_24", "Rolling_Max_24", "Rolling_Min_24",
    "Season_Monsoon", "Season_Summer", "Season_Winter",
]

SEQ_LEN = 24

# ── Request / Response schemas ────────────────────────────────────────────────
class PredictRequest(BaseModel):
    # Core weather & calendar inputs (required)
    temp:           float
    Hour:           int
    Month:          int
    Day:            int
    Weekday:        int
    WeekOfYear:     int
    Quarter:        int
    Holiday:        float = 0.0
    Festival:       float = 0.0
    Weekend:        float = 0.0
    # Weather extras (optional, defaults to typical Delhi values)
    dwpt:           float = 15.0
    rhum:           float = 60.0
    wspd:           float = 8.0
    pres:           float = 1010.0
    # Lag features (optional — defaults to rolling mean if not provided)
    Lag_1:          Optional[float] = None
    Lag_2:          Optional[float] = None
    Lag_3:          Optional[float] = None
    Lag_6:          Optional[float] = None
    Lag_12:         Optional[float] = None
    Lag_24:         Optional[float] = None
    Lag_48:         Optional[float] = None
    Lag_168:        Optional[float] = None
    Rolling_Mean_24: Optional[float] = None
    Rolling_STD_24:  Optional[float] = None
    Rolling_Max_24:  Optional[float] = None
    Rolling_Min_24:  Optional[float] = None
    # Season flags (auto-derived from Month if not provided)
    Season_Monsoon: Optional[int] = None
    Season_Summer:  Optional[int] = None
    Season_Winter:  Optional[int] = None
    # Model selection
    model_name:     str = "xgboost"

class PredictResponse(BaseModel):
    model_used:       str
    predicted_demand: float
    unit:             str = "MW"

# ── Helper: derive missing features ──────────────────────────────────────────
TYPICAL_DEMAND = 4500.0   # Delhi average MW

def derive_features(req: PredictRequest) -> np.ndarray:
    lag_default = req.Rolling_Mean_24 if req.Rolling_Mean_24 else TYPICAL_DEMAND

    # Season auto-derive
    monsoon = req.Season_Monsoon if req.Season_Monsoon is not None else int(req.Month in [6, 7, 8, 9])
    summer  = req.Season_Summer  if req.Season_Summer  is not None else int(req.Month in [3, 4, 5])
    winter  = req.Season_Winter  if req.Season_Winter  is not None else int(req.Month in [11, 12, 1, 2])

    # Cyclical encodings
    hour_sin  = np.sin(2 * np.pi * req.Hour  / 24)
    hour_cos  = np.cos(2 * np.pi * req.Hour  / 24)
    month_sin = np.sin(2 * np.pi * req.Month / 12)
    month_cos = np.cos(2 * np.pi * req.Month / 12)

    row = [
        req.temp, req.dwpt, req.rhum, req.wspd, req.pres,
        req.Holiday, req.Festival, req.Weekend,
        req.Hour, req.Day, req.Month, req.Quarter, req.Weekday, req.WeekOfYear,
        hour_sin, hour_cos, month_sin, month_cos,
        req.Lag_1   or lag_default,
        req.Lag_2   or lag_default,
        req.Lag_3   or lag_default,
        req.Lag_6   or lag_default,
        req.Lag_12  or lag_default,
        req.Lag_24  or lag_default,
        req.Lag_48  or lag_default,
        req.Lag_168 or lag_default,
        req.Rolling_Mean_24 or lag_default,
        req.Rolling_STD_24  or 500.0,
        req.Rolling_Max_24  or lag_default * 1.2,
        req.Rolling_Min_24  or lag_default * 0.8,
        monsoon, summer, winter,
    ]
    return np.array(row, dtype=np.float32).reshape(1, -1)

# ── Model name aliases ────────────────────────────────────────────────────────
MODEL_ALIASES = {
    "hybrid":           "hybrid_transformer_bilstm",
    "transformer":      "hybrid_transformer_bilstm",
    "bilstm":           "bilstm",
    "bi-lstm":          "bilstm",
    "lstm":             "lstm",
    "cnn_lstm":         "cnn_lstm",
    "cnn-lstm":         "cnn_lstm",
    "tft":              "tft",
    "xgboost":          "xgboost",
    "random_forest":    "random_forest",
    "rf":               "random_forest",
    "linear":           "linear_regression",
    "linear_regression":"linear_regression",
}

# Fallback priority order — best available model used when requested one is missing
FALLBACK_ORDER = [
    "hybrid_transformer_bilstm", "tft", "bilstm", "cnn_lstm",
    "lstm", "xgboost", "random_forest", "linear_regression"
]

def resolve_model(requested: str) -> str:
    """Resolve alias → actual key, fall back to best available if not loaded."""
    key = MODEL_ALIASES.get(requested.lower(), requested.lower())
    if key in models:
        return key
    # requested model not loaded — pick best available from fallback order
    for fallback in FALLBACK_ORDER:
        if fallback in models:
            print(f"[WARN] Model '{key}' not loaded, falling back to '{fallback}'")
            return fallback
    return None

# ── POST /predict ─────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    model_key = resolve_model(req.model_name)

    if model_key is None:
        raise HTTPException(
            status_code=503,
            detail="No models are loaded. Run train.py first."
        )

    X_raw = derive_features(req)
    X_sc  = feat_scaler.transform(X_raw)

    model = models[model_key]

    # DL models need sequence input — replicate single row SEQ_LEN times
    if model_key in ("lstm", "bilstm", "cnn_lstm", "tft", "hybrid_transformer_bilstm"):
        X_seq = np.repeat(X_sc, SEQ_LEN, axis=0).reshape(1, SEQ_LEN, -1)
        pred_sc = model.predict(X_seq, verbose=0).ravel()[0]
        pred = float(tgt_scaler.inverse_transform([[pred_sc]])[0][0])

        # For hybrid: add XGBoost residual correction
        if model_key == "hybrid_transformer_bilstm" and "hybrid_xgb_residual" in models:
            residual = float(models["hybrid_xgb_residual"].predict(X_sc)[0])
            pred += residual
    else:
        # ML models predict directly
        pred = float(model.predict(X_sc)[0])

    return PredictResponse(model_used=model_key, predicted_demand=round(pred, 2))

# ── GET /models ───────────────────────────────────────────────────────────────
@app.get("/models")
def list_models():
    return {"available_models": list(models.keys())}

# ── GET /metrics ──────────────────────────────────────────────────────────────
@app.get("/metrics")
def get_metrics():
    path = os.path.join(MODELS_DIR, "model_results.csv")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run train.py first to generate metrics.")
    df = pd.read_csv(path)
    return df.to_dict(orient="records")

# ── GET /shap ─────────────────────────────────────────────────────────────────
@app.get("/shap")
def get_shap():
    path = os.path.join(MODELS_DIR, "shap_importance.csv")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Run train.py first to generate SHAP values.")
    df = pd.read_csv(path)
    return df.to_dict(orient="records")

# ── GET /health ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": len(models)}

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("predict_api:app", host="0.0.0.0", port=8000, reload=False)
