import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./landingpage/landingpage";
import Login from "./landingpage/login";
import Signup from "./landingpage/signup";
import Dashboard from "./dashboard/Dashboard";
import Analysis from "./dashboard/Analysis";
import Profile from "./dashboard/Profile";
import { isAuthenticated } from "./api/authService";

const PrivateRoute = ({ element }) =>
  isAuthenticated() ? element : <Navigate to="/login" replace />;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/dashboard/analysis" element={<PrivateRoute element={<Analysis />} />} />
        <Route path="/dashboard/profile" element={<PrivateRoute element={<Profile />} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
