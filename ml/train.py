"""
Delhi Electricity Demand Forecasting — Full ML/DL Training Pipeline
Dataset : delhi_features.csv
Target  : DELHI (total Delhi demand in MW)
Split   : 80% train / 10% val / 10% test (chronological, lag features computed per-split)
"""

import os
import warnings
import joblib
import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

import tensorflow as tf
from tensorflow.keras.models import Model, Sequential
from tensorflow.keras.layers import (
    Input, LSTM, Bidirectional, Dense, Dropout, Conv1D,
    MaxPooling1D, LayerNormalization, MultiHeadAttention,
    GlobalAveragePooling1D, Add,
)
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.regularizers import l2

warnings.filterwarnings("ignore")
tf.get_logger().setLevel("ERROR")
tf.keras.utils.set_random_seed(42)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "..", "delhi_features.csv")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

SEQ_LEN    = 24
BATCH_SIZE = 64
EPOCHS     = 50

# ── 1. Load raw data (NO ffill/bfill across split boundary) ───────────────────
print("\n[1/5] Loading Data...")

df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
df.sort_values("datetime", inplace=True)
df.replace("None", np.nan, inplace=True)
df.reset_index(drop=True, inplace=True)

n         = len(df)
train_end = int(n * 0.80)
val_end   = int(n * 0.90)

# Split FIRST, then fill within each split — prevents future leakage via bfill
train_df = df.iloc[:train_end].copy().ffill().bfill().reset_index(drop=True)
val_df   = df.iloc[train_end:val_end].copy().ffill().bfill().reset_index(drop=True)
test_df  = df.iloc[val_end:].copy().ffill().bfill().reset_index(drop=True)

print(f"  Total  : {n} rows  ({df['datetime'].min().date()} → {df['datetime'].max().date()})")
print(f"  Train  : {len(train_df)} rows")
print(f"  Val    : {len(val_df)} rows")
print(f"  Test   : {len(test_df)} rows")

# ── 2. Feature Definition ─────────────────────────────────────────────────────
print("\n[2/5] Preparing Features...")

TARGET_COL = "DELHI"

FEATURE_COLS = [
    "temperature_c", "humidity_pct", "apparent_temp_c",
    "hour", "day_of_week", "month", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "DELHI_lag_1h", "DELHI_lag_2h", "DELHI_lag_3h",
    "DELHI_lag_24h", "DELHI_lag_48h", "DELHI_lag_168h",
    "DELHI_roll_mean_3h", "DELHI_roll_mean_24h",
    "DELHI_roll_std_24h", "DELHI_roll_max_24h",
]

