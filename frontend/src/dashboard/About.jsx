import React, { useEffect, useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip, Divider,
} from "@mui/material";
import {
  ElectricBolt, Storage, Psychology, BarChart, Code,
} from "@mui/icons-material";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};

const models = [
  { name: "Linear Regression",         type: "Baseline",    color: "#64748b", desc: "Simple baseline for benchmarking. Captures linear trends only." },
  { name: "Random Forest",             type: "Ensemble",    color: "#22c55e", desc: "Ensemble of decision trees. Handles non-linearity and feature interactions well." },
  { name: "XGBoost",                   type: "Boosting",    color: "#38bdf8", desc: "Gradient boosted trees. Best classical ML model — fast, accurate, interpretable via SHAP." },
  { name: "LSTM",                      type: "Deep Learning", color: "#a78bfa", desc: "Long Short-Term Memory network. Captures temporal dependencies in hourly demand sequences." },
  { name: "BiLSTM",                    type: "Deep Learning", color: "#f97316", desc: "Bidirectional LSTM. Processes sequences in both directions for richer context." },
  { name: "CNN-LSTM",                  type: "Hybrid DL",   color: "#facc15", desc: "CNN extracts local patterns, LSTM models temporal dependencies." },
  { name: "TFT",                       type: "Transformer", color: "#ec4899", desc: "Temporal Fusion Transformer. Attention-based model with interpretable variable selection." },
  { name: "Hybrid Transformer+BiLSTM", type: "Best Model",  color: "#ef4444", desc: "Custom hybrid combining Transformer attention, BiLSTM memory, and XGBoost residual correction." },
];

// Feature groups matching train.py FEATURE_COLS exactly
const FEATURE_GROUPS = [
  "Weather: temperature_c, humidity_pct, apparent_temp_c",
  "Time: hour, day_of_week, month, is_weekend",
  "Cyclical encodings: hour_sin, hour_cos, dow_sin, dow_cos",
  "Lag features: DELHI_lag_1h, 2h, 3h, 24h, 48h, 168h",
  "Rolling stats: roll_mean_3h, roll_mean_24h, roll_std_24h, roll_max_24h",
];

const techStack = [
  { label: "React 19",         color: "#38bdf8" },
  { label: "MUI v9",           color: "#a78bfa" },
  { label: "Recharts",         color: "#22c55e" },
  { label: "Spring Boot 3.5",  color: "#f97316" },
  { label: "Spring Security",  color: "#facc15" },
  { label: "JWT",              color: "#ec4899" },
  { label: "MySQL",            color: "#38bdf8" },
  { label: "FastAPI",          color: "#22c55e" },
  { label: "TensorFlow/Keras", color: "#f97316" },
  { label: "XGBoost",          color: "#a78bfa" },
  { label: "scikit-learn",     color: "#facc15" },
  { label: "SHAP",             color: "#ef4444" },
];

