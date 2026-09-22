import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./landingpage/landingpage";
import Login from "./landingpage/login";
import Signup from "./landingpage/signup";
import Dashboard from "./dashboard/Dashboard";
import Analysis from "./dashboard/Analysis";
import Profile from "./dashboard/Profile";
import Forecast from "./dashboard/Forecast";
import PeakDemand from "./dashboard/PeakDemand";
import V2GOptimization from "./dashboard/V2GOptimization";
import ModelPerformance from "./dashboard/ModelPerformance";
import About from "./dashboard/About";
import StationManagers from "./dashboard/StationManagers";
import { isAuthenticated, isAnalyst } from "./api/authService";

const PrivateRoute = ({ element }) =>
  isAuthenticated() ? element : <Navigate to="/login" replace />;

const AnalystRoute = ({ element }) =>
  isAuthenticated()
    ? isAnalyst() ? element : <Navigate to="/dashboard" replace />
    : <Navigate to="/login" replace />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard"          element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/dashboard/analysis" element={<PrivateRoute element={<Analysis />} />} />
        <Route path="/dashboard/forecast" element={<PrivateRoute element={<Forecast />} />} />
        <Route path="/dashboard/peak"     element={<PrivateRoute element={<PeakDemand />} />} />
        <Route path="/dashboard/v2g"      element={<PrivateRoute element={<V2GOptimization />} />} />
        <Route path="/dashboard/managers" element={<PrivateRoute element={<StationManagers />} />} />
        <Route path="/dashboard/about"    element={<PrivateRoute element={<About />} />} />
        <Route path="/dashboard/profile"  element={<PrivateRoute element={<Profile />} />} />
        {/* Analyst-only routes */}
        <Route path="/dashboard/models"   element={<AnalystRoute element={<ModelPerformance />} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
