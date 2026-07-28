import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
  Link,
  CircularProgress,
  LinearProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Bolt, Visibility, VisibilityOff, CheckCircle, Cancel } from "@mui/icons-material";
import { registerUser } from "../api/authService";

const rules = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password) {
  return rules.filter((r) => r.test(password)).length;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
const strengthColor = ["", "#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8"];

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const strength = getStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (strength < 5) {
      setError("Please meet all password requirements.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerUser(form.name, form.email, form.password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
      "&:hover fieldset": { borderColor: "#38bdf8" },
      "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
    },
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0f172a", color: "white" }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: "rgba(2,6,23,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Toolbar sx={{ cursor: "pointer" }} onClick={() => window.location.href = "/"}>
          <Bolt sx={{ mr: 1, color: "#38bdf8" }} />
          <Typography variant="h5" fontWeight={800}>
            <span style={{ color: "#38bdf8" }}>Electri</span><span style={{ color: "#facc15" }}>City</span>
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Signup Card */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", px: 2, py: 4 }}>
        <Paper sx={{ p: 5, borderRadius: 4, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "100%", maxWidth: 440, color: "white" }}>
          <Typography variant="h5" fontWeight={700} textAlign="center" mb={0.5}>
            Create an account
          </Typography>
          <Typography variant="body2" textAlign="center" sx={{ color: "#94a3b8", mb: 3 }}>
            Get started with ElectriCity
          </Typography>

          {error && (
            <Typography variant="body2" sx={{ color: "#f87171", mb: 2, textAlign: "center" }}>
              {error}
            </Typography>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                InputProps={{ style: { color: "white" } }}
                sx={fieldSx}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                fullWidth
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                InputProps={{ style: { color: "white" } }}
                sx={fieldSx}
              />

              {/* Password field */}
              <Box>
                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  required
                  fullWidth
                  InputLabelProps={{ style: { color: "#94a3b8" } }}
                  InputProps={{
                    style: { color: "white" },
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "#94a3b8" }}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />

                {/* Strength bar */}
                {form.password && (
                  <Box mt={1}>
                    <LinearProgress
                      variant="determinate"
                      value={(strength / 5) * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "rgba(255,255,255,0.08)",
                        "& .MuiLinearProgress-bar": { bgcolor: strengthColor[strength], borderRadius: 3 },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: strengthColor[strength], fontWeight: 600 }}>
                      {strengthLabel[strength]}
                    </Typography>
                  </Box>
                )}

                {/* Rules checklist */}
                {form.password && (
                  <Stack mt={1.5} spacing={0.5}>
                    {rules.map((rule) => {
                      const passed = rule.test(form.password);
                      return (
                        <Stack key={rule.label} direction="row" alignItems="center" spacing={0.8}>
                          {passed
                            ? <CheckCircle sx={{ fontSize: 14, color: "#22c55e" }} />
                            : <Cancel sx={{ fontSize: 14, color: "#ef4444" }} />}
                          <Typography variant="caption" sx={{ color: passed ? "#22c55e" : "#94a3b8" }}>
                            {rule.label}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              {/* Confirm Password */}
              <TextField
                label="Confirm Password"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                value={form.confirm}
                onChange={handleChange}
                required
                fullWidth
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                InputProps={{
                  style: { color: "white" },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" sx={{ color: "#94a3b8" }}>
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...fieldSx,
                  ...(form.confirm && {
                    "& .MuiOutlinedInput-root fieldset": {
                      borderColor: form.password === form.confirm ? "#22c55e" : "#ef4444",
                    },
                  }),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ fontWeight: 700, background: "linear-gradient(90deg,#0ea5e9,#2563eb)", borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Create Account"}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.08)" }} />

          <Typography variant="body2" textAlign="center" sx={{ color: "#94a3b8" }}>
            Already have an account?{" "}
            <Link href="/login" sx={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
              Sign in
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
