import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("authToken");
  const location = useLocation();

  // Save full path including query params (e.g., /collaboration/room123?email=abc)
  if (!token) {
    const fullPath = location.pathname + location.search;
    localStorage.setItem("redirectAfterLogin", fullPath);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
