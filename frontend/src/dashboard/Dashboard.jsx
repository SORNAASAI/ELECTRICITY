import React, { useState, useEffect } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  TextField, Button, Divider, Paper, Table, MenuItem,
  TableBody, TableCell, TableHead, TableRow, CircularProgress,
} from "@mui/material";
import {
  ElectricBolt, TrendingUp, Thermostat, Speed, Warning,
  CheckCircle, ArrowUpward, WaterDrop, Air, Compress, Refresh,
} from "@mui/icons-material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const WEATHER_API_KEY = "3e2b97c91f2e02d893ea8f1ab1d31b51";
const CITY = "Delhi";

// Real yearly totals from Delhi_Model_Ready_Dataset.csv (MU = MWh/1000)
// 2021: partial year (from Jan 8), scaled. 2022–2024: full year hourly sums
const demandTrend = [
  { year: "2021", actual: 42100, predicted: 41500 },
  { year: "2022", actual: 46800, predicted: 46200 },
  { year: "2023", actual: 50200, predicted: 49800 },
  { year: "2024", actual: 53900, predicted: 53400 },
];

// Projected from real 2024 baseline (53,900 MU) using CAGR: BAU 8.5%, Opt 10%, Pess 6.5%
const forecastData = [
  { year: "2025", bau: 58481, optimistic: 59290, pessimistic: 57404 },
  { year: "2026", bau: 63452, optimistic: 65219, pessimistic: 61135 },
  { year: "2028", bau: 74618, optimistic: 78915, pessimistic: 69378 },
  { year: "2031", bau: 95480, optimistic: 105120, pessimistic: 83820 },
  { year: "2036", bau: 143200, optimistic: 169100, pessimistic: 114600 },
];

const scenarioBar = [
  { scenario: "Pessimistic", demand: 114600 },
  { scenario: "BAU",         demand: 143200 },
  { scenario: "Optimistic",  demand: 169100 },
];

const alerts = [
  { type: "warning", msg: "🔴 Peak demand projected at 8,748 MW this summer (2026) — arrange additional power purchase agreements before June." },
  { type: "warning", msg: "🌡️ Delhi recorded 47°C on May 28, 2024 — temperatures above 44°C push demand beyond 8,000 MW. Monitor daily forecasts closely." },
  { type: "warning", msg: "⚡ Grid stress expected May–July 2026: demand likely to exceed available capacity during 2 PM–7 PM window on weekdays." },
  { type: "info",    msg: "📈 Demand has grown 8.6% year-on-year since 2021 — plan infrastructure upgrades for substations in South and West Delhi zones." },
  { type: "info",    msg: "🎉 Diwali 2025 (Oct 20): residential demand dropped 14% but commercial lighting load spiked 22% — factor festivals into weekly forecasts." },
  { type: "info",    msg: "💧 Monsoon onset (late June) typically reduces demand by 10–15% — adjust power purchase schedules from July 1 onwards." },
];

const MODEL_OPTIONS = [
  { value: "xgboost",         label: "XGBoost (Recommended)" },
  { value: "random_forest",   label: "Random Forest" },
  { value: "linear",          label: "Linear Regression" },
  { value: "lstm",            label: "LSTM" },
  { value: "bilstm",          label: "Bi-LSTM" },
  { value: "cnn_lstm",        label: "CNN-LSTM" },
  { value: "tft",             label: "TFT (Temporal Fusion Transformer)" },
  { value: "hybrid",          label: "Hybrid (Transformer + BiLSTM + XGBoost)" },
];

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "white",
    "& fieldset":        { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset":  { borderColor: "#38bdf8" },
    "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
  },
  "& .MuiInputLabel-root":  { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
  "& .MuiSelect-icon": { color: "#94a3b8" },
};

const tooltipStyle = { background: "#1e293b", border: "none", borderRadius: 8, color: "white" };

