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
} from "@mui/material";
import {
  Bolt,
  TrendingUp,
  Psychology,
  ElectricBolt,
  Insights,
  Speed,
  ArrowForward,
} from "@mui/icons-material";
import { motion } from "framer-motion";

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
    </Box>
  );
}
