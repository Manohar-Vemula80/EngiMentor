import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE =  "http://localhost:5000/api";

const Profile = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: "John Doe",
    email: "johndoe@example.com",
    branch: "Mechanical",
    skills: "CAD, SolidWorks",
    pastProjects: "Bridge Model, Robotic Arm",
  });

  const handleLogout = () => {
    try {
      localStorage.removeItem("authToken");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      navigate("/login");
    }
  };

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // load from localStorage first
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      // ignore parse errors
    }

    // then try server if token present
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (!token) return;

    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const u = res.data?.user || res.data;
        if (u) {
          setUser((prev) => ({ ...prev, ...u }));
          try {
            localStorage.setItem("user", JSON.stringify(u));
          } catch (e) {}
        }
      } catch (err) {
        console.warn("Could not fetch user:", err?.response?.data || err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    try {
      if (!token) {
        // offline save to localStorage
        localStorage.setItem("user", JSON.stringify(user));
        setEditMode(false);
        setSaving(false);
        return;
      }
      const res = await axios.put(
        `${API_BASE}/users/me`,
        { ...user },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = res.data?.user || res.data || user;
      setUser(updated);
      try {
        localStorage.setItem("user", JSON.stringify(updated));
      } catch (e) {}
      setEditMode(false);
    } catch (err) {
      console.error("Failed to save profile:", err?.response?.data || err.message);
      alert("Save failed. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  // Function to get initials from name
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-gray-200 to-gray-100 flex justify-center items-start pt-16 pb-16">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center space-x-6">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl font-bold text-blue-600">
            {getInitials(user.name)}
          </div>
          <div>
            <h1 className="text-white text-3xl font-bold">{user.name}</h1>
            <p className="text-white/80">{user.email}</p>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-8 space-y-6">
          {/* Branch */}
          <div className="border-b pb-4">
            <label className="block text-gray-600 font-semibold mb-1">Branch</label>
            {editMode ? (
              <select
                name="branch"
                value={user.branch || ""}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select Domain</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="Software">Software</option>
                <option value="IT">IT</option>
              </select>
            ) : (
              <p className="text-gray-700 text-lg">{user.branch}</p>
            )}
          </div>

          {/* Skills */}
          <div className="border-b pb-4">
            <label className="block text-gray-600 font-semibold mb-1">Skills</label>
            {editMode ? (
              <input
                type="text"
                name="skills"
                value={user.skills || ""}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <p className="text-gray-700 text-lg">{user.skills}</p>
            )}
          </div>

          {/* Past Projects */}
          <div className="border-b pb-4">
            <label className="block text-gray-600 font-semibold mb-1">Past Projects</label>
            {editMode ? (
              <textarea
                name="pastProjects"
                value={user.pastProjects || ""}
                onChange={handleChange}
                rows="4"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <p className="text-gray-700 text-lg">{user.pastProjects}</p>
            )}
          </div>

          {/* Edit / Save Button */}
          <div className="flex justify-center mt-6">
            {editMode ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-10 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="bg-blue-600 text-white px-10 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
              >
                Edit Profile
              </button>
            )}
          </div>
          {/* Absolute logout button at bottom-right */}
          <div className="absolute bottom-6 right-6">
            <button
              onClick={handleLogout}
              className="bg-white/20 text-gray-800 px-4 py-2 rounded-lg border border-gray-200 hover:bg-red-600 hover:text-white shadow-sm transition-colors duration-200 focus:outline-none"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
