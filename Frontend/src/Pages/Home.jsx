import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";


const Home = () => {
  const API_BASE_URL = "http://localhost:5000/api";
  const API_BASE = "http://localhost:5000/api";
  const [user, setUser] = useState({ name: "Student" }); 
  // later fetch user from backend using token

  // Try load user from localStorage first, then from backend if token present
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
        return;
      }
    } catch (e) {
      // ignore JSON parse errors
    }

    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (!token) return;

    
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res?.data) {
          // support both { user } and direct user object responses
          const u = res.data.user || res.data;
          setUser(u);
          try { localStorage.setItem("user", JSON.stringify(u)); } catch (e) {}
        }
      } catch (err) {
        console.warn("Could not fetch current user:", err?.response?.data || err.message);
      }
    })();
  }, []);
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


  // Example backend fetch (uncomment when backend is ready)
  /*
  useEffect(() => {
    axios.get("/api/users/me", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      
    .then(res => setUser(res.data))
    .catch(err => console.log(err));
  }, []);
  */

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-between">
      <div className="p-6 flex-1">
        {/* Welcome Section */}
        <header className="bg-white shadow-md rounded-2xl p-6 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Welcome, {user?.name || user?.fullName || "Student"}! 👋
            </h1>
            <p className="text-gray-600">Let’s start building your project idea step by step.</p>
          </div>

          {/* Profile icon */}
          <div className="flex items-center gap-4">
            <Link to="/profile" className="flex items-center space-x-3">
              <div
                title={user.name}
                className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold shadow-md"
              >
                {(() => {
                  const names = (user.name || "U").split(" ").filter(Boolean);
                  const initials =
                    names.length === 1
                      ? names[0].charAt(0)
                      : (names[0].charAt(0) + names[names.length - 1].charAt(0));
                  return initials.toUpperCase();
                })()}
              </div>
            </Link>
          </div>
        </header>

        {/* Quick Actions */}
        <section className="grid md:grid-cols-3 w-full gap-6  mb-6">
          <div className="bg-white rounded-2xl  shadow-md p-6 hover:shadow-lg transition cursor-pointer">
            <h2 className="text-lg font-semibold text-gray-800">Submit Idea</h2>
            <p className="text-sm text-gray-600 mt-2 mb-5">
              Share your project idea with details and get AI guidance.
            </p>
            <Link to="/submit" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl">
              Start
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition cursor-pointer">
            <h2 className="text-lg font-semibold text-gray-800">Project's Done by this site </h2>
            <p className="text-sm text-gray-600 mt-2 mb-5">
              learn new skills and technologies to boost your project.
            </p>
            <Link to="/learning" className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl">
              learn
            </Link>
          </div>

          {/* <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition cursor-pointer">
            <h2 className="text-lg font-semibold text-gray-800">Track Progress</h2>
            <p className="text-sm text-gray-600 mt-2 mb-5">
              Keep track of your project milestones and next steps.
            </p>
            <Link to="/progress-tracker" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl">
              Update
            </Link>
          </div> */}
        </section>

        {/* Suggested Section */}
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
      </div>

      {/* --- Info/Footer Section --- */}
      <footer className="bg-gray-900 text-gray-300 p-6 mt-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-white">About</h3>
            <p className="text-sm mt-2">
              This platform helps students turn their project ideas into reality
              with AI guidance, peer collaboration, and progress tracking.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">Quick Links</h3>
            <ul className="text-sm mt-2 space-y-1">
              <li><a href="/submit" className="hover:underline">Submit Idea</a></li>
              <li><a href="/learning" className="hover:underline">Learning</a></li>
              {/* <li><a href="#" className="hover:underline">Track Progress</a></li> */}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">Contact</h3>
            <p className="text-sm mt-2">Email: support@projectai.com</p>
            <p className="text-sm">Phone: +91-9876543210</p>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 mt-6">
          © {new Date().getFullYear()} Project AI Platform. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Home;
