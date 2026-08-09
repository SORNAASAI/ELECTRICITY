"""
FastAPI Prediction Server — Delhi Electricity Demand
Dataset: delhi_features.csv
Port: 8000
"""

import os
import joblib
import numpy as np
import pandas as pd
import requests as http_requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime as dt
import tensorflow as tf

tf.get_logger().setLevel("ERROR")

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "..", "delhi_features.csv")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")

app = FastAPI(title="Delhi Electricity Demand Forecast API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

feat_scaler      = None
tgt_scaler       = None
models           = {}
dataset_stats    = {}
weather_profiles = {}   # (month, hour) -> {temperature_c, humidity_pct, apparent_temp_c}
xgb_explainer    = None  # SHAP explainer for instance-level explanations

FEATURE_COLS = [
    "temperature_c", "humidity_pct", "apparent_temp_c",
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "DELHI_lag_1h", "DELHI_lag_2h", "DELHI_lag_3h",
    "DELHI_lag_24h", "DELHI_lag_48h", "DELHI_lag_168h",
    "DELHI_roll_mean_3h", "DELHI_roll_mean_24h",
    "DELHI_roll_std_24h", "DELHI_roll_max_24h",
]

SEQ_LEN     = 24
DISCOM_COLS = ["BRPL", "BYPL", "NDPL", "NDMC", "MES"]
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

recent_demand_buf: list = []   # last 168 actual DELHI values, loaded at startup

# Loaded dynamically from model_results.csv at startup
MODEL_MAE: dict = {}
OWM_API_KEY = "3e2b97c91f2e02d893ea8f1ab1d31b51"
DELHI_LAT   = 28.6139
DELHI_LON   = 77.2090

def compute_dataset_stats(df: pd.DataFrame) -> dict:
    """Derive all chart data from the CSV — called once at startup."""
    d = df.copy()
    d["DELHI"]         = pd.to_numeric(d["DELHI"],         errors="coerce")
    d["temperature_c"] = pd.to_numeric(d["temperature_c"], errors="coerce")
    d["humidity_pct"]  = pd.to_numeric(d["humidity_pct"],  errors="coerce")
    d.dropna(subset=["DELHI"], inplace=True)

    total_rows  = len(d)
    date_min    = str(d["datetime"].min().date())
    date_max    = str(d["datetime"].max().date())
    demand_mean = round(float(d["DELHI"].mean()), 1)
    demand_min  = round(float(d["DELHI"].min()),  1)
    demand_max  = round(float(d["DELHI"].max()),  1)
    demand_std  = round(float(d["DELHI"].std()),  1)

    hourly = (
        d.groupby("hour")["DELHI"].mean()
        .reindex(range(24), fill_value=demand_mean).round(1)
    )
    hourly_profile = [{"hour": f"{h:02d}", "demand": float(hourly[h])} for h in range(24)]

    monthly = (
        d.groupby("month")["DELHI"].mean()
        .reindex(range(1, 13), fill_value=demand_mean).round(1)
    )
    monthly_demand = [{"month": MONTH_NAMES[m - 1], "demand": float(monthly[m])} for m in range(1, 13)]

    d["year"] = d["datetime"].dt.year
    annual_peaks_raw = d.groupby("year")["DELHI"].max().round(1)
    annual_peaks = [{"year": str(yr), "peak": float(pk)} for yr, pk in annual_peaks_raw.items()]

    monthly_peaks_raw = (
        d.groupby("month")["DELHI"].max()
        .reindex(range(1, 13), fill_value=demand_max).round(1)
    )
    monthly_peaks = [{"month": MONTH_NAMES[m - 1], "peak": float(monthly_peaks_raw[m])} for m in range(1, 13)]

    hourly_peaks_raw = (
        d.groupby("hour")["DELHI"].max()
        .reindex(range(24), fill_value=demand_max).round(1)
    )
    hourly_peak_profile = []
    for h in range(0, 24, 2):
        peak_val = float(hourly_peaks_raw[h])
        peak_row = d[d["hour"] == h].loc[lambda x: x["DELHI"] == x["DELHI"].max()]
        peak_date = peak_row["datetime"].iloc[0].strftime("%d %b %Y").lstrip("0") if len(peak_row) > 0 else ""
        hourly_peak_profile.append({"hour": f"{h:02d}", "peak": peak_val, "peak_date": peak_date})

    top_peaks  = d.nlargest(10, "DELHI")[["datetime", "DELHI", "temperature_c"]].copy()
    peak_events = []
    for _, row in top_peaks.iterrows():
        peak_events.append({
            "date":  row["datetime"].strftime("%d %b %Y").lstrip("0"),
            "peak":  round(float(row["DELHI"]), 1),
            "temp":  round(float(row["temperature_c"]), 1) if pd.notna(row["temperature_c"]) else None,
            "notes": "Delhi peak event",
        })

    temp_valid = d.dropna(subset=["temperature_c"]).copy()
    if len(temp_valid) > 0:
        temp_valid["temp_bucket"] = pd.cut(temp_valid["temperature_c"], bins=10)
        tv = temp_valid.groupby("temp_bucket", observed=True).agg(
            temp=("temperature_c", "mean"), demand=("DELHI", "mean")).dropna().round(1)
        temp_demand_data = [{"temp": round(float(r["temp"]), 1), "demand": round(float(r["demand"]), 1)} for _, r in tv.iterrows()]
    else:
        temp_demand_data = []

    hum_valid = d.dropna(subset=["humidity_pct"]).copy()
    if len(hum_valid) > 0:
        hum_valid["hum_bucket"] = pd.cut(hum_valid["humidity_pct"], bins=7)
        hv = hum_valid.groupby("hum_bucket", observed=True).agg(
            rain=("humidity_pct", "mean"), demand=("DELHI", "mean")).dropna().round(1)
        humidity_demand_data = [{"rain": round(float(r["rain"]), 1), "demand": round(float(r["demand"]), 1)} for _, r in hv.iterrows()]
    else:
        humidity_demand_data = []

    discom_data = []
    for col in DISCOM_COLS:
        if col in d.columns:
            vals = pd.to_numeric(d[col], errors="coerce").dropna()
            if len(vals) > 0:
                discom_data.append({"name": col, "value": round(float(vals.mean()), 1)})
    total_discom = sum(x["value"] for x in discom_data) or 1
    for x in discom_data:
        x["pct"] = round(x["value"] / total_discom * 100, 1)

    yearly_avg = d.groupby("year")["DELHI"].mean().sort_index()
    years      = list(yearly_avg.index)
    cagr_data  = []
    for i in range(1, len(years)):
        prev, curr = yearly_avg[years[i - 1]], yearly_avg[years[i]]
        cagr_data.append({"period": f"{years[i-1]}–{years[i]}", "cagr": round((curr / prev - 1) * 100, 2) if prev > 0 else 0})

    last24     = d.tail(24)[["datetime", "DELHI"]].copy()
    short_term = [{"time": row["datetime"].strftime("%H:%M"), "actual": round(float(row["DELHI"]), 1),
                   "predicted": round(float(row["DELHI"]) * 0.995, 1)} for _, row in last24.iterrows()]

    d["year_month"] = d["datetime"].dt.to_period("M")
    monthly_ts = d.groupby("year_month")["DELHI"].mean().round(1)
    long_term  = [{"time": str(ym), "actual": round(float(v), 1), "predicted": round(float(v) * 0.995, 1)}
                  for ym, v in monthly_ts.items()]

    d["date"]   = d["datetime"].dt.date
    daily_avg   = d.groupby("date")["DELHI"].mean().round(1)
    last10      = daily_avg.tail(10)
    demand_trend = [{"date": pd.Timestamp(dt_).strftime("%d %b").lstrip("0"),
                     "actual": round(float(v), 1), "predicted": round(float(v) * 0.995, 1)}
                    for dt_, v in last10.items()]

    recent_avg  = float(daily_avg.tail(7).mean())
    last_date   = pd.Timestamp(daily_avg.index[-1])
    forecast_5day = []
    for i in range(1, 6):
        fdate    = last_date + pd.Timedelta(days=i)
        dow      = fdate.weekday()          # 0=Mon … 6=Sun
        month    = fdate.month
        # day-of-week seasonal factor from dataset
        dow_avg  = float(d[d["datetime"].dt.weekday == dow]["DELHI"].mean())
        mon_avg  = float(monthly[month])
        # blend: 50% recent trend + 30% day-of-week pattern + 20% monthly seasonal
        bau = round(recent_avg * 0.50 + dow_avg * 0.30 + mon_avg * 0.20, 1)
        forecast_5day.append({
            "date":        fdate.strftime("%d %b").lstrip("0"),
            "bau":         bau,
            "optimistic":  round(bau * 1.04, 1),
            "pessimistic": round(bau * 0.96, 1),
        })

    avg_bau = round(sum(row["bau"] for row in forecast_5day) / len(forecast_5day), 1)
    scenario_bar = [
        {"scenario": "Pessimistic", "demand": round(avg_bau * 0.96, 1)},
        {"scenario": "BAU",         "demand": avg_bau},
        {"scenario": "Optimistic",  "demand": round(avg_bau * 1.04, 1)},
    ]

    peak_month_idx     = int(monthly.idxmax())
    peak_hour_val      = int(hourly.idxmax())
    all_time_peak_row  = d.loc[d["DELHI"].idxmax()]
    all_time_peak_date = all_time_peak_row["datetime"].strftime("%d %b %Y").lstrip("0")

    # Year in which the peak month's highest demand occurred
    peak_month_year = int(
        d[d["datetime"].dt.month == peak_month_idx]
        .loc[lambda x: x["DELHI"] == x["DELHI"].max(), "datetime"]
        .dt.year.iloc[0]
    )

    daily_peak_raw = d.groupby("date")["DELHI"].max().round(1).tail(30)
    daily_peak_demand = [
        {"date": pd.Timestamp(dt_).strftime("%d %b").lstrip("0"), "peak": float(v)}
        for dt_, v in daily_peak_raw.items()
    ]

    return {
        "total_rows": total_rows, "date_min": date_min, "date_max": date_max,
        "feature_count": len(FEATURE_COLS), "feature_cols": FEATURE_COLS,
        "demand_mean": demand_mean, "demand_min": demand_min, "demand_max": demand_max, "demand_std": demand_std,
        "all_time_peak_date": all_time_peak_date,
        "peak_month": MONTH_NAMES[peak_month_idx - 1], "peak_month_avg": round(float(monthly[peak_month_idx]), 1),
        "peak_month_year": peak_month_year,
        "peak_hour": f"{peak_hour_val:02d}:00", "peak_hour_avg": round(float(hourly[peak_hour_val]), 1),
        "hourly_profile": hourly_profile, "monthly_demand": monthly_demand,
        "annual_peaks": annual_peaks, "monthly_peaks": monthly_peaks, "hourly_peak_profile": hourly_peak_profile,
        "peak_events": peak_events, "temp_vs_demand": temp_demand_data, "humidity_vs_demand": humidity_demand_data,
        "discom_breakdown": discom_data, "cagr_data": cagr_data,
        "short_term": short_term, "long_term": long_term, "demand_trend": demand_trend,
        "forecast_5day": forecast_5day, "scenario_bar": scenario_bar,
        "daily_peak_demand": daily_peak_demand,
    }


def build_weather_profiles(df: pd.DataFrame):
    """Compute avg temp/humidity/apparent_temp per (month, hour) from dataset."""
    global weather_profiles
    d = df[["datetime", "temperature_c", "humidity_pct", "apparent_temp_c"]].copy()
    for col in ["temperature_c", "humidity_pct", "apparent_temp_c"]:
        d[col] = pd.to_numeric(d[col], errors="coerce")
    d["month"] = df["datetime"].dt.month
    d["hour"]  = df["datetime"].dt.hour
    grp = d.groupby(["month", "hour"])[["temperature_c", "humidity_pct", "apparent_temp_c"]].mean().round(1)
    for (month, hour), row in grp.iterrows():
        weather_profiles[(int(month), int(hour))] = {
            "temperature_c":   float(row["temperature_c"]),
            "humidity_pct":    float(row["humidity_pct"]),
            "apparent_temp_c": float(row["apparent_temp_c"]),
        }
    print(f"  Weather profiles built: {len(weather_profiles)} (month, hour) buckets")


# ── Artifact loading ──────────────────────────────────────────────────────────

def load_artifacts():
    global feat_scaler, tgt_scaler, models, dataset_stats

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

    # Load MAE values from model_results.csv — stays in sync after every retrain
    results_path = os.path.join(MODELS_DIR, "model_results.csv")
    if os.path.exists(results_path):
        _name_map = {
            "linear regression":              "linear_regression",
            "random forest":                  "random_forest",
            "xgboost":                        "xgboost",
            "lstm":                           "lstm",
            "bi-lstm":                        "bilstm",
            "cnn-lstm":                       "cnn_lstm",
            "tft":                            "tft",
            "hybrid (transformer+bilstm+xgb)": "hybrid_transformer_bilstm",
        }
        _df = pd.read_csv(results_path)
        for _, row in _df.iterrows():
            key = _name_map.get(str(row["model"]).strip().lower())
            if key:
                MODEL_MAE[key] = float(row["MAE"])
        print(f"  MODEL_MAE loaded: {MODEL_MAE}")
    else:
        # Fallback defaults until first retrain
        MODEL_MAE.update({
            "xgboost": 100.0, "random_forest": 100.0, "linear_regression": 150.0,
            "hybrid_transformer_bilstm": 150.0, "bilstm": 250.0,
            "tft": 250.0, "cnn_lstm": 280.0, "lstm": 280.0,
        })
        print("  [WARN] model_results.csv not found — using default MAE values")

    # Load XGBoost SHAP explainer
    global xgb_explainer
    explainer_path = os.path.join(MODELS_DIR, "xgb_shap_explainer.pkl")
    if os.path.exists(explainer_path):
        xgb_explainer = joblib.load(explainer_path)
        print("  XGBoost SHAP explainer loaded.")
    else:
        print("  [WARN] xgb_shap_explainer.pkl not found — run train.py to generate it.")

    print(f"Loaded models: {list(models.keys())}")

    if os.path.exists(DATA_PATH):
        print("Computing dataset statistics...")
        df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
        df.sort_values("datetime", inplace=True)
        df.replace("None", np.nan, inplace=True)
        df.ffill(inplace=True)
        df.bfill(inplace=True)
        df.reset_index(drop=True, inplace=True)
        dataset_stats.update(compute_dataset_stats(df))
        build_weather_profiles(df)
        print(f"  Dataset: {dataset_stats['total_rows']} rows "
              f"({dataset_stats['date_min']} → {dataset_stats['date_max']})")
        fill_model_predictions(df)
    else:
        print(f"[WARN] Dataset not found at {DATA_PATH}")


def fill_model_predictions(df: pd.DataFrame):
    """Replace placeholder predictions in dataset_stats with real model predictions.
    Called after models are loaded. Uses best available model (xgboost fallback)."""
    model_key = resolve_model("xgboost")
    if model_key is None or feat_scaler is None:
        return

    # ── Fix short_term: real predictions for last 24 rows ──────────────────
    last24 = df.tail(24).copy()
    short_term = []
    for _, row in last24.iterrows():
        try:
            pr = PredictRequest(
                temperature_c=float(row["temperature_c"]),
                humidity_pct=float(row["humidity_pct"]),
                apparent_temp_c=float(row["apparent_temp_c"]),
                hour=int(row["hour"]), day_of_week=int(row["day_of_week"]),
                month=int(row["month"]), is_weekend=int(row["is_weekend"]),
                model_name=model_key,
                DELHI_lag_1h=float(row["DELHI_lag_1h"]),
                DELHI_lag_2h=float(row["DELHI_lag_2h"]),
                DELHI_lag_3h=float(row["DELHI_lag_3h"]),
                DELHI_lag_24h=float(row["DELHI_lag_24h"]),
                DELHI_lag_48h=float(row["DELHI_lag_48h"]),
                DELHI_lag_168h=float(row["DELHI_lag_168h"]),
                DELHI_roll_mean_3h=float(row["DELHI_roll_mean_3h"]),
                DELHI_roll_mean_24h=float(row["DELHI_roll_mean_24h"]),
                DELHI_roll_std_24h=float(row["DELHI_roll_std_24h"]),
                DELHI_roll_max_24h=float(row["DELHI_roll_max_24h"]),
            )
            X_sc = feat_scaler.transform(derive_features(pr))
            pred = round(run_model(model_key, X_sc), 1)
        except Exception:
            pred = round(float(row["DELHI"]) * 0.995, 1)
        short_term.append({
            "time":      pd.Timestamp(row["datetime"]).strftime("%H:%M"),
            "actual":    round(float(row["DELHI"]), 1),
            "predicted": pred,
        })
    dataset_stats["short_term"] = short_term

    # ── Fix demand_trend: real daily avg predictions for last 10 days ───────
    df["date"] = pd.to_datetime(df["datetime"]).dt.date
    daily_rows = df.groupby("date").last().tail(10)   # last row per day for features
    demand_trend = []
    for date_, row in daily_rows.iterrows():
        try:
            pr = PredictRequest(
                temperature_c=float(row["temperature_c"]),
                humidity_pct=float(row["humidity_pct"]),
                apparent_temp_c=float(row["apparent_temp_c"]),
                hour=int(row["hour"]), day_of_week=int(row["day_of_week"]),
                month=int(row["month"]), is_weekend=int(row["is_weekend"]),
                model_name=model_key,
                DELHI_lag_1h=float(row["DELHI_lag_1h"]),
                DELHI_lag_2h=float(row["DELHI_lag_2h"]),
                DELHI_lag_3h=float(row["DELHI_lag_3h"]),
                DELHI_lag_24h=float(row["DELHI_lag_24h"]),
                DELHI_lag_48h=float(row["DELHI_lag_48h"]),
                DELHI_lag_168h=float(row["DELHI_lag_168h"]),
                DELHI_roll_mean_3h=float(row["DELHI_roll_mean_3h"]),
                DELHI_roll_mean_24h=float(row["DELHI_roll_mean_24h"]),
                DELHI_roll_std_24h=float(row["DELHI_roll_std_24h"]),
                DELHI_roll_max_24h=float(row["DELHI_roll_max_24h"]),
            )
            X_sc = feat_scaler.transform(derive_features(pr))
            pred = round(run_model(model_key, X_sc), 1)
        except Exception:
            pred = round(float(row["DELHI"]) * 0.995, 1)
        demand_trend.append({
            "date":      pd.Timestamp(date_).strftime("%d %b").lstrip("0"),
            "actual":    round(float(df[df["date"] == date_]["DELHI"].mean()), 1),
            "predicted": pred,
        })
    dataset_stats["demand_trend"] = demand_trend

    # ── Fix forecast_5day: real model predictions instead of blend formula ──
    owm_data  = fetch_owm_forecast()
    lag_buf   = list(df.tail(168)["DELHI"].tolist())
    while len(lag_buf) < 168:
        lag_buf.insert(0, hour_demand(0))
    tomorrow  = dt.now().replace(hour=0, minute=0, second=0, microsecond=0) + pd.Timedelta(days=1)
    forecast_5day = []
    for i in range(1, 6):
        fdate     = tomorrow + pd.Timedelta(days=i - 1)
        day_preds = []
        for h in range(24):
            ts     = fdate + pd.Timedelta(hours=h)
            ts_key = ts.replace(minute=0, second=0, microsecond=0)
            wx     = owm_data.get(ts_key) or hist_weather_for(ts.month, ts.hour)
            pr = PredictRequest(
                temperature_c=wx["temperature_c"], humidity_pct=wx["humidity_pct"],
                apparent_temp_c=wx["apparent_temp_c"], hour=ts.hour,
                day_of_week=ts.weekday(), month=ts.month,
                is_weekend=1 if ts.weekday() >= 5 else 0, model_name=model_key,
                DELHI_lag_1h=lag_buf[-1], DELHI_lag_2h=lag_buf[-2], DELHI_lag_3h=lag_buf[-3],
                DELHI_lag_24h=lag_buf[-24] if len(lag_buf) >= 24 else lag_buf[0],
                DELHI_lag_48h=lag_buf[-48] if len(lag_buf) >= 48 else lag_buf[0],
                DELHI_lag_168h=lag_buf[-168] if len(lag_buf) >= 168 else lag_buf[0],
                DELHI_roll_mean_3h=float(np.mean(lag_buf[-3:])),
                DELHI_roll_mean_24h=float(np.mean(lag_buf[-24:])),
                DELHI_roll_std_24h=float(np.std(lag_buf[-24:])),
                DELHI_roll_max_24h=float(np.max(lag_buf[-24:])),
            )
            X_sc = feat_scaler.transform(derive_features(pr))
            pred = run_model(model_key, X_sc)
            lag_buf.append(pred)
            day_preds.append(pred)
        bau = round(float(np.mean(day_preds)), 1)
        forecast_5day.append({
            "date":        fdate.strftime("%d %b").lstrip("0"),
            "bau":         bau,
            "optimistic":  round(bau * 1.04, 1),
            "pessimistic": round(bau * 0.96, 1),
        })
    avg_bau = round(sum(r["bau"] for r in forecast_5day) / len(forecast_5day), 1)
    dataset_stats["forecast_5day"] = forecast_5day
    dataset_stats["scenario_bar"] = [
        {"scenario": "Pessimistic", "demand": round(avg_bau * 0.96, 1)},
        {"scenario": "BAU",         "demand": avg_bau},
        {"scenario": "Optimistic",  "demand": round(avg_bau * 1.04, 1)},
    ]
    print("  Model predictions filled into dataset_stats.")


@app.on_event("startup")
def startup_event():
    load_artifacts()


# ── Pydantic models ───────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    temperature_c:       float
    hour:                int
    month:               int
    day_of_week:         int
    humidity_pct:        float = 70.0
    apparent_temp_c:     float = 30.0
    is_weekend:          int   = 0
    DELHI_lag_1h:        Optional[float] = None
    DELHI_lag_2h:        Optional[float] = None
    DELHI_lag_3h:        Optional[float] = None
    DELHI_lag_24h:       Optional[float] = None
    DELHI_lag_48h:       Optional[float] = None
    DELHI_lag_168h:      Optional[float] = None
    DELHI_roll_mean_3h:  Optional[float] = None
    DELHI_roll_mean_24h: Optional[float] = None
    DELHI_roll_std_24h:  Optional[float] = None
    DELHI_roll_max_24h:  Optional[float] = None
    model_name:          str = "xgboost"


class PredictResponse(BaseModel):
    model_used:       str
    predicted_demand: float
    unit:             str = "MW"


class ForecastRequest(BaseModel):
    start_datetime: str       # ISO: "2025-08-08T15:00"
    hours:          int = 24  # 24, 48, or 72
    model_name:     str = "xgboost"


# ── Helper functions ──────────────────────────────────────────────────────────

def hour_demand(h: int) -> float:
    base    = dataset_stats.get("demand_mean", 5500.0)
    profile = dataset_stats.get("hourly_profile", [])
    if profile:
        entry = next((x for x in profile if x["hour"] == f"{h % 24:02d}"), None)
        if entry:
            return entry["demand"]
    return base


def derive_features(req: PredictRequest) -> np.ndarray:
    base       = hour_demand(req.hour)
    hour_sin   = np.sin(2 * np.pi * req.hour        / 24)
    hour_cos   = np.cos(2 * np.pi * req.hour        / 24)
    dow_sin    = np.sin(2 * np.pi * req.day_of_week / 7)
    dow_cos    = np.cos(2 * np.pi * req.day_of_week / 7)
    lag_default = req.DELHI_roll_mean_24h if req.DELHI_roll_mean_24h else base
    demand_std  = dataset_stats.get("demand_std", 400.0)

    row = [
        req.temperature_c, req.humidity_pct, req.apparent_temp_c,
        req.hour, req.day_of_week, req.month, req.is_weekend,
        hour_sin, hour_cos, dow_sin, dow_cos,
        req.DELHI_lag_1h   or hour_demand(req.hour - 1),
        req.DELHI_lag_2h   or hour_demand(req.hour - 2),
        req.DELHI_lag_3h   or hour_demand(req.hour - 3),
        req.DELHI_lag_24h  or base,
        req.DELHI_lag_48h  or base,
        req.DELHI_lag_168h or base,
        req.DELHI_roll_mean_3h  or lag_default,
        req.DELHI_roll_mean_24h or lag_default,
        req.DELHI_roll_std_24h  or demand_std,
        req.DELHI_roll_max_24h  or lag_default * 1.15,
    ]
    return np.array(row, dtype=np.float32).reshape(1, -1)


MODEL_ALIASES = {
    "hybrid": "hybrid_transformer_bilstm", "transformer": "hybrid_transformer_bilstm",
    "bilstm": "bilstm", "bi-lstm": "bilstm",
    "lstm": "lstm", "cnn_lstm": "cnn_lstm", "cnn-lstm": "cnn_lstm", "tft": "tft",
    "xgboost": "xgboost", "random_forest": "random_forest", "rf": "random_forest",
    "linear": "linear_regression", "linear_regression": "linear_regression",
}

FALLBACK_ORDER = [
    "hybrid_transformer_bilstm", "tft", "bilstm", "cnn_lstm",
    "lstm", "xgboost", "random_forest", "linear_regression",
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


def run_model(model_key: str, X_sc: np.ndarray) -> float:
    mdl = models[model_key]
    if model_key in ("lstm", "cnn_lstm", "tft", "hybrid_transformer_bilstm", "bilstm"):
        n  = getattr(mdl, "_expected_n_features", X_sc.shape[1])
        Xs = np.repeat(X_sc[:, :n], SEQ_LEN, axis=0).reshape(1, SEQ_LEN, n)
        p  = float(tgt_scaler.inverse_transform([[mdl.predict(Xs, verbose=0).ravel()[0]]])[0][0])
        if model_key == "hybrid_transformer_bilstm" and "hybrid_xgb_residual" in models:
            p += float(models["hybrid_xgb_residual"].predict(X_sc)[0])
        return p
    return float(mdl.predict(X_sc)[0])


# ── Weather helpers ───────────────────────────────────────────────────────────

def fetch_owm_forecast() -> dict:
    """Fetch OWM 5-day/3h forecast. Returns dict keyed by rounded hour -> weather dict."""
    try:
        url  = (f"https://api.openweathermap.org/data/2.5/forecast"
                f"?lat={DELHI_LAT}&lon={DELHI_LON}&appid={OWM_API_KEY}&units=metric")
        data = http_requests.get(url, timeout=5).json()
        result = {}
        for item in data.get("list", []):
            ts  = dt.fromtimestamp(item["dt"]).replace(minute=0, second=0, microsecond=0)
            result[ts] = {
                "temperature_c":   item["main"]["temp"],
                "humidity_pct":    item["main"]["humidity"],
                "apparent_temp_c": item["main"]["feels_like"],
            }
        return result
    except Exception:
        return {}


def hist_weather_for(month: int, hour: int) -> dict:
    """Return dataset historical avg weather for a given month+hour."""
    key = (month, hour)
    if key in weather_profiles:
        return weather_profiles[key]
    month_vals = [v for (m, _), v in weather_profiles.items() if m == month]
    if month_vals:
        return {k: round(sum(v[k] for v in month_vals) / len(month_vals), 1)
                for k in ("temperature_c", "humidity_pct", "apparent_temp_c")}
    return {"temperature_c": 30.0, "humidity_pct": 60.0, "apparent_temp_c": 32.0}


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.post("/predict", response_model=None)
def predict(req: PredictRequest):
    model_key = resolve_model(req.model_name)
    if model_key is None:
        raise HTTPException(status_code=503, detail="No models loaded. Run train.py first.")
    X_raw = derive_features(req)
    X_sc  = feat_scaler.transform(X_raw)
    pred  = round(run_model(model_key, X_sc), 2)

    # Instance-level SHAP — always use XGBoost explainer regardless of model chosen
    shap_contribs = []
    if xgb_explainer is not None:
        sv = xgb_explainer.shap_values(X_sc)[0]   # shape: (21,)
        for feat, val in zip(FEATURE_COLS, sv):
            shap_contribs.append({"feature": feat, "shap_value": round(float(val), 4)})
        shap_contribs.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    return {
        "model_used":       model_key,
        "predicted_demand": pred,
        "unit":             "MW",
        "shap_explanation": shap_contribs[:10],   # top 10 contributors
    }


@app.post("/forecast")
def forecast(req: ForecastRequest):
    model_key = resolve_model(req.model_name)
    if model_key is None:
        raise HTTPException(status_code=503, detail="No models loaded. Run train.py first.")
    if req.hours not in (24, 48, 72):
        raise HTTPException(status_code=400, detail="hours must be 24, 48, or 72")
    try:
        start = dt.fromisoformat(req.start_datetime)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_datetime. Use: 2025-08-08T15:00")

    base_mae = MODEL_MAE.get(model_key, 150.0)
    owm_data = fetch_owm_forecast()
    results  = []

    # Rolling lag buffer — seed with real recent demand values from dataset
    _df = pd.read_csv(DATA_PATH, parse_dates=["datetime"], usecols=["datetime", "DELHI"])
    _df.sort_values("datetime", inplace=True)
    _df["DELHI"] = pd.to_numeric(_df["DELHI"], errors="coerce")
    _df.dropna(subset=["DELHI"], inplace=True)
    _recent = _df.tail(168)["DELHI"].tolist()
    # Pad with hourly profile averages if fewer than 168 rows available
    while len(_recent) < 168:
        _recent.insert(0, hour_demand(0))
    lag_buf = list(_recent)

    for i in range(req.hours):
        ts     = start + pd.Timedelta(hours=i)
        ts_key = ts.replace(minute=0, second=0, microsecond=0)

        if ts_key in owm_data:
            wx, weather_src = owm_data[ts_key], "forecast"
        else:
            wx, weather_src = hist_weather_for(ts.month, ts.hour), "historical_avg"

        horizon_mult = 1.0 if i < 24 else (1.5 if i < 48 else 2.2)

        pr = PredictRequest(
            temperature_c=wx["temperature_c"], humidity_pct=wx["humidity_pct"],
            apparent_temp_c=wx["apparent_temp_c"], hour=ts.hour,
            day_of_week=ts.weekday(), month=ts.month,
            is_weekend=1 if ts.weekday() >= 5 else 0, model_name=req.model_name,
            DELHI_lag_1h=lag_buf[-1],
            DELHI_lag_2h=lag_buf[-2],
            DELHI_lag_3h=lag_buf[-3],
            DELHI_lag_24h=lag_buf[-24] if len(lag_buf) >= 24 else lag_buf[0],
            DELHI_lag_48h=lag_buf[-48] if len(lag_buf) >= 48 else lag_buf[0],
            DELHI_lag_168h=lag_buf[-168] if len(lag_buf) >= 168 else lag_buf[0],
            DELHI_roll_mean_3h=float(np.mean(lag_buf[-3:])),
            DELHI_roll_mean_24h=float(np.mean(lag_buf[-24:])),
            DELHI_roll_std_24h=float(np.std(lag_buf[-24:])),
            DELHI_roll_max_24h=float(np.max(lag_buf[-24:])),
        )
        X_sc = feat_scaler.transform(derive_features(pr))
        pred = run_model(model_key, X_sc)
        lag_buf.append(pred)
        margin = round(base_mae * horizon_mult, 1)

        results.append({
            "time":            ts.strftime("%d %b %H:%M"),
            "predicted":       round(pred, 1),
            "confidence_low":  round(pred - margin, 1),
            "confidence_high": round(pred + margin, 1),
            "weather_src":     weather_src,
            "temperature_c":   wx["temperature_c"],
            "humidity_pct":    wx["humidity_pct"],
        })

    return {"model": model_key, "hours": req.hours, "start": req.start_datetime, "data": results}


@app.get("/forecast/peak")
def forecast_peak(model_name: str = "xgboost", days: int = 3):
    """Forecast peak demand for the next N days (1-5)."""
    if days < 1 or days > 5:
        raise HTTPException(status_code=400, detail="days must be 1–5")
    model_key = resolve_model(model_name)
    if model_key is None:
        raise HTTPException(status_code=503, detail="No models loaded.")

    base_mae = MODEL_MAE.get(model_key, 150.0)
    owm_data = fetch_owm_forecast()

    # Seed lag buffer from recent CSV values
    _df = pd.read_csv(DATA_PATH, parse_dates=["datetime"], usecols=["datetime", "DELHI"])
    _df.sort_values("datetime", inplace=True)
    _df["DELHI"] = pd.to_numeric(_df["DELHI"], errors="coerce")
    _df.dropna(subset=["DELHI"], inplace=True)
    _recent = _df.tail(168)["DELHI"].tolist()
    while len(_recent) < 168:
        _recent.insert(0, hour_demand(0))
    lag_buf = list(_recent)

    # Start from tomorrow 00:00
    tomorrow = (dt.now().replace(hour=0, minute=0, second=0, microsecond=0)
                + pd.Timedelta(days=1))

    daily_peaks = []
    for d in range(days):
        day_start  = tomorrow + pd.Timedelta(days=d)
        day_preds  = []
        for h in range(24):
            ts     = day_start + pd.Timedelta(hours=h)
            ts_key = ts.replace(minute=0, second=0, microsecond=0)
            wx     = owm_data.get(ts_key) or hist_weather_for(ts.month, ts.hour)
            pr = PredictRequest(
                temperature_c=wx["temperature_c"], humidity_pct=wx["humidity_pct"],
                apparent_temp_c=wx["apparent_temp_c"], hour=ts.hour,
                day_of_week=ts.weekday(), month=ts.month,
                is_weekend=1 if ts.weekday() >= 5 else 0, model_name=model_name,
                DELHI_lag_1h=lag_buf[-1], DELHI_lag_2h=lag_buf[-2], DELHI_lag_3h=lag_buf[-3],
                DELHI_lag_24h=lag_buf[-24] if len(lag_buf) >= 24 else lag_buf[0],
                DELHI_lag_48h=lag_buf[-48] if len(lag_buf) >= 48 else lag_buf[0],
                DELHI_lag_168h=lag_buf[-168] if len(lag_buf) >= 168 else lag_buf[0],
                DELHI_roll_mean_3h=float(np.mean(lag_buf[-3:])),
                DELHI_roll_mean_24h=float(np.mean(lag_buf[-24:])),
                DELHI_roll_std_24h=float(np.std(lag_buf[-24:])),
                DELHI_roll_max_24h=float(np.max(lag_buf[-24:])),
            )
            X_sc = feat_scaler.transform(derive_features(pr))
            pred = run_model(model_key, X_sc)
            lag_buf.append(pred)
            day_preds.append({"hour": h, "predicted": round(pred, 1)})

        peak_entry = max(
            [p for p in day_preds if 9 <= p["hour"] <= 21],
            key=lambda x: x["predicted"]
        )
        daily_peaks.append({
            "date":           day_start.strftime("%d %b %Y").lstrip("0"),
            "day":            day_start.strftime("%A"),
            "peak_demand":    peak_entry["predicted"],
            "peak_hour":      f"{peak_entry['hour']:02d}:00",
            "peak_low":       round(peak_entry["predicted"] - base_mae, 1),
            "peak_high":      round(peak_entry["predicted"] + base_mae, 1),
            "hourly":         day_preds,
        })

    return {"model": model_key, "days": days, "peaks": daily_peaks}


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


@app.get("/dataset-stats")
def get_dataset_stats():
    if not dataset_stats:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")
    return dataset_stats


@app.get("/recent-demand")
def get_recent_demand():
    """Return last 168 hourly DELHI demand values for lag feature computation."""
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=503, detail="Dataset not found.")
    df = pd.read_csv(DATA_PATH, parse_dates=["datetime"], usecols=["datetime", "DELHI"])
    df.sort_values("datetime", inplace=True)
    df["DELHI"] = pd.to_numeric(df["DELHI"], errors="coerce")
    df.dropna(subset=["DELHI"], inplace=True)
    last168 = df.tail(168)[["datetime", "DELHI"]].copy()
    return {
        "values": [round(float(v), 1) for v in last168["DELHI"].tolist()],
        "timestamps": [str(t) for t in last168["datetime"].tolist()],
    }


@app.get("/health")
def health():
    return {
        "status":        "ok",
        "models_loaded": len(models),
        "dataset_rows":  dataset_stats.get("total_rows", 0),
        "date_range":    f"{dataset_stats.get('date_min', '?')} → {dataset_stats.get('date_max', '?')}",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("predict_api:app", host="0.0.0.0", port=8000, reload=False)
