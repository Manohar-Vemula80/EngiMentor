const express = require("express");
const router = express.Router();
const chatController = require("../Controller/chat");
const { authMiddleware } = require("../middleware/authmiddleware");

// find or create room by projectId
router.get("/project/:projectId", authMiddleware, chatController.getOrCreateRoomByProjectId);

// get chat doc by roomId
router.get("/:roomId", authMiddleware, chatController.getChatByRoomId);

// invite collaborator by email
router.post("/:roomId/invite", authMiddleware, chatController.invitePeer);

router.get("/verify/:token", chatController.verifyInviteToken);


// close/archive room
router.put("/:roomId/close", authMiddleware, chatController.closeRoom);

// (optional) invite endpoint can stay in existing router if you already have it
module.exports = router;
