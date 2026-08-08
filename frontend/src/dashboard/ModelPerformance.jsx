import React, { useState, useEffect } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};
const tooltipStyle = { background: "#1e293b", border: "none", borderRadius: 8, color: "white" };

const FALLBACK = [
  { model: "Linear Regression",          MAE: 18420, RMSE: 23100, MAPE: 12.1, R2: 0.72 },
  { model: "Random Forest",              MAE: 5820,  RMSE: 7640,  MAPE: 3.8,  R2: 0.94 },
  { model: "XGBoost",                    MAE: 3210,  RMSE: 4180,  MAPE: 2.1,  R2: 0.97 },
  { model: "LSTM",                       MAE: 4100,  RMSE: 5320,  MAPE: 2.7,  R2: 0.96 },
  { model: "BiLSTM",                     MAE: 3680,  RMSE: 4760,  MAPE: 2.4,  R2: 0.965 },
  { model: "CNN-LSTM",                   MAE: 3540,  RMSE: 4580,  MAPE: 2.3,  R2: 0.967 },
  { model: "TFT",                        MAE: 3120,  RMSE: 4020,  MAPE: 2.0,  R2: 0.971 },
  { model: "Hybrid Transformer+BiLSTM",  MAE: 2480,  RMSE: 3210,  MAPE: 1.6,  R2: 0.982 },
];

const MODEL_COLORS = [
  "#64748b", "#22c55e", "#38bdf8", "#a78bfa",
  "#f97316", "#facc15", "#ec4899", "#ef4444",
];

export default function ModelPerformance() {
  const [models, setModels]     = useState(FALLBACK);
  const [loading, setLoading]   = useState(true);
  const [live, setLive]         = useState(false);

  useEffect(() => {
    axiosInstance.get("/api/predict/metrics")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setModels(res.data);
          setLive(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted  = [...models].sort((a, b) => b.R2 - a.R2);
  const best    = sorted[0];

  const maeData  = sorted.map((m) => ({ model: m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model, MAE: m.MAE }));
  const rmseData = sorted.map((m) => ({ model: m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model, RMSE: m.RMSE }));
  const radarData = sorted.map((m) => ({
    subject: m.model.length > 14 ? m.model.slice(0, 14) + "…" : m.model,
    R2: Math.round(m.R2 * 100),
  }));

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">
          Model Performance
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {loading
            ? <CircularProgress size={14} sx={{ color: "#38bdf8" }} />
            : <Chip
                label={live ? "Live from ML API" : "Static Fallback"}
                size="small"
                sx={{
                  bgcolor: live ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)",
                  color:   live ? "#22c55e" : "#f97316",
                  border:  `1px solid ${live ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
                  fontSize: 11,
                }}
              />
          }
        </Stack>
      </Stack>

      <Grid container spacing={3}>

        {/* Best Model Highlight */}
        <Grid item xs={12}>
          <Box sx={{
            p: 3, borderRadius: 3,
            background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2,
          }}>
            <Box>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>🏆 Best Performing Model</Typography>
              <Typography variant="h5" fontWeight={800} color="white">{best?.model}</Typography>
            </Box>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              {[
                { label: "MAE",  value: `${best?.MAE} MW` },
                { label: "RMSE", value: `${best?.RMSE} MW` },
                { label: "MAPE", value: `${best?.MAPE}%` },
                { label: "R²",   value: `${best?.R2}` },
              ].map((s) => (
                <Box key={s.label} sx={{ textAlign: "center" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</Typography>
                  <Typography variant="h6" fontWeight={800} color="white">{s.value}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Grid>

        {/* MAE Comparison */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                MAE Comparison (MW) — Lower is Better
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={maeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                  <YAxis type="category" dataKey="model" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="MAE" radius={[0, 4, 4, 0]} fill="#38bdf8" name="MAE (MW)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* RMSE Comparison */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                RMSE Comparison (MW) — Lower is Better
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rmseData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                  <YAxis type="category" dataKey="model" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="RMSE" radius={[0, 4, 4, 0]} fill="#f97316" name="RMSE (MW)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* R² Radar */}
        <Grid item xs={12} md={5}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                R² Score Radar (×100)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Radar name="R²×100" dataKey="R2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Full Table */}
        <Grid item xs={12} md={7}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                All Models — Full Comparison
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Model", "MAE (MW)", "RMSE (MW)", "MAPE (%)", "R²"].map((h) => (
                      <TableCell key={h} sx={{ color: "#64748b", borderColor: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((row, i) => (
                    <TableRow key={row.model}>
                      <TableCell sx={{ color: i === 0 ? "#facc15" : "#cbd5e1", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 ? "🏆 " : ""}{row.model}
                      </TableCell>
                      <TableCell sx={{ color: "#38bdf8",  borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.MAE}</TableCell>
                      <TableCell sx={{ color: "#f97316",  borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.RMSE}</TableCell>
                      <TableCell sx={{ color: "#a78bfa",  borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.MAPE}</TableCell>
                      <TableCell sx={{ color: "#22c55e",  borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: 700 }}>{row.R2}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
