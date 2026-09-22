import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  TextField, Button, Divider, Paper, CircularProgress, MenuItem,
  IconButton,
} from "@mui/material";
import {
  ElectricBolt, TrendingUp, Thermostat, Speed, Warning,
  CheckCircle, ArrowUpward, Refresh, NotificationsActive,
  Info, ErrorOutlined, AccessTime, Campaign,
} from "@mui/icons-material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const WEATHER_API_KEY = "3e2b97c91f2e02d893ea8f1ab1d31b51";
const DELHI_CITY_ID   = 1273294;

const MODEL_OPTIONS = [
  { value: "xgboost",       label: "XGBoost (Recommended)" },
  { value: "random_forest", label: "Random Forest" },
  { value: "linear",        label: "Linear Regression" },
  { value: "lstm",          label: "LSTM" },
  { value: "bilstm",        label: "Bi-LSTM" },
  { value: "cnn_lstm",      label: "CNN-LSTM" },
  { value: "tft",           label: "TFT (Temporal Fusion Transformer)" },
  { value: "hybrid",        label: "Hybrid (Transformer + BiLSTM + XGBoost)" },
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
    "& fieldset":             { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset":       { borderColor: "#38bdf8" },
    "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
  },
  "& .MuiInputLabel-root":            { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused":{ color: "#38bdf8" },
  "& .MuiSelect-icon":                { color: "#94a3b8" },
};
const tooltipStyle = { background: "#1e293b", border: "none", borderRadius: 8, color: "white" };

export default function Dashboard() {
  const [stats,          setStats]          = useState(null);
  const [statsLoading,   setStatsLoading]   = useState(true);
  const [weather,        setWeather]        = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [recentDemand,   setRecentDemand]   = useState([]);   // last 168 actual hourly values
  const [inputs,         setInputs]         = useState({
    temperature: "", humidity: "", apparentTemp: "", isWeekend: "0", model: "xgboost",
  });
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predError,  setPredError]  = useState("");
  const [modelUsed,  setModelUsed]  = useState("");
  const [shapData,   setShapData]   = useState([]);

  // ── Dynamic Alerts State & Live Sync ─────────────────────────────────────
  const [dispatchedAlerts, setDispatchedAlerts] = useState([]);
  const [peakForecast,     setPeakForecast]     = useState(null);
  const [alertsLoading,    setAlertsLoading]    = useState(true);
  const [alertFilter,      setAlertFilter]      = useState("all");
  const [lastSyncTime,     setLastSyncTime]     = useState(new Date());

  const fetchAlertsData = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [alertsRes, peakRes] = await Promise.allSettled([
        fetch("http://localhost:8081/api/managers/alerts", { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch("http://localhost:8081/api/predict/forecast/peak?model_name=xgboost&days=1", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
        setDispatchedAlerts(alertsRes.value);
      } else {
        setDispatchedAlerts([]);
      }

      if (peakRes.status === "fulfilled" && peakRes.value?.peaks) {
        setPeakForecast(peakRes.value);
      }
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn("Alerts fetch note:", e);
      setDispatchedAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertsData();
  }, [fetchAlertsData]);

  // ── Fetch dataset stats ───────────────────────────────────────────────────
  useEffect(() => {
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
    // Fetch last 168 actual hourly demand values for lag features
    axiosInstance.get("/api/predict/recent-demand")
      .then((r) => setRecentDemand(r.data.values || []))
      .catch(() => {});
  }, []);

  // ── Fetch live Delhi weather ──────────────────────────────────────────────
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
  useEffect(() => { fetchWeather(); }, []); // eslint-disable-line

  // ── KPI cards — values from dataset stats ────────────────────────────────
  const kpis = [
    {
      label: "Dataset Peak",
      value: stats ? `${Number(stats.demand_max).toLocaleString()} MW` : "...",
      sub:   stats ? stats.all_time_peak_date : "Loading...",
      icon: <Speed />, color: "#f97316",
    },
    {
      label: "Avg Demand",
      value: stats ? `${Number(stats.demand_mean).toLocaleString()} MW` : "...",
      sub:   stats ? `${stats.date_min} → ${stats.date_max}` : "Loading...",
      icon: <ElectricBolt />, color: "#38bdf8",
    },
    {
      label: "Min Demand",
      value: stats ? `${Number(stats.demand_min).toLocaleString()} MW` : "...",
      sub:   "Night / early morning low",
      icon: <CheckCircle />, color: "#a78bfa",
    },
    {
      label: "Delhi Temp",
      value: weatherLoading ? "..." : weather ? `${weather.temp} °C` : "N/A",
      sub:   weatherLoading ? "Fetching..." : weather ? weather.description : "Delhi",
      icon: <Thermostat />, color: "#facc15",
    },
    {
      label: "Dataset Rows",
      value: stats ? Number(stats.total_rows).toLocaleString() : "...",
      sub:   stats ? `${stats.feature_count} features` : "Loading...",
      icon: <TrendingUp />, color: "#22c55e",
    },
    {
      label: "Humidity",
      value: weatherLoading ? "..." : weather ? `${weather.humidity}%` : "N/A",
      sub:   "Live Delhi humidity",
      icon: <ArrowUpward />, color: "#34d399",
    },
  ];

  // ── 12-Hour Time Formatter Helper ────────────────────────────────────────
  const formatTime12h = (timeStr) => {
    if (!timeStr) return "N/A";
    const str = String(timeStr).trim();
    if (/am|pm/i.test(str)) return str;
    const parts = str.split(":");
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return str;
    const minutes = parts[1] ? parts[1].padStart(2, "0").slice(0, 2) : "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // ── Dynamic Alerts Engine ────────────────────────────────────────────────
  const dynamicAlerts = useMemo(() => {
    const list = [];

    // 1. Dispatched Alerts from MySQL database (Logged by Operator)
    if (Array.isArray(dispatchedAlerts) && dispatchedAlerts.length > 0) {
      dispatchedAlerts.slice(0, 4).forEach((da) => {
        const sev = (da.severity || "WARNING").toUpperCase();
        let timeStr = "Recent";
        let dateStr = "";
        if (da.sentAt && typeof da.sentAt === "string") {
          const parts = da.sentAt.replace("T", " ").split(" ");
          dateStr = parts[0] || "";
          timeStr = parts[1]?.slice(0, 5) || "Recent";
        }
        list.push({
          id: `db-${da.id}`,
          category: "broadcast",
          type: sev === "CRITICAL" ? "critical" : sev === "WARNING" ? "warning" : "info",
          source: "OPERATOR BROADCAST",
          title: da.title || "Grid Demand Advisory",
          msg: da.message || "",
          time: timeStr,
          date: dateStr,
          badge: `${da.recipientCount || 0} Managers Notified`,
          operator: da.sentBy || "Grid Operator",
        });
      });
    }

    // 2. ML Peak Demand Forecast Advisory (XGBoost Live Model Prediction)
    if (peakForecast?.peaks?.[0]?.peak_demand) {
      const p = peakForecast.peaks[0];
      const peakDemandNum = Math.round(Number(p.peak_demand) || 0);
      const peakTimeFormatted = formatTime12h(p.peak_hour);
      const isCritical = peakDemandNum >= 6200;
      const isWarning = peakDemandNum >= 5500;

      list.push({
        id: "ml-peak-alert",
        category: "ml",
        type: isCritical ? "critical" : isWarning ? "warning" : "info",
        source: "AI PEAK PREDICTION",
        title: isCritical
          ? "CRITICAL PEAK DEMAND PROJECTED"
          : isWarning
          ? "ELEVATED PEAK DEMAND WARNING"
          : "STABLE PEAK CAPACITY FORECAST",
        msg: `AI Engine forecasts peak demand of ${peakDemandNum.toLocaleString()} MW at ${peakTimeFormatted} today (${p.day || "Today"}). Grid reserve condition: ${
          isCritical ? "Curtailed / High Stress" : isWarning ? "Elevated Monitoring" : "Normal"
        }.`,
        badge: `XGBoost • ${peakTimeFormatted}`,
        time: "Live Model",
      });
    }

    // 3. Live Weather Telemetry & Heat Surge Alert (OpenWeather API)
    if (weather) {
      if (weather.temp >= 38 || weather.feelsLike >= 40) {
        list.push({
          id: "weather-extreme-heat",
          category: "weather",
          type: "critical",
          source: "WEATHER TELEMETRY",
          title: "EXTREME HEATWAVE LOAD SURGE",
          msg: `Delhi temperature is ${weather.temp}°C (feels like ${weather.feelsLike}°C). Expect a 12–18% spike in cooling load across BRPL, BYPL & TPDDL.`,
          badge: `${weather.temp}°C • Humidity ${weather.humidity}%`,
          time: "Live Feed",
        });
      } else if (weather.temp >= 32) {
        list.push({
          id: "weather-elevated",
          category: "weather",
          type: "warning",
          source: "WEATHER TELEMETRY",
          title: "HIGH RESIDENTIAL COOLING LOAD",
          msg: `Current Delhi temperature is ${weather.temp}°C (${weather.description}). Afternoon HVAC usage remains elevated across domestic feeders.`,
          badge: `${weather.temp}°C • ${weather.humidity}% RH`,
          time: "Live Feed",
        });
      } else if (weather.temp <= 15) {
        list.push({
          id: "weather-cold",
          category: "weather",
          type: "info",
          source: "WEATHER TELEMETRY",
          title: "MORNING HEATING LOAD RISE",
          msg: `Current Delhi temperature is ${weather.temp}°C. Morning water geyser and space heating load rise expected between 06:00–09:00.`,
          badge: `${weather.temp}°C`,
          time: "Live Feed",
        });
      }

      if (weather.humidity >= 75) {
        list.push({
          id: "weather-humidity",
          category: "weather",
          type: "warning",
          source: "WEATHER TELEMETRY",
          title: "HIGH HUMID HEAT INDEX",
          msg: `Relative humidity at ${weather.humidity}%. High moisture drives continuous AC compressor runtime across corporate and retail zones.`,
          badge: `${weather.humidity}% Humidity`,
          time: "Live Feed",
        });
      }
    }

    // 4. Live Calendar / Shift Load Advisory
    const today = new Date();
    const isWeekendDay = [0, 6].includes(today.getDay());
    list.push({
      id: "day-schedule",
      category: "schedule",
      type: "info",
      source: "DISPATCH SCHEDULE",
      title: isWeekendDay ? "WEEKEND LOAD REDUCTION" : "WEEKDAY INDUSTRIAL SHIFT ACTIVE",
      msg: isWeekendDay
        ? "Government offices, NDMC, and Connaught Place commercial feeders operating at ~15% lower consumption. Rebalance base-load."
        : "Full commercial & industrial shifts active across Bawana, Narela, Okhla, and Mayapuri zones. Industrial feeders prioritized.",
      badge: isWeekendDay ? "Weekend Curve" : "Weekday Peak Curve",
      time: "Scheduled",
    });

    // 5. Dataset Historical Benchmark
    if (stats) {
      list.push({
        id: "dataset-historical",
        category: "historical",
        type: "info",
        source: "HISTORICAL BENCHMARK",
        title: "ALL-TIME RECORD REFERENCE",
        msg: `Historical peak record stands at ${Number(stats.demand_max).toLocaleString()} MW (${stats.all_time_peak_date}). Historical peak window is ${stats.peak_hour}.`,
        badge: `${Number(stats.total_rows).toLocaleString()} Records`,
        time: "SLDC Benchmark",
      });
    }

    return list;
  }, [dispatchedAlerts, peakForecast, weather, stats]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (alertFilter === "critical") {
      return dynamicAlerts.filter((a) => a.type === "critical" || a.type === "warning");
    }
    if (alertFilter === "broadcast") {
      return dynamicAlerts.filter((a) => a.category === "broadcast");
    }
    if (alertFilter === "ml") {
      return dynamicAlerts.filter((a) => a.category === "ml" || a.category === "weather");
    }
    return dynamicAlerts;
  }, [dynamicAlerts, alertFilter]);

  // ── Predict handler — sends all 21 features ──────────────────────────────
  const handlePredict = async () => {
    setPredicting(true);
    setPredError("");
    setPrediction(null);
    setModelUsed("");
    const now = new Date();

    // Compute lag & rolling features from real recent demand values
    const buf = recentDemand.length >= 168
      ? recentDemand
      : Array(168).fill(stats?.demand_mean || 5500);  // fallback if not loaded yet

    const last3   = buf.slice(-3);
    const last24  = buf.slice(-24);
    const mean3   = last3.reduce((a, b) => a + b, 0) / last3.length;
    const mean24  = last24.reduce((a, b) => a + b, 0) / last24.length;
    const std24   = Math.sqrt(last24.reduce((a, b) => a + (b - mean24) ** 2, 0) / last24.length);
    const max24   = Math.max(...last24);

    const payload = {
      temperature_c:       parseFloat(inputs.temperature)  || weather?.temp      || 30,
      humidity_pct:        parseFloat(inputs.humidity)     || weather?.humidity  || 70,
      apparent_temp_c:     parseFloat(inputs.apparentTemp) || weather?.feelsLike || 32,
      hour:                now.getHours(),
      day_of_week:         (now.getDay() + 6) % 7,   // JS Sun=0 → Python Mon=0
      month:               now.getMonth() + 1,
      is_weekend:          parseInt(inputs.isWeekend) || 0,
      model_name:          inputs.model,
      // Lag features from real dataset values
      DELHI_lag_1h:        buf[buf.length - 1],
      DELHI_lag_2h:        buf[buf.length - 2],
      DELHI_lag_3h:        buf[buf.length - 3],
      DELHI_lag_24h:       buf[buf.length - 24],
      DELHI_lag_48h:       buf.length >= 48 ? buf[buf.length - 48] : buf[0],
      DELHI_lag_168h:      buf[0],
      DELHI_roll_mean_3h:  parseFloat(mean3.toFixed(2)),
      DELHI_roll_mean_24h: parseFloat(mean24.toFixed(2)),
      DELHI_roll_std_24h:  parseFloat(std24.toFixed(2)),
      DELHI_roll_max_24h:  parseFloat(max24.toFixed(2)),
    };
    try {
      const res = await axiosInstance.post("/api/predict", payload);
      setPrediction(res.data.predicted_demand);
      setModelUsed(res.data.model_used || inputs.model);
      setShapData(res.data.shap_explanation || []);
    } catch {
      setPredError("Prediction failed — make sure the ML service (port 8000) is running.");
    } finally {
      setPredicting(false);
    }
  };

  const inp = (label, name, unit, icon) => (
    <Grid item xs={12} sm={6} md={3} lg={2} key={name}>
      <TextField
        label={label} value={inputs[name]}
        onChange={(e) => setInputs({ ...inputs, [name]: e.target.value })}
        fullWidth size="small" sx={fieldSx}
        InputProps={{
          endAdornment: (
            <Typography variant="caption" sx={{ color: "#64748b", whiteSpace: "nowrap" }}>{unit}</Typography>
          ),
        }}
        helperText={
          weather ? (
            <Typography variant="caption" sx={{ color: "#22c55e", fontSize: 10 }}>
              {icon} Live: {name === "temperature" ? weather.temp : name === "humidity" ? weather.humidity : ""} {unit}
            </Typography>
          ) : null
        }
        FormHelperTextProps={{ component: "div" }}
      />
    </Grid>
  );

  const demandTrend     = stats?.demand_trend      || [];
  const dailyPeakData   = stats?.daily_peak_demand || [];

  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} color="white" mb={3}>Overview</Typography>

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
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  Delhi Electricity Demand — Last 10 Days (MW daily avg)
                </Typography>
                {statsLoading && <CircularProgress size={14} sx={{ color: "#38bdf8" }} />}
              </Stack>
              {demandTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={demandTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: "#94a3b8" }} />
                    <Line type="monotone" dataKey="actual"    stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" />
                    <Line type="monotone" dataKey="predicted" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} name="Predicted" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#64748b" }}>
                    {statsLoading ? "Loading dataset..." : "ML service offline — start predict_api.py"}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Daily Peak Demand Chart ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                ⚡ Daily Peak Demand — Last 30 Days (MW)
              </Typography>
              {dailyPeakData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyPeakData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }}
                      interval={4} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW"
                      domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()} MW`, "Peak"]} />
                    <Bar dataKey="peak" fill="#f97316" radius={[4, 4, 0, 0]} name="Peak Demand" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#64748b" }}>
                    {statsLoading ? "Loading..." : "ML service offline"}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Live Weather Card ── */}
        <Grid item xs={12} lg={4}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">🌤 Live Weather — New Delhi</Typography>
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
              ) : weather ? (
                <>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", mb: 2 }}>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>Delhi Live Weather</Typography>
                    <Stack direction="row" spacing={3} mt={0.5}>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#facc15" }}>{weather.temp}°C</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Temperature</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#38bdf8" }}>{weather.humidity}%</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Humidity</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h5" fontWeight={800} sx={{ color: "#22c55e" }}>{weather.feelsLike}°C</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>Feels Like</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 1.5 }} />
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt={weather.description} style={{ width: 48, height: 48 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={700} sx={{ color: "white" }}>New Delhi</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", textTransform: "capitalize" }}>{weather.description}</Typography>
                    </Box>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: "#64748b" }}>Unable to fetch weather data.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Dynamic Alert & Advisory Feed Panel ── */}
        <Grid item xs={12} lg={8}>
          <Card sx={cardSx}>
            <CardContent>
              {/* Header */}
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5} mb={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2,
                      bgcolor: "rgba(250, 204, 21, 0.12)",
                      border: "1px solid rgba(250, 204, 21, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <NotificationsActive sx={{ color: "#facc15", fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} color="white">
                      Live Grid Alert & Advisory Feed
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                      Dynamic dispatch advisories, ML load forecasts & weather telemetry
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label="● LIVE FEED"
                    size="small"
                    sx={{
                      bgcolor: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      fontWeight: 700,
                      fontSize: 10.5,
                      letterSpacing: 0.5,
                    }}
                  />
                  <Chip
                    label={`${filteredAlerts.length} Active`}
                    size="small"
                    sx={{
                      bgcolor: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={fetchAlertsData}
                    disabled={alertsLoading}
                    sx={{
                      color: "#94a3b8",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 1.5,
                      p: 0.6,
                      "&:hover": { color: "#38bdf8", bgcolor: "rgba(56,189,248,0.1)" },
                    }}
                  >
                    <Refresh sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              </Stack>

              {/* Quick Filter Buttons */}
              <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mb: 2 }}>
                {[
                  { id: "all", label: `All (${dynamicAlerts?.length || 0})` },
                  { id: "critical", label: `⚠️ Warnings & Critical (${(dynamicAlerts || []).filter((a) => a.type === "critical" || a.type === "warning").length})` },
                  { id: "broadcast", label: `📢 Operator Broadcasts (${dispatchedAlerts?.length || 0})` },
                  { id: "ml", label: "⚡ ML & Weather" },
                ].map((f) => (
                  <Chip
                    key={f.id}
                    size="small"
                    label={f.label}
                    onClick={() => setAlertFilter(f.id)}
                    sx={{
                      cursor: "pointer",
                      bgcolor: alertFilter === f.id ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.03)",
                      color: alertFilter === f.id ? "#38bdf8" : "#94a3b8",
                      border: `1px solid ${alertFilter === f.id ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                      fontWeight: 700,
                      fontSize: 11,
                      "&:hover": { bgcolor: "rgba(56,189,248,0.1)", color: "white" },
                    }}
                  />
                ))}
              </Box>

              {/* Scrollable Alerts List */}
              <Box sx={{ maxHeight: 380, overflowY: "auto", pr: 0.5 }}>
                {alertsLoading && dynamicAlerts.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: "center" }}>
                    <CircularProgress size={28} sx={{ color: "#38bdf8", mb: 1 }} />
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>
                      Synchronizing live telemetry & alerts...
                    </Typography>
                  </Box>
                ) : filteredAlerts.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: "center", bgcolor: "rgba(255,255,255,0.01)", borderRadius: 2, border: "1px dashed rgba(255,255,255,0.08)" }}>
                    <CheckCircle sx={{ color: "#22c55e", fontSize: 32, mb: 1, opacity: 0.8 }} />
                    <Typography variant="body2" color="white" fontWeight={600}>
                      No active alerts in this category
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      Switch filter to 'All' to view other operational advisories.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {filteredAlerts.map((a) => {
                      const isCrit = a.type === "critical";
                      const isWarn = a.type === "warning";
                      const borderColor = isCrit ? "#ef4444" : isWarn ? "#f59e0b" : "#38bdf8";
                      const bgColor = isCrit ? "rgba(239, 68, 68, 0.08)" : isWarn ? "rgba(245, 158, 11, 0.08)" : "rgba(56, 189, 248, 0.06)";
                      const tagColor = isCrit ? "#f87171" : isWarn ? "#facc15" : "#38bdf8";

                      return (
                        <Box
                          key={a.id}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            bgcolor: bgColor,
                            border: `1px solid ${isCrit ? "rgba(239,68,68,0.3)" : isWarn ? "rgba(245,158,11,0.25)" : "rgba(56,189,248,0.2)"}`,
                            borderLeft: `4px solid ${borderColor}`,
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                              bgcolor: isCrit ? "rgba(239,68,68,0.12)" : isWarn ? "rgba(245,158,11,0.12)" : "rgba(56,189,248,0.1)",
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.8} gap={1}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              {isCrit ? (
                                <ErrorOutlined sx={{ fontSize: 17, color: "#ef4444" }} />
                              ) : isWarn ? (
                                <Warning sx={{ fontSize: 17, color: "#f59e0b" }} />
                              ) : (
                                <Info sx={{ fontSize: 17, color: "#38bdf8" }} />
                              )}
                              <Typography variant="caption" sx={{ color: tagColor, fontWeight: 800, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" }}>
                                [{a.source}]
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="white">
                                {a.title}
                              </Typography>
                            </Stack>

                            {a.badge && (
                              <Chip
                                label={a.badge}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  bgcolor: isCrit ? "rgba(239,68,68,0.2)" : isWarn ? "rgba(245,158,11,0.2)" : "rgba(56,189,248,0.15)",
                                  color: isCrit ? "#fca5a5" : isWarn ? "#fde047" : "#7dd3fc",
                                  border: `1px solid ${isCrit ? "rgba(239,68,68,0.4)" : isWarn ? "rgba(245,158,11,0.35)" : "rgba(56,189,248,0.3)"}`,
                                }}
                              />
                            )}
                          </Stack>

                          <Typography variant="body2" sx={{ color: "#cbd5e1", fontSize: 12.5, lineHeight: 1.5, pl: 3.2 }}>
                            {a.msg}
                          </Typography>

                          {(a.operator || a.date) && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1} pl={3.2}>
                              {a.operator && (
                                <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: 11 }}>
                                  👤 Sent by: <strong style={{ color: "#e2e8f0" }}>{a.operator}</strong>
                                </Typography>
                              )}
                              {a.date && (
                                <Typography variant="caption" sx={{ color: "#64748b", fontSize: 10.5 }}>
                                  {a.date} • {a.time}
                                </Typography>
                              )}
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="caption" sx={{ color: "#64748b" }}>
                  Telemetry Sync: OpenWeather &bull; XGBoost ML Model &bull; MySQL Alert Logs
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", fontSize: 10.5 }}>
                  Last sync: {lastSyncTime instanceof Date && !isNaN(lastSyncTime.getTime()) ? lastSyncTime.toLocaleTimeString() : new Date().toLocaleTimeString()}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>



        {/* ── Predict Demand ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="h6" fontWeight={700} color="white">🔮 Predict Demand</Typography>
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
                Predicts Delhi electricity demand for the{" "}
                <strong style={{ color: "#38bdf8" }}>current hour ({new Date().getHours()}:00 – {new Date().getHours()}:59)</strong>{" "}
                based on live Delhi weather. Fields are auto-filled from the live feed.
              </Typography>

              <Grid container spacing={2} alignItems="flex-start">
                {inp("Temperature",   "temperature",  "°C", "🌡")}
                {inp("Humidity",      "humidity",     "%",  "💧")}
                {inp("Apparent Temp", "apparentTemp", "°C", "🌡")}

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

                <Grid item xs={12} sm={6} md={3} lg={1}>
                  <Button
                    variant="contained" fullWidth onClick={handlePredict} disabled={predicting}
                    sx={{ background: "linear-gradient(90deg,#0ea5e9,#2563eb)", fontWeight: 700, height: 40, minWidth: 110 }}
                  >
                    {predicting ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Predict"}
                  </Button>
                </Grid>

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

              {predError && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Typography variant="body2" sx={{ color: "#f87171" }}>{predError}</Typography>
                </Box>
              )}

              {prediction !== null && (
                <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
                  <Paper sx={{ p: 2.5, borderRadius: 3, background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)", display: "inline-block" }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block", mb: 0.5 }}>
                      🕐 {new Date().getHours()}:00 – {new Date().getHours()}:59 &nbsp;|&nbsp;{" "}
                      {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)" }}>Predicted Demand for this hour</Typography>
                    <Typography variant="h4" fontWeight={800} color="white">
                      {Number(prediction).toLocaleString()} MW
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Model: {modelUsed || inputs.model}
                    </Typography>
                  </Paper>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {[
                      { label: `🌡 ${inputs.temperature}°C`, color: "#facc15" },
                      { label: `💧 ${inputs.humidity}%`,     color: "#38bdf8" },
                      { label: `🌡 ${inputs.apparentTemp}°C feels like`, color: "#22c55e" },
                    ].map((c) => (
                      <Chip key={c.label} label={c.label} size="small"
                        sx={{ bgcolor: "rgba(255,255,255,0.05)", color: c.color, border: `1px solid ${c.color}33`, fontSize: 11 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {shapData.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ color: "#a78bfa", mb: 1 }}>
                    🔍 Why this prediction? — Top Feature Contributions (SHAP)
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={[...shapData].reverse()} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }}
                        label={{ value: "SHAP contribution (MW)", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }} />
                      <YAxis type="category" dataKey="feature" stroke="#64748b"
                        tick={{ fill: "#94a3b8", fontSize: 11 }} width={160} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v) => [`${v > 0 ? "+" : ""}${v.toFixed(4)}`, "SHAP value"]} />
                      <Bar dataKey="shap_value" radius={[0, 4, 4, 0]} name="SHAP">
                        {[...shapData].reverse().map((d, i) => (
                          <Cell key={i} fill={d.shap_value >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    🟢 Green = increases predicted demand &nbsp;|&nbsp; 🔴 Red = decreases predicted demand
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
