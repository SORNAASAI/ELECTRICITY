import os
import pandas as pd
import numpy as np
import joblib
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '..', 'delhi_features.csv')
MODELS_DIR = os.path.join(BASE_DIR, 'saved_models')
FEATURE_COLS = [
    'temperature_c', 'humidity_pct', 'apparent_temp_c',
    'hour', 'day_of_week', 'month', 'is_weekend',
    'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'DELHI_lag_1h', 'DELHI_lag_2h', 'DELHI_lag_3h',
    'DELHI_lag_24h', 'DELHI_lag_48h', 'DELHI_lag_168h',
    'DELHI_roll_mean_3h', 'DELHI_roll_mean_24h',
    'DELHI_roll_std_24h', 'DELHI_roll_max_24h',
]
TARGET_COL = 'DELHI'
SEQ_LEN = 24


def prepare(df):
    for col in FEATURE_COLS + [TARGET_COL]:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(subset=FEATURE_COLS + [TARGET_COL], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df[FEATURE_COLS].values, df[TARGET_COL].values


def make_sequences(X_sc, y_sc, seq_len):
    xs = np.lib.stride_tricks.sliding_window_view(X_sc, (seq_len, X_sc.shape[1]))[:-1, 0]
    ys = y_sc[seq_len:]
    return xs, ys


def report(name, y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    print(f'{name}: MAE={mae:.2f}, RMSE={rmse:.2f}, R2={r2:.4f}')


def main():
    print('Loading dataset...')
    df = pd.read_csv(DATA_PATH, parse_dates=['datetime'])
    df.sort_values('datetime', inplace=True)
    df.replace('None', np.nan, inplace=True)
    df.ffill(inplace=True)
    df.bfill(inplace=True)
    df.reset_index(drop=True, inplace=True)

    n = len(df)
    train_end = int(n * 0.80)
    val_end = int(n * 0.90)
    train_df = df.iloc[:train_end].copy()
    val_df = df.iloc[train_end:val_end].copy()
    test_df = df.iloc[val_end:].copy()

    X_train, y_train = prepare(train_df.copy())
    X_val, y_val = prepare(val_df.copy())
    X_test, y_test = prepare(test_df.copy())

    feat_scaler = joblib.load(os.path.join(MODELS_DIR, 'feat_scaler.pkl'))
    tgt_scaler = joblib.load(os.path.join(MODELS_DIR, 'tgt_scaler.pkl'))

    X_train_sc = feat_scaler.transform(X_train)
    X_val_sc = feat_scaler.transform(X_val)
    X_test_sc = feat_scaler.transform(X_test)

    y_train_sc = tgt_scaler.transform(y_train.reshape(-1, 1)).ravel()
    y_val_sc = tgt_scaler.transform(y_val.reshape(-1, 1)).ravel()
    y_test_sc = tgt_scaler.transform(y_test.reshape(-1, 1)).ravel()

    X_tr24, y_tr24 = make_sequences(X_train_sc, y_train_sc, SEQ_LEN)
    X_va24, y_va24 = make_sequences(X_val_sc, y_val_sc, SEQ_LEN)
    X_te24, y_te24 = make_sequences(X_test_sc, y_test_sc, SEQ_LEN)

    models = {}
    for name, fname in [
        ('linear_regression', 'linear_regression.pkl'),
        ('random_forest', 'random_forest.pkl'),
        ('xgboost', 'xgboost.pkl'),
        ('hybrid_xgb_residual', 'hybrid_xgb_residual.pkl'),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            models[name] = joblib.load(path)

    for name, fname in [
        ('lstm', 'lstm.keras'),
        ('bilstm', 'bilstm.keras'),
        ('cnn_lstm', 'cnn_lstm.keras'),
        ('tft', 'tft.keras'),
        ('hybrid_transformer_bilstm', 'hybrid_transformer_bilstm.keras'),
    ]:
        path = os.path.join(MODELS_DIR, fname)
        if os.path.exists(path):
            models[name] = tf.keras.models.load_model(path)

    print('Loaded models:', list(models.keys()))
    print('\nValidation metrics on the test set:')

    if 'xgboost' in models:
        preds = models['xgboost'].predict(X_test_sc)
        report('XGBoost test', y_test, preds)

    if 'hybrid_transformer_bilstm' in models and 'hybrid_xgb_residual' in models:
        def dl_predict(model, X_seq):
            return tgt_scaler.inverse_transform(model.predict(X_seq, verbose=0).reshape(-1, 1)).ravel()
        y_te_dl = dl_predict(models['hybrid_transformer_bilstm'], X_te24)
        y_pred_hybrid = y_te_dl + models['hybrid_xgb_residual'].predict(X_test_sc[SEQ_LEN:])
        report('Hybrid test', y_test[SEQ_LEN:], y_pred_hybrid)

    sample_idx = 5
    print('\nSample actual:', y_test[sample_idx])
    if 'xgboost' in models:
        print('XGBoost pred:', models['xgboost'].predict(X_test_sc[sample_idx:sample_idx+1])[0])
    if 'linear_regression' in models:
        print('Linear pred:', models['linear_regression'].predict(X_test_sc[sample_idx:sample_idx+1])[0])
    if 'random_forest' in models:
        print('RF pred:', models['random_forest'].predict(X_test_sc[sample_idx:sample_idx+1])[0])

    print('\nAPI fallback feature test:')
    row = X_test[sample_idx].copy()
    for feature in ['DELHI_lag_1h', 'DELHI_lag_2h', 'DELHI_lag_3h', 'DELHI_lag_24h', 'DELHI_lag_48h', 'DELHI_lag_168h', 'DELHI_roll_mean_3h', 'DELHI_roll_mean_24h', 'DELHI_roll_std_24h', 'DELHI_roll_max_24h']:
        row[FEATURE_COLS.index(feature)] = np.nan
    try:
        masked_pred = models['xgboost'].predict(feat_scaler.transform(row.reshape(1, -1)))[0]
        print('Masked XGBoost pred:', masked_pred)
    except Exception as e:
        print('Masked pred error:', e)


if __name__ == '__main__':
    main()
