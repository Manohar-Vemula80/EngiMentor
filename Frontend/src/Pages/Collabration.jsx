import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";

// --- Constants & Helpers ---
const API_BASE_URL = "http://localhost:5000/api";
// const SOCKET_SERVER_URL = "http://localhost:5000"; // Already used inline

const getAuthToken = () => localStorage.getItem("authToken");
const getUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

const Collaboration = () => {
  const navigate = useNavigate();
  const { roomId: paramRoomId } = useParams();
  const location = useLocation();

  // Project ID extraction logic
  const project = location.state?.project || null;
  const qp = new URLSearchParams(location.search);
  const projectIdFromQP = qp.get("projectId") || null;
  const inviteEmailFromLink = qp.get("email") || null;

  const [inviteEmail, setInviteEmail] = useState(inviteEmailFromLink || "");
  const [inviteLink, setInviteLink] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [roomId, setRoomId] = useState(paramRoomId || null);
  const [mongoProjectId, setMongoProjectId] = useState(null);

  // 🛠️ NEW STATE: To hold project title fetched from API
  const [projectDetails, setProjectDetails] = useState({ 
      // Use project title from location.state if available, otherwise use fallback
      title: project?.title || "Project Collaboration" 
  }); 

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const startedRef = useRef(false); // guard against double init (React StrictMode)

  const token = getAuthToken();
  const user = getUser();
  const userId = user?._id || user?.id; // Standardized User ID

  // resolved project id used for navigation (MongoDB ID)
  const activeProjectId =
project?._id || project?.id || project?.projectId || projectIdFromQP || paramRoomId || null;
  const progressDisabled = !activeProjectId;
  
  // 🛠️ UPDATED: Project Title for display now uses the state
  const displayTitle = projectDetails.title;


  // Redirect to login if not authenticated
  useEffect(() => {
    if (!token) {
      navigate("/login", {
        state: {
          from: location.pathname + location.search,
          inviteEmail: inviteEmailFromLink,
        },
      });
    }
  }, [token, navigate, location, inviteEmailFromLink]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };
  
// ------------------------------------------
// 🛠️ NEW EFFECT: Fetch Project Details if needed (Fixes title on refresh)
// ------------------------------------------
  useEffect(() => {
    const fetchProjectDetails = async () => {
      // prefer explicit mongoProjectId (from chat), then query / location.project ids
      const idToFetch =
        mongoProjectId ||
        projectIdFromQP ||
        project?._id ||
        project?.id ||
        project?.projectId ||
        null;

      if (!idToFetch || !token) return; // do not use roomId here

      // Only fetch when title is missing or default
      const needsFetch = !projectDetails.title || projectDetails.title === "Project Collaboration";

      if (!needsFetch) return;

      try {
        const res = await axios.get(`${API_BASE_URL}/projects/${idToFetch}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const fetchedTitle = res.data?.project?.title || res.data?.title || res.data?.name;
        if (fetchedTitle) {
          setProjectDetails({ title: fetchedTitle });
        } else {
          setProjectDetails((prev) => ({ ...prev, title: "Untitled Project" }));
        }
      } catch (err) {
        console.error("Failed to fetch project details:", err);
        setProjectDetails((prev) => ({ ...prev, title: "Error Loading Title" }));
      }
    };

    fetchProjectDetails();
  }, [mongoProjectId, projectIdFromQP, project, token]); 


// ------------------------------------------
// Fix 1: Chat Room Fetching Logic
// ------------------------------------------
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        // Backend expects Project ID to find/create the chat room
        const idToUse = activeProjectId;

        if (!roomId && idToUse) {
          const res = await axios.get(
            `${API_BASE_URL}/chat/project/${idToUse}`, // Use idToUse (Project ID)
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data?.roomId) setRoomId(res.data.roomId);
          if (res.data?.projectId) {
              setMongoProjectId(res.data.projectId); // <--- ADD THIS LINE
          }
        }
      } catch (err) {
        console.error("Failed to get room:", err.response?.data?.message || err.message);
      }
    };
    if (token) fetchRoom();
  }, [activeProjectId, roomId, token]); // Dependencies fixed

// ------------------------------------------
// Socket Setup (Keeping your robust logic, but cleaning up)
// ------------------------------------------
  useEffect(() => {
    if (!roomId || !token) return;

    // Prevent duplicate sockets (StrictMode or re-runs)
    if (socketRef.current && socketRef.current.connected) {
      console.log("Collaboration: socket already active, skipping create.");
      return;
    }
    // This guard helps prevent connection attempts while cleanup is running or during fast refresh
    if (startedRef.current) return; 
    startedRef.current = true; // Mark as started

    const rawToken = token?.startsWith?.("Bearer ") ? token.split(" ")[1] : token;
    console.log("Collaboration: connecting socket, roomId:", roomId, "haveToken:", !!rawToken);

    const socket = io("http://localhost:5000", { auth: { token: rawToken } });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id, "— emitting joinRoom");
      socket.emit("joinRoom", { roomId, token: rawToken });
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error:", err);
    });

    // Server-side check that redirects user if needed
    socket.on("joinError", (err) => {
      console.warn("joinError from server:", err);
      const target = location.pathname + location.search;
      localStorage.setItem("redirectAfterLogin", target);
      const queryEmail = new URLSearchParams(location.search).get("email") || "";
      const serverInviteEmail = err?.inviteEmail || "";
      const invite = queryEmail || inviteEmailFromLink || serverInviteEmail || "";
      navigate("/login", { state: { from: target, inviteEmail: invite } });
    });

    socket.on("newMessage", (msg) => {
      setMessages((prev) => {
        // Try to find an optimistic (pending) message we can replace.
        // Match on pending flag + same text + same sender (safer than text-only).
        const pendingIndex = prev.findIndex(
          (m) => m.pending && m.text === msg.text && (m.senderId === msg.senderId || m.senderName === msg.senderName)
        );

        if (pendingIndex !== -1) {
          // Replace the optimistic entry with the server message
          const next = [...prev];
          next.splice(pendingIndex, 1, msg);
          return next;
        }

        // Prevent exact duplicates (basic guard)
        const already = prev.some(
          (m) =>
            (m._id && msg._id && m._id === msg._id) ||
            (m.text === msg.text && String(m.timestamp) === String(msg.timestamp))
        );
        if (already) return prev;

        return [...prev, msg];
      });
    });

    socket.on("roomUsers", (u) => console.log("Users in room:", u));
    socket.on("disconnect", (reason) => console.log("Socket disconnected:", reason));

    // fetch chat history after socket join (so history + live messages align)
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/chat/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // response may be array (messages) or object with messages + metadata
        const data = res.data;

        if (Array.isArray(data)) {
          setMessages(data);
        } else if (data?.messages) {
          setMessages(data.messages);
        } else {
          setMessages([]);
        }

        // IMPORTANT: if backend returns a projectId or project inside the chat doc,
        // save it so we can fetch the project details (handles case when friend opens invite link)
        const resolvedProjectId =
          data?.projectId ||
          data?.project?._id ||
          data?.project?.id ||
          // sometimes backend may return project as string
          (typeof data?.project === "string" ? data.project : null);

        if (resolvedProjectId) {
          // only set if not already set to avoid unnecessary refetches
          setMongoProjectId((prev) => prev || resolvedProjectId);
        }
      } catch (e) {
        console.error("Chat history error:", e);
      }
    })();

    return () => {
      startedRef.current = false; // Mark as clean
      if (socketRef.current) {
        socketRef.current.off(); // Remove all listeners
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId, token]); 


  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // Invite another collaborator
  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      if (!roomId) {
        alert("Please wait for the chat room to initialize.");
        return;
      }

      const myEmail = user?.email?.toLowerCase?.();
      const target = inviteEmail?.trim()?.toLowerCase?.();
      if (!target) {
        alert("Enter a valid email.");
        return;
      }
      if (myEmail && target === myEmail) {
        alert("You cannot invite your own email. Enter your friend's email.");
        return;
      }

      // keep server invite (email) call for notifications
      await axios.post(
        `${API_BASE_URL}/chat/${roomId}/invite`,
        { email: inviteEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Build an invite link that includes projectId so recipient can fetch project details
      const pid = activeProjectId || mongoProjectId || project?._id || project?.id || "";
      const origin = window.location.origin;
      const qp = new URLSearchParams();
      if (pid) qp.set("projectId", pid);
      qp.set("email", inviteEmail.trim().toLowerCase());
      const link = `${origin}/collaboration/${roomId}?${qp.toString()}`;

      setInviteLink(link);
      alert(`✅ Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err) {
      alert("❌ Failed to send invite: " + (err.response?.data?.message || err.message));
    }
  };


  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !roomId) return;

    const text = newMessage.trim();

    // optimistic local append with a pending flag and sender id
    const optimistic = {
      senderId: userId,
      senderName: user?.name || user?.username || user?.email || "You",
      text,
      timestamp: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    // Emit to server
    socketRef.current.emit("chatMessage", { roomId, text });

    setNewMessage("");
  };

  // Close chat (archive/save)
  const handleCloseChat = async () => {
    if (!roomId) return alert("No active chat room to close.");
    if (!window.confirm("Close this chat and archive messages?")) return;
    try {
      await axios.put(
        `${API_BASE_URL}/chat/${roomId}/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Chat closed and archived.");
      // optionally navigate away or disable UI
      setRoomId(null);
      setMessages([]);
      setInviteLink("");
    } catch (err) {
      console.error("Failed to close chat:", err);
      alert("Failed to close chat. See console.");
    }
  };

  // optional: notify server on page unload (best-effort)
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!roomId) return;
      // synchronous navigator send is unreliable; do a best-effort fetch with keepalive
      try {
        navigator.sendBeacon(`${API_BASE_URL}/chat/${roomId}/close`, "");
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [roomId]);


  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-center mb-4">🤝 Collaboration Hub</h1>

        {/* Project Title Display */}
        {activeProjectId && (
          <div className="mb-4 p-3 bg-blue-50 rounded border">
            {/* Display loading message if project title is still the hardcoded fallback */}
            <strong>Project:</strong> {displayTitle === "Project Collaboration" && activeProjectId ? "Loading Project Title..." : displayTitle}
          </div>
        )}
        {!roomId && (
          <div className="mb-4 text-center text-orange-500">Loading chat room...</div>
        )}

        {/* Invite Section */}
        <form onSubmit={handleInvite} className="flex gap-3 mb-6">
          <input
            type="email"
            placeholder="Enter peer's email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 p-3 border rounded"
            required
            disabled={!roomId}
          />
          <button
            type="submit"
            className="px-5 py-2 bg-indigo-600 text-white rounded disabled:bg-indigo-300"
            disabled={!roomId}
          >
            Invite
          </button>
        </form>

        {inviteLink && (
          <div className="mb-4 text-green-700 break-words p-3 bg-green-100 rounded border border-green-300">
            Invite Link:{" "}
            <a href={inviteLink} target="_blank" rel="noreferrer" className="underline font-mono text-sm text-blue-600">
              {inviteLink}
            </a>
          </div>
        )}

        {/* Chat Section */}
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="font-semibold mb-2">💬 Chat</h2>

          <div className="h-64 overflow-y-auto p-3 bg-white border rounded mb-3">
            {messages.map((m, i) => {
              // Check if senderId matches either user._id or user.id
              const isMe = m.senderId === userId;
              // Show the actual registered name for your own messages (fallback to "You")
              const senderDisplay = isMe ? (user?.name || user?.username || "You") : m.senderName || "Unknown";
              const time = m.timestamp
                ? new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div key={i} className={`mb-2 ${isMe ? "text-right" : "text-left"}`}>
                  <div
                    className={`inline-block p-2 rounded-lg max-w-[80%] ${
                      isMe ? "bg-blue-100" : "bg-gray-200"
                    } ${m.pending ? 'opacity-70 border border-dashed border-gray-500' : ''}`}
                  >
                    <span
                      className={`block text-xs font-bold mb-1 ${isMe ? "text-blue-600" : "text-purple-700"
                        }`}
                    >
                      {senderDisplay} {m.pending && '(Sending...)'}
                    </span>
                    <span className="text-sm">{m.text}</span>
                    <div className="text-xs mt-1 text-gray-500">{time}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 border rounded disabled:bg-gray-100"
              disabled={!roomId}
            />
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-blue-300"
              disabled={!roomId || !newMessage.trim()}
            >
              Send
            </button>
          </form>
        </div>

        {/* Close Chat and Progress Tracker buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleCloseChat}
            disabled={!roomId}
            className={`flex-1 py-2 rounded font-semibold transition ${
              roomId ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            Close Chat
          </button>

          <button
            onClick={() => {
              if (progressDisabled) {
                alert("No project selected to open Progress Tracker.");
                return;
              }
              navigate(`/progress-tracker/${activeProjectId}`);
            }}
            disabled={progressDisabled}
            className={`flex-1 py-2 rounded font-semibold transition ${
              progressDisabled
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Progress Tracker
          </button>
        </div>

      </div>
    </div>
  );
};

export default Collaboration;