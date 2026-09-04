"""
Root Cause Investigation Script — Validation vs Real Forecast Discrepancy
"""
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "..", "delhi_features.csv")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")

FEATURE_COLS = [
    "temperature_c", "humidity_pct", "apparent_temp_c",
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "DELHI_lag_1h", "DELHI_lag_2h", "DELHI_lag_3h",
    "DELHI_lag_24h", "DELHI_lag_48h", "DELHI_lag_168h",
    "DELHI_roll_mean_3h", "DELHI_roll_mean_24h",
    "DELHI_roll_std_24h", "DELHI_roll_max_24h",
]

def run_investigation():
    df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
    df.sort_values("datetime", inplace=True)
    df.replace("None", np.nan, inplace=True)
    df.reset_index(drop=True, inplace=True)

    for col in FEATURE_COLS + ["DELHI"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    tgt_scaler  = joblib.load(os.path.join(MODELS_DIR, "tgt_scaler.pkl"))
    xgb_model   = joblib.load(os.path.join(MODELS_DIR, "xgboost.pkl"))

    print("=" * 70)
    print("INVESTIGATION 1: Validation Method vs Real World Deployment Method")
    print("=" * 70)

    # Pick a 24-hour window from the end of dataset (unseen test set)
    # E.g., 2026-07-20 00:00 to 2026-07-20 23:00 (or last 24h)
    target_date_start = df["datetime"].iloc[-24].replace(hour=0, minute=0, second=0)
    idx_start = df[df["datetime"] == target_date_start].index[0]
    
    test_24 = df.iloc[idx_start:idx_start+24].copy().reset_index(drop=True)
    actuals = test_24["DELHI"].values
    datetimes = test_24["datetime"].tolist()

    # --- Method A: Teacher Forcing / One-Step (used by train.py & validate_models.py) ---
    X_teacher = test_24[FEATURE_COLS].values
    X_teacher_sc = feat_scaler.transform(X_teacher)
    preds_teacher = xgb_model.predict(X_teacher_sc)

    mae_tf  = mean_absolute_error(actuals, preds_teacher)
    rmse_tf = np.sqrt(mean_squared_error(actuals, preds_teacher))
    mape_tf = np.mean(np.abs((actuals - preds_teacher) / actuals)) * 100
    r2_tf   = r2_score(actuals, preds_teacher)
    bias_tf = np.mean(preds_teacher - actuals)

    print(f"Test Window: {datetimes[0]} to {datetimes[-1]}")
    print(f"\n[A] One-Step Teacher-Forcing (train.py validation method):")
    print(f"    MAE  : {mae_tf:.2f} MW")
    print(f"    RMSE : {rmse_tf:.2f} MW")
    print(f"    MAPE : {mape_tf:.2f}%")
    print(f"    R²   : {r2_tf:.4f}")
    print(f"    Bias : {bias_tf:.2f} MW")

    # --- Method B: Recursive Multi-step Forecasting (used by /forecast endpoint) ---
    # Seed buffer with 168 hours prior to idx_start
    buf_df = df.iloc[max(0, idx_start-168):idx_start].copy()
    lag_buf = buf_df["DELHI"].tolist()
    while len(lag_buf) < 168:
        lag_buf.insert(0, lag_buf[0])

    preds_rec = []
    for i in range(24):
        row = test_24.iloc[i]
        ts = row["datetime"]
        
        # Build features dynamically using lag_buf (which includes previous predictions)
        feat_dict = {
            "temperature_c":   row["temperature_c"],
            "humidity_pct":    row["humidity_pct"],
            "apparent_temp_c": row["apparent_temp_c"],
            "hour":            ts.hour,
            "day_of_week":     ts.weekday(),
            "month":           ts.month,
            "is_weekend":      1 if ts.weekday() >= 5 else 0,
            "hour_sin":        np.sin(2 * np.pi * ts.hour / 24.0),
            "hour_cos":        np.cos(2 * np.pi * ts.hour / 24.0),
            "dow_sin":         np.sin(2 * np.pi * ts.weekday() / 7.0),
            "dow_cos":         np.cos(2 * np.pi * ts.weekday() / 7.0),
            "DELHI_lag_1h":    lag_buf[-1],
            "DELHI_lag_2h":    lag_buf[-2],
            "DELHI_lag_3h":    lag_buf[-3],
            "DELHI_lag_24h":   lag_buf[-24] if len(lag_buf)>=24 else lag_buf[0],
            "DELHI_lag_48h":   lag_buf[-48] if len(lag_buf)>=48 else lag_buf[0],
            "DELHI_lag_168h":  lag_buf[-168] if len(lag_buf)>=168 else lag_buf[0],
            "DELHI_roll_mean_3h":  float(np.mean(lag_buf[-3:])),
            "DELHI_roll_mean_24h": float(np.mean(lag_buf[-24:])),
            "DELHI_roll_std_24h":  float(np.std(lag_buf[-24:])),
            "DELHI_roll_max_24h":  float(np.max(lag_buf[-24:])),
        }
        
        x_raw = np.array([[feat_dict[c] for c in FEATURE_COLS]])
        x_sc = feat_scaler.transform(x_raw)
        p = xgb_model.predict(x_sc)[0]
        preds_rec.append(p)
        lag_buf.append(p) # recursive update!

    mae_rec  = mean_absolute_error(actuals, preds_rec)
    rmse_rec = np.sqrt(mean_squared_error(actuals, preds_rec))
    mape_rec = np.mean(np.abs((actuals - preds_rec) / actuals)) * 100
    r2_rec   = r2_score(actuals, preds_rec)
    bias_rec = np.mean(np.array(preds_rec) - actuals)

    print(f"\n[B] Recursive Multi-Step Forecasting (/forecast API method):")
    print(f"    MAE  : {mae_rec:.2f} MW")
    print(f"    RMSE : {rmse_rec:.2f} MW")
    print(f"    MAPE : {mape_rec:.2f}%")
    print(f"    R²   : {r2_rec:.4f}")
    print(f"    Bias : {bias_rec:.2f} MW")

    print(f"\nDiscrepancy (Recursive vs Teacher Forcing on SAME 24 hours):")
    print(f"    MAE Increase : +{mae_rec - mae_tf:.2f} MW ({(mae_rec/mae_tf - 1)*100:.1f}% higher error)")
    print(f"    R² Drop      : {r2_tf:.4f} -> {r2_rec:.4f}")
    print(f"    Bias Change  : {bias_tf:.2f} MW -> {bias_rec:.2f} MW")

    print("\n" + "=" * 70)
    print("INVESTIGATION 2: Initial Lag Buffer Seeding Logic in predict_api.py")
    print("=" * 70)
    # Check predict_api.py buffer logic when start_datetime is not the end of dataset
    # Look at line in predict_api.py: `_recent = _df.tail(168)['DELHI'].tolist()`
    # If start_datetime = 2026-07-10T00:00 (which is inside the dataset, but 11 days before tail):
    # predict_api.py STILL uses _df.tail(168), which corresponds to 2026-07-15 to 2026-07-21!
    test_dt = pd.Timestamp("2026-07-10 00:00:00")
    actual_prev_168 = df[df["datetime"] < test_dt].tail(168)["DELHI"].tolist()
    wrong_tail_168  = df.tail(168)["DELHI"].tolist()

    print(f"Requested start_datetime: {test_dt}")
    print(f"Actual demand 1 hour prior ({test_dt - pd.Timedelta(hours=1)}): {actual_prev_168[-1]:.2f} MW")
    print(f"predict_api.py lag_buf[-1] (_df.tail(168)[-1], i.e., {df['datetime'].iloc[-1]}): {wrong_tail_168[-1]:.2f} MW")
    print(f"Buffer Error / Disconnect: {wrong_tail_168[-1] - actual_prev_168[-1]:.2f} MW")

if __name__ == "__main__":
    run_investigation()

def investigation_part2():
    df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
    df.sort_values("datetime", inplace=True)
    df.replace("None", np.nan, inplace=True)
    df.reset_index(drop=True, inplace=True)

    print("\n" + "=" * 70)
    print("INVESTIGATION 3: Weather Feature Distributions & Seasonality")
    print("=" * 70)

    # August vs July vs Annual weather distribution in training data
    df["month"] = df["datetime"].dt.month
    df["temperature_c"] = pd.to_numeric(df["temperature_c"], errors="coerce")
    df["humidity_pct"]  = pd.to_numeric(df["humidity_pct"], errors="coerce")
    df["DELHI"]         = pd.to_numeric(df["DELHI"], errors="coerce")

    print("\nTraining Data Demand and Weather by Month:")
    for m, name in enumerate(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], 1):
        m_df = df[df["month"] == m]
        if len(m_df) > 0:
            print(f"  {name:3s} (Month {m:2d}): Mean Demand = {m_df['DELHI'].mean():6.1f} MW | "
                  f"Max Demand = {m_df['DELHI'].max():6.1f} MW | "
                  f"Mean Temp = {m_df['temperature_c'].mean():4.1f}°C | "
                  f"Mean Hum = {m_df['humidity_pct'].mean():4.1f}%")

    print("\n" + "=" * 70)
    print("INVESTIGATION 4: Feature Scaling & Model Sensitivity Analysis")
    print("=" * 70)
    
    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    xgb_model   = joblib.load(os.path.join(MODELS_DIR, "xgboost.pkl"))

    print("MinMaxScaler feature min & max bounds from training:")
    for col, fmin, fmax in zip(FEATURE_COLS, feat_scaler.data_min_, feat_scaler.data_max_):
        print(f"  {col:20s}: min = {fmin:8.2f}, max = {fmax:8.2f}")

    print("\n" + "=" * 70)
    print("INVESTIGATION 5: Simulation of 2026-08-04 Lag Buffer Disconnect")
    print("=" * 70)
    # What happens when we run recursive forecast starting 2026-08-04 with current code?
    # Current code takes df.tail(168), which ends 2026-07-21 23:00 (demand ~6528 MW).
    # But in August, temperatures are high and demand patterns shift.
    # Also, if lag_1h, lag_24h, lag_168h are taken from July 21st, they represent July demand, NOT August demand!
    
    # Check XGBoost feature importances
    importances = xgb_model.feature_importances_
    feat_imp = pd.DataFrame({"feature": FEATURE_COLS, "importance": importances})
    feat_imp.sort_values("importance", ascending=False, inplace=True)
    print("XGBoost Top 10 Feature Importances:")
    print(feat_imp.head(10).to_string(index=False))

if __name__ == "__main__":
    investigation_part2()
