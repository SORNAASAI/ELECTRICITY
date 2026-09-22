import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Bolt,
  TrendingUp,
  Psychology,
  ElectricBolt,
  Insights,
  Speed,
  ArrowForward,
  EvStation,
  CheckCircle,
  Close,
  HourglassTop,
  Person,
  Email,
  Phone,
  LocationOn,
  ElectricCar,
  Power,
  Description,
  Send,
  VerifiedUser,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import axiosInstance from "../api/axiosInstance";

const MotionBox = motion(Box);
const MotionCard = motion(Card);

const features = [
  {
    icon: <TrendingUp sx={{ fontSize: 40 }} />,
    title: "Demand Forecasting",
    desc: "Delhi's peak demand is projected to reach 8,748 MW in summer 2026, up from 8,302 MW in 2024. Our system forecasts hourly demand up to 7 days ahead, helping power suppliers plan ahead and avoid shortages.",
  },
  {
    icon: <ElectricBolt sx={{ fontSize: 40 }} />,
    title: "Peak Load Prediction",
    desc: "In 2026, Delhi's summer peak is expected to cross 8,700 MW. Our system warns grid operators 24–48 hours in advance so they can arrange extra supply before a blackout hits.",
  },
  {
    icon: <Psychology sx={{ fontSize: 40 }} />,
    title: "Why Did Demand Spike?",
    desc: "When temperatures cross 40°C, electricity use jumps by 15–20%. On public holidays, it drops by 12%. Our system explains every forecast in plain language so operators understand the reason.",
  },
  {
    icon: <Insights sx={{ fontSize: 40 }} />,
    title: "Smart Recommendations",
    desc: "Based on the forecast, the system suggests how much extra power to buy and when — helping electricity boards cut emergency costs by up to 18% and keep the city running smoothly.",
  },
];

const workflow = [
  {
    icon: "🔐",
    label: "Sign In",
    desc: "Log in to your secure dashboard as a grid operator or analyst.",
    detail: "Role-based access ensures only authorised personnel can view and act on forecasts.",
  },
  {
    icon: "📊",
    label: "View Live Demand",
    desc: "See Delhi's current electricity consumption updated in real time.",
    detail: "The dashboard shows today's load curve, yesterday's comparison, and the current demand in MW.",
  },
  {
    icon: "📅",
    label: "Select Forecast Period",
    desc: "Choose to forecast demand for the next 24 hours or up to 7 days ahead.",
    detail: "Pick a date range and the system instantly generates an hour-by-hour demand prediction.",
  },
  {
    icon: "⚡",
    label: "Get Demand Forecast",
    desc: "See exactly how much electricity Delhi will need, hour by hour.",
    detail: "The forecast chart shows expected demand in MW with confidence bands so you know how certain the prediction is.",
  },

  {
    icon: "🔍",
    label: "Understand Why",
    desc: "See which factors are driving the high or low demand prediction.",
    detail: "A breakdown shows how much today's heat wave, upcoming holiday, or industrial activity is contributing to the forecast.",
  },
  {
    icon: "💡",
    label: "Take Action",
    desc: "Follow the system's suggestions to balance supply and demand.",
    detail: "The system recommends whether to buy extra power, schedule maintenance, or reduce load in specific zones.",
  },
];

