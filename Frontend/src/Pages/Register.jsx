import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const API_BASE =  "http://localhost:5000/api";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/login";

  const qp = new URLSearchParams(location.search);
  const inviteEmailFromQuery = qp.get("email") || "";

  const [form, setForm] = useState({
    name: "",
    email: inviteEmailFromQuery || "",
    password: "",
    branch: "",
    skills: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm((f) => ({ ...f, email: location.state?.inviteEmail || inviteEmailFromQuery || "" }));
  }, [location.state?.inviteEmail, location.search]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // Basic client-side validation
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setMessage("Please fill all required fields.");
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        branch: form.branch.trim(),
        // send skills as array if comma separated, otherwise single string
        skills:
          form.skills.indexOf(",") !== -1
            ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
            : form.skills.trim() ? [form.skills.trim()] : [],
      };

      const res = await axios.post(`${API_BASE}/users/register`, payload);

      const token = res.data?.token || res.data?.data?.token;
      const user = res.data?.user || res.data?.data?.user || res.data;

      if (token) localStorage.setItem("authToken", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      navigate(from, { replace: true });
    } catch (err) {
      console.error("Register error:", err?.response || err.message);
      const serverMsg =
        err?.response?.data?.message ||
        (typeof err?.response?.data === "string" ? err.response.data : null);
      setMessage(serverMsg || "Registration failed");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')",
      }}
    >
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Student Register</h2>
        {message && <p className="text-center text-sm text-red-500 mb-3">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <input
            type="text"
            name="branch"
            placeholder="branch"
            value={form.branch}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <input
            type="text"
            name="skills"
            placeholder="skills (comma separated for multiple)"
            value={form.skills}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            type="submit"
            className="w-full bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600 transition duration-300"
          >
            Register
          </button>
        </form>
        <p className="text-sm text-center text-gray-600 mt-4">
          Already have an account?{" "}
          <span onClick={() => navigate("/login", { state: { from } })} className="text-purple-600 cursor-pointer hover:underline">
            Login
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;