def prepare(df):
    for col in FEATURE_COLS + [TARGET_COL]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df.dropna(subset=FEATURE_COLS + [TARGET_COL], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df[FEATURE_COLS].values, df[TARGET_COL].values

X_train, y_train = prepare(train_df)
X_val,   y_val   = prepare(val_df)
X_test,  y_test  = prepare(test_df)

print(f"  Features : {len(FEATURE_COLS)}")
print(f"  Train    : {X_train.shape[0]} samples")
print(f"  Val      : {X_val.shape[0]} samples")
print(f"  Test     : {X_test.shape[0]} samples")

# ── Scale ─────────────────────────────────────────────────────────────────────
feat_scaler = MinMaxScaler()
X_train_sc  = feat_scaler.fit_transform(X_train)
X_val_sc    = feat_scaler.transform(X_val)
X_test_sc   = feat_scaler.transform(X_test)

tgt_scaler  = MinMaxScaler()
y_train_sc  = tgt_scaler.fit_transform(y_train.reshape(-1, 1)).ravel()
y_val_sc    = tgt_scaler.transform(y_val.reshape(-1, 1)).ravel()
y_test_sc   = tgt_scaler.transform(y_test.reshape(-1, 1)).ravel()

joblib.dump(feat_scaler, os.path.join(MODELS_DIR, "feat_scaler.pkl"))
joblib.dump(tgt_scaler,  os.path.join(MODELS_DIR, "tgt_scaler.pkl"))
print("  Scalers saved.")

# ── Sequence builder ──────────────────────────────────────────────────────────
def make_sequences(X_sc, y_sc, seq_len):
    xs = np.lib.stride_tricks.sliding_window_view(X_sc, (seq_len, X_sc.shape[1]))[:-1, 0]
    ys = y_sc[seq_len:]
    return xs, ys

X_tr24, y_tr24 = make_sequences(X_train_sc, y_train_sc, SEQ_LEN)
X_va24, y_va24 = make_sequences(X_val_sc,   y_val_sc,   SEQ_LEN)
X_te24, y_te24 = make_sequences(X_test_sc,  y_test_sc,  SEQ_LEN)

print(f"  Seq (24h) — Train:{X_tr24.shape} Val:{X_va24.shape} Test:{X_te24.shape}")

# ── Metrics helper ────────────────────────────────────────────────────────────
def evaluate(name, y_true_test, y_pred_test):
    mae  = mean_absolute_error(y_true_test, y_pred_test)
    rmse = np.sqrt(mean_squared_error(y_true_test, y_pred_test))
    mape = np.mean(np.abs((y_true_test - y_pred_test) / (y_true_test + 1e-8))) * 100
    r2   = r2_score(y_true_test, y_pred_test)
    print(f"  [{name}] MAE={mae:.2f}  RMSE={rmse:.2f}  MAPE={mape:.2f}%  R²={r2:.4f}")
    return {"model": name, "MAE": round(mae, 2), "RMSE": round(rmse, 2),
            "MAPE": round(mape, 2), "R2": round(r2, 4)}

def dl_predict_unscaled(model, X_seq):
    return tgt_scaler.inverse_transform(
        model.predict(X_seq, verbose=0).reshape(-1, 1)
    ).ravel()

results = []

# ── 3. SHAP Feature Importance ────────────────────────────────────────────────
print("\n[3/5] Computing SHAP Feature Importance...")

# Use regularized RF for SHAP (max_depth=8 instead of 12)
rf_shap = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
rf_shap.fit(X_train_sc, y_train)

explainer   = shap.TreeExplainer(rf_shap)
shap_values = explainer.shap_values(X_val_sc[:200])
mean_shap   = np.abs(shap_values).mean(axis=0)

shap_df = pd.DataFrame({"feature": FEATURE_COLS, "importance": mean_shap})
shap_df.sort_values("importance", ascending=False, inplace=True)
shap_df.to_csv(os.path.join(MODELS_DIR, "shap_importance.csv"), index=False)
print("  Top 10 features by SHAP:")
print(shap_df.head(10).to_string(index=False))

plt.figure(figsize=(10, 6))
plt.barh(shap_df["feature"][:15][::-1], shap_df["importance"][:15][::-1], color="#38bdf8")
plt.xlabel("Mean |SHAP value|")
plt.title("Feature Importance (SHAP) — Delhi Demand")
plt.tight_layout()
plt.savefig(os.path.join(MODELS_DIR, "shap_importance.png"), dpi=100)
plt.close()

# ── 4. Model Training ─────────────────────────────────────────────────────────
print("\n[4/5] Training Models...")

ES = EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True, verbose=0)
LR = ReduceLROnPlateau(monitor="val_loss", patience=3, factor=0.5, min_lr=1e-6, verbose=0)
n_feat = X_tr24.shape[2]

# ── Ridge Regression (replaces plain LinearRegression — L2 regularized) ───────
print("  Training Ridge Regression...")
lr_model = Ridge(alpha=10.0)
lr_model.fit(X_train_sc, y_train)
results.append(evaluate("Linear Regression", y_test, lr_model.predict(X_test_sc)))
joblib.dump(lr_model, os.path.join(MODELS_DIR, "linear_regression.pkl"))

# ── Random Forest (max_depth reduced, min_samples_leaf added) ─────────────────
print("  Training Random Forest...")
rf = RandomForestRegressor(
    n_estimators=200, max_depth=10,
    min_samples_leaf=10, max_features=0.7,
    random_state=42, n_jobs=-1,
)
rf.fit(X_train_sc, y_train)
results.append(evaluate("Random Forest", y_test, rf.predict(X_test_sc)))
joblib.dump(rf, os.path.join(MODELS_DIR, "random_forest.pkl"))

# ── XGBoost (reg_alpha + reg_lambda added, lower max_depth) ───────────────────
print("  Training XGBoost...")
xgb = XGBRegressor(
    n_estimators=500, learning_rate=0.03, max_depth=5,
    subsample=0.8, colsample_bytree=0.7,
    reg_alpha=0.1, reg_lambda=2.0,
    early_stopping_rounds=20, random_state=42, n_jobs=-1, verbosity=0,
)
xgb.fit(X_train_sc, y_train, eval_set=[(X_val_sc, y_val)], verbose=False)
results.append(evaluate("XGBoost", y_test, xgb.predict(X_test_sc)))
joblib.dump(xgb, os.path.join(MODELS_DIR, "xgboost.pkl"))

