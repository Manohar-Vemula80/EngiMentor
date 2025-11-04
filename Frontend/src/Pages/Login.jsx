import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const fromState = location.state?.from;
  const storedRedirect = localStorage.getItem("redirectAfterLogin");
  const target = fromState || storedRedirect || "/home";

  const qp = new URLSearchParams(location.search);
  const inviteEmailFromQuery = qp.get("email") || "";
  const prefEmail = location.state?.inviteEmail || inviteEmailFromQuery || "";

  const [formData, setFormData] = useState({ email: prefEmail, password: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFormData((f) => ({ ...f, email: location.state?.inviteEmail || inviteEmailFromQuery || "" }));
  }, [location.state?.inviteEmail, location.search]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const API_BASE = "http://localhost:5000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      // read email/password from formData
      const { email, password } = formData;

      // POST to backend users login route
      const res = await axios.post(`${API_BASE}/users/login`, { email, password });

      const token = res.data.token || res.data?.data?.token;
      const user = res.data.user || res.data?.data?.user || res.data;

      // Save auth locally
      if (token) localStorage.setItem("authToken", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      const invitedEmail = location.state?.inviteEmail;
      if (invitedEmail) {
        if (!user || user.email !== invitedEmail) {
          localStorage.removeItem("authToken");
          localStorage.removeItem("user");
          setMessage(`Please login with the invited email: ${invitedEmail}`);
          return;
        }
      }

      if (storedRedirect) localStorage.removeItem("redirectAfterLogin");

      setTimeout(() => {
        navigate(target, { replace: true });
      }, 150);
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed. Please try again.");
      console.error("Login error:", err?.response || err.message);
    }
  };

  return (
    <div
      className="h-screen w-full bg-cover bg-center flex items-center justify-center relative"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')",
      }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-[90%] max-w-md">
        <h2 className="text-3xl font-bold text-center text-white mb-6">Engineer’s Login</h2>
        {message && <p className="text-center text-red-400 mb-3">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200">Email</label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full mt-1 px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className="w-full mt-1 px-4 py-2 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-green-400"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold shadow-lg transition duration-300"
          >
            Login
          </button>
        </form>

        <p className="text-gray-300 text-sm text-center mt-4">
          Don’t have an account?{" "}
          <span onClick={() => navigate("/")} className="text-green-400 cursor-pointer hover:underline">
            Register
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
