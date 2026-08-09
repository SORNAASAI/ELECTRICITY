import React, { useState, useEffect } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack,
  ToggleButton, ToggleButtonGroup, CircularProgress, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  ScatterChart, Scatter, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ReferenceLine,
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
const DISCOM_COLORS = ["#38bdf8", "#22c55e", "#facc15", "#f97316", "#a78bfa"];

export default function Analysis() {
  const [weatherMetric, setWeatherMetric] = useState("temperature");

  // Dataset-driven chart data
  const [stats,      setStats]      = useState(null);

  // Live ML data
  const [shapData,     setShapData]     = useState([]);
  const [metricsData,  setMetrics]      = useState([]);
  const [radarData,    setRadarData]    = useState([]);
  const [allModels,    setAllModels]    = useState([]);
  const [apiLoading,   setApiLoading]   = useState(true);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let connected = false;

    // Dataset stats — drives all static charts
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => { setStats(r.data); connected = true; })
      .catch(() => {});

    // SHAP
    axiosInstance.get("/api/predict/shap")
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) {
          connected = true;
          const top = r.data.slice(0, 6);
          const max = top[0].importance || 1;
          setShapData(top.map((d) => ({
            feature:    d.feature,
            importance: Math.round((d.importance / max) * 100),
          })));
        }
      })
      .catch(() => {});

    // Metrics
    axiosInstance.get("/api/predict/metrics")
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) {
          connected = true;
          setApiConnected(true);
          setAllModels(r.data);
          const best = r.data.reduce((a, b) => (a.R2 > b.R2 ? a : b));
          setMetrics([
            { metric: "MAE",      value: `${best.MAE} MW` },
            { metric: "RMSE",     value: `${best.RMSE} MW` },
            { metric: "MAPE",     value: `${best.MAPE}%` },
            { metric: "R² Score", value: `${best.R2}` },
          ]);
          setRadarData(
            r.data.map((m) => ({
              subject: m.model.length > 14 ? m.model.substring(0, 14) + "…" : m.model,
              A: Math.min(100, Math.round(m.R2 * 100)),
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => { setApiLoading(false); if (connected) setApiConnected(true); });
  }, []);

  // ── Derived chart data from stats ────────────────────────────────────────
  const monthlyDemand    = stats?.monthly_demand    || [];
  const hourlyProfile    = stats?.hourly_profile    || [];
  const tempVsDemand     = stats?.temp_vs_demand    || [];
  const humidityVsDemand = stats?.humidity_vs_demand || [];
  const discomData       = stats?.discom_breakdown  || [];
  const cagrData         = stats?.cagr_data         || [];

  const dateRange = stats
    ? `${stats.date_min?.slice(0, 4)} – ${stats.date_max?.slice(0, 4)}`
    : "";

  // Default SHAP placeholder while loading
  const shapDisplay = shapData.length > 0
    ? shapData
    : [
        { feature: "DELHI_lag_1h",        importance: 0 },
        { feature: "DELHI_roll_mean_24h",  importance: 0 },
        { feature: "DELHI_lag_24h",        importance: 0 },
        { feature: "temperature_c",        importance: 0 },
        { feature: "DELHI_lag_168h",       importance: 0 },
        { feature: "humidity_pct",         importance: 0 },
      ];

  const defaultMetrics = [
    { metric: "MAE",      value: "—" },
    { metric: "RMSE",     value: "—" },
    { metric: "MAPE",     value: "—" },
    { metric: "R² Score", value: "—" },
  ];

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">Analysis & Visualizations</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {stats && (
            <Chip label={`Dataset: ${dateRange} · ${Number(stats.total_rows).toLocaleString()} rows`}
              size="small"
              sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontSize: 11 }} />
          )}
          {apiLoading ? (
            <CircularProgress size={14} sx={{ color: "#38bdf8" }} />
          ) : (
            <Chip
              label={apiConnected ? "Live ML Data" : "ML service offline"}
              size="small"
              sx={{
                bgcolor: apiConnected ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)",
                color:   apiConnected ? "#22c55e" : "#f97316",
                border:  `1px solid ${apiConnected ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
                fontSize: 11,
              }}
            />
          )}
        </Stack>
      </Stack>

      <Grid container spacing={3}>

        {/* ── Weather Impact on Demand ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Weather Impact on Delhi Demand
                </Typography>
                <ToggleButtonGroup
                  value={weatherMetric} exclusive
                  onChange={(_, v) => v && setWeatherMetric(v)}
                  size="small"
                  sx={{
                    "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", fontSize: 11, py: 0.5, px: 1.5 },
                    "& .Mui-selected": { color: "#38bdf8 !important", bgcolor: "rgba(56,189,248,0.1) !important" },
                  }}
                >
                  <ToggleButton value="temperature">Temp</ToggleButton>
                  <ToggleButton value="humidity">Humidity</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey={weatherMetric === "temperature" ? "temp" : "rain"}
                    stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: weatherMetric === "temperature" ? "Temperature (°C)" : "Humidity (%)", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis dataKey="demand" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter
                    data={weatherMetric === "temperature" ? tempVsDemand : humidityVsDemand}
                    fill={weatherMetric === "temperature" ? "#f97316" : "#38bdf8"}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Monthly Avg Demand ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Monthly Avg Demand — Delhi (MW{dateRange ? `, ${dateRange}` : ""})
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyDemand}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="demand" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Avg Demand (MW)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── DISCOM Breakdown Pie ── */}
        <Grid item xs={12} md={5}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Delhi DISCOM Demand Share (avg MW)
              </Typography>
              {discomData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={discomData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value"
                      label={({ name, pct }) => `${name} ${pct}%`}
                      labelLine={{ stroke: "#64748b" }}
                    >
                      {discomData.map((_, i) => <Cell key={i} fill={DISCOM_COLORS[i % DISCOM_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()} MW`, "Avg Demand"]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#64748b" }}>{apiLoading ? "Loading..." : "No DISCOM data"}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Avg Hourly Demand Profile ── */}
        <Grid item xs={12} md={7}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Avg Hourly Demand Profile — Delhi (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={hourlyProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: "Hour of Day", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="demand" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4, fill: "#a78bfa" }} name="Avg MW" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── SHAP Feature Importance (live) ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">Feature Importance (SHAP)</Typography>
                {apiConnected && (
                  <Chip label="Live" size="small"
                    sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 10 }} />
                )}
              </Stack>
              <Stack spacing={1.5}>
                {shapDisplay.map((f) => (
                  <Box key={f.feature}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" sx={{ color: "#cbd5e1" }}>{f.feature}</Typography>
                      <Typography variant="body2" sx={{ color: "#38bdf8", fontWeight: 700 }}>{f.importance}%</Typography>
                    </Stack>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <Box sx={{
                        height: "100%", width: `${f.importance}%`, borderRadius: 4,
                        background: "linear-gradient(90deg,#0ea5e9,#2563eb)",
                        transition: "width 1s ease",
                      }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Best Model Metrics + Radar (live) ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">Best Model — Evaluation Metrics</Typography>
                {apiConnected && (
                  <Chip label="Live" size="small"
                    sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 10 }} />
                )}
              </Stack>
              <Grid container spacing={1.5} mb={2}>
                {(metricsData.length > 0 ? metricsData : defaultMetrics).map((m) => (
                  <Grid item xs={6} key={m.metric}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", textAlign: "center" }}>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>{m.metric}</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: "#38bdf8" }}>{m.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              {radarData.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Radar name="R²×100" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── All Models Comparison Table (live) ── */}
        {allModels.length > 0 && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700} color="white">All Models — Performance Comparison</Typography>
                  <Chip label="Live from training" size="small"
                    sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontSize: 10 }} />
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Model", "MAE (MW)", "RMSE (MW)", "MAPE (%)", "R²"].map((h) => (
                        <TableCell key={h} sx={{ color: "#64748b", borderColor: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 700 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allModels.slice().sort((a, b) => b.R2 - a.R2).map((row, i) => (
                      <TableRow key={row.model}>
                        <TableCell sx={{ color: i === 0 ? "#facc15" : "#cbd5e1", borderColor: "rgba(255,255,255,0.04)", fontWeight: i === 0 ? 700 : 400 }}>
                          {i === 0 ? "🏆 " : ""}{row.model}
                        </TableCell>
                        <TableCell sx={{ color: "#38bdf8", borderColor: "rgba(255,255,255,0.04)" }}>{row.MAE}</TableCell>
                        <TableCell sx={{ color: "#f97316", borderColor: "rgba(255,255,255,0.04)" }}>{row.RMSE}</TableCell>
                        <TableCell sx={{ color: "#a78bfa", borderColor: "rgba(255,255,255,0.04)" }}>{row.MAPE}</TableCell>
                        <TableCell sx={{ color: "#22c55e", borderColor: "rgba(255,255,255,0.04)", fontWeight: 700 }}>{row.R2}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── CAGR / Year-over-Year Growth ── */}
        {cagrData.length > 0 && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                  Year-over-Year Demand Growth Rate (%) — Delhi
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cagrData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="cagr" stroke="#facc15" strokeWidth={2.5} dot={{ r: 5, fill: "#facc15" }} name="Growth %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

      </Grid>
    </DashboardLayout>
  );
}