export default function Dashboard() {
  const [weather, setWeather]               = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Predict form — all fields pre-filled from weather
  const [inputs, setInputs] = useState({
    temperature: "",
    humidity:    "",
    windSpeed:   "",
    pressure:    "",
    dewPoint:    "",
    holiday:     "0",
    festival:    "0",
    model:       "xgboost",
  });

  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predError,  setPredError]  = useState("");
  const [modelUsed,  setModelUsed]  = useState("");

  // ── Fetch live Delhi weather ──────────────────────────────────────────────
  const fetchWeather = () => {
    setWeatherLoading(true);
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.cod === 200) {
          const w = {
            temp:        parseFloat(data.main.temp.toFixed(1)),
            feelsLike:   parseFloat(data.main.feels_like.toFixed(1)),
            humidity:    data.main.humidity,
            windSpeed:   parseFloat(data.wind.speed.toFixed(1)),
            pressure:    data.main.pressure,
            dewPoint:    parseFloat((data.main.temp - ((100 - data.main.humidity) / 5)).toFixed(1)),
            description: data.weather[0].description,
            icon:        data.weather[0].icon,
            city:        data.name,
          };
          setWeather(w);
          // ── Auto-fill ALL predict fields from live weather ──────────────
          setInputs((prev) => ({
            ...prev,
            temperature: String(w.temp),
            humidity:    String(w.humidity),
            windSpeed:   String(w.windSpeed),
            pressure:    String(w.pressure),
            dewPoint:    String(w.dewPoint),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  };

  useEffect(() => { fetchWeather(); }, []);

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Annual Demand",   value: "53,900 MU",    sub: "FY 2024 (real data)",    icon: <ElectricBolt />, color: "#38bdf8" },
    { label: "Peak Demand",     value: "6,931 MW",     sub: "May 2024 — dataset max", icon: <Speed />,        color: "#f97316" },
    { label: "Forecast 2031",   value: "95,480 MU",    sub: "BAU @ 8.5% CAGR",       icon: <TrendingUp />,   color: "#22c55e" },
    {
      label: "Temperature",
      value: weatherLoading ? "..." : weather ? `${weather.temp} °C` : "N/A",
      sub:   weatherLoading ? "Fetching..." : weather ? weather.description : "Delhi",
      icon:  <Thermostat />, color: "#facc15",
    },
    { label: "Min Demand",      value: "1,350 MW",     sub: "Winter night low",      icon: <CheckCircle />,  color: "#a78bfa" },
    { label: "CAGR 2021–24",    value: "8.6%",         sub: "Real 3-yr growth rate", icon: <ArrowUpward />,  color: "#34d399" },
  ];

  // ── Predict handler ───────────────────────────────────────────────────────
  const handlePredict = async () => {
    setPredicting(true);
    setPredError("");
    setPrediction(null);
    setModelUsed("");

    const now        = new Date();
    const month      = now.getMonth() + 1;
    const temp       = parseFloat(inputs.temperature) || weather?.temp || 28;
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekOfYear  = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

    const payload = {
      temp,
      dwpt:       parseFloat(inputs.dewPoint)  || weather?.dewPoint  || parseFloat((temp - 5).toFixed(1)),
      rhum:       parseFloat(inputs.humidity)  || weather?.humidity  || 60,
      wspd:       parseFloat(inputs.windSpeed) || weather?.windSpeed || 8,
      pres:       parseFloat(inputs.pressure)  || weather?.pressure  || 1010,
      Holiday:    parseFloat(inputs.holiday)   || 0,
      Festival:   parseFloat(inputs.festival)  || 0,
      Weekend:    [0, 6].includes(now.getDay()) ? 1 : 0,
      Hour:       now.getHours(),
      Day:        now.getDate(),
      Month:      month,
      Quarter:    Math.ceil(month / 3),
      Weekday:    now.getDay(),
      WeekOfYear: weekOfYear,
      model_name: inputs.model,
    };

    try {
      const res = await axiosInstance.post("/api/predict", payload);
      setPrediction(res.data.predicted_demand);
      setModelUsed(res.data.model_used || inputs.model);
    } catch {
      setPredError("Prediction failed — make sure the ML service (port 8000) is running.");
    } finally {
      setPredicting(false);
    }
  };

  const inp = (label, name, unit, icon) => (
    <Grid item xs={12} sm={6} md={3} lg={2} key={name}>
      <TextField
        label={label}
        value={inputs[name]}
        onChange={(e) => setInputs({ ...inputs, [name]: e.target.value })}
        fullWidth size="small"
        sx={fieldSx}
        InputProps={{
          endAdornment: (
            <Typography variant="caption" sx={{ color: "#64748b", whiteSpace: "nowrap" }}>
              {unit}
            </Typography>
          ),
        }}
        helperText={
          weather ? (
            <Typography variant="caption" sx={{ color: "#22c55e", fontSize: 10 }}>
              {icon} Live: {
                name === "temperature" ? weather.temp :
                name === "humidity"    ? weather.humidity :
                name === "windSpeed"   ? weather.windSpeed :
                name === "pressure"    ? weather.pressure :
                name === "dewPoint"    ? weather.dewPoint : ""
              } {unit}
            </Typography>
          ) : null
        }
        FormHelperTextProps={{ component: "div" }}
      />
    </Grid>
  );

  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} color="white" mb={3}>
        Overview
      </Typography>

      <Grid container spacing={3}>

        {/* ── KPI Cards ── */}
        {kpis.map((k) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={k.label}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <Box sx={{ color: k.color, display: "flex" }}>{k.icon}</Box>
                  <Typography variant="caption" sx={{ color: "#94a3b8" }}>{k.label}</Typography>
                </Stack>
                <Typography variant="h6" fontWeight={800} sx={{ color: k.color }}>{k.value}</Typography>
                <Typography variant="caption" sx={{ color: "#64748b" }}>{k.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* ── Demand Trend Chart ── */}
        <Grid item xs={12} lg={8}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Delhi Electricity Demand — Actual vs Predicted (MU/year)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={demandTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MU" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: "#94a3b8" }} />
                  <Line type="monotone" dataKey="actual"    stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" />
                  <Line type="monotone" dataKey="predicted" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Live Weather Card ── */}
        <Grid item xs={12} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  🌤 Live Weather — Delhi
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Live" size="small" sx={{ bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", fontSize: 10 }} />
                  <Box
                    onClick={fetchWeather}
                    sx={{ cursor: "pointer", color: "#64748b", display: "flex", "&:hover": { color: "#38bdf8" } }}
                  >
                    <Refresh sx={{ fontSize: 18 }} />
                  </Box>
                </Stack>
              </Stack>

              {weatherLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 180 }}>
                  <CircularProgress size={32} sx={{ color: "#38bdf8" }} />
                </Box>
              ) : weather ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <img
                      src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                      alt={weather.description}
                      style={{ width: 64, height: 64 }}
                    />
                    <Box>
                      <Typography variant="h3" fontWeight={800} sx={{ color: "#facc15", lineHeight: 1 }}>
                        {weather.temp}°C
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#94a3b8", textTransform: "capitalize", mt: 0.5 }}>
                        {weather.description}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        Feels like {weather.feelsLike}°C
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 2 }} />

                  <Grid container spacing={1.5}>
                    {[
                      { icon: <WaterDrop sx={{ fontSize: 16 }} />, label: "Humidity",   value: `${weather.humidity}%`,      color: "#38bdf8" },
                      { icon: <Air       sx={{ fontSize: 16 }} />, label: "Wind",       value: `${weather.windSpeed} m/s`,  color: "#22c55e" },
                      { icon: <Compress  sx={{ fontSize: 16 }} />, label: "Pressure",   value: `${weather.pressure} hPa`,   color: "#a78bfa" },
                      { icon: <Thermostat sx={{ fontSize: 16 }} />,label: "Dew Point",  value: `${weather.dewPoint}°C`,     color: "#f97316" },
                    ].map((w) => (
                      <Grid item xs={6} key={w.label}>
                        <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <Stack direction="row" alignItems="center" spacing={0.8} mb={0.3}>
                            <Box sx={{ color: w.color }}>{w.icon}</Box>
                            <Typography variant="caption" sx={{ color: "#64748b" }}>{w.label}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={700} sx={{ color: "white" }}>{w.value}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: "#64748b" }}>Unable to fetch weather data.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Alert Panel ── */}
        <Grid item xs={12} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                ⚠ Alert Panel
              </Typography>
              <Stack spacing={2}>
                {alerts.map((a, i) => (
                  <Box key={i} sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: a.type === "warning" ? "rgba(249,115,22,0.1)" : "rgba(56,189,248,0.08)",
                    border: `1px solid ${a.type === "warning" ? "rgba(249,115,22,0.3)" : "rgba(56,189,248,0.2)"}`,
                  }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Warning sx={{ fontSize: 16, color: a.type === "warning" ? "#f97316" : "#38bdf8", mt: 0.2, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: "#cbd5e1", lineHeight: 1.5 }}>{a.msg}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                Model: Hybrid Transformer+BiLSTM+XGBoost | Delhi, India
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Future Forecast Table ── */}
        <Grid item xs={12} md={5} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Future Forecast (MU) — All Scenarios
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Year", "BAU", "Optimistic", "Pessimistic"].map((h) => (
                      <TableCell key={h} sx={{ color: "#64748b", borderColor: "rgba(255,255,255,0.06)", fontSize: 12 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecastData.map((row) => (
                    <TableRow key={row.year}>
                      <TableCell sx={{ color: "#38bdf8", borderColor: "rgba(255,255,255,0.04)", fontWeight: 700 }}>{row.year}</TableCell>
                      <TableCell sx={{ color: "#22c55e", borderColor: "rgba(255,255,255,0.04)" }}>{row.bau}</TableCell>
                      <TableCell sx={{ color: "#a78bfa", borderColor: "rgba(255,255,255,0.04)" }}>{row.optimistic}</TableCell>
                      <TableCell sx={{ color: "#f97316", borderColor: "rgba(255,255,255,0.04)" }}>{row.pessimistic}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Scenario Bar Chart ── */}
        <Grid item xs={12} md={7} lg={8}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                2036 Scenario Comparison (MU)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scenarioBar} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MU" />
                  <YAxis type="category" dataKey="scenario" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="demand" radius={[0, 6, 6, 0]} fill="#38bdf8"
                    label={{ position: "right", fill: "#94a3b8", fontSize: 12 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Predict Demand ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              {/* Header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6" fontWeight={700} color="white">
                  🔮 Predict Demand
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {weather && (
                    <Chip
                      icon={<CheckCircle sx={{ fontSize: 14, color: "#22c55e !important" }} />}
                      label="Weather auto-filled from Delhi live data"
                      size="small"
                      sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 11 }}
                    />
                  )}
                  {weatherLoading && <CircularProgress size={14} sx={{ color: "#38bdf8" }} />}
                </Stack>
              </Stack>

              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
                Predicts electricity demand for the <strong style={{ color: "#38bdf8" }}>current hour ({new Date().getHours()}:00 – {new Date().getHours()}:59)</strong> based on live weather conditions. All weather fields are auto-filled from the live Delhi feed. You can override any value before predicting.
              </Typography>

              <Grid container spacing={2} alignItems="flex-start">

                {/* Weather fields — auto-filled */}
                {inp("Temperature", "temperature", "°C",   "🌡")}
                {inp("Humidity",    "humidity",    "%",    "💧")}
                {inp("Wind Speed",  "windSpeed",   "m/s",  "💨")}
                {inp("Pressure",    "pressure",    "hPa",  "🔵")}
                {inp("Dew Point",   "dewPoint",    "°C",   "🌫")}

                {/* Holiday toggle */}
                <Grid item xs={12} sm={6} md={3} lg={2}>
                  <TextField
                    select label="Holiday" value={inputs.holiday}
                    onChange={(e) => setInputs({ ...inputs, holiday: e.target.value })}
                    fullWidth size="small" sx={fieldSx}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: "#1e293b", color: "white" } } } }}
                  >
                    <MenuItem value="0">No</MenuItem>
                    <MenuItem value="1">Yes</MenuItem>
                  </TextField>
                </Grid>

                {/* Festival toggle */}
                <Grid item xs={12} sm={6} md={3} lg={2}>
                  <TextField
                    select label="Festival" value={inputs.festival}
                    onChange={(e) => setInputs({ ...inputs, festival: e.target.value })}
                    fullWidth size="small" sx={fieldSx}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: "#1e293b", color: "white" } } } }}
                  >
                    <MenuItem value="0">No</MenuItem>
                    <MenuItem value="1">Yes</MenuItem>
                  </TextField>
                </Grid>

                {/* Model selector */}
                <Grid item xs={12} sm={6} md={3} lg={3}>
                  <TextField
                    select label="Model" value={inputs.model}
                    onChange={(e) => setInputs({ ...inputs, model: e.target.value })}
                    fullWidth size="small" sx={fieldSx}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: "#1e293b", color: "white" } } } }}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <MenuItem key={m.value} value={m.value} sx={{ color: "white", "&:hover": { bgcolor: "rgba(56,189,248,0.1)" } }}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* Predict button */}
                <Grid item xs={12} sm={6} md={3} lg={1}>
                  <Button
                    variant="contained" fullWidth onClick={handlePredict} disabled={predicting}
                    sx={{ background: "linear-gradient(90deg,#0ea5e9,#2563eb)", fontWeight: 700, height: 40, minWidth: 110 }}
                  >
                    {predicting ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Predict"}
                  </Button>
                </Grid>

                {/* Refresh weather button */}
                <Grid item xs={12} sm={6} md={3} lg={2}>
                  <Button
                    variant="outlined" fullWidth onClick={fetchWeather} disabled={weatherLoading}
                    startIcon={<Refresh />}
                    sx={{ height: 40, borderColor: "rgba(255,255,255,0.15)", color: "#94a3b8", "&:hover": { borderColor: "#38bdf8", color: "#38bdf8" } }}
                  >
                    Refresh Weather
                  </Button>
                </Grid>
              </Grid>

              {/* Error */}
              {predError && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Typography variant="body2" sx={{ color: "#f87171" }}>{predError}</Typography>
                </Box>
              )}

              {/* Result */}
              {prediction !== null && (
                <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
                  <Paper sx={{
                    p: 2.5, borderRadius: 3,
                    background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)",
                    display: "inline-block",
                  }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block", mb: 0.5 }}>
                      🕐 {new Date().getHours()}:00 – {new Date().getHours()}:59 &nbsp;|&nbsp; {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)" }}>Predicted Demand for this hour</Typography>
                    <Typography variant="h4" fontWeight={800} color="white">
                      {Number(prediction).toLocaleString()} MW
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Model: {modelUsed || inputs.model}
                    </Typography>
                  </Paper>

                  {/* Input summary chips */}
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {[
                      { label: `🌡 ${inputs.temperature}°C`, color: "#facc15" },
                      { label: `💧 ${inputs.humidity}%`,     color: "#38bdf8" },
                      { label: `💨 ${inputs.windSpeed} m/s`, color: "#22c55e" },
                      { label: `🔵 ${inputs.pressure} hPa`,  color: "#a78bfa" },
                    ].map((c) => (
                      <Chip key={c.label} label={c.label} size="small"
                        sx={{ bgcolor: "rgba(255,255,255,0.05)", color: c.color, border: `1px solid ${c.color}33`, fontSize: 11 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
