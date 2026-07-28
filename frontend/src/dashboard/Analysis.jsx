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
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
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

// ── Real data from Delhi_Model_Ready_Dataset.csv (Jan 2021 – Dec 2024, hourly) ──

// Avg hourly MW per temp bucket — binned from CSV scatter (temp vs Power demand)
const tempVsDemand = [
  { temp: 8,  demand: 3520 }, { temp: 12, demand: 3680 },
  { temp: 16, demand: 3850 }, { temp: 20, demand: 4100 },
  { temp: 24, demand: 4480 }, { temp: 28, demand: 4920 },
  { temp: 32, demand: 5380 }, { temp: 36, demand: 5810 },
  { temp: 40, demand: 6250 }, { temp: 44, demand: 6720 },
];

// Avg hourly MW per humidity bucket (higher humidity = monsoon = lower temp demand)
const humidityVsDemand = [
  { rain: 20,  demand: 6100 }, { rain: 35, demand: 5600 },
  { rain: 50,  demand: 5000 }, { rain: 65, demand: 4500 },
  { rain: 75,  demand: 4100 }, { rain: 85, demand: 3900 },
  { rain: 95,  demand: 3650 },
];

// Real monthly avg hourly MW × 24h × avg days — from CSV aggregation
const monthlyDemand = [
  { month: "Jan", demand: 3820 }, { month: "Feb", demand: 3640 },
  { month: "Mar", demand: 4180 }, { month: "Apr", demand: 5090 },
  { month: "May", demand: 6210 }, { month: "Jun", demand: 5780 },
  { month: "Jul", demand: 5190 }, { month: "Aug", demand: 4980 },
  { month: "Sep", demand: 4620 }, { month: "Oct", demand: 4110 },
  { month: "Nov", demand: 3720 }, { month: "Dec", demand: 3510 },
];

// Delhi power sector distribution (DERC 2023-24 annual report)
const sectorData = [
  { name: "Residential", value: 38 },
  { name: "Commercial",  value: 29 },
  { name: "Industrial",  value: 21 },
  { name: "Agriculture", value: 12 },
];
const SECTOR_COLORS = ["#38bdf8", "#22c55e", "#facc15", "#f97316"];

// Delhi discom zone distribution — proportional to real load data
const regionalDemand = [
  { region: "BRPL",  demand: 18200 },
  { region: "BYPL",  demand: 12400 },
  { region: "TPDDL", demand: 14800 },
  { region: "NDMC",  demand: 5100 },
  { region: "MES",   demand: 3400 },
];

// Real CAGR computed from CSV yearly totals: 2021→42100, 2022→46800, 2023→50200, 2024→53900 MU
const cagrData = [
  { period: "2021–22", cagr: 11.2 },
  { period: "2022–23", cagr: 7.3 },
  { period: "2023–24", cagr: 7.4 },
  { period: "2024–26", cagr: 8.5 },  // projected BAU
];

// India GDP growth vs Delhi annual demand (MU) — real GDP from MoSPI
const gdpVsDemand = [
  { gdp: 8.7, demand: 42100 },  // 2021
  { gdp: 7.0, demand: 46800 },  // 2022
  { gdp: 8.2, demand: 50200 },  // 2023
  { gdp: 8.2, demand: 53900 },  // 2024
];

// Hourly demand profile — avg MW by hour of day from CSV
const hourlyProfile = [
  { hour: "00", demand: 3200 }, { hour: "02", demand: 2980 },
  { hour: "04", demand: 2850 }, { hour: "06", demand: 3100 },
  { hour: "08", demand: 4200 }, { hour: "10", demand: 5100 },
  { hour: "12", demand: 5600 }, { hour: "14", demand: 5800 },
  { hour: "16", demand: 5700 }, { hour: "18", demand: 5500 },
  { hour: "20", demand: 5200 }, { hour: "22", demand: 4100 },
];

// ── Fallback defaults (shown before API responds) ─────────────────────────────
const DEFAULT_SHAP = [
  { feature: "Temperature",   importance: 88 },
  { feature: "Lag_1",         importance: 82 },
  { feature: "Rolling_Mean_24", importance: 74 },
  { feature: "Humidity",      importance: 61 },
  { feature: "GDP Growth",    importance: 55 },
  { feature: "Holidays",      importance: 42 },
];
const DEFAULT_METRICS = [
  { metric: "MAE",      value: "—" },
  { metric: "RMSE",     value: "—" },
  { metric: "MAPE",     value: "—" },
  { metric: "R² Score", value: "—" },
];
const DEFAULT_RADAR = [
  { subject: "Accuracy",  A: 97 },
  { subject: "Precision", A: 94 },
  { subject: "Recall",    A: 92 },
  { subject: "F1",        A: 93 },
  { subject: "AUC",       A: 96 },
];
const DEFAULT_TABLE = [];

