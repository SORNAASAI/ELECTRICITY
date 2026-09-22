import React, { useEffect, useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, CircularProgress,
  ToggleButton, ToggleButtonGroup, Button, Alert, Snackbar, Tooltip as MuiTooltip,
} from "@mui/material";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";
import emailjs from "@emailjs/browser";
import { getUser, isOperator } from "../api/authService";

const EMAILJS_SERVICE_ID = "service_mc2eoao";
const EMAILJS_TEMPLATE_ID = "template_a33zq9h";
const EMAILJS_PUBLIC_KEY = "2W6cKKmGUrTp-IRbC";

export const formatPeakTime12Hour = (timeStr) => {
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

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};
const tooltipStyle = { background: "#1e293b", border: "none", borderRadius: 8, color: "white" };

export default function PeakDemand() {
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [peakForecast, setPeakForecast] = useState(null);
  const [pfLoading,    setPfLoading]    = useState(true);
  const [pfDays,       setPfDays]       = useState(3);
  const [pfModel,      setPfModel]      = useState("xgboost");
  const [selectedDay,  setSelectedDay]  = useState(0);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState({ open: false, severity: "success", message: "" });

  useEffect(() => {
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    } catch (e) {
      console.warn("EmailJS init note:", e);
    }
  }, []);

  useEffect(() => {
    setPfLoading(true);
    setPeakForecast(null);
    setSelectedDay(0);
    axiosInstance.get(`/api/predict/forecast/peak?model_name=${pfModel}&days=${pfDays}`)
      .then((r) => setPeakForecast(r.data))
      .catch(() => {})
      .finally(() => setPfLoading(false));
  }, [pfModel, pfDays]);

  const handleSendAlertToManagers = async () => {
    if (!peakForecast || !peakForecast.peaks || peakForecast.peaks.length === 0) {
      setAlertFeedback({
        open: true,
        severity: "error",
        message: "Peak demand forecast data is not available yet.",
      });
      return;
    }

    if (!isOperator()) {
      setAlertFeedback({
        open: true,
        severity: "warning",
        message: "Access Denied: Only Grid Operators are authorized to dispatch alerts to station managers.",
      });
      return;
    }

    const currentPeak = peakForecast.peaks[selectedDay] || peakForecast.peaks[0];
    const peakTime12 = formatPeakTime12Hour(currentPeak.peak_hour);
    const formattedDemand = `${Number(currentPeak.peak_demand).toLocaleString()} MW`;
    const alertLevel =
      currentPeak.peak_demand >= 6200
        ? "CRITICAL"
        : currentPeak.peak_demand >= 5500
        ? "HIGH"
        : "WARNING";

    const currentUser = getUser();
    const operatorName = currentUser?.name ? `${currentUser.name} (Grid Operator)` : "Grid Operator";

    setSendingAlerts(true);
    setAlertFeedback({ open: false, severity: "info", message: "" });

    try {
      // 1. Fetch approved managers from the manager table
      const res = await axiosInstance.get("/api/managers");
      const managers = res.data || [];

      if (managers.length === 0) {
        setAlertFeedback({
          open: true,
          severity: "warning",
          message: "No approved station managers found in the manager table to receive alerts.",
        });
        setSendingAlerts(false);
        return;
      }

      // 2. Dispatch email to each approved manager using EmailJS
      let sentCount = 0;
      const failedManagers = [];

      try {
        emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      } catch (_) {}

      for (const mgr of managers) {
        const templateParams = {
          name: mgr.name,
          to_name: mgr.name,
          manager_name: mgr.name,
          operator: operatorName,
          operator_name: operatorName,
          from_name: operatorName,
          station: mgr.stationName || "EV Station",
          station_name: mgr.stationName || "EV Station",
          alert_level: alertLevel,
          severity: alertLevel,
          predicted_demand: formattedDemand,
          peak_demand: formattedDemand,
          peak_time: peakTime12,
          peak_hour: peakTime12,
          date: currentPeak.date,
          day: currentPeak.day,
          email: mgr.email,
          to_email: mgr.email,
          reply_to: currentUser?.email || "operator@delhi.gov.in",
          message: `Grid Peak Alert: Predicted peak demand of ${formattedDemand} expected at ${peakTime12} on ${currentPeak.date} (${currentPeak.day}). Station: ${mgr.stationName}. Alert Level: ${alertLevel}.`,
        };

        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            { publicKey: EMAILJS_PUBLIC_KEY }
          );
          sentCount++;
        } catch (err) {
          console.error(`EmailJS failed for manager ${mgr.email}:`, err);
          const errReason =
            err?.text ||
            err?.message ||
            (typeof err === "string" ? err : JSON.stringify(err)) ||
            "Network / Service Error";
          const errCode = err?.status ? ` [HTTP ${err.status}]` : "";
          failedManagers.push({
            name: mgr.name,
            email: mgr.email,
            reason: `${errReason}${errCode}`,
          });
        }
      }

      // 3. Log alert to backend repository
      try {
        await axiosInstance.post("/api/managers/alerts", {
          title: `Peak Alert: ${formattedDemand} at ${peakTime12}`,
          message: `Alert dispatched to ${sentCount} station managers. Predicted Peak: ${formattedDemand} at ${peakTime12} (${currentPeak.date}). Alert Level: ${alertLevel}.`,
          severity: alertLevel,
        });
      } catch (logErr) {
        console.warn("Backend alert logging note:", logErr);
      }

      // 4. Set feedback message
      if (sentCount > 0) {
        const partialWarning =
          failedManagers.length > 0
            ? ` (${failedManagers.length} failed: ${failedManagers
                .map((f) => `${f.name}: ${f.reason}`)
                .join("; ")})`
            : "";
        setAlertFeedback({
          open: true,
          severity: failedManagers.length > 0 ? "warning" : "success",
          message: `Alert successfully sent to ${sentCount} approved station manager${
            sentCount > 1 ? "s" : ""
          } via EmailJS! Peak Time: ${peakTime12} | Demand: ${formattedDemand} | Level: ${alertLevel}${partialWarning}`,
        });
      } else {
        const failureDetails = failedManagers
          .map((f) => `${f.name} (${f.email}): ${f.reason}`)
          .join(" | ");
        setAlertFeedback({
          open: true,
          severity: "error",
          message: `EmailJS dispatch failed: ${
            failureDetails ||
            "Unable to reach EmailJS. If you have an Ad-Blocker or Brave Shields active, please disable it for localhost, or check your EmailJS dashboard."
          }`,
        });
      }
    } catch (err) {
      console.error("Error dispatching alerts to managers:", err);
      setAlertFeedback({
        open: true,
        severity: "error",
        message:
          "Error sending alerts to managers: " +
          (err.response?.data?.message || err.message || "Unknown error"),
      });
    } finally {
      setSendingAlerts(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
          <CircularProgress sx={{ color: "#38bdf8" }} />
        </Box>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
          <Typography sx={{ color: "#64748b" }}>ML service offline — start predict_api.py on port 8000.</Typography>
        </Box>
      </DashboardLayout>
    );
  }

  const annualPeaks       = stats.annual_peaks       || [];
  const monthlyPeaks      = stats.monthly_peaks      || [];
  const hourlyPeakProfile = stats.hourly_peak_profile || [];
  const peakEvents        = stats.peak_events        || [];
  const cagr              = stats.cagr_data          || [];

  // Dynamic colour thresholds based on actual data range
  const peakMax  = Math.max(...monthlyPeaks.map((d) => d.peak), 1);
  const peakHigh = peakMax * 0.9;
  const peakMid  = peakMax * 0.75;

  const hourPeakMax  = Math.max(...hourlyPeakProfile.map((d) => d.peak), 1);
  const hourPeakHigh = hourPeakMax * 0.85;

  // YoY growth between last two annual peaks
  const yoyGrowth = annualPeaks.length >= 2
    ? (((annualPeaks.at(-1).peak - annualPeaks.at(-2).peak) / annualPeaks.at(-2).peak) * 100).toFixed(1)
    : null;

  const kpis = [
    {
      label: "All-Time Peak",
      value: `${Number(stats.demand_max).toLocaleString()} MW`,
      sub:   stats.all_time_peak_date,
      color: "#f97316",
    },
    {
      label: "Peak Month",
      value: stats.peak_month,
      sub:   `${stats.peak_month_year} — Avg ${Number(stats.peak_month_avg).toLocaleString()} MW`,
      color: "#ef4444",
    },
    {
      label: "Historical Peak Hour",
      value: stats.peak_hour,
      sub:   `All-Time Avg: ${Number(stats.peak_hour_avg).toLocaleString()} MW`,
      color: "#facc15",
    },
    {
      label: "YoY Peak Growth",
      value: yoyGrowth !== null ? `${yoyGrowth > 0 ? "+" : ""}${yoyGrowth}%` : "—",
      sub:   annualPeaks.length >= 2 ? `${annualPeaks.at(-2).year} → ${annualPeaks.at(-1).year}` : "",
      color: "#22c55e",
    },
  ];

  const dateRange = `${stats.date_min?.slice(0, 4)} – ${stats.date_max?.slice(0, 4)}`;

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">Peak Demand Analysis</Typography>
        <Chip
          label={`Dataset: ${dateRange}`}
          size="small"
          sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontSize: 11 }}
        />
      </Stack>

      <Grid container spacing={3}>

        {/* ── Predicted Peak Demand — Next N Days ── */}
        <Grid item xs={12}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2} mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">
                  ⚡ Predicted Peak Demand — Next {pfDays} Day{pfDays > 1 ? "s" : ""}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" gap={1} alignItems="center">
                  {isOperator() ? (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSendAlertToManagers}
                      disabled={sendingAlerts || pfLoading || !peakForecast}
                      sx={{
                        bgcolor: "#f97316",
                        color: "white",
                        fontWeight: 700,
                        textTransform: "none",
                        fontSize: 12.5,
                        px: 2,
                        py: 0.7,
                        borderRadius: 2,
                        boxShadow: "0 0 15px rgba(249,115,22,0.35)",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          bgcolor: "#ea580c",
                          boxShadow: "0 0 20px rgba(249,115,22,0.6)",
                          transform: "translateY(-1px)",
                        },
                        "&:disabled": {
                          bgcolor: "rgba(249,115,22,0.3)",
                          color: "rgba(255,255,255,0.5)",
                        },
                      }}
                    >
                      {sendingAlerts ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={14} sx={{ color: "white" }} />
                          <span>Sending Alerts...</span>
                        </Stack>
                      ) : (
                        "📧 Send Alert to Managers"
                      )}
                    </Button>
                  ) : (
                    <MuiTooltip title="Only Grid Operators are authorized to dispatch alerts to station managers" arrow>
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          disabled
                          sx={{
                            color: "#94a3b8 !important",
                            borderColor: "rgba(255,255,255,0.15) !important",
                            fontSize: 12,
                            textTransform: "none",
                            borderRadius: 2,
                            px: 1.5,
                            py: 0.7,
                          }}
                        >
                          🔒 Operator Alert Only
                        </Button>
                      </span>
                    </MuiTooltip>
                  )}
                  <ToggleButtonGroup value={pfDays} exclusive onChange={(_, v) => v && setPfDays(v)} size="small"
                    sx={{ "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", px: 2 },
                          "& .Mui-selected": { color: "#f97316 !important", bgcolor: "rgba(249,115,22,0.1) !important" } }}>
                    {[1, 2, 3, 5].map((d) => <ToggleButton key={d} value={d}>{d}D</ToggleButton>)}
                  </ToggleButtonGroup>
                  <ToggleButtonGroup value={pfModel} exclusive onChange={(_, v) => v && setPfModel(v)} size="small"
                    sx={{ "& .MuiToggleButton-root": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", px: 1.5, fontSize: 11 },
                          "& .Mui-selected": { color: "#a78bfa !important", bgcolor: "rgba(167,139,250,0.1) !important" } }}>
                    {["xgboost", "random_forest", "hybrid", "bilstm"].map((m) => (
                      <ToggleButton key={m} value={m}>{m}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>
              </Stack>

              {alertFeedback.open && (
                <Alert
                  severity={alertFeedback.severity}
                  onClose={() => setAlertFeedback((prev) => ({ ...prev, open: false }))}
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor:
                      alertFeedback.severity === "success"
                        ? "rgba(34,197,94,0.4)"
                        : alertFeedback.severity === "warning"
                        ? "rgba(234,179,8,0.4)"
                        : "rgba(239,68,68,0.4)",
                    bgcolor:
                      alertFeedback.severity === "success"
                        ? "rgba(34,197,94,0.12)"
                        : alertFeedback.severity === "warning"
                        ? "rgba(234,179,8,0.12)"
                        : "rgba(239,68,68,0.12)",
                    color: "white",
                    fontWeight: 500,
                    "& .MuiAlert-icon": {
                      color:
                        alertFeedback.severity === "success"
                          ? "#22c55e"
                          : alertFeedback.severity === "warning"
                          ? "#eab308"
                          : "#ef4444",
                    },
                  }}
                >
                  {alertFeedback.message}
                </Alert>
              )}

              {pfLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress sx={{ color: "#f97316" }} />
                </Box>
              ) : peakForecast ? (
                <>
                  {/* Peak KPI cards per day */}
                  <Grid container spacing={2} mb={2}>
                    {peakForecast.peaks.map((p, i) => (
                      <Grid item xs={12} sm={6} md={12 / pfDays} key={p.date}
                        onClick={() => setSelectedDay(i)}
                        sx={{ cursor: "pointer" }}>
                        <Box sx={{
                          p: 2, borderRadius: 2, textAlign: "center",
                          bgcolor: selectedDay === i ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${selectedDay === i ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.07)"}`,
                          transition: "all 0.2s",
                        }}>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>{p.day}</Typography>
                          <Typography variant="body2" sx={{ color: "#64748b", fontSize: 11 }}>{p.date}</Typography>
                          <Typography variant="h5" fontWeight={800} sx={{ color: "#f97316", my: 0.5 }}>
                            {Number(p.peak_demand).toLocaleString()} MW
                          </Typography>
                          <Chip label={`Peak at ${formatPeakTime12Hour(p.peak_hour)}`} size="small"
                            sx={{ bgcolor: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", fontSize: 10, fontWeight: 600 }} />
                          <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.5 }}>
                            {Number(p.peak_low).toLocaleString()} – {Number(p.peak_high).toLocaleString()} MW
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Hourly breakdown for selected day */}
                  <Typography variant="body2" fontWeight={700} sx={{ color: "white", mb: 1 }}>
                    Hourly Forecast — {peakForecast.peaks[selectedDay]?.date} ({peakForecast.peaks[selectedDay]?.day})
                  </Typography>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={peakForecast.peaks[selectedDay]?.hourly || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(h) => `${String(h).padStart(2,"0")}:00`} />
                      <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" domain={["auto", "auto"]} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v) => [`${Number(v).toLocaleString()} MW`, "Predicted"]}
                        labelFormatter={(h) => `${String(h).padStart(2,"0")}:00`} />
                      <Bar dataKey="predicted" radius={[4, 4, 0, 0]} name="Predicted">
                        {(peakForecast.peaks[selectedDay]?.hourly || []).map((d, i) => (
                          <Cell key={i} fill={d.hour === peakForecast.peaks[selectedDay]?.peak_hour.slice(0,2)*1 ? "#f97316" : "#38bdf8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    🟠 Orange bar = predicted peak hour &nbsp;|&nbsp; Model: {peakForecast.model}
                  </Typography>
                </>
              ) : (
                <Typography sx={{ color: "#64748b", py: 2 }}>ML service offline — start predict_api.py</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* KPI Cards */}
        {kpis.map((k) => (
          <Grid item xs={6} md={3} key={k.label}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>{k.label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: k.color, mt: 0.5 }}>{k.value}</Typography>
                <Typography variant="caption" sx={{ color: "#64748b" }}>{k.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Annual Peak Trend */}
        <Grid item xs={12} md={7}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Annual Peak Demand — Delhi (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={annualPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine
                    y={stats.demand_max}
                    stroke="#ef4444" strokeDasharray="4 4"
                    label={{ value: "All-time peak", fill: "#ef4444", fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="peak" stroke="#f97316" strokeWidth={3} dot={{ r: 5, fill: "#f97316" }} name="Peak MW" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Peak Pattern */}
        <Grid item xs={12} md={5}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Monthly Peak Pattern — All-Time High per Month (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="peak" radius={[4, 4, 0, 0]} name="Peak MW">
                    {monthlyPeaks.map((d, i) => (
                      <Cell key={i} fill={d.peak >= peakHigh ? "#ef4444" : d.peak >= peakMid ? "#f97316" : "#38bdf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Hourly Peak Profile */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                Peak Demand by Hour of Day (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourlyPeakProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: "Hour", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <Box sx={{ ...tooltipStyle, p: 1.5, borderRadius: 2 }}>
                          <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>{d.hour}:00 — {d.hour}:59</Typography>
                          <Typography variant="body2" sx={{ color: "#facc15", fontWeight: 700 }}>{Number(d.peak).toLocaleString()} MW</Typography>
                          {d.peak_date && <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>📅 {d.peak_date}</Typography>}
                        </Box>
                      );
                    }}
                  />
                  <Bar dataKey="peak" radius={[4, 4, 0, 0]} name="Peak MW">
                    {hourlyPeakProfile.map((d, i) => (
                      <Cell key={i} fill={d.peak >= hourPeakHigh ? "#facc15" : "#38bdf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Peak Events Table */}
        <Grid item xs={12} md={6}>
          <Card sx={cardSx}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700} color="white">Top Historical Peak Events</Typography>
                <Chip label={dateRange} size="small"
                  sx={{ bgcolor: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)", fontSize: 10 }} />
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Date", "Peak (MW)", "Temp (°C)", "Notes"].map((h) => (
                      <TableCell key={h} sx={{ color: "#64748b", borderColor: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {peakEvents.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: i === 0 ? "#facc15" : "#cbd5e1", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 ? "🏆 " : ""}{row.date}
                      </TableCell>
                      <TableCell sx={{ color: "#f97316", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: 700 }}>
                        {Number(row.peak).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: "#ef4444", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>
                        {row.temp ?? "—"}
                      </TableCell>
                      <TableCell sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* CAGR Chart */}
        {cagr.length > 0 && (
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                  Year-over-Year Demand Growth Rate (%)
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cagr}>
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

      {/* Floating Alert Notification */}
      <Snackbar
        open={alertFeedback.open}
        autoHideDuration={8000}
        onClose={() => setAlertFeedback((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={alertFeedback.severity}
          onClose={() => setAlertFeedback((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%", boxShadow: 6, borderRadius: 2 }}
        >
          {alertFeedback.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
