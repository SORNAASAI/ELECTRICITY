"""
Multi-Date Comparison: Recursive XGBoost vs Random Forest across Unseen 24-Hour Periods
"""
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
DATA_PATH  = os.path.join(BASE_DIR, "..", "..", "EDA", "delhi.csv")

FEATURE_COLS = [
    "temperature_c", "humidity_pct", "apparent_temp_c",
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "DELHI_lag_1h", "DELHI_lag_2h", "DELHI_lag_3h",
    "DELHI_lag_24h", "DELHI_lag_48h", "DELHI_lag_168h",
    "DELHI_roll_mean_3h", "DELHI_roll_mean_24h",
    "DELHI_roll_std_24h", "DELHI_roll_max_24h",
]

TEST_DATES = [
    "2026-03-15 00:00:00",  # Spring / Moderate
    "2026-05-15 00:00:00",  # Summer Peak / Hot
    "2026-06-29 00:00:00",  # Extreme All-Time Peak Day (8653 MW)
    "2026-07-15 00:00:00",  # Monsoon High Humidity
    "2026-08-01 00:00:00",  # Early August
    "2026-08-04 00:00:00",  # Late August
]

def run_recursive_forecast(model, feat_scaler, df, start_dt):
    aug_df = df[(df["datetime"] >= start_dt) & (df["datetime"] < start_dt + pd.Timedelta(days=1))].copy().reset_index(drop=True)
    if len(aug_df) < 24:
        return None, None
    actuals = aug_df["DELHI"].values
    
    prior_168 = df[df["datetime"] < start_dt].tail(168)
    if len(prior_168) < 168:
        return None, None
    lag_buf = prior_168["DELHI"].tolist()
    
    preds = []
    for i in range(24):
        row = aug_df.iloc[i]
        ts = row["datetime"]
        
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
            "DELHI_lag_24h":   lag_buf[-24],
            "DELHI_lag_48h":   lag_buf[-48],
            "DELHI_lag_168h":  lag_buf[-168],
            "DELHI_roll_mean_3h":  float(np.mean(lag_buf[-3:])),
            "DELHI_roll_mean_24h": float(np.mean(lag_buf[-24:])),
            "DELHI_roll_std_24h":  float(np.std(lag_buf[-24:])),
            "DELHI_roll_max_24h":  float(np.max(lag_buf[-24:])),
        }
        x_raw = np.array([[feat_dict[c] for c in FEATURE_COLS]])
        x_sc = feat_scaler.transform(x_raw)
        p = model.predict(x_sc)[0]
        preds.append(p)
        lag_buf.append(p)
        
    return actuals, np.array(preds)

def calc_metrics(actuals, preds):
    mae = mean_absolute_error(actuals, preds)
    rmse = np.sqrt(mean_squared_error(actuals, preds))
    mape = np.mean(np.abs((actuals - preds) / actuals)) * 100.0
    r2 = r2_score(actuals, preds)
    bias = np.mean(preds - actuals)
    
    peak_idx = np.argmax(actuals)
    actual_peak = actuals[peak_idx]
    pred_peak_err = preds[peak_idx] - actual_peak
    return mae, rmse, mape, r2, bias, pred_peak_err, actual_peak

def main():
    feat_scaler = joblib.load(os.path.join(MODELS_DIR, "feat_scaler.pkl"))
    xgb_model   = joblib.load(os.path.join(MODELS_DIR, "xgboost.pkl"))
    rf_model    = joblib.load(os.path.join(MODELS_DIR, "random_forest.pkl"))

    df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
    df.sort_values("datetime", inplace=True)
    for c in FEATURE_COLS + ["DELHI"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    xgb_metrics_list = []
    rf_metrics_list  = []

    print("=" * 110)
    print("RECURSIVE MULTI-STEP 24-HOUR FORECAST: XGBOOST vs RANDOM FOREST ACROSS MULTIPLE DATES")
    print("=" * 110)

    for date_str in TEST_DATES:
        start_dt = pd.Timestamp(date_str)
        
        act_xgb, preds_xgb = run_recursive_forecast(xgb_model, feat_scaler, df, start_dt)
        act_rf,  preds_rf  = run_recursive_forecast(rf_model, feat_scaler, df, start_dt)
        
        m_xgb = calc_metrics(act_xgb, preds_xgb)
        m_rf  = calc_metrics(act_rf, preds_rf)
        
        xgb_metrics_list.append((date_str, *m_xgb, act_xgb, preds_xgb))
        rf_metrics_list.append((date_str, *m_rf, act_rf, preds_rf))

    print(f"\n{'Date':<20} | {'Model':<14} | {'MAE (MW)':<8} | {'RMSE (MW)':<9} | {'MAPE (%)':<8} | {'R2 Score':<8} | {'Bias (MW)':<10} | {'Peak Err (MW)':<12}")
    print("-" * 110)

    for i in range(len(TEST_DATES)):
        d_str = TEST_DATES[i].split()[0]
        
        # XGBoost row
        m_x = xgb_metrics_list[i]
        print(f"{d_str:<20} | {'XGBoost':<14} | {m_x[1]:8.1f} | {m_x[2]:9.1f} | {m_x[3]:7.2f}% | {m_x[4]:8.4f} | {m_x[5]:10.1f} | {m_x[6]:12.1f}")
        
        # RF row
        m_r = rf_metrics_list[i]
        print(f"{'':<20} | {'Random Forest':<14} | {m_r[1]:8.1f} | {m_r[2]:9.1f} | {m_r[3]:7.2f}% | {m_r[4]:8.4f} | {m_r[5]:10.1f} | {m_r[6]:12.1f}")
        print("-" * 110)

    # OVERALL AGGREGATED EVALUATION ACROSS ALL DATES
    all_act_xgb = np.concatenate([m[8] for m in xgb_metrics_list])
    all_pred_xgb = np.concatenate([m[9] for m in xgb_metrics_list])
    
    all_act_rf = np.concatenate([m[8] for m in rf_metrics_list])
    all_pred_rf = np.concatenate([m[9] for m in rf_metrics_list])

    ov_xgb = calc_metrics(all_act_xgb, all_pred_xgb)
    ov_rf  = calc_metrics(all_act_rf, all_pred_rf)

    print("\n" + "=" * 110)
    print("OVERALL AGGREGATED METRICS ACROSS ALL TEST DATES:")
    print("=" * 110)
    print(f"XGBoost Overall       : MAE = {ov_xgb[0]:6.1f} MW | RMSE = {ov_xgb[1]:6.1f} MW | MAPE = {ov_xgb[2]:5.2f}% | R2 = {ov_xgb[3]:6.4f} | Bias = {ov_xgb[4]:6.1f} MW")
    print(f"Random Forest Overall : MAE = {ov_rf[0]:6.1f} MW | RMSE = {ov_rf[1]:6.1f} MW | MAPE = {ov_rf[2]:5.2f}% | R2 = {ov_rf[3]:6.4f} | Bias = {ov_rf[4]:6.1f} MW")

if __name__ == "__main__":
    main()