export default function About() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => setStats(r.data))
      .catch(() => {});
  }, []);

  const datasetRows = [
    { label: "Source",        value: "delhi_features.csv" },
    { label: "Period",        value: stats ? `${stats.date_min} → ${stats.date_max}` : "Loading..." },
    { label: "Granularity",   value: "Hourly" },
    { label: "Records",       value: stats ? Number(stats.total_rows).toLocaleString() + " rows" : "Loading..." },
    { label: "Features",      value: stats ? `${stats.feature_count} engineered features` : "Loading..." },
    { label: "Target",        value: "DELHI (total Delhi demand, MW)" },
    { label: "Region",        value: "Delhi — BRPL, BYPL, NDPL, NDMC, MES" },
    { label: "Train/Val/Test",value: "80% / 10% / 10% (chronological)" },
    { label: "Demand Range",  value: stats ? `${Number(stats.demand_min).toLocaleString()} – ${Number(stats.demand_max).toLocaleString()} MW` : "Loading..." },
  ];

  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} color="white" mb={3}>
        About This Project
      </Typography>

      <Grid container spacing={3}>

        {/* Project Overview */}
        <Grid item xs={12}>
          <Box sx={{
            p: 4, borderRadius: 3,
            background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)",
            position: "relative", overflow: "hidden",
          }}>
            <Box sx={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)" }} />
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <ElectricBolt sx={{ fontSize: 36, color: "#facc15" }} />
              <Box>
                <Typography variant="h4" fontWeight={800} color="white">ElectriCity</Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)" }}>
                  Delhi Electricity Demand Forecasting System
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 800, lineHeight: 1.8 }}>
              ElectriCity is an AI-powered electricity demand forecasting platform for Delhi's power grid.
              It uses a suite of machine learning and deep learning models trained on hourly data
              {stats ? ` (${stats.date_min} → ${stats.date_max}, ${Number(stats.total_rows).toLocaleString()} records)` : ""}
              {" "}to predict short-term and long-term electricity demand, helping grid operators
              plan capacity, prevent outages, and optimize dispatch across all 5 Delhi DISCOMs.
            </Typography>
          </Box>
        </Grid>

        {/* Dataset Info */}
        <Grid item xs={12} md={4}>
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Storage sx={{ color: "#38bdf8" }} />
                <Typography variant="h6" fontWeight={700} color="white">Dataset</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {datasetRows.map((r) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ color: "#64748b" }}>{r.label}</Typography>
                    <Typography variant="body2" sx={{ color: "#cbd5e1", fontWeight: 600, textAlign: "right", maxWidth: "55%" }}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Features Used */}
        <Grid item xs={12} md={4}>
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <BarChart sx={{ color: "#22c55e" }} />
                <Typography variant="h6" fontWeight={700} color="white">Feature Engineering</Typography>
              </Stack>
              <Stack spacing={1}>
                {FEATURE_GROUPS.map((f, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#38bdf8", mt: 0.8, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.6 }}>{f}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Tech Stack */}
        <Grid item xs={12} md={4}>
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Code sx={{ color: "#a78bfa" }} />
                <Typography variant="h6" fontWeight={700} color="white">Tech Stack</Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {techStack.map((t) => (
                  <Chip key={t.label} label={t.label} size="small"
                    sx={{ bgcolor: "rgba(255,255,255,0.05)", color: t.color, border: `1px solid ${t.color}33`, fontSize: 11 }} />
                ))}
              </Stack>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />
              <Stack spacing={1}>
                {[
                  { label: "Frontend",  value: "React + MUI + Recharts",       color: "#38bdf8" },
                  { label: "Backend",   value: "Spring Boot + Spring Security", color: "#f97316" },
                  { label: "ML API",    value: "FastAPI + TensorFlow + XGBoost",color: "#22c55e" },
                  { label: "Database",  value: "MySQL (JPA/Hibernate)",         color: "#a78bfa" },
                  { label: "Auth",      value: "JWT (jjwt 0.12.6)",             color: "#facc15" },
                ].map((r) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between">
                    <Typography variant="caption" sx={{ color: "#64748b" }}>{r.label}</Typography>
                    <Typography variant="caption" sx={{ color: r.color, fontWeight: 600, textAlign: "right" }}>{r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Models Used */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
                <Psychology sx={{ color: "#f97316" }} />
                <Typography variant="h6" fontWeight={700} color="white">Models Used</Typography>
              </Stack>
              <Grid container spacing={2}>
                {models.map((m) => (
                  <Grid item xs={12} sm={6} md={3} key={m.name}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}22`, height: "100%" }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: m.color, flexShrink: 0 }} />
                        <Typography variant="body2" fontWeight={700} sx={{ color: m.color }}>{m.name}</Typography>
                      </Stack>
                      <Chip label={m.type} size="small"
                        sx={{ bgcolor: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33`, fontSize: 10, mb: 1 }} />
                      <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.6, display: "block" }}>{m.desc}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
