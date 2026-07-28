import React, { useState } from "react";
import {
  Box, Card, CardContent, Typography, Stack, Avatar,
  TextField, Button, Divider, Grid, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import {
  Person, Email, Edit, Save, ElectricBolt, Cancel,
  Shield, WarningAmber, CheckCircle, CalendarToday,
} from "@mui/icons-material";
import DashboardLayout from "./DashboardLayout";
import { getUser, logoutUser } from "../api/authService";

const cardSx = {
  bgcolor: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 3,
  color: "white",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset": { borderColor: "#38bdf8" },
    "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
  },
};

const InfoRow = ({ icon, label, value, sub }) => (
  <Box sx={{ py: 2, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <Stack direction="row" alignItems="flex-start" spacing={2}>
      <Box sx={{ color: "#38bdf8", mt: 0.3, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="caption" sx={{ color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ color: "white", fontWeight: 600, mt: 0.3 }}>{value}</Typography>
        {sub && <Typography variant="caption" sx={{ color: "#64748b" }}>{sub}</Typography>}
      </Box>
    </Stack>
  </Box>
);

export default function Profile() {
  const user = getUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [saved, setSaved] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleSave = () => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...stored, name }));
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDeactivate = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <DashboardLayout>

      {/* Banner */}
      <Box sx={{ borderRadius: 3, background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)", p: 4, mb: 3, position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)" }} />
        <Box sx={{ position: "absolute", bottom: -60, right: 80, width: 150, height: 150, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.04)" }} />
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={3}>
          <Avatar sx={{ width: 80, height: 80, bgcolor: "rgba(255,255,255,0.2)", fontSize: 32, border: "3px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
            {name?.[0]?.toUpperCase() || "U"}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800} color="white">{name}</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", mt: 0.5 }}>{user?.email}</Typography>
            <Stack direction="row" spacing={1} mt={1.5}>
              <Chip label="Active" size="small" sx={{ bgcolor: "rgba(34,197,94,0.25)", color: "#86efac", border: "1px solid rgba(34,197,94,0.4)", fontSize: 11 }} />
              <Chip label="Analyst" size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontSize: 11 }} />
              <Chip label="Full Access" size="small" sx={{ bgcolor: "rgba(250,204,21,0.2)", color: "#fde68a", border: "1px solid rgba(250,204,21,0.3)", fontSize: 11 }} />
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Grid container spacing={3}>

        {/* Left Column */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>

            {/* Quick Stats */}
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, mb: 2 }}>
                  Account Summary
                </Typography>
                <Stack spacing={2}>
                  {[
                    { icon: <Shield sx={{ fontSize: 16 }} />, label: "Role", value: "Analyst", color: "#38bdf8" },
                    { icon: <ElectricBolt sx={{ fontSize: 16 }} />, label: "Project", value: "Delhi Power AI", color: "#facc15" },
                    { icon: <CheckCircle sx={{ fontSize: 16 }} />, label: "Status", value: "Active", color: "#22c55e" },
                    { icon: <CalendarToday sx={{ fontSize: 16 }} />, label: "Member Since", value: "2024", color: "#a78bfa" },
                  ].map((s) => (
                    <Stack key={s.label} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ color: s.color }}>{s.icon}</Box>
                        <Typography variant="body2" sx={{ color: "#64748b" }}>{s.label}</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: "#cbd5e1", fontWeight: 600 }}>{s.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card sx={{ ...cardSx, border: "1px solid rgba(239,68,68,0.2)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#f87171", textTransform: "uppercase", letterSpacing: 1, mb: 1 }}>
                  Danger Zone
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", lineHeight: 1.6, display: "block", mb: 2 }}>
                  Deactivating your account will remove all your session data and sign you out permanently.
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={() => setDeactivateDialog(true)}
                  sx={{ borderColor: "rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 2, "&:hover": { bgcolor: "rgba(239,68,68,0.08)", borderColor: "#ef4444" } }}
                >
                  Deactivate Account
                </Button>
              </CardContent>
            </Card>

          </Stack>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>

            {/* Account Information */}
            <Card sx={cardSx}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                    Account Information
                  </Typography>
                  {!editing ? (
                    <Button startIcon={<Edit sx={{ fontSize: 15 }} />} size="small" onClick={() => setEditing(true)}
                      variant="outlined"
                      sx={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)", borderRadius: 2, fontSize: 12, "&:hover": { borderColor: "#38bdf8", bgcolor: "rgba(56,189,248,0.06)" } }}>
                      Edit Profile
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => { setEditing(false); setName(user?.name || ""); }}
                        variant="outlined"
                        sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.12)", borderRadius: 2, fontSize: 12 }}>
                        Cancel
                      </Button>
                      <Button startIcon={<Save sx={{ fontSize: 15 }} />} size="small" onClick={handleSave}
                        variant="contained"
                        sx={{ background: "linear-gradient(90deg,#0ea5e9,#2563eb)", borderRadius: 2, fontSize: 12 }}>
                        Save Changes
                      </Button>
                    </Stack>
                  )}
                </Stack>

                {saved && (
                  <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle sx={{ fontSize: 16, color: "#22c55e" }} />
                      <Typography variant="body2" sx={{ color: "#22c55e" }}>Profile updated successfully</Typography>
                    </Stack>
                  </Box>
                )}

                {/* Name */}
                <Box sx={{ py: 2, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <Stack direction="row" alignItems="flex-start" spacing={2}>
                    <Box sx={{ color: "#38bdf8", mt: 0.3, flexShrink: 0 }}><Person sx={{ fontSize: 18 }} /></Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" sx={{ color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>Full Name</Typography>
                      {editing ? (
                        <TextField value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small"
                          sx={{ mt: 0.5, ...fieldSx }}
                          InputProps={{ style: { color: "white" } }} />
                      ) : (
                        <Typography variant="body1" sx={{ color: "white", fontWeight: 600, mt: 0.3 }}>{name}</Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>

                <InfoRow
                  icon={<Email sx={{ fontSize: 18 }} />}
                  label="Email Address"
                  value={user?.email}
                  sub="Email address cannot be changed"
                />
                <InfoRow
                  icon={<Shield sx={{ fontSize: 18 }} />}
                  label="Access Level"
                  value="Full Access — Dashboard, Analysis, Forecasting"
                />
              </CardContent>
            </Card>



          </Stack>
        </Grid>

      </Grid>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={deactivateDialog}
        onClose={() => { setDeactivateDialog(false); setConfirmText(""); }}
        PaperProps={{
          sx: { bgcolor: "#0f172a", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 3, color: "white", minWidth: 400 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WarningAmber sx={{ color: "#f87171", fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="white">Deactivate Account</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.7, mb: 2 }}>
            This action will permanently deactivate your account and clear all session data. You will be redirected to the home page.
          </Typography>
          <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1 }}>
            Type <strong style={{ color: "#f87171" }}>DEACTIVATE</strong> to confirm
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="DEACTIVATE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            InputProps={{ style: { color: "white" } }}
            sx={{ "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "rgba(239,68,68,0.3)" }, "&:hover fieldset": { borderColor: "#ef4444" }, "&.Mui-focused fieldset": { borderColor: "#ef4444" } } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => { setDeactivateDialog(false); setConfirmText(""); }}
            variant="outlined"
            sx={{ borderColor: "rgba(255,255,255,0.12)", color: "#94a3b8", "&:hover": { borderColor: "#38bdf8", color: "white" }, borderRadius: 2, flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivate}
            variant="contained"
            disabled={confirmText !== "DEACTIVATE"}
            sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" }, "&.Mui-disabled": { bgcolor: "rgba(239,68,68,0.3)", color: "rgba(255,255,255,0.4)" }, borderRadius: 2, flex: 1, fontWeight: 700 }}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

    </DashboardLayout>
  );
}
