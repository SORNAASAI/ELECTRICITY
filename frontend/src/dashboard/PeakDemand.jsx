import React, { useEffect, useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, CircularProgress,
  ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
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

export default function PeakDemand() {
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [peakForecast, setPeakForecast] = useState(null);
  const [pfLoading,  setPfLoading]  = useState(true);
  const [pfDays,     setPfDays]     = useState(3);
  const [pfModel,    setPfModel]    = useState("xgboost");
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    axiosInstance.get("/api/predict/dataset-stats")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
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
      label: "Peak Hour",
      value: stats.peak_hour,
      sub:   `Avg ${Number(stats.peak_hour_avg).toLocaleString()} MW`,
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
                <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
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
                          <Chip label={`Peak at ${p.peak_hour}`} size="small"
                            sx={{ bgcolor: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", fontSize: 10 }} />
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
    </DashboardLayout>
  );
}