# Save XGBoost SHAP explainer for instance-level explanations in predict API
xgb_explainer = shap.TreeExplainer(xgb)
joblib.dump(xgb_explainer, os.path.join(MODELS_DIR, "xgb_shap_explainer.pkl"))
print("  XGBoost SHAP explainer saved.")

# ── LSTM (dropout increased to 0.3, kernel_regularizer added) ─────────────────
print("  Training LSTM...")
lstm_model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(SEQ_LEN, n_feat),
         kernel_regularizer=l2(1e-4), recurrent_regularizer=l2(1e-4)),
    Dropout(0.3),
    LSTM(32, kernel_regularizer=l2(1e-4)),
    Dropout(0.3),
    Dense(16, activation="relu", kernel_regularizer=l2(1e-4)),
    Dense(1),
])
lstm_model.compile(optimizer=Adam(1e-3), loss="mse")
lstm_model.fit(
    X_tr24, y_tr24, epochs=EPOCHS, batch_size=BATCH_SIZE,
    validation_data=(X_va24, y_va24), callbacks=[ES, LR], verbose=0,
)
results.append(evaluate("LSTM", y_test[SEQ_LEN:], dl_predict_unscaled(lstm_model, X_te24)))
lstm_model.save(os.path.join(MODELS_DIR, "lstm.keras"))

# ── Bi-LSTM (dropout 0.3, L2 regularizer) ────────────────────────────────────
print("  Training Bi-LSTM...")
bi_inp = Input(shape=(SEQ_LEN, n_feat))
x = Bidirectional(LSTM(64, return_sequences=True,
                        kernel_regularizer=l2(1e-4), recurrent_regularizer=l2(1e-4)))(bi_inp)
x = Dropout(0.3)(x)
x = Bidirectional(LSTM(32, kernel_regularizer=l2(1e-4)))(x)
x = Dropout(0.3)(x)
x = Dense(32, activation="relu", kernel_regularizer=l2(1e-4))(x)
bilstm_model = Model(bi_inp, Dense(1)(x))
bilstm_model.compile(optimizer=Adam(1e-3), loss=tf.keras.losses.Huber())
bilstm_model.fit(
    X_tr24, y_tr24, epochs=EPOCHS, batch_size=BATCH_SIZE,
    validation_data=(X_va24, y_va24), callbacks=[ES, LR], verbose=0,
)
results.append(evaluate("Bi-LSTM", y_test[SEQ_LEN:], dl_predict_unscaled(bilstm_model, X_te24)))
bilstm_model.save(os.path.join(MODELS_DIR, "bilstm.keras"))

# ── CNN-LSTM (dropout 0.3, L2 on Conv) ───────────────────────────────────────
print("  Training CNN-LSTM...")
cnn_lstm = Sequential([
    Conv1D(32, kernel_size=3, activation="relu", padding="same",
           input_shape=(SEQ_LEN, n_feat), kernel_regularizer=l2(1e-4)),
    MaxPooling1D(pool_size=2),
    LSTM(32, kernel_regularizer=l2(1e-4)),
    Dropout(0.3),
    Dense(16, activation="relu", kernel_regularizer=l2(1e-4)),
    Dense(1),
])
cnn_lstm.compile(optimizer=Adam(1e-3), loss="mse")
cnn_lstm.fit(
    X_tr24, y_tr24, epochs=EPOCHS, batch_size=BATCH_SIZE,
    validation_data=(X_va24, y_va24), callbacks=[ES, LR], verbose=0,
)
results.append(evaluate("CNN-LSTM", y_test[SEQ_LEN:], dl_predict_unscaled(cnn_lstm, X_te24)))
cnn_lstm.save(os.path.join(MODELS_DIR, "cnn_lstm.keras"))

# ── TFT (dropout 0.3, L2 on Dense) ───────────────────────────────────────────
print("  Training TFT (simplified)...")

