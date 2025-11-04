const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/Sendemail");
const Chat = require("../Model/chat");
const User = require("../Model/User");
const { v4: uuidv4 } = require("uuid");

// GET /api/chat/:roomId
async function getChatByRoomId(req, res) {
  try {
    const { roomId } = req.params;
    const chat = await Chat.findOne({ roomId }).lean();
    if (!chat) return res.status(200).json({ roomId, messages: [] });
    return res.json(chat);
  } catch (err) {
    console.error("getChatByRoomId:", err);
    return res.status(500).json({ message: "Failed to load chat" });
  }
}

// GET /api/chat/project/:projectId  -> find or create room for a project
async function getOrCreateRoomByProjectId(req, res) {
  try {
    const { projectId } = req.params;
    if (!projectId) return res.status(400).json({ message: "projectId required" });

    let chat = await Chat.findOne({ projectId: projectId.toString() }).lean();
    if (!chat) {
      const roomId = uuidv4();
      const created = await Chat.create({ roomId, projectId });
      return res.json({ roomId: created.roomId, projectId: created.projectId });
    }

    return res.json({ roomId: chat.roomId, projectId: chat.projectId });
  } catch (err) {
    console.error("getOrCreateRoomByProjectId:", err);
    return res.status(500).json({ message: "Failed to get or create room" });
  }
}

// PUT /api/chat/:roomId/close
async function closeRoom(req, res) {
  try {
    const { roomId } = req.params;
    if (!roomId) return res.status(400).json({ message: "roomId required" });
    const updated = await Chat.findOneAndUpdate({ roomId }, { closed: true }, { new: true });
    if (!updated) return res.status(404).json({ message: "Room not found" });
    return res.json({ message: "Room closed", roomId: updated.roomId });
  } catch (err) {
    console.error("closeRoom:", err);
    return res.status(500).json({ message: "Failed to close room" });
  }
}

// ✅ Get chat by room ID
const getChat = async (req, res) => {
    try {
        const chat = await Chat.findOne({ roomId: req.params.roomId });
        res.json(chat ? chat.messages : []);
    } catch (err) {
        console.error("GetChat error:", err);
        res.status(500).json({ message: "Error fetching chat" });
    }
};

// ✅ Post a new message (fallback if not using sockets)
const postChat = async (req, res) => {
    try {
        const { text } = req.body;
        const { roomId } = req.params;

        // Note: The 'upsert: true' here will only work if no matching chat exists.
        // If a chat exists but is missing messages, this correctly pushes the message.
        const chat = await Chat.findOneAndUpdate(
            { roomId },
            {
                $push: {
                    messages: {
                        senderId: req.user.id,
                        senderName: req.user.name,
                        text,
                        timestamp: new Date(),
                    },
                },
            },
            { new: true, upsert: true }
        );

        res.json(chat);
    } catch (err) {
        console.error("PostChat error:", err);
        res.status(500).json({ message: "Error sending message" });
    }
};

// ✅ Invite a peer securely (email + tokenized invite link)
const invitePeer = async (req, res) => {
    try {
        const inviter = req.user; // authMiddleware must set req.user
        const { email } = req.body;
        const { roomId } = req.params;
        if (!email || !roomId) return res.status(400).json({ message: "Missing email or roomId" });

        // prevent inviting yourself
        if (inviter && inviter.email && inviter.email.toLowerCase() === email.trim().toLowerCase()) {
            return res.status(400).json({ message: "Cannot invite your own email" });
        }

        // Fetch chat to get projectId (optional, but good practice)
        const existingChat = await Chat.findOne({ roomId });
        const projectId = existingChat?.projectId;

        // include inviteEmail and projectId in token payload
        const payload = { roomId, projectId, inviteEmail: email.trim(), invitedBy: inviter?.email || inviter?.id };
        const inviteToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "30d" });

        const clientBase = process.env.BASE_CLIENT_URL || "http://localhost:5173";
        const inviteLink = `${clientBase}/invite/${encodeURIComponent(inviteToken)}`;

        // send email (sendEmail util)
        await sendEmail(
            email,
            "You've been invited to collaborate",
            `Open this link to join: ${inviteLink}`,
            `<p>Open this link to join the collaboration room: <a href="${inviteLink}">${inviteLink}</a></p>
            <p> If you already login in this site,then you will render to collaboration page else you have to login first and then you have to come again to this email and click on this link ,then you collaboration page is rendered  <p/>`
            
        );

        // ensure chat exists (uses $setOnInsert to prevent overwriting existing data)
        await Chat.findOneAndUpdate(
            { roomId }, 
            { $setOnInsert: { roomId, messages: [] } }, 
            { upsert: true }
        );

        return res.json({ success: true, chatLink: inviteLink });
    } catch (err) {
        console.error("invitePeer error:", err);
        return res.status(500).json({ message: "Failed to send invite" });
    }
};

