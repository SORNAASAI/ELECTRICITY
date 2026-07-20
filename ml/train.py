"""
Delhi Electricity Demand Forecasting — Full ML/DL Training Pipeline
Pipeline:
  1. Data Cleaning & Missing Values
  2. Feature Engineering Validation
  3. Feature Importance (SHAP)
  4. Model Training:
       ML  → Linear Regression, Random Forest, XGBoost
       DL  → LSTM, Bi-LSTM, CNN-LSTM, TFT (simplified)
       Hybrid → Transformer + Bi-LSTM + XGBoost (residual stacking)
  5. Evaluation: MAE, RMSE, MAPE, R²
  6. Save all models
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

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

import tensorflow as tf
from tensorflow.keras.models import Model, Sequential
from tensorflow.keras.layers import (
    Input, LSTM, Bidirectional, Dense, Dropout, Conv1D,
    MaxPooling1D, Flatten, LayerNormalization, MultiHeadAttention,
    GlobalAveragePooling1D, Add, Reshape
)
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam

warnings.filterwarnings("ignore")
tf.get_logger().setLevel("ERROR")

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_PATH  = os.path.join(BASE_DIR, "..", "Delhi_Model_Ready_Dataset.csv")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)

SEQ_LEN    = 24   # 24-hour look-back window
BATCH_SIZE = 64
EPOCHS     = 50

# ── 1. Load & Clean ───────────────────────────────────────────────────────────
print("\n[1/5] Loading & Cleaning Data...")
df = pd.read_csv(DATA_PATH, parse_dates=["datetime"])
df.sort_values("datetime", inplace=True)
df.reset_index(drop=True, inplace=True)

print(f"  Raw shape: {df.shape}")
print(f"  Missing values:\n{df.isnull().sum()[df.isnull().sum() > 0]}")

# Forward-fill then backward-fill any missing values
df.ffill(inplace=True)
df.bfill(inplace=True)

# Convert boolean-like season columns to int
for col in ["Season_Monsoon", "Season_Summer", "Season_Winter"]:
    df[col] = df[col].astype(str).str.strip().str.lower().map(
        {"true": 1, "false": 0, "1": 1, "0": 0, "1.0": 1, "0.0": 0}
    ).fillna(0).astype(int)

print(f"  Clean shape: {df.shape}")

# ── 2. Feature Engineering Validation ────────────────────────────────────────
print("\n[2/5] Validating Features...")

FEATURE_COLS = [
    "temp", "dwpt", "rhum", "wspd", "pres",
    "Holiday", "Festival", "Weekend",
    "Hour", "Day", "Month", "Quarter", "Weekday", "WeekOfYear",
    "Hour_sin", "Hour_cos", "Month_sin", "Month_cos",
    "Lag_1", "Lag_2", "Lag_3", "Lag_6", "Lag_12", "Lag_24", "Lag_48", "Lag_168",
    "Rolling_Mean_24", "Rolling_STD_24", "Rolling_Max_24", "Rolling_Min_24",
    "Season_Monsoon", "Season_Summer", "Season_Winter",
]
TARGET_COL = "Power demand"

# Drop rows where any feature or target is NaN after fill
df.dropna(subset=FEATURE_COLS + [TARGET_COL], inplace=True)
df.reset_index(drop=True, inplace=True)

X = df[FEATURE_COLS].values
y = df[TARGET_COL].values

print(f"  Features: {len(FEATURE_COLS)} | Samples: {len(X)}")

# ── Train / Test Split (80/20 chronological) ──────────────────────────────────
split = int(len(X) * 0.8)
X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

# Scale features
feat_scaler = MinMaxScaler()
X_train_sc  = feat_scaler.fit_transform(X_train)
X_test_sc   = feat_scaler.transform(X_test)

# Scale target
tgt_scaler  = MinMaxScaler()
y_train_sc  = tgt_scaler.fit_transform(y_train.reshape(-1, 1)).ravel()
y_test_sc   = tgt_scaler.transform(y_test.reshape(-1, 1)).ravel()

joblib.dump(feat_scaler, os.path.join(MODELS_DIR, "feat_scaler.pkl"))
joblib.dump(tgt_scaler,  os.path.join(MODELS_DIR, "tgt_scaler.pkl"))
print("  Scalers saved.")

# ── Sequence builder for DL models ───────────────────────────────────────────
def make_sequences(X_sc, y_sc, seq_len):
    Xs, ys = [], []
    for i in range(seq_len, len(X_sc)):
        Xs.append(X_sc[i - seq_len:i])
        ys.append(y_sc[i])
    return np.array(Xs), np.array(ys)

X_tr_seq, y_tr_seq = make_sequences(X_train_sc, y_train_sc, SEQ_LEN)
X_te_seq, y_te_seq = make_sequences(X_test_sc,  y_test_sc,  SEQ_LEN)
print(f"  Sequence shapes — Train: {X_tr_seq.shape} | Test: {X_te_seq.shape}")

# ── Metrics helper ────────────────────────────────────────────────────────────
def evaluate(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1e-8))) * 100
    r2   = r2_score(y_true, y_pred)
    print(f"  [{name}] MAE={mae:.2f}  RMSE={rmse:.2f}  MAPE={mape:.2f}%  R²={r2:.4f}")
    return {"model": name, "MAE": round(mae, 2), "RMSE": round(rmse, 2),
            "MAPE": round(mape, 2), "R2": round(r2, 4)}

results = []

# ── 3. Feature Importance (SHAP on Random Forest) ────────────────────────────
print("\n[3/5] Computing SHAP Feature Importance...")
rf_shap = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
rf_shap.fit(X_train_sc, y_train_sc)

explainer   = shap.TreeExplainer(rf_shap)
shap_values = explainer.shap_values(X_test_sc[:500])
mean_shap   = np.abs(shap_values).mean(axis=0)

shap_df = pd.DataFrame({"feature": FEATURE_COLS, "importance": mean_shap})
shap_df.sort_values("importance", ascending=False, inplace=True)
shap_df.to_csv(os.path.join(MODELS_DIR, "shap_importance.csv"), index=False)

print("  Top 10 features by SHAP:")
print(shap_df.head(10).to_string(index=False))

# SHAP bar plot
plt.figure(figsize=(10, 6))
plt.barh(shap_df["feature"][:15][::-1], shap_df["importance"][:15][::-1], color="#38bdf8")
plt.xlabel("Mean |SHAP value|")
plt.title("Feature Importance (SHAP)")
plt.tight_layout()
plt.savefig(os.path.join(MODELS_DIR, "shap_importance.png"), dpi=100)
plt.close()
print("  SHAP plot saved.")

# ── 4. Model Training ─────────────────────────────────────────────────────────
print("\n[4/5] Training Models...")

ES = EarlyStopping(patience=7, restore_best_weights=True, verbose=0)
LR = ReduceLROnPlateau(patience=4, factor=0.5, verbose=0)

def dl_predict_unscaled(model, X_seq):
    pred_sc = model.predict(X_seq, verbose=0).ravel()
    return tgt_scaler.inverse_transform(pred_sc.reshape(-1, 1)).ravel()

# ── 4a. Linear Regression ─────────────────────────────────────────────────────
print("  Training Linear Regression...")
lr = LinearRegression()
lr.fit(X_train_sc, y_train)
y_pred_lr = lr.predict(X_test_sc)
results.append(evaluate("Linear Regression", y_test, y_pred_lr))
joblib.dump(lr, os.path.join(MODELS_DIR, "linear_regression.pkl"))

# ── 4b. Random Forest ─────────────────────────────────────────────────────────
print("  Training Random Forest...")
rf = RandomForestRegressor(n_estimators=200, max_depth=20, random_state=42, n_jobs=-1)
rf.fit(X_train_sc, y_train)
y_pred_rf = rf.predict(X_test_sc)
results.append(evaluate("Random Forest", y_test, y_pred_rf))
joblib.dump(rf, os.path.join(MODELS_DIR, "random_forest.pkl"))

# ── 4c. XGBoost ───────────────────────────────────────────────────────────────
print("  Training XGBoost...")
xgb = XGBRegressor(
    n_estimators=500, learning_rate=0.05, max_depth=7,
    subsample=0.8, colsample_bytree=0.8,
    early_stopping_rounds=20, random_state=42, n_jobs=-1, verbosity=0
)
xgb.fit(X_train_sc, y_train, eval_set=[(X_test_sc, y_test)], verbose=False)
y_pred_xgb = xgb.predict(X_test_sc)
results.append(evaluate("XGBoost", y_test, y_pred_xgb))
joblib.dump(xgb, os.path.join(MODELS_DIR, "xgboost.pkl"))

# ── 4d. LSTM ──────────────────────────────────────────────────────────────────
print("  Training LSTM...")
n_feat = X_tr_seq.shape[2]

lstm_model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(SEQ_LEN, n_feat)),
    Dropout(0.2),
    LSTM(64),
    Dropout(0.2),
    Dense(32, activation="relu"),
    Dense(1),
])
lstm_model.compile(optimizer=Adam(1e-3), loss="mse")
lstm_model.fit(X_tr_seq, y_tr_seq, epochs=EPOCHS, batch_size=BATCH_SIZE,
               validation_split=0.1, callbacks=[ES, LR], verbose=0)
y_pred_lstm = dl_predict_unscaled(lstm_model, X_te_seq)
results.append(evaluate("LSTM", y_test[SEQ_LEN:], y_pred_lstm))
lstm_model.save(os.path.join(MODELS_DIR, "lstm.keras"))

# ── 4e. Bi-LSTM ───────────────────────────────────────────────────────────────
print("  Training Bi-LSTM...")
bilstm_model = Sequential([
    Bidirectional(LSTM(128, return_sequences=True), input_shape=(SEQ_LEN, n_feat)),
    Dropout(0.2),
    Bidirectional(LSTM(64)),
    Dropout(0.2),
    Dense(32, activation="relu"),
    Dense(1),
])
bilstm_model.compile(optimizer=Adam(1e-3), loss="mse")
bilstm_model.fit(X_tr_seq, y_tr_seq, epochs=EPOCHS, batch_size=BATCH_SIZE,
                 validation_split=0.1, callbacks=[ES, LR], verbose=0)
y_pred_bilstm = dl_predict_unscaled(bilstm_model, X_te_seq)
results.append(evaluate("Bi-LSTM", y_test[SEQ_LEN:], y_pred_bilstm))
bilstm_model.save(os.path.join(MODELS_DIR, "bilstm.keras"))

# ── 4f. CNN-LSTM ──────────────────────────────────────────────────────────────
print("  Training CNN-LSTM...")
cnn_lstm = Sequential([
    Conv1D(64, kernel_size=3, activation="relu", padding="same", input_shape=(SEQ_LEN, n_feat)),
    Conv1D(32, kernel_size=3, activation="relu", padding="same"),
    MaxPooling1D(pool_size=2),
    LSTM(64, return_sequences=False),
    Dropout(0.2),
    Dense(32, activation="relu"),
    Dense(1),
])
cnn_lstm.compile(optimizer=Adam(1e-3), loss="mse")
cnn_lstm.fit(X_tr_seq, y_tr_seq, epochs=EPOCHS, batch_size=BATCH_SIZE,
             validation_split=0.1, callbacks=[ES, LR], verbose=0)
y_pred_cnnlstm = dl_predict_unscaled(cnn_lstm, X_te_seq)
results.append(evaluate("CNN-LSTM", y_test[SEQ_LEN:], y_pred_cnnlstm))
cnn_lstm.save(os.path.join(MODELS_DIR, "cnn_lstm.keras"))

# ── 4g. Temporal Fusion Transformer (simplified TFT) ─────────────────────────
print("  Training TFT (simplified)...")

def build_tft(seq_len, n_features, d_model=64, num_heads=4, ff_dim=128):
    inp = Input(shape=(seq_len, n_features))
    # Variable selection via Dense projection
    x = Dense(d_model)(inp)
    x = LayerNormalization()(x)
    # Multi-head self-attention (temporal self-attention)
    attn_out = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads)(x, x)
    x = Add()([x, attn_out])
    x = LayerNormalization()(x)
    # Position-wise feed-forward
    ff = Dense(ff_dim, activation="relu")(x)
    ff = Dense(d_model)(ff)
    x = Add()([x, ff])
    x = LayerNormalization()(x)
    x = GlobalAveragePooling1D()(x)
    x = Dense(64, activation="relu")(x)
    x = Dropout(0.2)(x)
    out = Dense(1)(x)
    return Model(inp, out)

tft_model = build_tft(SEQ_LEN, n_feat)
tft_model.compile(optimizer=Adam(1e-3), loss="mse")
tft_model.fit(X_tr_seq, y_tr_seq, epochs=EPOCHS, batch_size=BATCH_SIZE,
              validation_split=0.1, callbacks=[ES, LR], verbose=0)
y_pred_tft = dl_predict_unscaled(tft_model, X_te_seq)
results.append(evaluate("TFT", y_test[SEQ_LEN:], y_pred_tft))
tft_model.save(os.path.join(MODELS_DIR, "tft.keras"))

# ── 4h. Hybrid: Transformer + Bi-LSTM + XGBoost (residual stacking) ──────────
print("  Training Hybrid (Transformer + Bi-LSTM + XGBoost)...")

def build_transformer_bilstm(seq_len, n_features, d_model=64, num_heads=4):
    inp = Input(shape=(seq_len, n_features))
    # Transformer encoder block
    x = Dense(d_model)(inp)
    x = LayerNormalization()(x)
    attn = MultiHeadAttention(num_heads=num_heads, key_dim=d_model // num_heads)(x, x)
    x = Add()([x, attn])
    x = LayerNormalization()(x)
    ff = Dense(d_model * 2, activation="relu")(x)
    ff = Dense(d_model)(ff)
    x = Add()([x, ff])
    x = LayerNormalization()(x)
    # Bi-LSTM layer
    x = Bidirectional(LSTM(64, return_sequences=False))(x)
    x = Dropout(0.2)(x)
    # Dense prediction
    x = Dense(32, activation="relu")(x)
    out = Dense(1)(x)
    return Model(inp, out)

hybrid_dl = build_transformer_bilstm(SEQ_LEN, n_feat)
hybrid_dl.compile(optimizer=Adam(5e-4), loss="mse")
hybrid_dl.fit(X_tr_seq, y_tr_seq, epochs=EPOCHS, batch_size=BATCH_SIZE,
              validation_split=0.1, callbacks=[ES, LR], verbose=0)

# Stage 1: DL predictions on train set (for residual learning)
y_tr_pred_dl_sc = hybrid_dl.predict(X_tr_seq, verbose=0).ravel()
y_tr_pred_dl    = tgt_scaler.inverse_transform(y_tr_pred_dl_sc.reshape(-1, 1)).ravel()
y_tr_actual     = y_train[SEQ_LEN:]

# Stage 2: XGBoost learns residuals
residuals_train = y_tr_actual - y_tr_pred_dl
X_tr_res = X_train_sc[SEQ_LEN:]   # align with sequence output
xgb_residual = XGBRegressor(
    n_estimators=300, learning_rate=0.05, max_depth=5,
    subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbosity=0
)
xgb_residual.fit(X_tr_res, residuals_train)

# Stage 3: Final prediction = DL prediction + XGBoost residual correction
y_te_pred_dl_sc = hybrid_dl.predict(X_te_seq, verbose=0).ravel()
y_te_pred_dl    = tgt_scaler.inverse_transform(y_te_pred_dl_sc.reshape(-1, 1)).ravel()
X_te_res        = X_test_sc[SEQ_LEN:]
residuals_pred  = xgb_residual.predict(X_te_res)
y_pred_hybrid   = y_te_pred_dl + residuals_pred

results.append(evaluate("Hybrid (Transformer+BiLSTM+XGB)", y_test[SEQ_LEN:], y_pred_hybrid))

hybrid_dl.save(os.path.join(MODELS_DIR, "hybrid_transformer_bilstm.keras"))
joblib.dump(xgb_residual, os.path.join(MODELS_DIR, "hybrid_xgb_residual.pkl"))

# ── 5. Save Results & Summary ─────────────────────────────────────────────────
print("\n[5/5] Saving Results...")
results_df = pd.DataFrame(results)
results_df.to_csv(os.path.join(MODELS_DIR, "model_results.csv"), index=False)

print("\n" + "=" * 70)
print("  MODEL EVALUATION SUMMARY")
print("=" * 70)
print(results_df.to_string(index=False))
print("=" * 70)

# Save best model name
best_row = results_df.loc[results_df["R2"].idxmax()]
print(f"\n  Best Model: {best_row['model']}  (R²={best_row['R2']})")
with open(os.path.join(MODELS_DIR, "best_model.txt"), "w") as f:
    f.write(best_row["model"])

print("\n  All models saved to:", MODELS_DIR)
print("  Training complete!\n")
