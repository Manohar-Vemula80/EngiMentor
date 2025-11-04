import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";

const LearningSuggestions = () => {
  const navigate = useNavigate();

  const [recommendations] = useState([
    // {
    //   id: 1,
    //   title: "Machine Learning Image Classifier",
    //   description:
    //     "Learn ML basics by building an image classification project using Python and TensorFlow.",
    //   tags: ["ML", "Python", "TensorFlow"],
    // },
    // {
    //   id: 2,
    //   title: "IoT Home Automation",
    //   description:
    //     "Extend your IoT skills by automating lights, fans, and sensors using Node.js and Arduino.",
    //   tags: ["IoT", "Node.js", "Arduino"],
    // },
    // {
    //   id: 3,
    //   title: "Fullstack E-Commerce App",
    //   description:
    //     "Build a complete e-commerce website using MERN stack and payment gateway integration.",
    //   tags: ["MERN", "Fullstack", "React", "Node.js"],
    // },
  ]);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("authToken") || "";
    if (!token) return; // not logged in

    (async () => {
      setLoadingProjects(true);
      setProjectsError("");
      try {
        const res = await axios.get(`${API_BASE_URL}/projects/my-projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          // backend may return { projects: [...] } or an array directly
          const data = Array.isArray(res.data) ? res.data : res.data.projects || [];
          setProjects(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch projects:", err?.response?.data || err.message);
          setProjectsError(err?.response?.data?.message || "Failed to load projects");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartProject = (rec) => {
    alert(`Starting new project: ${rec.title} 🚀`);
    navigate("/submit");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-6">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-2xl p-10 border border-gray-200">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
          📚 Continuous Learning Suggestions
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Based on your completed projects, here are recommended next steps and your projects:
        </p>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Projects</h2>

          {loadingProjects ? (
            <div className="text-gray-600">Loading your projects...</div>
          ) : projectsError ? (
            <div className="text-red-600">{projectsError}</div>
          ) : projects.length === 0 ? (
            <div className="text-gray-600">You have no projects yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p) => {
                const title = p.title || p.name || p.projectName || "Untitled Project";
                const desc = p.description || p.summary || "";
                const tech =
                  p.techStack ||
                  p.techstack ||
                  p.stack ||
                  p.technologies ||
                  p.tags ||
                  [];
                const techArr = Array.isArray(tech)
                  ? tech
                  : typeof tech === "string" && tech.length
                  ? tech.split(",").map((s) => s.trim())
                  : [];

                const projId = p._id || p.id || p.projectId || p.roomId || "";

                return (
                  <div key={projId || Math.random()} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{title}</h3>
                        {desc && <p className="text-sm text-gray-600 mt-1">{desc}</p>}

                        {/* Tech stack badges */}
                        {techArr.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {techArr.map((t, idx) => (
                              <span
                                key={idx}
                                className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* View Project button -> opens ProjectOverview and passes project in state */}
                        <button
                          onClick={() => {
                            if (!projId) return alert("Project id missing");
                            navigate(`/project/${projId}/projectoverview`, { state: { project: p } });
                          }}
                          className="text-sm bg-white border text-indigo-700 px-3 py-1 rounded hover:bg-indigo-50"
                        >
                          View Project
                        </button>

                        {/* Open Collaboration (existing) */}
                        {p.roomId && (
                          <button
                            onClick={() => navigate(`/collaboration/${p.roomId}`, { state: { project: p } })}
                            className="text-sm bg-purple-600 text-white px-3 py-1 rounded"
                          >
                            Open Collaboration
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-5 border rounded-lg shadow-md bg-gray-50 hover:shadow-xl transition cursor-pointer"
              onClick={() => handleStartProject(rec)}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{rec.title}</h2>
              <p className="text-gray-600 mb-2">{rec.description}</p>
              <div className="flex flex-wrap gap-2">
                {rec.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/submit")}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-90 transition"
          >
            Start a New Project 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningSuggestions;