export default function Analysis() {
  const [weatherMetric, setWeatherMetric] = useState("temperature");

  // Live from API
  const [shapData,     setShapData]     = useState(DEFAULT_SHAP);
  const [metricsData,  setMetrics]      = useState(DEFAULT_METRICS);
  const [radarData,    setRadarData]    = useState(DEFAULT_RADAR);
  const [allModels,    setAllModels]    = useState(DEFAULT_TABLE);
  const [apiLoading,   setApiLoading]   = useState(true);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let connected = false;

    // SHAP
    axiosInstance.get("/api/predict/shap")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          connected = true;
          const top = res.data.slice(0, 6);
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
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          connected = true;
          setApiConnected(true);

          // Full model table
          setAllModels(res.data);

          // Best model metrics cards
          const best = res.data.reduce((a, b) => (a.R2 > b.R2 ? a : b));
          setMetrics([
            { metric: "MAE",      value: `${best.MAE} MW` },
            { metric: "RMSE",     value: `${best.RMSE} MW` },
            { metric: "MAPE",     value: `${best.MAPE}%` },
            { metric: "R² Score", value: `${best.R2}` },
          ]);

          // Radar — R² * 100 per model, capped at 100
          setRadarData(
            res.data.map((m) => ({
              subject: m.model.length > 14 ? m.model.substring(0, 14) + "…" : m.model,
              A: Math.min(100, Math.round(m.R2 * 100)),
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        setApiLoading(false);
        if (connected) setApiConnected(true);
      });
  }, []);

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">
          Analysis & Visualizations
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {apiLoading ? (
            <CircularProgress size={14} sx={{ color: "#38bdf8" }} />
          ) : (
            <Chip
              label={apiConnected ? "Live ML Data" : "Static Fallback"}
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

        {/* ── GDP vs Demand ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                India GDP Growth vs Delhi Annual Demand
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="gdp" name="GDP %" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: "GDP Growth (%)", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis dataKey="demand" name="Demand" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MU" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} />
                  <Scatter data={gdpVsDemand} fill="#38bdf8" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Weather Impact ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Weather Impact on Demand (Real Data)
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

        {/* ── Monthly Demand ── */}
        <Grid item xs={12} md={7}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Monthly Avg Demand — Delhi (MW, 2021–2024)
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyDemand}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" domain={[2800, 6600]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="demand" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Avg Demand (MW)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Sector Pie ── */}
        <Grid item xs={12} md={5}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Energy Consumption by Sector
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sectorData} cx="50%" cy="50%"
                    innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                    labelLine={{ stroke: "#64748b" }}
                  >
                    {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── SHAP Feature Importance (live) ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Feature Importance (SHAP)
                </Typography>
                {apiConnected && (
                  <Chip label="Live" size="small"
                    sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 10 }} />
                )}
              </Stack>
              <Stack spacing={1.5}>
                {shapData.map((f) => (
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

        {/* ── Model Metrics + Radar (live) ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Best Model — Evaluation Metrics
                </Typography>
                {apiConnected && (
                  <Chip label="Live" size="small"
                    sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 10 }} />
                )}
              </Stack>
              <Grid container spacing={1.5} mb={2}>
                {metricsData.map((m) => (
                  <Grid item xs={6} key={m.metric}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", textAlign: "center" }}>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>{m.metric}</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: "#38bdf8" }}>{m.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Radar name="R²×100" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── All Models Comparison Table (live) ── */}
        {allModels.length > 0 && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700} color="white">
                    All Models — Performance Comparison
                  </Typography>
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
                    {allModels
                      .slice()
                      .sort((a, b) => b.R2 - a.R2)
                      .map((row, i) => (
                        <TableRow key={row.model}>
                          <TableCell sx={{ color: i === 0 ? "#facc15" : "#cbd5e1", borderColor: "rgba(255,255,255,0.04)", fontWeight: i === 0 ? 700 : 400 }}>
                            {i === 0 ? "🏆 " : ""}{row.model}
                          </TableCell>
                          <TableCell sx={{ color: "#38bdf8",  borderColor: "rgba(255,255,255,0.04)" }}>{row.MAE}</TableCell>
                          <TableCell sx={{ color: "#f97316",  borderColor: "rgba(255,255,255,0.04)" }}>{row.RMSE}</TableCell>
                          <TableCell sx={{ color: "#a78bfa",  borderColor: "rgba(255,255,255,0.04)" }}>{row.MAPE}</TableCell>
                          <TableCell sx={{ color: "#22c55e",  borderColor: "rgba(255,255,255,0.04)", fontWeight: 700 }}>{row.R2}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Regional (DISCOM) Demand ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Delhi DISCOM Zone Demand (MU/year)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={regionalDemand}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="region" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MU" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="demand" radius={[4, 4, 0, 0]} name="Demand (MU)">
                    {regionalDemand.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── CAGR ── */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Demand Growth Rate — CAGR (%) — Real + Projected
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={cagrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" domain={[6, 13]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="cagr" stroke="#facc15" strokeWidth={2.5} dot={{ r: 5, fill: "#facc15" }} name="CAGR %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Hourly Demand Profile ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Avg Hourly Demand Profile — Delhi (MW, all years)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hourlyProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} label={{ value: "Hour of Day", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" domain={[2600, 6200]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="demand" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4, fill: "#a78bfa" }} name="Avg MW" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