function WorkflowPreview() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % workflow.length), 1400);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box sx={{ position: "relative", height: 300, overflow: "hidden" }}>
      {/* Animated line */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flexWrap: "nowrap", mt: 1 }}>
        {workflow.map((step, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center" }}>
            <motion.div
              animate={{ scale: active === i ? 1.25 : 1, opacity: active === i ? 1 : 0.35 }}
              transition={{ duration: 0.4 }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: active === i ? "#38bdf8" : "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  boxShadow: active === i ? "0 0 16px #38bdf8" : "none",
                  transition: "all 0.4s",
                }}
              >
                {step.icon}
              </Box>
            </motion.div>
            {i < workflow.length - 1 && (
              <Box sx={{ width: 18, height: 2, bgcolor: active > i ? "#38bdf8" : "rgba(255,255,255,0.1)", transition: "background 0.4s" }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Active step detail */}
      <Box sx={{ mt: 4, textAlign: "center", minHeight: 120 }}>
        {workflow.map((step, i) =>
          active === i ? (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Typography variant="h4" sx={{ mb: 1 }}>{step.icon}</Typography>
              <Typography variant="h6" fontWeight={700} color="#38bdf8">{step.label}</Typography>
              <Typography variant="body2" sx={{ color: "#cbd5e1", mt: 0.5 }}>{step.desc}</Typography>
              <Typography variant="caption" sx={{ color: "#475569", mt: 1, display: "block" }}>Step {i + 1} of {workflow.length}</Typography>
            </motion.div>
          ) : null
        )}
      </Box>

      {/* Progress bar */}
      <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
        <motion.div
          animate={{ width: `${((active + 1) / workflow.length) * 100}%` }}
          transition={{ duration: 0.4 }}
          style={{ height: "100%", background: "linear-gradient(90deg,#38bdf8,#22c55e)", borderRadius: 8 }}
        />
      </Box>
    </Box>
  );
}

const stats = [
  { value: "8,748 MW", label: "Delhi's Projected Peak Demand (Summer 2026)" },
  { value: "95%+", label: "Forecast Accuracy" },
  { value: "~35%", label: "Demand Growth in Last 10 Years" },
  { value: "20M+", label: "People Powered by Delhi's Grid" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Station Manager Request Modal State ─────────────────────────────────────
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [submittedData, setSubmittedData] = useState(null);
  const [requestForm, setRequestForm] = useState({
    name: "",
    email: "",
    phone: "",
    stationName: "",
    stationLocation: "",
    capacityKw: "",
    evPorts: "",
    notes: "",
  });

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestError("");
    setSubmitting(true);
    try {
      const payload = {
        name: requestForm.name,
        email: requestForm.email,
        phone: requestForm.phone,
        stationName: requestForm.stationName,
        stationLocation: requestForm.stationLocation,
        capacityKw: requestForm.capacityKw ? parseFloat(requestForm.capacityKw) : 100,
        evPorts: requestForm.evPorts ? parseInt(requestForm.evPorts) : 4,
        notes: requestForm.notes,
      };
      const res = await axiosInstance.post("/api/manager-requests", payload);
      setSubmittedData(res.data.request || payload);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to submit request. Please check your information.";
      setRequestError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setRequestOpen(false);
    setRequestError("");
    setSubmittedData(null);
    setRequestForm({
      name: "",
      email: "",
      phone: "",
      stationName: "",
      stationLocation: "",
      capacityKw: "",
      evPorts: "",
      notes: "",
    });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box className="animated-bg" sx={{ color: "white", minHeight: "100vh" }}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Navbar */}
      <AppBar
        position="fixed"
        elevation={scrolled ? 4 : 0}
        sx={{
          bgcolor: scrolled ? "rgba(2,6,23,0.95)" : "transparent",
          transition: "background-color 300ms ease, box-shadow 300ms ease",
          backdropFilter: "blur(8px)",
        }}
      >
        <Toolbar>
          <Bolt sx={{ mr: 1, color: "#38bdf8" }} aria-hidden />
          <Typography variant="h5" fontWeight={800} sx={{ flexGrow: 1 }}>
            <span style={{ color: "#38bdf8" }}>Electri</span><span style={{ color: "#facc15" }}>City</span>
          </Typography>
          {/* Desktop nav links — always visible on md+ */}
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}>
            <Button color="inherit" onClick={() => scrollTo("hero")}>Home</Button>
            <Button color="inherit" onClick={() => scrollTo("features")}>Features</Button>
            <Button color="inherit" onClick={() => scrollTo("workflow")}>Workflow</Button>
            <Button
              variant="outlined"
              onClick={() => setRequestOpen(true)}
              sx={{
                ml: 1.5,
                color: "#facc15",
                borderColor: "rgba(250, 204, 21, 0.4)",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 2,
                px: 1.8,
                "&:hover": {
                  borderColor: "#facc15",
                  bgcolor: "rgba(250, 204, 21, 0.08)",
                },
              }}
              startIcon={<EvStation sx={{ color: "#facc15" }} />}
            >
              Manager Request
            </Button>
            <Button color="inherit" href="/login" sx={{ ml: 1 }}>Login</Button>
            <Button variant="contained" href="/signup" sx={{ ml: 1 }}>Sign Up</Button>
          </Box>
          {/* Hamburger — only on mobile, starts closed */}
          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <Box
              onClick={() => setMenuOpen((o) => !o)}
              sx={{ cursor: "pointer", p: 1, display: "flex", flexDirection: "column", gap: "5px", width: 32 }}
            >
              <motion.div
                animate={{ rotate: menuOpen ? 45 : 0, y: menuOpen ? 7 : 0 }}
                transition={{ duration: 0.3 }}
                style={{ height: 2, background: "white", borderRadius: 2, transformOrigin: "center" }}
              />
              <motion.div
                animate={{ opacity: menuOpen ? 0 : 1, scaleX: menuOpen ? 0 : 1 }}
                transition={{ duration: 0.2 }}
                style={{ height: 2, background: "white", borderRadius: 2 }}
              />
              <motion.div
                animate={{ rotate: menuOpen ? -45 : 0, y: menuOpen ? -7 : 0 }}
                transition={{ duration: 0.3 }}
                style={{ height: 2, background: "white", borderRadius: 2, transformOrigin: "center" }}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile dropdown menu */}
      <motion.div
        initial={false}
        animate={{ height: menuOpen ? "auto" : 0, opacity: menuOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{ overflow: "hidden", position: "fixed", top: 64, left: 0, right: 0, zIndex: 1200 }}
      >
        <Box
          sx={{
            bgcolor: "rgba(2,6,23,0.97)",
            backdropFilter: "blur(12px)",
            display: { xs: "flex", md: "none" },
            flexDirection: "column",
            p: 2,
            gap: 0.5,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[["Home", "hero"], ["Features", "features"], ["Workflow", "workflow"]].map(([label, id]) => (
            <Button
              key={id}
              color="inherit"
              fullWidth
              onClick={() => { scrollTo(id); setMenuOpen(false); }}
              sx={{ justifyContent: "flex-start", py: 1.2, fontSize: "1rem" }}
            >
              {label}
            </Button>
          ))}
          <Button
            color="inherit"
            fullWidth
            onClick={() => { setRequestOpen(true); setMenuOpen(false); }}
            sx={{ justifyContent: "flex-start", py: 1.2, fontSize: "1rem", color: "#facc15", fontWeight: 700 }}
            startIcon={<EvStation sx={{ color: "#facc15" }} />}
          >
            Manager Request
          </Button>
          <Button color="inherit" fullWidth href="/login" sx={{ justifyContent: "flex-start", py: 1.2, fontSize: "1rem" }}>Login</Button>
          <Button variant="contained" fullWidth href="/signup" sx={{ py: 1.2, mt: 0.5 }}>Sign Up</Button>
        </Box>
      </motion.div>

      <Box component="main" id="main">
        {/* Hero */}
        <Container id="hero" maxWidth="xl" sx={{ pt: 18, pb: 10 }}>
          <Grid container spacing={6} alignItems="center">
            {/* LEFT — title, subtitle, buttons */}
            <Grid item xs={12} md={6}>
              <MotionBox initial={{ opacity: 0, x: -80 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                <Chip
                  label="AI Powered Electricity Forecasting"
                  sx={{ mb: 3, bgcolor: "rgba(255,255,255,0.04)", color: "#38bdf8" }}
                />
                <Typography
                  variant="h2"
                  fontWeight={800}
                  sx={{
                    mb: 3,
                    lineHeight: 1.05,
                    background: "linear-gradient(90deg,#38bdf8,#22c55e,#facc15)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  AI-Powered Electricity Demand Forecasting for Delhi
                </Typography>
                <Typography variant="h6" sx={{ color: "#cbd5e1", lineHeight: 1.8 }}>
                  Delhi's peak demand is projected to hit 8,748 MW in summer 2026. Our system uses years of historical load data, daily weather patterns, and city growth trends to forecast electricity demand and help prevent blackouts before they happen.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={4}>
                  <Button size="large" variant="contained" onClick={() => scrollTo("features")}>
                    Explore Project
                  </Button>
                  <Button size="large" variant="outlined" color="inherit" onClick={() => scrollTo("cta")}>
                    View Dashboard
                  </Button>
                </Stack>
              </MotionBox>
            </Grid>

            {/* RIGHT — About + Workflow GIF side by side */}
            <Grid item xs={12} md={6}>
              <MotionBox
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                  alignItems: "start",
                }}
              >
                {/* Left card — About */}
                <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Typography variant="caption" sx={{ color: "#38bdf8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                    About The Project
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5, lineHeight: 1.7 }}>
                    Delhi's demand has grown 35% in a decade. In 2026, peak load is projected at 8,748 MW. Even a 1% forecast error costs electricity boards crores in emergency purchases. This system forecasts demand up to 7 days ahead using historical load data, weather records, and holiday calendars.
                  </Typography>
                </Box>
                {/* Right card — Workflow GIF */}
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <WorkflowPreview />
                </Box>
              </MotionBox>
            </Grid>
          </Grid>
        </Container>

        {/* Features */}
        <Container id="features" sx={{ py: 8 }}>
          <Typography variant="h3" textAlign="center" fontWeight={700} gutterBottom>
            Key Features
          </Typography>
          <Stack spacing={3} mt={4}>
            {features.map((feature, index) => (
              <MotionCard
                key={index}
                whileHover={{ x: 6 }}
                sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "white", borderRadius: 4 }}
              >
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 3, p: 3 }}>
                  <Box sx={{ color: "#38bdf8", flexShrink: 0 }}>{feature.icon}</Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{feature.title}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: "#cbd5e1" }}>{feature.desc}</Typography>
                  </Box>
                </CardContent>
              </MotionCard>
            ))}
          </Stack>
        </Container>

        {/* Workflow */}
        <Container id="workflow" sx={{ py: 10 }}>
          <Typography variant="h3" textAlign="center" fontWeight={700} gutterBottom>
            How You Use This App
          </Typography>
          <Typography variant="body1" textAlign="center" sx={{ color: "#94a3b8", mb: 6 }}>
            From login to action — here's exactly what happens inside the platform
          </Typography>
          <Box sx={{ position: "relative" }}>
            {workflow.map((step, index) => (
              <MotionBox
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -60 : 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: index % 2 === 0 ? "row" : "row-reverse" },
                  alignItems: "center",
                  gap: 4,
                  mb: 6,
                }}
              >
                {/* Step number + icon */}
                <Box sx={{ flexShrink: 0, textAlign: "center" }}>
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      bgcolor: "rgba(56,189,248,0.12)",
                      border: "2px solid #38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      mx: "auto",
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography variant="caption" sx={{ color: "#38bdf8", mt: 1, display: "block", fontWeight: 700 }}>
                    Step {index + 1}
                  </Typography>
                </Box>

                {/* Connector line (hidden on mobile) */}
                {index < workflow.length - 1 && (
                  <Box
                    sx={{
                      display: { xs: "none", md: "block" },
                      position: "absolute",
                      left: "50%",
                      width: 2,
                      height: 60,
                      bgcolor: "rgba(56,189,248,0.2)",
                      transform: `translateY(${index * 148 + 72}px)`,
                    }}
                  />
                )}

                {/* Content card */}
                <Card sx={{ flex: 1, bgcolor: "rgba(255,255,255,0.03)", color: "white", borderRadius: 4, maxWidth: 560 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} color="#38bdf8" gutterBottom>
                      {step.label}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "#e2e8f0", mb: 1 }}>
                      {step.desc}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8" }}>
                      {step.detail}
                    </Typography>
                  </CardContent>
                </Card>
              </MotionBox>
            ))}
          </Box>
        </Container>

        {/* Stats */}
        <Container sx={{ py: 10 }}>
          <Grid container spacing={4}>
            {stats.map((item, index) => (
              <Grid item xs={12} md={3} key={index}>
                <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "white", textAlign: "center", borderRadius: 4 }}>
                  <CardContent>
                    <Typography variant="h3" fontWeight={800} color="#38bdf8">{item.value}</Typography>
                    <Typography variant="h6">{item.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* CTA */}
        <Container id="cta" sx={{ py: 10 }}>
          <Paper sx={{ p: 6, borderRadius: 5, textAlign: "center", background: "linear-gradient(135deg,#0ea5e9,#2563eb,#4f46e5)", color: "white" }}>
            <Speed sx={{ fontSize: 60 }} />
            <Typography variant="h3" fontWeight={800} mt={2}>Ready for Smart Power Management?</Typography>
            <Typography variant="h6" sx={{ mt: 2, maxWidth: 700, mx: "auto" }}>
              Delhi's grid powers over 20 million people every single day. With accurate demand forecasting, electricity boards can prevent blackouts, reduce emergency costs, and plan smarter — keeping the city's lights on no matter the season.
            </Typography>
            <Button
              variant="contained"
              size="large"
              sx={{ mt: 4, bgcolor: "white", color: "#2563eb", fontWeight: 700 }}
              onClick={() => window.open("/dashboard", "_self")}
            >
              Learn More
            </Button>
          </Paper>
        </Container>

        {/* Footer */}
        <Box sx={{ bgcolor: "#020617", py: 4, textAlign: "center" }}>
          <Typography color="#94a3b8">© 2026 Delhi Power AI Forecasting System | Final Year Project</Typography>
        </Box>
      </Box>

      {/* ── Station Manager Request Modal Dialog ─────────────────────────── */}
      <Dialog
        open={requestOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "#090d16",
            color: "white",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 25px 60px -15px rgba(0,0,0,0.85), 0 0 50px rgba(56,189,248,0.08)",
            backgroundImage: "radial-gradient(ellipse at 50% -20%, rgba(56,189,248,0.12), transparent 70%)",
            overflow: "hidden",
          },
        }}
      >
        {/* Neon Accent Glow Strip */}
        <Box sx={{ height: 4, background: "linear-gradient(90deg, #38bdf8 0%, #facc15 50%, #f97316 100%)" }} />

        <DialogTitle sx={{ m: 0, p: 3, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                bgcolor: "rgba(250, 204, 21, 0.12)",
                border: "1px solid rgba(250, 204, 21, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(250, 204, 21, 0.2)",
              }}
            >
              <EvStation sx={{ color: "#facc15", fontSize: 28 }} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={800} color="white">
                  EV Station Manager Onboarding
                </Typography>
                <Chip
                  label="Direct Grid Enrollment"
                  size="small"
                  icon={<VerifiedUser sx={{ "&&": { color: "#38bdf8" }, fontSize: 14 }} />}
                  sx={{
                    bgcolor: "rgba(56,189,248,0.1)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56,189,248,0.25)",
                    fontWeight: 700,
                    fontSize: 10.5,
                  }}
                />
              </Stack>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                Submit station capacity to receive peak-demand advisories, load curtailment alerts & V2G dispatch orders
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleCloseModal} sx={{ color: "#94a3b8", "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.06)" } }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: "rgba(255,255,255,0.08)", p: 3, pt: 2.5 }}>
          {submittedData ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              {/* Success Badge */}
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  bgcolor: "rgba(34, 197, 94, 0.12)",
                  border: "2px solid #22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                  boxShadow: "0 0 30px rgba(34, 197, 94, 0.3)",
                }}
              >
                <CheckCircle sx={{ fontSize: 44, color: "#22c55e" }} />
              </Box>

              <Typography variant="h5" fontWeight={800} color="white" mb={0.5}>
                Station Request Registered!
              </Typography>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 2 }}>
                Reference ID: <strong style={{ color: "#facc15" }}>#REQ-{String(Date.now()).slice(-6)}</strong> &nbsp;|&nbsp; Station: <strong style={{ color: "white" }}>{submittedData.stationName}</strong>
              </Typography>

              <Chip
                icon={<HourglassTop sx={{ "&&": { color: "#facc15" }, fontSize: 16 }} />}
                label="STATUS: PENDING GRID OPERATOR APPROVAL"
                sx={{
                  bgcolor: "rgba(250, 204, 21, 0.15)",
                  color: "#facc15",
                  border: "1px solid rgba(250, 204, 21, 0.4)",
                  fontWeight: 700,
                  fontSize: 12,
                  mb: 3,
                  px: 1,
                  boxShadow: "0 0 15px rgba(250, 204, 21, 0.2)",
                }}
              />

              {/* 3-Step Process Stepper */}
              <Box sx={{ p: 2.5, mb: 3, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 2 }}>
                  Approval & Verification Lifecycle
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 0.5 }}>
                        <CheckCircle sx={{ fontSize: 16 }} /> 1. Request Stored
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.5, fontSize: 11 }}>
                        Profile recorded as PENDING in queue
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.3)" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: "#facc15", display: "flex", alignItems: "center", gap: 0.5 }}>
                        <HourglassTop sx={{ fontSize: 16 }} /> 2. Operator Review
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.5, fontSize: 11 }}>
                        Grid Operator reviews feeder & capacity
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: "#64748b", display: "flex", alignItems: "center", gap: 0.5 }}>
                        ⚡ 3. Active Alert List
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.5, fontSize: 11 }}>
                        Receives peak curtailment & V2G emails
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Station Passport Summary Card */}
              <Paper sx={{ p: 2.5, bgcolor: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, textAlign: "left", mb: 3 }}>
                <Typography variant="caption" sx={{ color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", display: "block", mb: 1 }}>
                  Registered Station Passport
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Manager:</Typography>
                    <Typography variant="body2" fontWeight={700} color="white">{submittedData.name}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Alert Email Address:</Typography>
                    <Typography variant="body2" fontWeight={700} color="#38bdf8">{submittedData.email}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Location / Sub-zone:</Typography>
                    <Typography variant="body2" color="white">{submittedData.stationLocation}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Power Capacity & Ports:</Typography>
                    <Typography variant="body2" fontWeight={700} color="#22c55e">
                      {submittedData.capacityKw} kW &nbsp;|&nbsp; {submittedData.evPorts || 4} EV Ports
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Button
                variant="contained"
                onClick={handleCloseModal}
                sx={{
                  background: "linear-gradient(90deg, #38bdf8, #2563eb)",
                  color: "white",
                  fontWeight: 700,
                  px: 5,
                  py: 1,
                  borderRadius: 2,
                  boxShadow: "0 0 20px rgba(56,189,248,0.4)",
                  "&:hover": { background: "linear-gradient(90deg, #0284c7, #1d4ed8)" },
                }}
              >
                Close & Return to Home
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleRequestSubmit}>
              {requestError && (
                <Alert severity="error" sx={{ mb: 2.5, bgcolor: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 2 }}>
                  {requestError}
                </Alert>
              )}

              {/* ── Group 1: Manager Identity ── */}
              <Box sx={{ p: 2.5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <Person sx={{ color: "#38bdf8", fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#38bdf8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    1. Manager Credentials & Contact
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      size="small"
                      label="Manager Full Name"
                      value={requestForm.name}
                      onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                      placeholder="e.g. Pooja Verma"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person sx={{ color: "#38bdf8", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(56,189,248,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      type="email"
                      fullWidth
                      size="small"
                      label="Official Alert Email"
                      value={requestForm.email}
                      onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                      placeholder="e.g. pooja@saketev.in"
                      helperText="Peak-demand warnings & V2G notices will be delivered here"
                      FormHelperTextProps={{ sx: { color: "#64748b", fontSize: 10 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email sx={{ color: "#38bdf8", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(56,189,248,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Contact Phone / Mobile"
                      value={requestForm.phone}
                      onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone sx={{ color: "#38bdf8", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#38bdf8" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(56,189,248,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#38bdf8" },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        p: 1.2,
                        height: "100%",
                        minHeight: 40,
                        boxSizing: "border-box",
                        borderRadius: 2,
                        bgcolor: "rgba(56, 189, 248, 0.05)",
                        border: "1px dashed rgba(56, 189, 248, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: 1.2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          bgcolor: "rgba(56, 189, 248, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <VerifiedUser sx={{ color: "#38bdf8", fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#38bdf8", fontWeight: 700, display: "block", fontSize: 11 }}>
                          SLDC Real-Time Alert Channel
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", fontSize: 10, lineHeight: 1.2 }}>
                          Emergency peak curtailment alerts and automated V2G discharge orders are delivered to this contact.
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* ── Group 2: Station Profile ── */}
              <Box sx={{ p: 2.5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <EvStation sx={{ color: "#facc15", fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#facc15", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    2. Station Infrastructure & Location
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      size="small"
                      label="EV Station Name"
                      value={requestForm.stationName}
                      onChange={(e) => setRequestForm({ ...requestForm, stationName: e.target.value })}
                      placeholder="e.g. Saket EV Supercharging Station"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EvStation sx={{ color: "#facc15", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#facc15" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(250,204,21,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#facc15" },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      size="small"
                      label="Station Location / Grid Zone"
                      value={requestForm.stationLocation}
                      onChange={(e) => setRequestForm({ ...requestForm, stationLocation: e.target.value })}
                      placeholder="e.g. South Delhi, Saket District Centre"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationOn sx={{ color: "#facc15", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#facc15" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(250,204,21,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#facc15" },
                        },
                      }}
                    />
                    {/* Quick Zone Chips */}
                    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                      {[
                        "South Delhi (BRPL)",
                        "North Delhi (TPDDL)",
                        "East Delhi (BYPL)",
                        "Central / NDMC",
                        "West / Dwarka",
                      ].map((zone) => (
                        <Chip
                          key={zone}
                          size="small"
                          label={zone}
                          onClick={() => setRequestForm({ ...requestForm, stationLocation: zone })}
                          sx={{
                            cursor: "pointer",
                            bgcolor: requestForm.stationLocation === zone ? "rgba(250,204,21,0.25)" : "rgba(255,255,255,0.04)",
                            color: requestForm.stationLocation === zone ? "#facc15" : "#94a3b8",
                            border: `1px solid ${requestForm.stationLocation === zone ? "#facc15" : "rgba(255,255,255,0.08)"}`,
                            fontWeight: 700,
                            fontSize: 10,
                            "&:hover": { bgcolor: "rgba(250,204,21,0.15)", color: "#facc15" },
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* ── Group 3: Grid Capacity & Hardware ── */}
              <Box sx={{ p: 2.5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, mb: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Power sx={{ color: "#22c55e", fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#22c55e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      3. Power Capacity & Ports Setup
                    </Typography>
                  </Stack>
                  {/* Dynamic Station Tier Pill */}
                  {parseFloat(requestForm.capacityKw) > 0 && (
                    <Chip
                      size="small"
                      label={
                        parseFloat(requestForm.capacityKw) >= 350
                          ? "⚡ Tier 1: Ultra-Fast Superhub (High V2G Priority)"
                          : parseFloat(requestForm.capacityKw) >= 150
                          ? "⚡ Tier 2: Rapid DC Fast Station"
                          : "⚡ Tier 3: Standard Charging Station"
                      }
                      sx={{
                        bgcolor: parseFloat(requestForm.capacityKw) >= 350 ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                        color: parseFloat(requestForm.capacityKw) >= 350 ? "#facc15" : "#22c55e",
                        border: "1px solid",
                        borderColor: parseFloat(requestForm.capacityKw) >= 350 ? "rgba(245,158,11,0.35)" : "rgba(34,197,94,0.35)",
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      label="Connected Load / Capacity"
                      value={requestForm.capacityKw}
                      onChange={(e) => setRequestForm({ ...requestForm, capacityKw: e.target.value })}
                      placeholder="e.g. 350"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Power sx={{ color: "#22c55e", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography sx={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>kW</Typography>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#22c55e" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(34,197,94,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#22c55e" },
                        },
                      }}
                    />
                    {/* Quick Capacity Presets */}
                    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                      {[
                        { label: "60 kW", val: 60 },
                        { label: "150 kW", val: 150 },
                        { label: "250 kW", val: 250 },
                        { label: "350 kW", val: 350 },
                        { label: "500 kW", val: 500 },
                      ].map((preset) => (
                        <Chip
                          key={preset.val}
                          size="small"
                          label={preset.label}
                          onClick={() => setRequestForm({ ...requestForm, capacityKw: String(preset.val) })}
                          sx={{
                            cursor: "pointer",
                            bgcolor: String(requestForm.capacityKw) === String(preset.val) ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.04)",
                            color: String(requestForm.capacityKw) === String(preset.val) ? "#22c55e" : "#94a3b8",
                            border: `1px solid ${String(requestForm.capacityKw) === String(preset.val) ? "#22c55e" : "rgba(255,255,255,0.08)"}`,
                            fontWeight: 700,
                            fontSize: 10.5,
                            "&:hover": { bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e" },
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      label="Available EV Ports"
                      value={requestForm.evPorts}
                      onChange={(e) => setRequestForm({ ...requestForm, evPorts: e.target.value })}
                      placeholder="e.g. 6"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ElectricCar sx={{ color: "#22c55e", fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Typography sx={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>Ports</Typography>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#22c55e" },
                        "& .MuiOutlinedInput-root": {
                          color: "white",
                          bgcolor: "rgba(15, 23, 42, 0.6)",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                          "&:hover fieldset": { borderColor: "rgba(34,197,94,0.4)" },
                          "&.Mui-focused fieldset": { borderColor: "#22c55e" },
                        },
                      }}
                    />
                    {/* Quick Ports Presets */}
                    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                      {[2, 4, 8, 12, 16].map((p) => (
                        <Chip
                          key={p}
                          size="small"
                          label={`${p} Ports`}
                          onClick={() => setRequestForm({ ...requestForm, evPorts: String(p) })}
                          sx={{
                            cursor: "pointer",
                            bgcolor: String(requestForm.evPorts) === String(p) ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.04)",
                            color: String(requestForm.evPorts) === String(p) ? "#38bdf8" : "#94a3b8",
                            border: `1px solid ${String(requestForm.evPorts) === String(p) ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                            fontWeight: 700,
                            fontSize: 10.5,
                            "&:hover": { bgcolor: "rgba(56,189,248,0.15)", color: "#38bdf8" },
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* ── Group 4: Technical Notes & V2G Readiness ── */}
              <Box sx={{ p: 2.5, bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <Description sx={{ color: "#a78bfa", fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#a78bfa", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    4. Technical Feeder & V2G Readiness Notes
                  </Typography>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  rows={2.5}
                  size="small"
                  label="Interconnection Notes (Feeder / DISCOM / V2G Capability)"
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                  placeholder="e.g. Connected to 11kV BRPL sub-feeder, bi-directional inverter deployed, automated telemetry ready."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                        <Description sx={{ color: "#a78bfa", fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiInputLabel-root": { color: "#94a3b8", fontSize: 13 },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#a78bfa" },
                    "& .MuiOutlinedInput-root": {
                      color: "white",
                      bgcolor: "rgba(15, 23, 42, 0.6)",
                      borderRadius: 2,
                      "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                      "&:hover fieldset": { borderColor: "rgba(167,139,250,0.4)" },
                      "&.Mui-focused fieldset": { borderColor: "#a78bfa" },
                    },
                  }}
                />
                {/* Quick Technical Tag Chips */}
                <Box sx={{ mt: 1.2, display: "flex", flexWrap: "wrap", gap: 0.8, alignItems: "center" }}>
                  <Typography variant="caption" sx={{ color: "#64748b", fontSize: 10.5, fontWeight: 700, mr: 0.5 }}>
                    Quick Tags:
                  </Typography>
                  {[
                    "⚡ Bi-directional V2G Ready",
                    "🔌 11kV Dedicated Feeder",
                    "🕒 24x7 Public Fast Charging",
                    "📡 Automated SCADA Telemetry",
                    "🔋 On-site BESS (Battery Storage)",
                  ].map((tag) => (
                    <Chip
                      key={tag}
                      size="small"
                      label={tag}
                      onClick={() => {
                        const cleanTag = tag.replace(/^[^\w\s]+/, "").trim();
                        const current = requestForm.notes || "";
                        if (!current.includes(cleanTag)) {
                          setRequestForm({
                            ...requestForm,
                            notes: current ? `${current}, ${cleanTag}` : cleanTag,
                          });
                        }
                      }}
                      sx={{
                        cursor: "pointer",
                        bgcolor: "rgba(167, 139, 250, 0.08)",
                        color: "#c4b5fd",
                        border: "1px solid rgba(167, 139, 250, 0.2)",
                        fontWeight: 600,
                        fontSize: 10,
                        "&:hover": {
                          bgcolor: "rgba(167, 139, 250, 0.2)",
                          color: "#e9d5ff",
                          borderColor: "#a78bfa",
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Dialog Footer Actions */}
              <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                <Typography variant="caption" sx={{ color: "#64748b", maxWidth: 450, fontSize: 11 }}>
                  🔒 Official registration directly registers your station into the Delhi State Load Despatch Centre (SLDC) operator review portal.
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    onClick={handleCloseModal}
                    sx={{
                      color: "#94a3b8",
                      borderRadius: 2,
                      px: 2.5,
                      "&:hover": { color: "white", bgcolor: "rgba(255,255,255,0.05)" },
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    sx={{
                      background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
                      color: "white",
                      fontWeight: 700,
                      px: 3.5,
                      py: 1,
                      borderRadius: 2,
                      boxShadow: "0 0 25px rgba(245, 158, 11, 0.4)",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        background: "linear-gradient(135deg, #d97706 0%, #c2410c 100%)",
                        boxShadow: "0 0 30px rgba(245, 158, 11, 0.6)",
                        transform: "translateY(-1px)",
                      },
                      "&:disabled": {
                        background: "rgba(245, 158, 11, 0.3)",
                        color: "rgba(255,255,255,0.5)",
                      },
                    }}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send sx={{ fontSize: 18 }} />}
                  >
                    {submitting ? "Submitting..." : "Submit Station Registration"}
                  </Button>
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
