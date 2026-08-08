import React, { useState, useEffect } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  TextField, Button, Divider, Paper, Table, MenuItem,
  TableBody, TableCell, TableHead, TableRow, CircularProgress,
} from "@mui/material";
import {
  ElectricBolt, TrendingUp, Thermostat, Speed, Warning,
  CheckCircle, ArrowUpward, Refresh,
} from "@mui/icons-material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const WEATHER_API_KEY = "3e2b97c91f2e02d893ea8f1ab1d31b51";

// Delhi only — single city weather
const DELHI_CITY_ID = 1273294;

// Delhi hourly demand trend (MW avg per day) — derived from delhi_features.csv
const demandTrend = [
  { date: "Aug 8",  actual: 6513, predicted: 6480 },
  { date: "Aug 9",  actual: 6111, predicted: 6090 },
  { date: "Aug 10", actual: 5693, predicted: 5670 },
  { date: "Aug 11", actual: 5847, predicted: 5820 },
  { date: "Aug 12", actual: 5752, predicted: 5730 },
  { date: "Aug 13", actual: 5971, predicted: 5950 },
  { date: "Aug 14", actual: 6302, predicted: 6280 },
  { date: "Aug 15", actual: 5212, predicted: 5190 },
  { date: "Aug 16", actual: 4900, predicted: 4880 },
  { date: "Aug 17", actual: 5369, predicted: 5350 },
];

// Delhi demand forecast scenarios (MW daily avg)
const forecastData = [
  { date: "Aug 26", bau: 5400, optimistic: 5600, pessimistic: 5200 },
  { date: "Aug 27", bau: 5350, optimistic: 5550, pessimistic: 5150 },
  { date: "Aug 28", bau: 5500, optimistic: 5700, pessimistic: 5300 },
  { date: "Aug 29", bau: 5600, optimistic: 5800, pessimistic: 5400 },
  { date: "Aug 30", bau: 5650, optimistic: 5850, pessimistic: 5450 },
];

const scenarioBar = [
  { scenario: "Pessimistic", demand: 5200 },
  { scenario: "BAU",         demand: 5500 },
  { scenario: "Optimistic",  demand: 5800 },
];

