// Server.js (UPDATED with Chat Fixes)

const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const connectDB = require("./db");

dotenv.config();
connectDB();

const Chat = require("./Model/chat");
const User = require("./Model/User");

// Routers
// const userRoutes = require("./Router/User");
const projectRoutes = require("./Router/Project");
const aiRoutes = require("./Router/AI");
const chatRoutes = require("./Router/chat");
const progressRoutes = require("./Router/task");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Mount routers
// app.use("/api/auth", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/ai", require("./Router/ai"));
app.use("/api/chat", chatRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/users", require("./Router/User"));

// Helper: verify JWT and return minimal user info from DB
async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id || decoded._id).select("-password").lean();
    if (!user) return null;
    return {
      id: user._id.toString(),
      name: user.name || user.email || "Unknown",
      email: user.email,
    };
  } catch (error) {
    return null;
  }
}

// Socket.IO setup
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// room map: roomId -> Map(userId -> Set(socketId))
const rooms = new Map();
// userId -> displayName
const userNamesById = new Map();

io.on("connection", async (socket) => {
  console.log("🔌 New socket connected:", socket.id);

  // try lightweight pre-auth from handshake token (optional)
  const handshakeToken = socket.handshake?.auth?.token;
  if (handshakeToken) {
    const preUser = await getUserFromToken(handshakeToken);
    if (preUser) {
      socket.user = { id: preUser.id, name: preUser.name, email: preUser.email };
      console.log("Socket pre-authenticated:", socket.id, "user:", socket.user.name);
    } else {
      console.log("Socket pre-auth failed for:", socket.id);
    }
  }

  socket.on("joinRoom", async ({ roomId, token }) => {
    try {
      if (!roomId) {
        socket.emit("joinError", { message: "roomId required" });
        return;
      }

      // Resolve user: prefer explicit token -> DB lookup, else use pre-auth socket.user
      let resolvedUser = null;
      if (token) {
        resolvedUser = await getUserFromToken(token);
      } else if (socket.user) {
        // socket.user might already be a minimal user object from handshake
        resolvedUser = socket.user;
      }

      if (!resolvedUser) {
        socket.emit("joinError", { message: "Authentication required" });
        return;
      }

      // normalize socket.user to expected shape
      socket.user = {
        id: String(resolvedUser.id || resolvedUser._id),
        name: resolvedUser.name || resolvedUser.email || "Unknown",
        email: resolvedUser.email || "",
      };

      // join socket.io room
      socket.join(roomId);

      // maintain rooms map
      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const roomMap = rooms.get(roomId);

      const uid = socket.user.id || socket.id;
      if (!roomMap.has(uid)) roomMap.set(uid, new Set());
      roomMap.get(uid).add(socket.id);

      userNamesById.set(uid, socket.user.name || "Unknown");

      console.log(`User ${socket.user.name} joined room ${roomId} (socket: ${socket.id})`);

      // emit unique users list
      const userList = Array.from(roomMap.keys()).map((uId) => userNamesById.get(uId) || "Unknown");
      io.in(roomId).emit("roomUsers", userList);

      // ensure chat doc exists
      try {
        await Chat.findOneAndUpdate(
          { roomId },
          { $setOnInsert: { roomId, messages: [] } },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("Error ensuring chat doc:", err.message);
      }
    } catch (err) {
      console.error("joinRoom handler error:", err);
      socket.emit("joinError", { message: "Internal server error" });
    }
  });

  socket.on("chatMessage", async ({ roomId, text }) => {
    try {
      if (!roomId || !text?.trim() || !socket.user) {
        socket.emit("messageError", { message: "Invalid message data or unauthenticated" });
        return;
      }

      const message = {
        senderId: socket.user.id,
        senderName: socket.user.name || "Collaborator",
        text: text.trim(),
        timestamp: new Date(),
      };

      // save message in DB
      try {
        await Chat.findOneAndUpdate(
          { roomId },
          { $push: { messages: message } },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("Error saving message:", err.message);
      }

      // broadcast to room
      io.in(roomId).emit("newMessage", message);
    } catch (err) {
      console.error("chatMessage handler error:", err);
      socket.emit("messageError", { message: "Internal server error" });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);

    // remove this socket id from global rooms map; clean empty entries
    for (const [roomId, roomMap] of rooms.entries()) {
      let changed = false;
      for (const [uid, sset] of roomMap.entries()) {
        if (sset.has(socket.id)) {
          sset.delete(socket.id);
          changed = true;
          if (sset.size === 0) {
            roomMap.delete(uid);
            userNamesById.delete(uid);
          }
        }
      }
      if (changed) {
        if (roomMap.size === 0) {
          rooms.delete(roomId);
        } else {
          const userList = Array.from(roomMap.keys()).map((uId) => userNamesById.get(uId) || "Unknown");
          io.in(roomId).emit("roomUsers", userList);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));