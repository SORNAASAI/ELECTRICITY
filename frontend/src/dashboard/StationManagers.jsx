import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Paper,
} from "@mui/material";
import {
  EvStation,
  CheckCircle,
  Cancel,
  NotificationsActive,
  Send,
  History,
  Engineering,
  Power,
  Refresh,
  HourglassEmpty,
  VerifiedUser,
  WarningAmber,
} from "@mui/icons-material";
import DashboardLayout from "./DashboardLayout";
import axiosInstance from "../api/axiosInstance";

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
  height: "100%",
};

export default function StationManagers() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [managers, setManagers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    pendingRequestsCount: 0,
    activeManagersCount: 0,
    totalAlertsSent: 0,
    totalManagedCapacityKw: 0,
  });

  // Action feedback
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  // Reject dialog state
  const [rejectDialog, setRejectDialog] = useState({ open: false, requestId: null, managerName: "", reason: "" });
  const [rejecting, setRejecting] = useState(false);

  // Send alert dialog state
  const [alertForm, setAlertForm] = useState({
    title: "",
    message: "",
    severity: "WARNING",
  });
  const [sendingAlert, setSendingAlert] = useState(false);

  const fetchData = async () => {
    try {
      const [pendingRes, allReqRes, managersRes, alertsRes, statsRes] = await Promise.all([
        axiosInstance.get("/api/manager-requests/pending"),
        axiosInstance.get("/api/manager-requests"),
        axiosInstance.get("/api/managers"),
        axiosInstance.get("/api/managers/alerts"),
        axiosInstance.get("/api/managers/stats"),
      ]);

      setPendingRequests(pendingRes.data || []);
      setAllRequests(allReqRes.data || []);
      setManagers(managersRes.data || []);
      setAlerts(alertsRes.data || []);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to load manager workflow data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Accept Request ──────────────────────────────────────────────────────────
  const handleAccept = async (id, name) => {
    setActionSuccess("");
    setActionError("");
    try {
      const res = await axiosInstance.put(`/api/manager-requests/${id}/accept`);
      setActionSuccess(`Accepted request for ${name}. Added to the official 'manager' table!`);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || `Failed to accept request for ${name}`);
    }
  };

  // ── Reject Request ──────────────────────────────────────────────────────────
  const handleOpenReject = (req) => {
    setRejectDialog({
      open: true,
      requestId: req.id,
      managerName: req.name,
      reason: "",
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectDialog.requestId) return;
    setRejecting(true);
    setActionSuccess("");
    setActionError("");
    try {
      await axiosInstance.put(`/api/manager-requests/${rejectDialog.requestId}/reject`, {
        reason: rejectDialog.reason || "Application criteria not met.",
      });
      setActionSuccess(`Request from ${rejectDialog.managerName} has been rejected.`);
      setRejectDialog({ open: false, requestId: null, managerName: "", reason: "" });
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to reject request.");
    } finally {
      setRejecting(false);
    }
  };

  // ── Send Grid Alert to Approved Managers ────────────────────────────────────
  const handleSendAlert = async (e) => {
    e.preventDefault();
    if (!alertForm.title || !alertForm.message) return;
    setSendingAlert(true);
    setActionSuccess("");
    setActionError("");
    try {
      const res = await axiosInstance.post("/api/managers/alerts", alertForm);
      setActionSuccess(res.data?.message || "Alert dispatched to approved managers in `manager` table.");
      setAlertForm({ title: "", message: "", severity: "WARNING" });
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to dispatch alert.");
    } finally {
      setSendingAlert(false);
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

  const kpis = [
    {
      label: "Pending Requests",
      value: stats.pendingRequestsCount,
      sub: stats.pendingRequestsCount > 0 ? "Awaiting Operator Review" : "All reviewed",
      color: stats.pendingRequestsCount > 0 ? "#facc15" : "#22c55e",
      icon: <HourglassEmpty sx={{ fontSize: 32, color: stats.pendingRequestsCount > 0 ? "#facc15" : "#22c55e" }} />,
    },
    {
      label: "Approved Managers",
      value: stats.activeManagersCount,
      sub: "In `manager` table (Alerts active)",
      color: "#38bdf8",
      icon: <VerifiedUser sx={{ fontSize: 32, color: "#38bdf8" }} />,
    },
    {
      label: "Managed Capacity",
      value: `${Number(stats.totalManagedCapacityKw).toLocaleString()} kW`,
      sub: "Enrolled EV Charging Infrastructure",
      color: "#a78bfa",
      icon: <Power sx={{ fontSize: 32, color: "#a78bfa" }} />,
    },
    {
      label: "Dispatched Alerts",
      value: stats.totalAlertsSent,
      sub: "Sent to Approved Managers",
      color: "#f97316",
      icon: <NotificationsActive sx={{ fontSize: 32, color: "#f97316" }} />,
    },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" mb={3} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="white">
            Station Manager Directory &amp; Requests
          </Typography>
          <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5 }}>
            Review incoming station manager applications, approve them to the official <code>manager</code> database, and dispatch grid demand advisories.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
            startIcon={<Refresh />}
            sx={{
              color: "#94a3b8",
              borderColor: "rgba(255,255,255,0.15)",
              "&:hover": { borderColor: "#38bdf8", color: "#38bdf8" },
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>
      </Stack>

      {/* Notifications */}
      {actionSuccess && (
        <Alert severity="success" onClose={() => setActionSuccess("")} sx={{ mb: 3, bgcolor: "rgba(34, 197, 94, 0.15)", color: "#86efac", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
          {actionSuccess}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError("")} sx={{ mb: 3, bgcolor: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
          {actionError}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} mb={3}>
        {kpis.map((k) => (
          <Grid item xs={12} sm={6} md={3} key={k.label}>
            <Card sx={cardSx}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {k.label}
                    </Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ color: k.color, my: 0.5 }}>
                      {k.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                      {k.sub}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)" }}>
                    {k.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main Tabs Container */}
      <Card sx={cardSx}>
        <Box sx={{ borderBottom: 1, borderColor: "rgba(255,255,255,0.08)", px: 3, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              "& .MuiTab-root": { color: "#94a3b8", textTransform: "none", fontWeight: 600, fontSize: "0.95rem" },
              "& .Mui-selected": { color: "#38bdf8 !important" },
              "& .MuiTabs-indicator": { bgcolor: "#38bdf8" },
            }}
          >
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Pending Requests</span>
                  {pendingRequests.length > 0 && (
                    <Chip label={pendingRequests.length} size="small" sx={{ height: 20, bgcolor: "rgba(250, 204, 21, 0.2)", color: "#facc15", fontWeight: 700 }} />
                  )}
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Approved Managers</span>
                  <Chip label={managers.length} size="small" sx={{ height: 20, bgcolor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontWeight: 700 }} />
                </Stack>
              }
            />
            <Tab label="Dispatch Grid Alerts" />
            <Tab label="Request History" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: 3 }}>
          {/* ── TAB 0: Pending Requests ───────────────────────────────────── */}
          {tab === 0 && (
            <Box>
              {pendingRequests.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <CheckCircle sx={{ fontSize: 56, color: "#22c55e", mb: 1, opacity: 0.8 }} />
                  <Typography variant="h6" fontWeight={700} color="white">
                    All caught up!
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5 }}>
                    There are currently no pending station manager requests awaiting review.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2.5}>
                  {pendingRequests.map((req) => (
                    <Grid item xs={12} md={6} key={req.id}>
                      <Paper
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(250, 204, 21, 0.25)",
                          position: "relative",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                bgcolor: "rgba(250, 204, 21, 0.1)",
                                border: "1px solid rgba(250, 204, 21, 0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <EvStation sx={{ color: "#facc15", fontSize: 26 }} />
                            </Box>
                            <Box>
                              <Typography variant="h6" fontWeight={700} color="white">
                                {req.stationName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                                {req.name} • {req.email}
                              </Typography>
                            </Box>
                          </Stack>
                          <Chip
                            label="PENDING"
                            size="small"
                            sx={{ bgcolor: "rgba(250, 204, 21, 0.15)", color: "#facc15", fontWeight: 700, fontSize: 10 }}
                          />
                        </Stack>

                        <Box sx={{ my: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: "#64748b" }}>Location / Zone:</Typography>
                              <Typography variant="body2" fontWeight={600} color="white">{req.stationLocation}</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" sx={{ color: "#64748b" }}>Capacity:</Typography>
                              <Typography variant="body2" fontWeight={600} color="#38bdf8">{req.capacityKw || 100} kW</Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" sx={{ color: "#64748b" }}>EV Ports:</Typography>
                              <Typography variant="body2" fontWeight={600} color="#a78bfa">{req.evPorts || 4} ports</Typography>
                            </Grid>
                            {req.phone && (
                              <Grid item xs={6}>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>Phone:</Typography>
                                <Typography variant="body2" color="white">{req.phone}</Typography>
                              </Grid>
                            )}
                            {req.submittedAt && (
                              <Grid item xs={6}>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>Submitted:</Typography>
                                <Typography variant="body2" color="white">{req.submittedAt.replace("T", " ").slice(0, 16)}</Typography>
                              </Grid>
                            )}
                            {req.notes && (
                              <Grid item xs={12}>
                                <Typography variant="caption" sx={{ color: "#64748b" }}>Notes:</Typography>
                                <Typography variant="body2" sx={{ color: "#cbd5e1", fontStyle: "italic" }}>"{req.notes}"</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>

                        <Stack direction="row" spacing={1.5} justifyContent="flex-end" mt={2}>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={() => handleOpenReject(req)}
                            startIcon={<Cancel />}
                            sx={{ borderColor: "rgba(239, 68, 68, 0.4)", textTransform: "none" }}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={() => handleAccept(req.id, req.name)}
                            startIcon={<CheckCircle />}
                            sx={{ background: "linear-gradient(90deg, #16a34a, #15803d)", textTransform: "none", fontWeight: 700 }}
                          >
                            Accept &amp; Enroll
                          </Button>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* ── TAB 1: Approved Managers (`manager` table) ────────────────── */}
          {tab === 1 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                  All managers currently registered in the database <code>manager</code> table. Only these approved managers receive grid advisories and alerts.
                </Typography>
              </Stack>

              {managers.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <Engineering sx={{ fontSize: 48, color: "#64748b", mb: 1 }} />
                  <Typography variant="body1" color="#94a3b8">
                    No approved managers in the <code>manager</code> table yet.
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    Accept pending requests from Tab 1 to enroll station managers.
                  </Typography>
                </Box>
              ) : (
                <Table sx={{ "& th": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.08)", fontWeight: 700 }, "& td": { color: "white", borderColor: "rgba(255,255,255,0.05)" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Manager</TableCell>
                      <TableCell>Station</TableCell>
                      <TableCell>Location / Zone</TableCell>
                      <TableCell>Capacity</TableCell>
                      <TableCell>Ports</TableCell>
                      <TableCell>Alerts Status</TableCell>
                      <TableCell>Approved By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {managers.map((m) => (
                      <TableRow key={m.id} hover sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.02)" } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{m.name}</Typography>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>{m.email}</Typography>
                          {m.phone && <Typography variant="caption" sx={{ display: "block", color: "#64748b" }}>{m.phone}</Typography>}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <EvStation sx={{ color: "#38bdf8", fontSize: 18 }} />
                            <Typography variant="body2" fontWeight={600}>{m.stationName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{m.stationLocation}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} sx={{ color: "#38bdf8" }}>
                            {m.capacityKw || 100} kW
                          </Typography>
                        </TableCell>
                        <TableCell>{m.evPorts || 4}</TableCell>
                        <TableCell>
                          <Chip
                            label="Active (Receives Alerts)"
                            size="small"
                            sx={{ bgcolor: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontWeight: 700, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                            {m.approvedBy || "Grid Operator"}
                          </Typography>
                          {m.approvedAt && (
                            <Typography variant="caption" sx={{ display: "block", color: "#64748b", fontSize: 10 }}>
                              {m.approvedAt.replace("T", " ").slice(0, 16)}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}

          {/* ── TAB 2: Dispatch Grid Alerts ───────────────────────────────── */}
          {tab === 2 && (
            <Grid container spacing={4}>
              {/* Alert Creation Form */}
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography variant="h6" fontWeight={700} color="white" mb={1}>
                    📢 Broadcast Alert to Station Managers
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mb: 2 }}>
                    This alert will only be received by the <strong>{managers.length} active managers</strong> currently in the <code>manager</code> table.
                  </Typography>

                  <Box component="form" onSubmit={handleSendAlert}>
                    <TextField
                      required
                      fullWidth
                      size="small"
                      label="Alert Title / Headline"
                      value={alertForm.title}
                      onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                      placeholder="e.g. Summer Peak Curtailment Window (14:00 - 18:00)"
                      sx={{ mb: 2, "& .MuiInputLabel-root": { color: "#94a3b8" }, "& .MuiOutlinedInput-root": { color: "white", bgcolor: "rgba(255,255,255,0.03)" } }}
                    />

                    <Stack direction="row" spacing={1} mb={2}>
                      {["INFO", "WARNING", "CRITICAL"].map((sev) => (
                        <Button
                          key={sev}
                          size="small"
                          variant={alertForm.severity === sev ? "contained" : "outlined"}
                          onClick={() => setAlertForm({ ...alertForm, severity: sev })}
                          sx={{
                            flex: 1,
                            textTransform: "none",
                            fontWeight: 700,
                            color: sev === "CRITICAL" ? "#ef4444" : sev === "WARNING" ? "#facc15" : "#38bdf8",
                            borderColor: "rgba(255,255,255,0.15)",
                            bgcolor: alertForm.severity === sev
                              ? sev === "CRITICAL"
                                ? "rgba(239, 68, 68, 0.25)"
                                : sev === "WARNING"
                                ? "rgba(250, 204, 21, 0.25)"
                                : "rgba(56, 189, 248, 0.25)"
                              : "transparent",
                          }}
                        >
                          {sev}
                        </Button>
                      ))}
                    </Stack>

                    <TextField
                      required
                      fullWidth
                      multiline
                      rows={4}
                      size="small"
                      label="Alert Instructions & Advisory Details"
                      value={alertForm.message}
                      onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                      placeholder="e.g. High ambient temperature forecast cross 41°C. Please activate V2G reverse feed and throttle non-essential fast chargers during peak."
                      sx={{ mb: 3, "& .MuiInputLabel-root": { color: "#94a3b8" }, "& .MuiOutlinedInput-root": { color: "white", bgcolor: "rgba(255,255,255,0.03)" } }}
                    />

                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      disabled={sendingAlert || managers.length === 0}
                      sx={{
                        background: "linear-gradient(90deg, #f97316, #ea580c)",
                        fontWeight: 700,
                        py: 1.2,
                      }}
                      startIcon={sendingAlert ? <CircularProgress size={16} color="inherit" /> : <Send />}
                    >
                      {sendingAlert ? "Dispatching..." : `Dispatch Alert (${managers.length} Recipients)`}
                    </Button>
                  </Box>
                </Paper>
              </Grid>

              {/* Alert History */}
              <Grid item xs={12} md={7}>
                <Typography variant="h6" fontWeight={700} color="white" mb={2}>
                  📜 Recent Alerts Dispatched
                </Typography>
                {alerts.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 6, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                    <NotificationsActive sx={{ fontSize: 44, color: "#64748b", mb: 1 }} />
                    <Typography variant="body2" color="#94a3b8">
                      No alerts dispatched yet. Send your first advisory using the form.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {alerts.map((al) => (
                      <Paper key={al.id} sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={al.severity}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: 10,
                                bgcolor: al.severity === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : al.severity === "WARNING" ? "rgba(250, 204, 21, 0.2)" : "rgba(56, 189, 248, 0.2)",
                                color: al.severity === "CRITICAL" ? "#ef4444" : al.severity === "WARNING" ? "#facc15" : "#38bdf8",
                              }}
                            />
                            <Typography variant="body1" fontWeight={700} color="white">
                              {al.title}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" sx={{ color: "#64748b" }}>
                            {al.sentAt?.replace("T", " ").slice(0, 16)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "#cbd5e1", mb: 1 }}>
                          {al.message}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ color: "#94a3b8", fontSize: 11 }}>
                          <span>Sent by: <strong>{al.sentBy}</strong></span>
                          <span>Delivered to: <strong style={{ color: "#38bdf8" }}>{al.recipientCount} station managers</strong></span>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Grid>
            </Grid>
          )}

          {/* ── TAB 3: Request History ────────────────────────────────────── */}
          {tab === 3 && (
            <Box>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 2 }}>
                Audit log of all station manager access submissions and operator review actions.
              </Typography>
              <Table sx={{ "& th": { color: "#94a3b8", borderColor: "rgba(255,255,255,0.08)" }, "& td": { color: "white", borderColor: "rgba(255,255,255,0.05)" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Manager &amp; Station</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Capacity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reviewed By</TableCell>
                    <TableCell>Notes / Decision</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell sx={{ fontSize: 12, color: "#94a3b8" }}>
                        {req.submittedAt?.replace("T", " ").slice(0, 16)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{req.name}</Typography>
                        <Typography variant="caption" sx={{ color: "#38bdf8" }}>{req.stationName}</Typography>
                      </TableCell>
                      <TableCell>{req.stationLocation}</TableCell>
                      <TableCell>{req.capacityKw || 100} kW</TableCell>
                      <TableCell>
                        <Chip
                          label={req.status}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: 10,
                            bgcolor: req.status === "ACCEPTED" ? "rgba(34, 197, 94, 0.15)" : req.status === "REJECTED" ? "rgba(239, 68, 68, 0.15)" : "rgba(250, 204, 21, 0.15)",
                            color: req.status === "ACCEPTED" ? "#22c55e" : req.status === "REJECTED" ? "#ef4444" : "#facc15",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: "#94a3b8" }}>
                        {req.reviewedBy || "—"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: "#cbd5e1" }}>
                        {req.status === "REJECTED" ? (
                          <span style={{ color: "#f87171" }}>Rejected: {req.rejectionReason}</span>
                        ) : req.status === "ACCEPTED" ? (
                          <span style={{ color: "#86efac" }}>Enrolled in manager table</span>
                        ) : (
                          "Pending operator review"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Reject Modal Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, requestId: null, managerName: "", reason: "" })}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "#0f172a",
            color: "white",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.1)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Cancel sx={{ color: "#ef4444" }} />
          Reject Manager Request
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#cbd5e1", mb: 2 }}>
            Are you sure you want to reject the request from <strong>{rejectDialog.managerName}</strong>? This station will <strong>NOT</strong> be added to the <code>manager</code> table and will not receive future alerts.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Rejection Reason (Optional)"
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
            placeholder="e.g. Incomplete station location details"
            sx={{
              "& .MuiInputLabel-root": { color: "#94a3b8" },
              "& .MuiOutlinedInput-root": { color: "white", bgcolor: "rgba(255,255,255,0.03)" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejectDialog({ open: false, requestId: null, managerName: "", reason: "" })} sx={{ color: "#94a3b8" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmReject}
            disabled={rejecting}
            startIcon={rejecting ? <CircularProgress size={14} color="inherit" /> : <Cancel />}
          >
            {rejecting ? "Rejecting..." : "Confirm Rejection"}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
