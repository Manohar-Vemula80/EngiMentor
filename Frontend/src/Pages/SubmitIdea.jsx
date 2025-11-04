import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const SubmitIdea = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    domain: "",
    techStack: "",
    challenges: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("authToken");

      if (!token) {
        alert("Please login first to submit your project idea.");
        navigate("/login");
        return;
      }

      // 1. Save project idea to your backend
      console.log('Sending Data:', formData);
      const res = await axios.post(
        "http://localhost:5000/api/projects/create",
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 🛑 CRITICAL FIX: Response se naye project ki Sahi MongoDB ID aur pura object nikaalna
      const newProject = res.data.project;
      const newProjectId = newProject._id; // <-- Yeh ObjectId format hai

      alert(res.data.message || "Project Submitted Successfully!");

      // 2. Navigate to AI page, passing Project ID in URL and full project data in state
      // NOTE: Ensure your React Router setup has a route like "/ai/:projectId"
      navigate(`/ai/${newProjectId}`, { 
        state: { 
          project: newProject, // Poora project object bhej diya for robustness
          projectId: newProjectId, // Separate ID bhi bhej di
          projectTitle: newProject.title
        } 
      });

    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Something went wrong. Check if your backend is running.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex justify-center items-center p-6">
      <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-3xl border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800">
            🚀 Submit Your Project Idea
          </h1>
          <p className="text-gray-600 mt-2">
            Share your project details and get AI-powered guidance.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Project Title"
            className="w-full p-3 border rounded-lg"
            required
          />
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Project Description"
            rows="3"
            className="w-full p-3 border rounded-lg"
            required
          />
          <select
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            required
          >
            <option value="">Select Domain</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Civil">Civil</option>
            <option value="IT">IT</option>
          </select>
          <input
            type="text"
            name="techStack"
            value={formData.techStack}
            onChange={handleChange}
            placeholder="Tech Stack (e.g. MERN, IoT, Python)"
            className="w-full p-3 border rounded-lg"
            required
          />
          <textarea
            name="challenges"
            value={formData.challenges}
            onChange={handleChange}
            placeholder="Challenges you foresee..."
            rows="3"
            className="w-full p-3 border rounded-lg"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Submit Idea
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitIdea;