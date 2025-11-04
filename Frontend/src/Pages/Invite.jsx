import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const Invite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying invite...");

  useEffect(() => {
    if (!token) {
      setMessage("Invalid invite link.");
      return;
    }

    (async () => {
      try {
        // ✅ Call the correct backend verification endpoint
        const res = await axios.get(
          `http://localhost:5000/api/chat/verify/${encodeURIComponent(token)}`
        );

        const { roomId, inviteEmail, projectId } = res.data;
        if (!roomId) throw new Error("Invalid invite data");

        // ✅ Check if user already logged in
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("authToken");
        const currentEmail = storedUser ? JSON.parse(storedUser).email : null;

        // ✅ If logged in and matches invited email → go directly to collaboration
        if (storedToken && currentEmail) {
          if (
            inviteEmail &&
            currentEmail.toLowerCase() === inviteEmail.toLowerCase()
          ) {
            navigate(`/collaboration/${roomId}?projectId=${projectId || ""}`, {
              replace: true,
            });
            return;
          }

          // Logged-in user is different → force logout and re-login
          localStorage.removeItem("authToken");
          localStorage.removeItem("user");
        }

        // ✅ Not logged in → redirect to login with prefilled invited email
        navigate("/login", {
          replace: true,
          state: {
            from: `/collaboration/${roomId}?projectId=${projectId || ""}`,
            inviteEmail: inviteEmail || "",
          },
        });
      } catch (err) {
        console.error("Invite verify error:", err);
        setMessage(err.response?.data?.message || "Invite invalid or expired.");
        // Redirect to homepage after short delay
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  );
};

export default Invite;