const alerts = [
  { type: "warning", msg: "🔴 Delhi peak demand hit ~6,964 MW in Aug 2025 — monitor BRPL/BYPL/NDPL feeders during 14:00–16:00 window." },
  { type: "warning", msg: "🌡️ Apparent temperature above 38°C — expect 8–12% demand surge in residential cooling load across all Delhi DISCOMs." },
  { type: "warning", msg: "⚡ Weekend demand dip expected — NDMC and MES loads drop ~15%, adjust dispatch schedule accordingly." },
  { type: "info",    msg: "📈 Delhi demand shows strong morning ramp 06:00–10:00 and evening peak 14:00–16:00 — plan inter-DISCOM transfers." },
  { type: "info",    msg: "🌧️ Monsoon humidity above 85% reduces cooling efficiency — demand may stay elevated despite lower temperatures." },
  { type: "info",    msg: "📊 BRPL accounts for ~42% of total Delhi demand — prioritize feeder monitoring for Western Delhi zones." },
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
  const [cityWeathers, setCityWeathers]     = useState([]);
  const [weather, setWeather]               = useState(null); // national avg
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Predict form — pre-filled from Delhi weather
  const [inputs, setInputs] = useState({
    temperature: "",
    humidity:    "",
    apparentTemp: "",
    isWeekend:   "0",
    model:       "xgboost",
  });

  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predError,  setPredError]  = useState("");
  const [modelUsed,  setModelUsed]  = useState("");

  // ── Fetch live weather for Delhi ─────────────────────────────────────────
  const fetchWeather = () => {
    setWeatherLoading(true);
    fetch(`https://api.openweathermap.org/data/2.5/weather?id=${DELHI_CITY_ID}&appid=${WEATHER_API_KEY}&units=metric`)
      .then((r) => r.json())
      .then((d) => {
        if (d.cod === 200) {
          const w = {
            temp:        parseFloat(d.main.temp.toFixed(1)),
            feelsLike:   parseFloat(d.main.feels_like.toFixed(1)),
            humidity:    d.main.humidity,
            description: d.weather[0].description,
            icon:        d.weather[0].icon,
          };
          setWeather(w);
          setCityWeathers([{ city: "New Delhi", region: "Delhi", ...w }]);
          setInputs((prev) => ({
            ...prev,
            temperature:  String(w.temp),
            humidity:     String(w.humidity),
            apparentTemp: String(w.feelsLike),
            isWeekend:    [0, 6].includes(new Date().getDay()) ? "1" : "0",
          }));
        }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  };

  useEffect(() => { fetchWeather(); }, []);

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Dataset Peak",    value: "6,964 MW",   sub: "Aug 2025 — dataset max",   icon: <Speed />,        color: "#f97316" },
    { label: "Avg Demand",      value: "~5,500 MW",  sub: "Delhi hourly mean",         icon: <ElectricBolt />, color: "#38bdf8" },
    { label: "Min Demand",      value: "~3,900 MW",  sub: "Night/early morning low",   icon: <CheckCircle />,  color: "#a78bfa" },
    {
      label: "Delhi Temp",
      value: weatherLoading ? "..." : weather ? `${weather.temp} °C` : "N/A",
      sub:   weatherLoading ? "Fetching..." : weather ? weather.description : "Delhi",
      icon:  <Thermostat />, color: "#facc15",
    },
    { label: "DISCOMs",         value: "5",          sub: "BRPL, BYPL, NDPL, NDMC, MES", icon: <TrendingUp />,  color: "#22c55e" },
    { label: "Humidity",        value: weatherLoading ? "..." : weather ? `${weather.humidity}%` : "N/A", sub: "Live Delhi humidity", icon: <ArrowUpward />, color: "#34d399" },
  ];

  // ── Predict handler ───────────────────────────────────────────────────────
  const handlePredict = async () => {
    setPredicting(true);
    setPredError("");
    setPrediction(null);
    setModelUsed("");

    const now = new Date();

    const payload = {
      temperature_c:   parseFloat(inputs.temperature)  || weather?.temp      || 30,
      humidity_pct:    parseFloat(inputs.humidity)     || weather?.humidity  || 70,
      apparent_temp_c: parseFloat(inputs.apparentTemp) || weather?.feelsLike || 32,
      hour:            now.getHours(),
      day_of_week:     now.getDay(),
      month:           now.getMonth() + 1,
      is_weekend:      parseInt(inputs.isWeekend) || 0,
      model_name:      inputs.model,
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
              {icon} Avg: {
                name === "temperature" ? weather.temp :
                name === "humidity"    ? weather.humidity :
                name === "windSpeed"   ? weather.windSpeed : ""
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
                Delhi Electricity Demand — Actual vs Predicted (MW)
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

        {/* ── Live Weather Card — India 5-city grid ── */}
        <Grid item xs={12} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  🌤 Live Weather — New Delhi
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="Live" size="small" sx={{ bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", fontSize: 10 }} />
                  <Box onClick={fetchWeather} sx={{ cursor: "pointer", color: "#64748b", display: "flex", "&:hover": { color: "#38bdf8" } }}>
                    <Refresh sx={{ fontSize: 18 }} />
                  </Box>
                </Stack>
              </Stack>

              {weatherLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 220 }}>
                  <CircularProgress size={32} sx={{ color: "#38bdf8" }} />
                </Box>
              ) : cityWeathers.length > 0 ? (
                <>
                  {/* National average summary */}
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", mb: 2 }}>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>Delhi Live Weather</Typography>
                    <Stack direction="row" spacing={3} mt={0.5}>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#facc15" }}>{weather?.temp}°C</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Temperature</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#38bdf8" }}>{weather?.humidity}%</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Humidity</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#22c55e" }}>{weather?.windSpeed} m/s</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Wind</Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 1.5 }} />

                  {/* Per-city rows */}
                  <Stack spacing={1}>
                    {cityWeathers.map((c) => (
                      <Box key={c.city} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <img
                            src={`https://openweathermap.org/img/wn/${c.icon}.png`}
                            alt={c.description}
                            style={{ width: 28, height: 28 }}
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color: "white", lineHeight: 1.2 }}>{c.city}</Typography>
                            <Typography variant="caption" sx={{ color: "#64748b" }}>{c.region}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="body2" fontWeight={700} sx={{ color: "#facc15", minWidth: 42, textAlign: "right" }}>{c.temp}°C</Typography>
                          <Typography variant="caption" sx={{ color: "#38bdf8", minWidth: 36, textAlign: "right" }}>{c.humidity}%</Typography>
                          <Typography variant="caption" sx={{ color: "#22c55e", minWidth: 48, textAlign: "right" }}>{c.windSpeed} m/s</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
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
                Model: Hybrid Transformer+BiLSTM+XGBoost | Delhi Grid
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Future Forecast Table ── */}
        <Grid item xs={12} md={5} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                5-Day Demand Forecast (MW) — All Scenarios
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Date", "BAU", "Optimistic", "Pessimistic"].map((h) => (
                      <TableCell key={h} sx={{ color: "#64748b", borderColor: "rgba(255,255,255,0.06)", fontSize: 12 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {forecastData.map((row) => (
                    <TableRow key={row.year}>
                      <TableCell sx={{ color: "#38bdf8", borderColor: "rgba(255,255,255,0.04)", fontWeight: 700 }}>{row.date}</TableCell>
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
                Scenario Comparison (MW)
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
                      label="Weather auto-filled from Delhi live weather"
                      size="small"
                      sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", fontSize: 11 }}
                    />
                  )}
                  {weatherLoading && <CircularProgress size={14} sx={{ color: "#38bdf8" }} />}
                </Stack>
              </Stack>

              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
                Predicts Delhi electricity demand for the <strong style={{ color: "#38bdf8" }}>current hour ({new Date().getHours()}:00 – {new Date().getHours()}:59)</strong> based on live Delhi weather. Fields are auto-filled from the live feed.
              </Typography>

              <Grid container spacing={2} alignItems="flex-start">

                {/* Weather fields — auto-filled from Delhi */}
                {inp("Temperature",    "temperature",  "°C", "🌡")}
                {inp("Humidity",       "humidity",     "%",  "💧")}
                {inp("Apparent Temp",  "apparentTemp", "°C", "🌡")}

                {/* Weekend toggle */}
                <Grid item xs={12} sm={6} md={3} lg={2}>
                  <TextField
                    select label="Weekend" value={inputs.isWeekend}
                    onChange={(e) => setInputs({ ...inputs, isWeekend: e.target.value })}
                    fullWidth size="small" sx={fieldSx}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: "#1e293b", color: "white" } } } }}
                  >
                    <MenuItem value="0">Weekday</MenuItem>
                    <MenuItem value="1">Weekend</MenuItem>
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
