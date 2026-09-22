import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip, Button,
  TextField, MenuItem, CircularProgress, Alert, Table, TableHead,
  TableRow, TableCell, TableBody, TablePagination, Tooltip as MuiTooltip,
  Divider, InputAdornment, IconButton
} from "@mui/material";
import {
  ElectricCar, Bolt, EvStation, BatteryChargingFull, TrendingDown,
  Power, ArrowUpward, ArrowDownward, CheckCircle, WarningAmber,
  Search, Refresh, Tune
} from "@mui/icons-material";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell
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

const tooltipStyle = {
  background: "#1e293b",
  border: "none",
  borderRadius: 8,
  color: "white",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  fontSize: "12px",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "white",
    bgcolor: "rgba(15, 23, 42, 0.6)",
    "& fieldset":             { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset":       { borderColor: "#38bdf8" },
    "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
  },
  "& .MuiInputLabel-root":             { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
  "& .MuiInputBase-input":             { colorScheme: "dark" },
};

const SAMPLE_DATES = [
  { label: "10 Aug (Summer Peak)", value: "2026-08-10" },
  { label: "15 Jun (Heatwave)",    value: "2026-06-15" },
  { label: "20 Jul (Monsoon)",     value: "2026-07-20" },
  { label: "15 Jan (Winter High)", value: "2026-01-15" },
];

export default function V2GOptimization() {
  const [date, setDate] = useState("2026-08-10");
  const [modelName, setModelName] = useState("xgboost");
  const [efficiency, setEfficiency] = useState(0.90);
  const [fleetMultiplier, setFleetMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [v2gData, setV2gData] = useState(null);

  // EV table state
  const [evPage, setEvPage] = useState(0);
  const [evRowsPerPage, setEvRowsPerPage] = useState(10);
  const [evSearch, setEvSearch] = useState("");
  const [evActionFilter, setEvActionFilter] = useState("ALL");
  const [evHourFilter, setEvHourFilter] = useState("ALL");

  const runOptimization = async (customDate, customModel, customMult) => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        date: customDate || date,
        modelName: customModel || modelName,
        efficiency: parseFloat(efficiency),
        fleetMultiplier: parseInt(customMult !== undefined ? customMult : fleetMultiplier, 10),
      };
      const res = await axiosInstance.post("/api/v2g/optimize", payload);
      setV2gData(res.data);
    } catch (err) {
      console.error("V2G optimization error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to run V2G optimization";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runOptimization("2026-08-10", "xgboost", 1);
  }, []);

  const hourlyResults = v2gData?.hourlyResults || [];
  const evDecisions = v2gData?.evDecisions || [];

  // Transform hourly results for research-ready graphs
  const researchChartData = useMemo(() => {
    return hourlyResults.map((row) => {
      const hStr = `${String(row.hour).padStart(2, "0")}:00`;
      const multiplier = v2gData?.fleetMultiplier || 1;
      const chargingMw = Number(((row.evChargingPowerKw * multiplier) / 1000.0).toFixed(4));
      const dischargingMw = Number(((row.evDischargingPowerKw * multiplier) / 1000.0).toFixed(4));
      return {
        ...row,
        hourLabel: hStr,
        forecastDemandBeforeV2g: row.forecastedDemandMw,
        gridDemandAfterV2g: row.gridDemandAfterV2gMw,
        chargingPowerMw: chargingMw,
        dischargingPowerMw: dischargingMw,
        avgFleetSoc: row.averageSoc,
      };
    });
  }, [hourlyResults, v2gData]);

  // Filter EV decisions
  const filteredEvDecisions = useMemo(() => {
    return evDecisions.filter((d) => {
      const matchSearch = evSearch === "" || d.evId.toLowerCase().includes(evSearch.toLowerCase());
      const matchAction = evActionFilter === "ALL" || d.action === evActionFilter;
      const matchHour = evHourFilter === "ALL" || d.hour === parseInt(evHourFilter, 10);
      return matchSearch && matchAction && matchHour;
    });
  }, [evDecisions, evSearch, evActionFilter, evHourFilter]);

  const kpis = v2gData
    ? [
        {
          label: "Peak Before V2G",
          value: `${v2gData.peakBeforeV2gMw?.toLocaleString()} MW`,
          sub: "Baseline Forecast Peak",
          color: "#f97316",
          icon: <ArrowUpward sx={{ fontSize: 22, color: "#f97316" }} />,
        },
        {
          label: "Peak After V2G",
          value: `${v2gData.peakAfterV2gMw?.toLocaleString()} MW`,
          sub: "Grid Demand After V2G",
          color: "#38bdf8",
          icon: <Bolt sx={{ fontSize: 22, color: "#38bdf8" }} />,
        },
        {
          label: "Peak Reduction",
          value: `${v2gData.peakReductionMw} MW (${v2gData.peakReductionPct}%)`,
          sub: "Peak Demand Shaved",
          color: "#22c55e",
          icon: <TrendingDown sx={{ fontSize: 22, color: "#22c55e" }} />,
        },
        {
          label: "Total Discharged",
          value: `${v2gData.totalDischargingEnergyKwh?.toLocaleString()} kWh`,
          sub: `${v2gData.totalDischargingEnergyMwh} MWh grid feed-in`,
          color: "#10b981",
          icon: <Power sx={{ fontSize: 22, color: "#10b981" }} />,
        },
        {
          label: "Total Charged",
          value: `${v2gData.totalChargingEnergyKwh?.toLocaleString()} kWh`,
          sub: `${v2gData.totalChargingEnergyMwh} MWh off-peak load`,
          color: "#a78bfa",
          icon: <BatteryChargingFull sx={{ fontSize: 22, color: "#a78bfa" }} />,
        },
        {
          label: "Participating EVs",
          value: `${v2gData.participatingEvCount} / 100`,
          sub: `${v2gData.dischargingEvCount} discharged • ${v2gData.chargingEvCount} charged`,
          color: "#facc15",
          icon: <EvStation sx={{ fontSize: 22, color: "#facc15" }} />,
        },
      ]
    : [];

  return (
    <DashboardLayout>
      {/* Header Banner */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: "rgba(56, 189, 248, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(56, 189, 248, 0.25)",
              }}
            >
              <ElectricCar sx={{ color: "#38bdf8", fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700} color="white">
                Vehicle-to-Grid (V2G) Optimization
              </Typography>
              <Typography variant="body2" color="#94a3b8">
                Coordinated smart charging & bidirectional peak shaving for 100 EV fleet
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {SAMPLE_DATES.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              size="small"
              onClick={() => {
                setDate(item.value);
                runOptimization(item.value, modelName, fleetMultiplier);
              }}
              sx={{
                bgcolor: date === item.value ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.05)",
                color: date === item.value ? "#38bdf8" : "#cbd5e1",
                border: "1px solid",
                borderColor: date === item.value ? "#38bdf8" : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(56, 189, 248, 0.15)" },
              }}
            />
          ))}
        </Stack>
      </Stack>

      {/* Control Bar Card */}
      <Card sx={{ ...cardSx, mb: 3, p: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Forecast Date"
              type="date"
              size="small"
              fullWidth
              value={date}
              onChange={(e) => setDate(e.target.value)}
              sx={fieldSx}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              label="Forecasting Model"
              select
              size="small"
              fullWidth
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              sx={fieldSx}
            >
              <MenuItem value="xgboost">XGBoost (Default)</MenuItem>
              <MenuItem value="random_forest">Random Forest</MenuItem>
              <MenuItem value="hybrid">Hybrid (Transformer+BiLSTM+XGB)</MenuItem>
              <MenuItem value="bilstm">Bi-LSTM</MenuItem>
              <MenuItem value="lstm">LSTM</MenuItem>
              <MenuItem value="linear">Linear Regression</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              label="Fleet Scale Multiplier"
              select
              size="small"
              fullWidth
              value={fleetMultiplier}
              onChange={(e) => setFleetMultiplier(e.target.value)}
              sx={fieldSx}
              helperText="Scale impact on macro grid"
              FormHelperTextProps={{ sx: { color: "#64748b", fontSize: "10px" } }}
            >
              <MenuItem value={1}>1× (Actual 100 EVs)</MenuItem>
              <MenuItem value={10}>10× (1,000 EVs)</MenuItem>
              <MenuItem value={100}>100× (10,000 EVs)</MenuItem>
              <MenuItem value={1000}>1,000× (100,000 EVs)</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Roundtrip Efficiency"
              select
              size="small"
              fullWidth
              value={efficiency}
              onChange={(e) => setEfficiency(e.target.value)}
              sx={fieldSx}
            >
              <MenuItem value={0.85}>85% Efficiency</MenuItem>
              <MenuItem value={0.90}>90% (Standard)</MenuItem>
              <MenuItem value={0.95}>95% (High Efficiency)</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              disabled={loading}
              onClick={() => runOptimization()}
              sx={{
                bgcolor: "#38bdf8",
                color: "#0f172a",
                fontWeight: 700,
                py: 1,
                borderRadius: 2,
                textTransform: "none",
                "&:hover": { bgcolor: "#0284c7" },
              }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Bolt />}
            >
              {loading ? "Optimizing..." : "Run V2G"}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>
            {error}
          </Alert>
        )}
      </Card>

      {/* KPI Cards */}
      {v2gData && (
        <Grid container spacing={2} mb={3}>
          {kpis.map((kpi, idx) => (
            <Grid item xs={12} sm={6} md={2} key={idx}>
              <Card sx={{ ...cardSx, p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600 }}>
                    {kpi.label}
                  </Typography>
                  {kpi.icon}
                </Stack>
                <Typography variant="h6" sx={{ color: kpi.color, fontWeight: 700, lineHeight: 1.2 }}>
                  {kpi.value}
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", mt: 0.5, display: "block" }}>
                  {kpi.sub}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Research-Ready Charts Section */}
      {v2gData && (
        <Grid container spacing={3} mb={3}>
          {/* Graph 1: Demand Before vs After V2G (Line chart) */}
          <Grid item xs={12}>
            <Card sx={{ ...cardSx, p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="white">
                    1. Demand Before vs After V2G
                  </Typography>
                  <Typography variant="caption" color="#94a3b8">
                    24-hour grid demand comparison: Forecast Demand Before V2G vs. Grid Demand After V2G (MW)
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Chip
                    label={`Peak Before: ${v2gData.peakBeforeV2gMw?.toLocaleString()} MW`}
                    size="small"
                    sx={{ bgcolor: "rgba(249, 115, 22, 0.15)", color: "#f97316", fontWeight: 600, border: "1px solid rgba(249, 115, 22, 0.3)" }}
                  />
                  <Chip
                    label={`Peak After: ${v2gData.peakAfterV2gMw?.toLocaleString()} MW`}
                    size="small"
                    sx={{ bgcolor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 600, border: "1px solid rgba(56, 189, 248, 0.3)" }}
                  />
                  <Chip
                    label={`Peak Reduction: ${v2gData.peakReductionMw} MW (${v2gData.peakReductionPct}%)`}
                    size="small"
                    sx={{ bgcolor: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontWeight: 600, border: "1px solid rgba(34, 197, 94, 0.3)" }}
                  />
                </Stack>
              </Stack>
              <Box sx={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={researchChartData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                      dataKey="hourLabel"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      domain={['auto', 'auto']}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `${Math.round(v)} MW`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val, name) => [`${Number(val).toFixed(2)} MW`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "8px" }} />
                    <ReferenceLine
                      y={v2gData.peakBeforeV2gMw}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                      label={{ value: `Peak Before (${v2gData.peakBeforeV2gMw} MW)`, fill: '#f97316', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <ReferenceLine
                      y={v2gData.peakAfterV2gMw}
                      stroke="#38bdf8"
                      strokeDasharray="4 4"
                      label={{ value: `Peak After (${v2gData.peakAfterV2gMw} MW)`, fill: '#38bdf8', fontSize: 10, position: 'insideBottomRight' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecastDemandBeforeV2g"
                      name="Forecast Demand Before V2G"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#f97316' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gridDemandAfterV2g"
                      name="Grid Demand After V2G"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#38bdf8' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          {/* Graph 2: EV Charging / Discharging Power (MW) */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ ...cardSx, p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="white">
                    2. EV Charging / Discharging Power
                  </Typography>
                  <Typography variant="caption" color="#94a3b8">
                    Hourly active power dispatch: Charging load vs. Discharging feed-in (MW)
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Chip
                    label={`Total Charged: ${v2gData.totalChargingEnergyMwh} MWh`}
                    size="small"
                    sx={{ bgcolor: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", fontWeight: 600, fontSize: "11px" }}
                  />
                  <Chip
                    label={`Total Discharged: ${v2gData.totalDischargingEnergyMwh} MWh`}
                    size="small"
                    sx={{ bgcolor: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontWeight: 600, fontSize: "11px" }}
                  />
                </Stack>
              </Stack>
              <Box sx={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={researchChartData} margin={{ top: 15, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                      dataKey="hourLabel"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `${Number(v).toFixed(2)} MW`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val, name) => [
                        `${Number(val).toFixed(4)} MW (${(Number(val) * 1000).toFixed(1)} kW)`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "8px" }} />
                    <Bar
                      dataKey="chargingPowerMw"
                      name="Charging Power"
                      fill="#38bdf8"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="dischargingPowerMw"
                      name="Discharging Power"
                      fill="#10b981"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>

          {/* Graph 3: Fleet State of Charge (SoC %) */}
          <Grid item xs={12} lg={6}>
            <Card sx={{ ...cardSx, p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="white">
                    3. Fleet State of Charge
                  </Typography>
                  <Typography variant="caption" color="#94a3b8">
                    Average fleet SoC trajectory across 24 hours with 20% minimum safety limit
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                  <Chip
                    label={`Average SoC: ${v2gData.averageSoc}%`}
                    size="small"
                    sx={{ bgcolor: "rgba(250, 204, 21, 0.12)", color: "#facc15", fontWeight: 600, fontSize: "11px" }}
                  />
                  <Chip
                    label="Min Safe Limit: 20%"
                    size="small"
                    sx={{ bgcolor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", fontWeight: 600, fontSize: "11px" }}
                  />
                </Stack>
              </Stack>
              <Box sx={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={researchChartData} margin={{ top: 15, right: 25, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis
                      dataKey="hourLabel"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      domain={[0, 100]}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val) => [`${Number(val).toFixed(1)}%`, "Average Fleet SoC"]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "8px" }} />
                    <ReferenceLine
                      y={20}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: "20% Minimum Safe SoC Limit",
                        fill: "#ef4444",
                        fontSize: 11,
                        position: "insideTopLeft",
                        fontWeight: 600,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgFleetSoc"
                      name="Average Fleet SoC"
                      stroke="#facc15"
                      strokeWidth={3}
                      dot={{ r: 3.5, fill: "#facc15" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Hourly Summary Table (Phase 11) */}
      {v2gData && (
        <Card sx={{ ...cardSx, p: 2.5, mb: 3 }}>
          <Box mb={2}>
            <Typography variant="subtitle1" fontWeight={700} color="white">
              Hourly 24-Hour V2G Dispatch Summary
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Hourly breakdown of grid demand, EV active power response, and fleet state
            </Typography>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.08)", fontWeight: 700 } }}>
                  <TableCell>Hour</TableCell>
                  <TableCell>Forecast Demand (MW)</TableCell>
                  <TableCell>Charging Power (kW)</TableCell>
                  <TableCell>Discharging Power (kW)</TableCell>
                  <TableCell>Grid Demand After V2G (MW)</TableCell>
                  <TableCell>Charging EVs</TableCell>
                  <TableCell>Discharging EVs</TableCell>
                  <TableCell>Idle EVs</TableCell>
                  <TableCell>Avg SoC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hourlyResults.map((row) => (
                  <TableRow
                    key={row.hour}
                    sx={{
                      bgcolor: row.isPeakHour ? "rgba(249, 115, 22, 0.05)" : "transparent",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                      "& td": { borderColor: "rgba(255,255,255,0.06)", color: "white" },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {String(row.hour).padStart(2, "0")}:00
                        </Typography>
                        {row.isPeakHour && (
                          <Chip label="PEAK" size="small" sx={{ height: 18, fontSize: 9, bgcolor: "#ef4444", color: "white", fontWeight: 700 }} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{row.forecastedDemandMw?.toFixed(1)}</TableCell>
                    <TableCell sx={{ color: "#a78bfa" }}>{row.evChargingPowerKw?.toFixed(1)}</TableCell>
                    <TableCell sx={{ color: "#10b981", fontWeight: row.evDischargingPowerKw > 0 ? 700 : 400 }}>
                      {row.evDischargingPowerKw?.toFixed(1)}
                    </TableCell>
                    <TableCell sx={{ color: "#38bdf8", fontWeight: 700 }}>
                      {row.gridDemandAfterV2gMw?.toFixed(1)}
                    </TableCell>
                    <TableCell>{row.numberOfChargingEVs}</TableCell>
                    <TableCell sx={{ color: "#10b981", fontWeight: row.numberOfDischargingEVs > 0 ? 700 : 400 }}>
                      {row.numberOfDischargingEVs}
                    </TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>{row.numberOfIdleEVs}</TableCell>
                    <TableCell>{row.averageSoc?.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* EV-Level Decisions Table (Phase 11) */}
      {v2gData && (
        <Card sx={{ ...cardSx, p: 2.5, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="white">
                EV-Level Optimization Decisions
              </Typography>
              <Typography variant="caption" color="#94a3b8">
                Detailed action and SoC trajectory for each individual EV ({filteredEvDecisions.length} records)
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <TextField
                placeholder="Search EV ID (e.g. EV_0001)"
                size="small"
                value={evSearch}
                onChange={(e) => { setEvSearch(e.target.value); setEvPage(0); }}
                sx={{ ...fieldSx, width: 220 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: "#94a3b8", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                select
                size="small"
                label="Hour"
                value={evHourFilter}
                onChange={(e) => { setEvHourFilter(e.target.value); setEvPage(0); }}
                sx={{ ...fieldSx, width: 110 }}
              >
                <MenuItem value="ALL">All Hours</MenuItem>
                {Array.from({ length: 24 }).map((_, i) => (
                  <MenuItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")}:00
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Action"
                value={evActionFilter}
                onChange={(e) => { setEvActionFilter(e.target.value); setEvPage(0); }}
                sx={{ ...fieldSx, width: 140 }}
              >
                <MenuItem value="ALL">All Actions</MenuItem>
                <MenuItem value="DISCHARGE">DISCHARGE</MenuItem>
                <MenuItem value="CHARGE">CHARGE</MenuItem>
                <MenuItem value="IDLE">IDLE</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.08)", fontWeight: 700 } }}>
                  <TableCell>EV ID</TableCell>
                  <TableCell>Hour</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>V2G Capable</TableCell>
                  <TableCell>Initial SoC</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Power (kW)</TableCell>
                  <TableCell>Final SoC</TableCell>
                  <TableCell>Departure SoC Target</TableCell>
                  <TableCell>Arrival / Departure</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvDecisions
                  .slice(evPage * evRowsPerPage, evPage * evRowsPerPage + evRowsPerPage)
                  .map((ev, idx) => {
                    const actionColor =
                      ev.action === "DISCHARGE"
                        ? "#10b981"
                        : ev.action === "CHARGE"
                        ? "#38bdf8"
                        : "#64748b";
                    const actionBg =
                      ev.action === "DISCHARGE"
                        ? "rgba(16, 185, 129, 0.15)"
                        : ev.action === "CHARGE"
                        ? "rgba(56, 189, 248, 0.15)"
                        : "rgba(255, 255, 255, 0.05)";

                    return (
                      <TableRow
                        key={`${ev.evId}-${ev.hour}-${idx}`}
                        sx={{
                          "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                          "& td": { borderColor: "rgba(255,255,255,0.06)", color: "white" },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600, color: "#38bdf8" }}>{ev.evId}</TableCell>
                        <TableCell>{String(ev.hour).padStart(2, "0")}:00</TableCell>
                        <TableCell>
                          <Chip
                            label={ev.connected ? "Connected" : "Unplugged"}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              bgcolor: ev.connected ? "rgba(34, 197, 94, 0.12)" : "rgba(100, 116, 139, 0.15)",
                              color: ev.connected ? "#22c55e" : "#94a3b8",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ev.v2gEnabled ? "V2G Enabled" : "Disabled"}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              bgcolor: ev.v2gEnabled ? "rgba(56, 189, 248, 0.12)" : "rgba(239, 68, 68, 0.12)",
                              color: ev.v2gEnabled ? "#38bdf8" : "#f87171",
                            }}
                          />
                        </TableCell>
                        <TableCell>{ev.initialSoc?.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Chip
                            label={ev.action}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: 11,
                              bgcolor: actionBg,
                              color: actionColor,
                              border: `1px solid ${actionColor}33`,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: ev.powerKw > 0 ? 600 : 400, color: ev.powerKw > 0 ? actionColor : "#94a3b8" }}>
                          {ev.powerKw > 0 ? `${ev.powerKw.toFixed(1)} kW` : "—"}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{ev.finalSoc?.toFixed(1)}%</TableCell>
                        <TableCell sx={{ color: "#facc15" }}>≥ {ev.socRequiredPct?.toFixed(1)}%</TableCell>
                        <TableCell sx={{ color: "#94a3b8" }}>
                          {String(ev.arrivalHour).padStart(2, "0")}:00 → {String(ev.departureHour).padStart(2, "0")}:00
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Box>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={filteredEvDecisions.length}
            rowsPerPage={evRowsPerPage}
            page={evPage}
            onPageChange={(_, newPage) => setEvPage(newPage)}
            onRowsPerPageChange={(e) => {
              setEvRowsPerPage(parseInt(e.target.value, 10));
              setEvPage(0);
            }}
            sx={{
              color: "#94a3b8",
              "& .MuiSvgIcon-root": { color: "#94a3b8" },
              "& .MuiTablePagination-select": { color: "white" },
            }}
          />
        </Card>
      )}
    </DashboardLayout>
  );
}
