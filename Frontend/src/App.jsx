import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Pages/Login.jsx";
import Register from "./Pages/Register.jsx";
import Home from "./Pages/Home";
import SubmitIdea from "./Pages/SubmitIdea";
import AIAnalysis from "./Pages/AIanalysis";
import Collaboration from "./Pages/Collabration";
import ProgressTracker from "./Pages/ProgressTracker";
import LearningSuggestions from "./Pages/learning";
import ProtectedRoute from "./Pages/ProtectedRoute.jsx";
import Invite from "./Pages/Invite.jsx";
import Profile from "./Pages/Profile.jsx";
import ProjectOverview from "./Pages/ProjectOverview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/submit" element={<SubmitIdea />} />
        <Route path="/AI/:projectId" element={<AIAnalysis />} />
        <Route path="/learning" element={<LearningSuggestions />} />
        <Route path="/progress-tracker/:projectId" element={<ProgressTracker />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/project/:projectId/overview" element={<ProjectOverview />} />

        {/* Ensure route(s) that match navigation paths */}
        <Route path="/project/:projectId/projectoverview" element={<ProjectOverview />} />
        <Route path="/project/:projectId/overview" element={<ProjectOverview />} />
        {/* optional aliases */}
        <Route path="/project/:projectId" element={<ProjectOverview />} />

        {/* ✅ Protected Collaboration route */}
        <Route
          path="/collaboration/:roomId"
          element={
            <ProtectedRoute>
              <Collaboration />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
