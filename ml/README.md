# ElectriCity — ML Pipeline Setup

## Folder Structure
```
ml/
├── train.py           ← Full training pipeline (run once)
├── predict_api.py     ← FastAPI server (run always)
├── requirements.txt   ← Python dependencies
└── saved_models/      ← Auto-created after training
    ├── feat_scaler.pkl
    ├── tgt_scaler.pkl
    ├── linear_regression.pkl
    ├── random_forest.pkl
    ├── xgboost.pkl
    ├── lstm.keras
    ├── bilstm.keras
    ├── cnn_lstm.keras
    ├── tft.keras
    ├── hybrid_transformer_bilstm.keras
    ├── hybrid_xgb_residual.pkl
    ├── shap_importance.csv
    ├── shap_importance.png
    └── model_results.csv
```

## Setup

### 1. Create virtual environment
```bash
cd ml
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Train all models (run once — takes ~10-20 min)
```bash
python train.py
```

### 4. Start the prediction API
```bash
python predict_api.py
# Runs on http://localhost:8000
```

## API Endpoints

| Method | Endpoint          | Description                        |
|--------|-------------------|------------------------------------|
| POST   | /predict          | Predict demand for given inputs    |
| GET    | /models           | List available models              |
| GET    | /metrics          | MAE, RMSE, MAPE, R² for all models |
| GET    | /shap             | SHAP feature importances           |
| GET    | /health           | Health check                       |

## Models Trained

| Type   | Model                          |
|--------|--------------------------------|
| ML     | Linear Regression              |
| ML     | Random Forest                  |
| ML     | XGBoost                        |
| DL     | LSTM                           |
| DL     | Bi-LSTM                        |
| DL     | CNN-LSTM                       |
| DL     | TFT (Temporal Fusion Transformer) |
| Hybrid | Transformer + Bi-LSTM + XGBoost (residual stacking) |

## Running Everything Together

1. Start MySQL
2. Start Spring Boot backend (`mvn spring-boot:run` in `/backend`)
3. Start ML API (`python predict_api.py` in `/ml`)
4. Start React frontend (`npm start` in `/frontend`)
