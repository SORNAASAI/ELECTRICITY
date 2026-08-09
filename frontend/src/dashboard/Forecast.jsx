import React, { useState, useEffect } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack,
  ToggleButton, ToggleButtonGroup, Chip, CircularProgress,
  TextField, Button,
} from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
  AreaChart, Area,
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
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "white",
    "& fieldset":             { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset":       { borderColor: "#38bdf8" },
    "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
  },
  "& .MuiInputLabel-root":             { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
  "& .MuiInputBase-input":             { colorScheme: "dark" },
};

// Default: now rounded to current hour in LOCAL time (not UTC)
function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export default function Forecast() {
  const [range,         setRange]         = useState("short");
  const [stats,         setStats]         = useState(null);
  const [metrics,       setMetrics]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [connected,     setConnected]     = useState(false);

  // Custom forecast state
  const [startDT,       setStartDT]       = useState(defaultStart());
  const [hours,         setHours]         = useState(24);
  const [model,         setModel]         = useState("xgboost");
  const [forecastData,  setForecastData]  = useState([]);
  const [forecasting,   setForecasting]   = useState(false);
  const [forecastError, setForecastError] = useState("");

  useEffect(() => {
    let ok = false;
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => { setStats(r.data); ok = true; })
      .catch(() => {});
    axiosInstance.get("/api/predict/metrics")
      .then((r) => {
        if (Array.isArray(r.data) && r.data.length > 0) { setMetrics(r.data); ok = true; }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); if (ok) setConnected(true); });
  }, []);

  const shortTermData = stats?.short_term || [];
  const longTermData  = stats?.long_term  || [];
  const data    = range === "short" ? shortTermData : longTermData;
  const xLabel  = range === "short" ? "Hour of Day" : "Month";

  const residual = data.map((d) => ({
    time:  d.time,
    error: parseFloat((d.actual - d.predicted).toFixed(1)),
  }));

  const bestModel = metrics ? metrics.reduce((a, b) => (a.R2 > b.R2 ? a : b)) : null;
  const metricCards = bestModel
    ? [
        { label: "MAE",      value: `${bestModel.MAE} MW`,  color: "#38bdf8" },
        { label: "RMSE",     value: `${bestModel.RMSE} MW`, color: "#f97316" },
        { label: "MAPE",     value: `${bestModel.MAPE}%`,   color: "#a78bfa" },
        { label: "R² Score", value: `${bestModel.R2}`,      color: "#22c55e" },
      ]
    : [
        { label: "MAE",      value: "—", color: "#38bdf8" },
        { label: "RMSE",     value: "—", color: "#f97316" },
        { label: "MAPE",     value: "—", color: "#a78bfa" },
        { label: "R² Score", value: "—", color: "#22c55e" },
      ];

  const chipLabel = range === "short"
    ? (stats ? `Hourly — last 24h (${stats.date_max})` : "Hourly")
    : (stats ? `Monthly — ${stats.date_min?.slice(0, 4)} → ${stats.date_max?.slice(0, 4)}` : "Monthly");

  const handleForecast = async () => {
    setForecasting(true);
    setForecastError("");
    setForecastData([]);
    try {
      const res = await axiosInstance.post("/api/predict/forecast", {
        start_datetime: startDT,
        hours,
        model_name: model,
      });
      setForecastData(res.data.data || []);
    } catch {
      setForecastError("Forecast failed — make sure the ML service (port 8000) is running.");
    } finally {
      setForecasting(false);
    }
  };

  const MODEL_OPTIONS = [
    "xgboost", "random_forest", "linear", "lstm", "bilstm", "cnn_lstm", "tft", "hybrid",
  ];

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">Forecast Results</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {loading && <CircularProgress size={14} sx={{ color: "#38bdf8" }} />}
          {!loading && (
            <Chip
              label={connected ? "Live Dataset" : "ML service offline"}
              size="small"
              sx={{
                bgcolor: connected ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)",
                color:   connected ? "#22c55e" : "#f97316",
                border:  `1px solid ${connected ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`,
                fontSize: 11,
              }}
            />
          )}
          <ToggleButtonGroup
            value={range} exclusive
            onChange={(_, v) => v && setRange(v)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", px: 2 },
              "& .Mui-selected": { color: "#38bdf8 !important", bgcolor: "rgba(56,189,248,0.1) !important" },
            }}
          >
            <ToggleButton value="short">Short-Term (Hourly)</ToggleButton>
            <ToggleButton value="long">Long-Term (Monthly)</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      <Grid container spacing={3}>

        {/* Metric Cards */}
        {metricCards.map((k) => (
          <Grid item xs={6} md={3} key={k.label}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>{k.label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: k.color, mt: 0.5 }}>{k.value}</Typography>
                {bestModel && (
                  <Typography variant="caption" sx={{ color: "#64748b" }}>{bestModel.model}</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Actual vs Predicted Chart */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Actual vs Predicted Demand (MW)
                </Typography>
                <Chip
                  label={chipLabel}
                  size="small"
                  sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontSize: 11 }}
                />
              </Stack>
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }}
                      label={{ value: xLabel, position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: "#94a3b8" }} />
                    <Line type="monotone" dataKey="actual"    stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} name="Actual" />
                    <Line type="monotone" dataKey="predicted" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} name="Predicted" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#64748b" }}>
                    {loading ? "Loading..." : "ML service offline — start predict_api.py"}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Residual Error Chart */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Residual Error (Actual − Predicted) MW
              </Typography>
              {residual.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={residual}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="error" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Error" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#64748b" }}>{loading ? "Loading..." : "No data"}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Custom Forecast Section ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={1}>
                🔮 Custom Forecast
              </Typography>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
                Select a start date &amp; time, forecast window, and model — get hour-by-hour demand predictions.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-end" flexWrap="wrap">

                {/* Date-time picker */}
                <TextField
                  label="Start Date & Time"
                  type="datetime-local"
                  value={startDT}
                  onChange={(e) => setStartDT(e.target.value)}
                  size="small"
                  sx={{ ...fieldSx, minWidth: 220 }}
                  InputLabelProps={{ shrink: true }}
                />

                {/* Hours toggle */}
                <Box>
                  <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mb: 0.5 }}>Forecast Window</Typography>
                  <ToggleButtonGroup
                    value={hours} exclusive
                    onChange={(_, v) => v && setHours(v)}
                    size="small"
                    sx={{
                      "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", px: 2.5 },
                      "& .Mui-selected": { color: "#38bdf8 !important", bgcolor: "rgba(56,189,248,0.1) !important" },
                    }}
                  >
                    <ToggleButton value={24}>24h</ToggleButton>
                    <ToggleButton value={48}>48h</ToggleButton>
                    <ToggleButton value={72}>72h</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Model toggle */}
                <Box>
                  <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mb: 0.5 }}>Model</Typography>
                  <ToggleButtonGroup
                    value={model} exclusive
                    onChange={(_, v) => v && setModel(v)}
                    size="small"
                    sx={{
                      flexWrap: "wrap",
                      "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", px: 1.5, fontSize: 11 },
                      "& .Mui-selected": { color: "#a78bfa !important", bgcolor: "rgba(167,139,250,0.1) !important" },
                    }}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <ToggleButton key={m} value={m}>{m}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>

                {/* Run button */}
                <Button
                  variant="contained"
                  onClick={handleForecast}
                  disabled={forecasting}
                  sx={{ background: "linear-gradient(90deg,#0ea5e9,#2563eb)", fontWeight: 700, height: 40, minWidth: 140 }}
                >
                  {forecasting ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Run Forecast"}
                </Button>
              </Stack>

              {forecastError && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Typography variant="body2" sx={{ color: "#f87171" }}>{forecastError}</Typography>
                </Box>
              )}

              {forecastData.length > 0 && (
                <Box mt={3}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "white" }}>
                      {hours}h Forecast — starting {startDT.replace("T", " ")}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={`Model: ${model}`} size="small"
                        sx={{ bgcolor: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", fontSize: 11 }} />
                      <Chip
                        label={forecastData.some(d => d.weather_src === "forecast") ? "🌤 Live weather used" : "📊 Historical avg used"}
                        size="small"
                        sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", fontSize: 11 }}
                      />
                    </Stack>
                  </Stack>

                  {/* Confidence band legend */}
                  <Stack direction="row" spacing={3} mb={1.5}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 12, height: 3, bgcolor: "#a78bfa", borderRadius: 1 }} />
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>Predicted</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 12, height: 10, bgcolor: "rgba(167,139,250,0.2)", borderRadius: 1 }} />
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>Confidence band (widens beyond 24h)</Typography>
                    </Stack>
                  </Stack>

                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={forecastData}>
                      <defs>
                        <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 10 }}
                        interval={hours === 24 ? 2 : hours === 48 ? 5 : 8} />
                      <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW"
                        domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [
                          `${Number(val).toLocaleString()} MW`,
                          name === "confidence_high" ? "Upper bound" :
                          name === "confidence_low"  ? "Lower bound" : "Predicted",
                        ]}
                      />
                      {/* Shaded confidence band */}
                      {/* Upper band — filled down */}
                      <Area type="monotone" dataKey="confidence_high" stroke="none"
                        fill="#a78bfa" fillOpacity={0.15} name="confidence_high" legendType="none" />
                      {/* Lower band — white fill to cut out bottom of upper band */}
                      <Area type="monotone" dataKey="confidence_low" stroke="none"
                        fill="#0f172a" fillOpacity={1} name="confidence_low" legendType="none" />
                      {/* Predicted line on top */}
                      <Area type="monotone" dataKey="predicted" stroke="#a78bfa"
                        strokeWidth={2.5} fill="none" dot={{ r: 2 }} name="Predicted Demand" />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Accuracy note */}
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      ⚠ Confidence band widens with horizon: ±1× MAE (0–24h) → ±1.5× MAE (24–48h) → ±2.2× MAE (48–72h).
                      Weather from OpenWeatherMap for ≤5 days ahead, historical dataset averages beyond.
                    </Typography>
                  </Box>
                </Box>
              )}

            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
