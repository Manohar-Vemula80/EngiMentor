import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE_URL = "http://localhost:5000/api";

const AIAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 🛑 FIX 1: Retrieve project ID and title correctly from location.state 
  const activeProjectId = location.state?.projectId || location.state?.project?._id || null;
  const projectTitle = location.state?.projectTitle || location.state?.project?.title || "Untitled Project";
  
  // 🛑 FIX 2: Consolidate all project data for summary and for the Collaboration page
  // Fallback to safe defaults if state is missing
  const projectDetailsFromState = location.state?.project || {}; // This is the full project object from SubmitIdea (if available)

  const projectData = {
    _id: activeProjectId,
    title: projectTitle,
    description: projectDetailsFromState.description || "No description provided.",
    domain: projectDetailsFromState.domain || "Not specified",
    techStack: projectDetailsFromState.techStack || "Unknown",
    challenges: projectDetailsFromState.challenges || "No challenges listed.",
  };
  
  // Check if we have a valid ID for fetching/creating chat room
  const isProjectValid = projectData._id && projectData._id !== "null";

  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch AI analysis
  useEffect(() => {
    const fetchAIAnalysis = async () => {
      if (!isProjectValid) {
        setAiResponse("Cannot analyze: Missing valid Project ID.");
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          alert("Please login first to access AI analysis.");
          navigate("/login");
          return;
        }

        const res = await axios.post(
          `${API_BASE_URL}/ai/analyze`,
          { 
            // Send required data to backend
            projectDescription: projectData.description,
            projectId: projectData._id 
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setAiResponse(res.data.analysis || "No AI response received.");
      } catch (error) {
        console.error("❌ AI analysis error:", error.response?.data || error);
        // Display specific error message if available
        setAiResponse("AI analysis failed: " + (error.response?.data?.message || "Please check server logs."));
      } finally {
        setLoading(false);
      }
    };

    fetchAIAnalysis();
  }, [projectData._id, projectData.description, navigate]);


  // Handle dynamic collaboration room
  const handleGoToCollaboration = async () => {
    if (!isProjectValid) {
      alert("Cannot proceed to collaboration: Invalid Project ID.");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      if (!token) return navigate("/login");

      // 1. Try to get existing room (using Project ID)
      let res = await axios.get(
        `${API_BASE_URL}/chat/project/${projectData._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let roomId = res.data?.roomId;

      // 2. If room doesn't exist, create it dynamically
      if (!roomId) {
        console.log("Chat room not found, creating new room...");
        res = await axios.post(
          `${API_BASE_URL}/chat/create`,
          { projectId: projectData._id, title: projectData.title }, // Pass project details for room creation
          { headers: { Authorization: `Bearer ${token}` } }
        );
        roomId = res.data.roomId;
      }

      if (!roomId) {
        alert("Failed to open collaboration room. Room ID is missing.");
        return;
      }

      // 3. Navigate to collaboration page, passing the room ID in the URL 
      // and the full project object in state.
      navigate(`/collaboration/${roomId}`, { state: { project: projectData } });
    } catch (err) {
      console.error("❌ Failed to open collaboration room:", err.response?.data || err);
      alert("Could not open collaboration room. Check if the project ID is valid and backend is running.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl p-10 border border-gray-200">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-4 text-center">
          🤖 AI Analysis & Guidance
        </h1>

        <p className="text-center text-gray-600 mb-6">
          Here’s what the AI suggests for your project idea.
        </p>

        {/* Project Summary */}
        <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-5 rounded-lg shadow-inner mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Project Summary
          </h2>
          <ul className="space-y-1 text-gray-800">
            <li><strong>Title:</strong> {projectData.title}</li>
            <li><strong>Description:</strong> {projectData.description}</li>
            <li><strong>Domain:</strong> {projectData.domain}</li>
            <li><strong>Tech Stack:</strong> {projectData.techStack}</li>
            <li><strong>Challenges:</strong> {projectData.challenges}</li>
{/*             {projectData._id && <li><strong>ID:</strong> {projectData._id}</li>} */}
          </ul>
        </div>

        {/* AI Output */}
        <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            🧩 AI Analysis
          </h2>
          {loading ? (
            <p className="text-gray-600 italic">Analyzing your project idea...</p>
          ) : (
            <div className="prose prose-indigo dark:prose-invert max-w-none leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {aiResponse}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Continue to Collaboration */}
        <button
          onClick={handleGoToCollaboration}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 rounded-lg shadow-md hover:opacity-90 transition"
          disabled={!isProjectValid} // Disable if ID is missing
        >
          Continue to Collaboration 🚀
        </button>
      </div>
    </div>
  );
};

export default AIAnalysis;