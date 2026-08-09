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

export default function ModelPerformance() {
  const [models,  setModels]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [live,    setLive]    = useState(false);
  const [offline, setOffline] = useState(false);
  const [shap,    setShap]    = useState([]);

  useEffect(() => {
    axiosInstance.get("/api/predict/metrics")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setModels(res.data);
          setLive(true);
        }
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
    axiosInstance.get("/api/predict/shap")
      .then((res) => { if (Array.isArray(res.data)) setShap(res.data.slice(0, 15)); })
      .catch(() => {});
  }, []);

  const sorted = [...models].sort((a, b) => b.R2 - a.R2);
  const best   = sorted[0];

  // Train vs Test MAE chart data
  const trainTestData = sorted
    .filter((m) => m.Train_MAE != null)
    .map((m) => ({
      model:     m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model,
      "Test MAE":  m.MAE,
      "Train MAE": m.Train_MAE,
    }));

  const hasTrainData = trainTestData.length > 0;

  const maeData  = sorted.map((m) => ({ model: m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model, MAE: m.MAE }));
  const rmseData = sorted.map((m) => ({ model: m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model, RMSE: m.RMSE }));
  const radarData = sorted.map((m) => ({
    subject: m.model.length > 14 ? m.model.slice(0, 14) + "…" : m.model,
    R2: Math.round(m.R2 * 100),
  }));

  const overfitColor = (status) =>
    status === "OVERFIT" ? "#ef4444" : status === "OK" ? "#22c55e" : "#64748b";

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">Model Performance</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {loading
            ? <CircularProgress size={14} sx={{ color: "#38bdf8" }} />
            : <Chip
                label={live ? "Live from ML API" : "ML service offline"}
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

      {offline && models.length === 0 && (
        <Box sx={{ p: 3, borderRadius: 2, bgcolor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", mb: 3 }}>
          <Typography variant="body2" sx={{ color: "#f97316" }}>
            ML service is offline — start <strong>predict_api.py</strong> on port 8000, then run <strong>train.py</strong> to generate model metrics.
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>

        {/* Best Model Highlight */}
        {best && (
          <Grid item xs={12}>
            <Box sx={{
              p: 3, borderRadius: 3,
              background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2,
            }}>
              <Box>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>🏆 Best Performing Model (Test Set)</Typography>
                <Typography variant="h5" fontWeight={800} color="white">{best.model}</Typography>
              </Box>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                {[
                  { label: "Test MAE",  value: `${best.MAE} MW` },
                  { label: "Test RMSE", value: `${best.RMSE} MW` },
                  { label: "Test MAPE", value: `${best.MAPE}%` },
                  { label: "Test R²",   value: `${best.R2}` },
                  ...(best.Train_MAE != null ? [{ label: "Train MAE", value: `${best.Train_MAE} MW` }] : []),
                  ...(best.Gap != null ? [{ label: "Gap Ratio", value: `${best.Gap}` }] : []),
                ].map((s) => (
                  <Box key={s.label} sx={{ textAlign: "center" }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</Typography>
                    <Typography variant="h6" fontWeight={800} color="white">{s.value}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
        )}

        {/* Train vs Test MAE — Overfitting Check */}
        {hasTrainData && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" fontWeight={700} color="white">
                    Train vs Test MAE — Overfitting Check
                  </Typography>
                  <Chip label="Gap ratio close to 1.0 = healthy generalization" size="small"
                    sx={{ bgcolor: "rgba(56,189,248,0.08)", color: "#94a3b8", border: "1px solid rgba(56,189,248,0.15)", fontSize: 10 }} />
                </Stack>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 2 }}>
                  If Train MAE ≪ Test MAE, the model memorized training data (overfitting). Healthy models have similar Train and Test MAE.
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trainTestData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                    <YAxis type="category" dataKey="model" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }} width={140} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                    <Bar dataKey="Train MAE" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Test MAE"  fill="#38bdf8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* MAE Comparison */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Test MAE Comparison (MW) — Lower is Better
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={maeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                  <YAxis type="category" dataKey="model" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="MAE" radius={[0, 4, 4, 0]} fill="#38bdf8" name="Test MAE (MW)" />
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
                Test RMSE Comparison (MW) — Lower is Better
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rmseData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                  <YAxis type="category" dataKey="model" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="RMSE" radius={[0, 4, 4, 0]} fill="#f97316" name="Test RMSE (MW)" />
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
                Test R² Score Radar (×100)
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

        {/* Full Table with overfitting status */}
        <Grid item xs={12} md={7}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                All Models — Full Evaluation (Test Set)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Model", "Test MAE", "Test RMSE", "Test MAPE", "Test R²",
                      ...(hasTrainData ? ["Train MAE", "Gap Ratio", "Status"] : [])
                    ].map((h) => (
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
                      <TableCell sx={{ color: "#38bdf8", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.MAE} MW</TableCell>
                      <TableCell sx={{ color: "#f97316", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.RMSE} MW</TableCell>
                      <TableCell sx={{ color: "#a78bfa", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.MAPE}%</TableCell>
                      <TableCell sx={{ color: "#22c55e", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: 700 }}>{row.R2}</TableCell>
                      {hasTrainData && <>
                        <TableCell sx={{ color: "#22c55e", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>
                          {row.Train_MAE != null ? `${row.Train_MAE} MW` : "—"}
                        </TableCell>
                        <TableCell sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>
                          {row.Gap != null ? row.Gap : "—"}
                        </TableCell>
                        <TableCell sx={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          {row.Overfit != null ? (
                            <Chip
                              label={row.Overfit === "OK" ? "✅ OK" : row.Overfit === "OVERFIT" ? "⚠ Overfit" : "—"}
                              size="small"
                              sx={{
                                bgcolor: `${overfitColor(row.Overfit)}22`,
                                color: overfitColor(row.Overfit),
                                border: `1px solid ${overfitColor(row.Overfit)}55`,
                                fontSize: 10, fontWeight: 700,
                              }}
                            />
                          ) : "—"}
                        </TableCell>
                      </>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {hasTrainData && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    Gap Ratio = Train MAE ÷ Test MAE. Values close to 1.0 indicate healthy generalization.
                    Values below 0.6 indicate the model memorized training data (overfitting).
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SHAP Feature Importance */}
        {shap.length > 0 && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" fontWeight={700} color="white">
                    🔍 Explainable AI — SHAP Feature Importance (Top 15)
                  </Typography>
                  <Chip
                    label="Mean |SHAP value| across validation set"
                    size="small"
                    sx={{ bgcolor: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)", fontSize: 10 }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 2 }}>
                  Higher SHAP value = stronger influence on the model's demand prediction. Features at the top drive the forecast the most.
                </Typography>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={[...shap].reverse()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }}
                      label={{ value: "Mean |SHAP value|", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
                    <YAxis type="category" dataKey="feature" stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 11 }} width={160} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [v.toFixed(4), "SHAP Importance"]}
                    />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]} fill="#a78bfa" name="SHAP Importance" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

      </Grid>
    </DashboardLayout>
  );
}
