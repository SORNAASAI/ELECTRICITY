import React, { useState } from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack,
  ToggleButton, ToggleButtonGroup, Chip,
} from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
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

// Short-term: hourly actual vs predicted for a sample day
const shortTermData = [
  { time: "00:00", actual: 112000, predicted: 110500 },
  { time: "02:00", actual: 108000, predicted: 107200 },
  { time: "04:00", actual: 106000, predicted: 105800 },
  { time: "06:00", actual: 115000, predicted: 114200 },
  { time: "08:00", actual: 138000, predicted: 136800 },
  { time: "10:00", actual: 158000, predicted: 156500 },
  { time: "12:00", actual: 165000, predicted: 163200 },
  { time: "14:00", actual: 168000, predicted: 166400 },
  { time: "16:00", actual: 162000, predicted: 160800 },
  { time: "18:00", actual: 155000, predicted: 153600 },
  { time: "20:00", actual: 148000, predicted: 147200 },
  { time: "22:00", actual: 128000, predicted: 127400 },
];

// Long-term: monthly actual vs predicted (2024)
const longTermData = [
  { time: "Jan", actual: 118000, predicted: 116800 },
  { time: "Feb", actual: 115000, predicted: 114200 },
  { time: "Mar", actual: 128000, predicted: 126500 },
  { time: "Apr", actual: 148000, predicted: 146200 },
  { time: "May", actual: 172000, predicted: 170100 },
  { time: "Jun", actual: 162000, predicted: 160400 },
  { time: "Jul", actual: 150000, predicted: 148800 },
  { time: "Aug", actual: 145000, predicted: 143600 },
  { time: "Sep", actual: 138000, predicted: 136900 },
  { time: "Oct", actual: 128000, predicted: 127100 },
  { time: "Nov", actual: 116000, predicted: 115200 },
  { time: "Dec", actual: 112000, predicted: 111400 },
];

// Residual error data
const residualShort = shortTermData.map((d) => ({
  time: d.time,
  error: d.actual - d.predicted,
}));
const residualLong = longTermData.map((d) => ({
  time: d.time,
  error: d.actual - d.predicted,
}));

const metrics = {
  short: { mae: "1,240 MW", rmse: "1,580 MW", mape: "0.82%", r2: "0.9921" },
  long:  { mae: "1,480 MW", rmse: "1,820 MW", mape: "1.04%", r2: "0.9887" },
};

export default function Forecast() {
  const [range, setRange] = useState("short");

  const data     = range === "short" ? shortTermData : longTermData;
  const residual = range === "short" ? residualShort : residualLong;
  const m        = metrics[range];
  const xLabel   = range === "short" ? "Hour of Day" : "Month (2024)";

  return (
    <DashboardLayout>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} color="white">
          Forecast Results
        </Typography>
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

      <Grid container spacing={3}>

        {/* Metric Cards */}
        {[
          { label: "MAE",      value: m.mae,  color: "#38bdf8" },
          { label: "RMSE",     value: m.rmse, color: "#f97316" },
          { label: "MAPE",     value: m.mape, color: "#a78bfa" },
          { label: "R² Score", value: m.r2,   color: "#22c55e" },
        ].map((k) => (
          <Grid item xs={6} md={3} key={k.label}>
            <Card sx={cardSx}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>{k.label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: k.color, mt: 0.5 }}>{k.value}</Typography>
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
                  label={range === "short" ? "Hourly — Sample Day" : "Monthly — 2024"}
                  size="small"
                  sx={{ bgcolor: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)", fontSize: 11 }}
                />
              </Stack>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }}
                    label={{ value: xLabel, position: "insideBottom", offset: -5, fill: "#64748b", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: "#94a3b8" }} />
                  <Line type="monotone" dataKey="actual"    stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" />
                  <Line type="monotone" dataKey="predicted" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={residual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} unit=" MW" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="error" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Error" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </DashboardLayout>
  );
}
