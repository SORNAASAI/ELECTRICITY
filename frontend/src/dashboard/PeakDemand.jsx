import React, { useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";
import DashboardLayout from "./DashboardLayout";

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};
const tooltipStyle = { background: "#1e293b", border: "none", borderRadius: 8, color: "white" };

// Annual peak demand (MW) — India national
const annualPeaks = [
  { year: "2019", peak: 183804 },
  { year: "2020", peak: 190198 },
  { year: "2021", peak: 200539 },
  { year: "2022", peak: 209000 },
  { year: "2023", peak: 224101 },
  { year: "2024", peak: 250000 },
];

// Avg peak demand by month
const monthlyPeaks = [
  { month: "Jan", peak: 185000 }, { month: "Feb", peak: 182000 },
  { month: "Mar", peak: 192000 }, { month: "Apr", peak: 210000 },
  { month: "May", peak: 238000 }, { month: "Jun", peak: 224000 },
  { month: "Jul", peak: 208000 }, { month: "Aug", peak: 202000 },
  { month: "Sep", peak: 195000 }, { month: "Oct", peak: 188000 },
  { month: "Nov", peak: 180000 }, { month: "Dec", peak: 178000 },
];

// Peak demand by hour of day
const hourlyPeakProfile = [
  { hour: "00", peak: 118000 }, { hour: "02", peak: 112000 },
  { hour: "04", peak: 110000 }, { hour: "06", peak: 122000 },
  { hour: "08", peak: 148000 }, { hour: "10", peak: 172000 },
  { hour: "12", peak: 185000 }, { hour: "14", peak: 192000 },
  { hour: "16", peak: 188000 }, { hour: "18", peak: 178000 },
  { hour: "20", peak: 165000 }, { hour: "22", peak: 140000 },
];

// Historical top 10 peak events
const peakEvents = [
  { date: "29 May 2024",  peak: 250000, temp: 44.2, notes: "Severe heatwave, North India" },
  { date: "30 May 2024",  peak: 246000, temp: 43.8, notes: "Continued heatwave" },
  { date: "28 May 2024",  peak: 243000, temp: 43.5, notes: "Pre-monsoon heat surge" },
  { date: "19 May 2023",  peak: 224101, temp: 42.1, notes: "Record 2023 peak" },
  { date: "20 May 2023",  peak: 221000, temp: 41.8, notes: "Heatwave continuation" },
  { date: "02 Jun 2022",  peak: 209000, temp: 40.5, notes: "Early monsoon delay" },
  { date: "07 Jul 2021",  peak: 200539, temp: 38.2, notes: "Post-lockdown recovery" },
  { date: "11 Jun 2020",  peak: 190198, temp: 39.1, notes: "Summer peak 2020" },
  { date: "01 Jul 2019",  peak: 183804, temp: 38.8, notes: "Pre-monsoon 2019" },
  { date: "15 May 2018",  peak: 175528, temp: 41.2, notes: "Summer 2018 peak" },
];

const kpis = [
  { label: "All-Time Peak",    value: "250,000 MW", sub: "29 May 2024",       color: "#f97316" },
  { label: "Peak Month",       value: "May",        sub: "Avg 238,000 MW",    color: "#ef4444" },
  { label: "Peak Hour",        value: "14:00",      sub: "Avg 192,000 MW",    color: "#facc15" },
  { label: "YoY Peak Growth",  value: "+11.6%",     sub: "2023 → 2024",       color: "#22c55e" },
];

export default function PeakDemand() {
  return (
    <DashboardLayout>
      <Typography variant="h5" fontWeight={700} color="white" mb={3}>
        Peak Demand Analysis
      </Typography>

      <Grid container spacing={3}>

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
                Annual Peak Demand Trend — India National (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={annualPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" domain={[160000, 260000]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={250000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "All-time peak", fill: "#ef4444", fontSize: 11 }} />
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
                Monthly Peak Pattern (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} unit=" MW" domain={[160000, 250000]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="peak" radius={[4, 4, 0, 0]} name="Peak MW">
                    {monthlyPeaks.map((d, i) => (
                      <Cell key={i} fill={d.peak >= 220000 ? "#ef4444" : d.peak >= 195000 ? "#f97316" : "#38bdf8"} />
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
                Avg Peak Demand by Hour of Day (MW)
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourlyPeakProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: "Hour", position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" domain={[100000, 210000]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="peak" radius={[4, 4, 0, 0]} name="Peak MW">
                    {hourlyPeakProfile.map((d, i) => (
                      <Cell key={i} fill={d.peak >= 180000 ? "#facc15" : "#38bdf8"} />
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
                <Typography variant="h6" fontWeight={700} color="white">
                  Top Historical Peak Events
                </Typography>
                <Chip label="2018–2024" size="small"
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
                    <TableRow key={row.date}>
                      <TableCell sx={{ color: i === 0 ? "#facc15" : "#cbd5e1", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 ? "🏆 " : ""}{row.date}
                      </TableCell>
                      <TableCell sx={{ color: "#f97316", borderColor: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: 700 }}>
                        {row.peak.toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: "#ef4444", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.temp}</TableCell>
                      <TableCell sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.04)", fontSize: 11 }}>{row.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