// ✅ When invited user clicks the invite link
const verifyInviteLink = async (req, res) => {
    try {
        const { inviteToken } = req.params;

        const decoded = jwt.verify(
            inviteToken,
            process.env.INVITE_SECRET || process.env.JWT_SECRET
        );

        if (!decoded?.roomId) {
            return res.status(400).json({ message: "Invalid or expired invite link" });
        }

        // Respond with info for frontend
        res.json({
            message: "Invite verified",
            roomId: decoded.roomId,
            projectId: decoded.projectId || null,
            invitedBy: decoded.invitedBy || null,
        });
    } catch (err) {
        console.error("verifyInviteLink error:", err);
        res.status(400).json({ message: "Invalid or expired invite link" });
    }
};

// ✅ Get or create chat by project
const getChatByProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        if (!projectId) return res.status(400).json({ message: "Missing projectId" });

        // Search by the unique projectId
        let chat = await Chat.findOne({ projectId }); 
        
        if (!chat) {
            // Create a new chat, assigning the unique projectId and a unique roomId
            chat = await Chat.create({
                projectId,
                roomId: uuidv4(),
                messages: [],
            });
        }

        res.json({ roomId: chat.roomId, messages: chat.messages });
    } catch (err) {
        console.error("getChatByProject error:", err);
        // Handle database-level conflict error (code 11000)
        if (err.code === 11000) {
            return res.status(409).json({ message: "A chat room already exists for this project ID." });
        }
        res.status(500).json({ message: "Error getting project chat" });
    }
};

// ✅ Create a chat room manually (not linked to a project ID)
const createChatRoom = async (req, res) => {
    try {
        // Project ID is now optional, making this a general chat
        const { projectId } = req.body; 
        
        // If projectId is provided, check if a chat already exists for it
        if (projectId) {
             const existingChat = await Chat.findOne({ projectId });
             if (existingChat) {
                return res.status(409).json({ message: "A chat room already exists for this project ID.", roomId: existingChat.roomId });
             }
        }
        
        const chat = await Chat.create({
            projectId: projectId || null, // Allow projectId to be null/undefined
            roomId: uuidv4(),
            messages: [],
        });
        res.json({ roomId: chat.roomId });
    } catch (err) {
        console.error("createChatRoom error:", err);
        if (err.code === 11000) {
            return res.status(409).json({ message: "A chat room already exists with this project ID." });
        }
        res.status(500).json({ message: "Error creating chat room" });
    }
};

// Add this function to your exports
async function verifyInviteToken(req, res) {
  try {
    const rawToken = req.params.token || req.params.inviteToken;
    if (!rawToken) return res.status(400).json({ message: "Missing invite token" });

    const decoded = jwt.verify(decodeURIComponent(rawToken), process.env.JWT_SECRET);
    if (!decoded?.roomId) return res.status(400).json({ message: "Invalid or expired invite link" });

    return res.json({
      message: "Invite verified",
      roomId: decoded.roomId,
      projectId: decoded.projectId || null,
      inviteEmail: decoded.inviteEmail || null,
      invitedBy: decoded.invitedBy || null,
    });
  } catch (err) {
    console.error("verifyInviteToken error:", err.message);
    return res.status(400).json({ message: "Invalid or expired invite link" });
  }
}


module.exports = {
    getChat,
    postChat,
    invitePeer,
    verifyInviteLink,
    getChatByProject,
    createChatRoom,
    verifyInviteToken,
    getChatByRoomId,
    getOrCreateRoomByProjectId,
    closeRoom,
};