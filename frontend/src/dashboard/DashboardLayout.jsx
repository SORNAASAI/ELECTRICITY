import React, { useState } from "react";
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Avatar, Divider, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
} from "@mui/material";
import {
  Dashboard as DashboardIcon, BarChart, Person, Bolt,
  Menu as MenuIcon, Logout, ChevronLeft, WarningAmber,
  ShowChart, BoltOutlined, Speed, Info, ElectricCar, Engineering,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { getUser, logoutUser, isAnalyst } from "../api/authService";

const DRAWER_WIDTH = 240;

const ALL_NAV = [
  { label: "Dashboard",         icon: <DashboardIcon />, path: "/dashboard",        roles: ["ANALYST", "OPERATOR"] },
  { label: "Analysis",          icon: <BarChart />,       path: "/dashboard/analysis", roles: ["ANALYST", "OPERATOR"] },
  { label: "Forecast",          icon: <ShowChart />,      path: "/dashboard/forecast", roles: ["ANALYST", "OPERATOR"] },
  { label: "Peak Demand",       icon: <Speed />,          path: "/dashboard/peak",     roles: ["ANALYST", "OPERATOR"] },
  { label: "V2G Optimization",  icon: <ElectricCar />,    path: "/dashboard/v2g",      roles: ["ANALYST", "OPERATOR"] },
  { label: "Station Managers",  icon: <Engineering />,    path: "/dashboard/managers", roles: ["OPERATOR"] },
  { label: "Model Performance", icon: <BoltOutlined />,   path: "/dashboard/models",   roles: ["ANALYST"] },
  { label: "About",             icon: <Info />,           path: "/dashboard/about",    roles: ["ANALYST", "OPERATOR"] },
  { label: "Profile",           icon: <Person />,         path: "/dashboard/profile",  roles: ["ANALYST", "OPERATOR"] },
];

export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user     = getUser();
  const role     = user?.role || "OPERATOR";
  const navItems = ALL_NAV.filter((item) => item.roles.includes(role));
  const roleLabel   = role === "ANALYST" ? "Analyst" : "Grid Operator";
  const roleColor   = role === "ANALYST" ? "#a78bfa" : "#38bdf8";
  const roleBg      = role === "ANALYST" ? "rgba(167,139,250,0.12)" : "rgba(56,189,248,0.12)";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#0f172a" }}>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: open ? DRAWER_WIDTH : 72,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: open ? DRAWER_WIDTH : 72,
            bgcolor: "#020617",
            color: "white",
            border: "none",
            transition: "width 0.3s ease",
            overflowX: "hidden",
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 2, minHeight: 64 }}>
          <Bolt sx={{ color: "#38bdf8", fontSize: 28, flexShrink: 0 }} />
          {open && (
            <Typography variant="h6" fontWeight={800} ml={1}>
              <span style={{ color: "#38bdf8" }}>Electri</span>
              <span style={{ color: "#facc15" }}>City</span>
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

        {/* Nav */}
        <List sx={{ mt: 1, px: 1 }}>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Tooltip key={item.path} title={!open ? item.label : ""} placement="right">
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2, mb: 0.5,
                    bgcolor: active ? "rgba(56,189,248,0.12)" : "transparent",
                    color: active ? "#38bdf8" : "#94a3b8",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.05)", color: "white" },
                    justifyContent: open ? "flex-start" : "center",
                    px: open ? 2 : 1,
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: open ? 36 : "auto" }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.label} />}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>

        {/* Logout */}
        <Box sx={{ mt: "auto", px: 1, pb: 2 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 1 }} />
          <Tooltip title={!open ? "Logout" : ""} placement="right">
            <ListItemButton
              onClick={() => setLogoutDialog(true)}
              sx={{
                borderRadius: 2,
                color: "#94a3b8",
                "&:hover": { bgcolor: "rgba(239,68,68,0.1)", color: "#f87171" },
                justifyContent: open ? "flex-start" : "center",
                px: open ? 2 : 1,
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: open ? 36 : "auto" }}>
                <Logout />
              </ListItemIcon>
              {open && <ListItemText primary="Logout" />}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Drawer>

      {/* Main */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: "rgba(2,6,23,0.8)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Toolbar>
            <IconButton onClick={() => setOpen(!open)} sx={{ color: "#94a3b8", mr: 2 }}>
              {open ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>
            <Typography variant="h6" fontWeight={600} color="white" sx={{ flexGrow: 1 }}>
              Delhi Power AI — Forecasting System
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ px: 1.5, py: 0.4, borderRadius: 2, bgcolor: roleBg, border: `1px solid ${roleColor}44` }}>
                <Typography variant="caption" sx={{ color: roleColor, fontWeight: 700, fontSize: 11 }}>{roleLabel}</Typography>
              </Box>
              <Typography variant="body2" color="#94a3b8">{user?.name}</Typography>
              <Avatar sx={{ width: 34, height: 34, bgcolor: "#0ea5e9", fontSize: 14 }}>
                {user?.name?.[0]?.toUpperCase() || "U"}
              </Avatar>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flexGrow: 1, overflow: "auto", p: 3 }}>
          {children}
        </Box>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialog}
        onClose={() => setLogoutDialog(false)}
        PaperProps={{
          sx: {
            bgcolor: "#0f172a",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 3,
            color: "white",
            minWidth: 360,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WarningAmber sx={{ color: "#f87171", fontSize: 22 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="white">Confirm Logout</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: "#94a3b8", lineHeight: 1.7 }}>
            Are you sure you want to log out? You will need to sign in again to access the dashboard.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setLogoutDialog(false)}
            variant="outlined"
            sx={{ borderColor: "rgba(255,255,255,0.12)", color: "#94a3b8", "&:hover": { borderColor: "#38bdf8", color: "white" }, borderRadius: 2, flex: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={logoutUser}
            variant="contained"
            sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" }, borderRadius: 2, flex: 1, fontWeight: 700 }}
          >
            Yes, Logout
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