def build_tft(seq_len, n_features, d_model=32, num_heads=2, ff_dim=64):
    inp = Input(shape=(seq_len, n_features))
    x = Dense(d_model, kernel_regularizer=l2(1e-4))(inp)
    x = LayerNormalization()(x)
    attn_out = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads)(x, x)
    x = Add()([x, attn_out])
    x = LayerNormalization()(x)
    ff = Dense(ff_dim, activation="relu", kernel_regularizer=l2(1e-4))(x)
    ff = Dense(d_model, kernel_regularizer=l2(1e-4))(ff)
    x = Add()([x, ff])
    x = LayerNormalization()(x)
    x = GlobalAveragePooling1D()(x)
    x = Dense(32, activation="relu", kernel_regularizer=l2(1e-4))(x)
    x = Dropout(0.3)(x)
    return Model(inp, Dense(1)(x))

tft_model = build_tft(SEQ_LEN, n_feat)
tft_model.compile(optimizer=Adam(1e-3), loss="mse")
tft_model.fit(
    X_tr24, y_tr24, epochs=EPOCHS, batch_size=BATCH_SIZE,
    validation_data=(X_va24, y_va24), callbacks=[ES, LR], verbose=0,
)
results.append(evaluate("TFT", y_test[SEQ_LEN:], dl_predict_unscaled(tft_model, X_te24)))
tft_model.save(os.path.join(MODELS_DIR, "tft.keras"))

# ── Hybrid: Transformer + Bi-LSTM + XGBoost residual ─────────────────────────
print("  Training Hybrid (Transformer + Bi-LSTM + XGBoost)...")

def build_transformer_bilstm(seq_len, n_features, d_model=32, num_heads=2):
    inp = Input(shape=(seq_len, n_features))
    x = Dense(d_model, kernel_regularizer=l2(1e-4))(inp)
    x = LayerNormalization()(x)
    attn = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads)(x, x)
    x = Add()([x, attn])
    x = LayerNormalization()(x)
    ff = Dense(d_model * 2, activation="relu", kernel_regularizer=l2(1e-4))(x)
    ff = Dense(d_model, kernel_regularizer=l2(1e-4))(ff)
    x = Add()([x, ff])
    x = LayerNormalization()(x)
    x = Bidirectional(LSTM(32, kernel_regularizer=l2(1e-4)))(x)
    x = Dropout(0.3)(x)
    x = Dense(16, activation="relu", kernel_regularizer=l2(1e-4))(x)
    return Model(inp, Dense(1)(x))

hybrid_dl = build_transformer_bilstm(SEQ_LEN, n_feat)
hybrid_dl.compile(optimizer=Adam(5e-4), loss="mse")
hybrid_dl.fit(
    X_tr24, y_tr24, epochs=EPOCHS, batch_size=BATCH_SIZE,
    validation_data=(X_va24, y_va24), callbacks=[ES, LR], verbose=0,
)

y_tr_pred_dl    = dl_predict_unscaled(hybrid_dl, X_tr24)
residuals_train = y_train[SEQ_LEN:] - y_tr_pred_dl
xgb_residual = XGBRegressor(
    n_estimators=100, learning_rate=0.05, max_depth=4,
    subsample=0.8, colsample_bytree=0.8,
    reg_alpha=0.1, reg_lambda=2.0,
    random_state=42, n_jobs=-1, verbosity=0,
)
xgb_residual.fit(X_train_sc[SEQ_LEN:], residuals_train)

y_te_pred_dl  = dl_predict_unscaled(hybrid_dl, X_te24)
y_pred_hybrid = y_te_pred_dl + xgb_residual.predict(X_test_sc[SEQ_LEN:])
results.append(evaluate("Hybrid (Transformer+BiLSTM+XGB)", y_test[SEQ_LEN:], y_pred_hybrid))
hybrid_dl.save(os.path.join(MODELS_DIR, "hybrid_transformer_bilstm.keras"))
joblib.dump(xgb_residual, os.path.join(MODELS_DIR, "hybrid_xgb_residual.pkl"))

# ── 5. Save Results ───────────────────────────────────────────────────────────
print("\n[5/5] Saving Results...")
results_df = pd.DataFrame(results)
results_df.to_csv(os.path.join(MODELS_DIR, "model_results.csv"), index=False)

print("\n" + "=" * 70)
print("  MODEL EVALUATION SUMMARY  (Delhi Demand Forecasting)")
print("=" * 70)
print(results_df.to_string(index=False))
print("=" * 70)

best_row = results_df.loc[results_df["R2"].idxmax()]
print(f"\n  Best Model: {best_row['model']}  (R²={best_row['R2']})")
with open(os.path.join(MODELS_DIR, "best_model.txt"), "w") as f:
    f.write(best_row["model"])

print("\n  All models saved to:", MODELS_DIR)
print("  Training complete!\n")
