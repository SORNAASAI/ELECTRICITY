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
} from "@mui/material";
import { Bolt } from "@mui/icons-material";
import { loginUser } from "../api/authService";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser(form.email, form.password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
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

      {/* Login Card */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", px: 2 }}>
        <Paper sx={{ p: 5, borderRadius: 4, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "100%", maxWidth: 420, color: "white" }}>
          <Typography variant="h5" fontWeight={700} textAlign="center" mb={0.5}>
            Welcome back
          </Typography>
          <Typography variant="body2" textAlign="center" sx={{ color: "#94a3b8", mb: 3 }}>
            Sign in to your account
          </Typography>

          {error && (
            <Typography variant="body2" sx={{ color: "#f87171", mb: 2, textAlign: "center" }}>
              {error}
            </Typography>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
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
              <TextField
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                fullWidth
                InputLabelProps={{ style: { color: "#94a3b8" } }}
                InputProps={{ style: { color: "white" } }}
                sx={fieldSx}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ fontWeight: 700, background: "linear-gradient(90deg,#0ea5e9,#2563eb)", borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.08)" }} />

          <Typography variant="body2" textAlign="center" sx={{ color: "#94a3b8" }}>
            Don't have an account?{" "}
            <Link href="/signup" sx={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
              Sign up
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
