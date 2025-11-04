const express = require("express");
const router = express.Router();
const userController = require("../Controller/User");
const { authMiddleware } = require("../middleware/authmiddleware"); // if you don't have authMiddleware, remove it or implement

// Auth endpoints
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);

// Current user endpoints
// Protect these with authMiddleware if available
router.get("/me", authMiddleware, userController.getMe);
router.put("/me", authMiddleware, userController.updateMe);

module.exports = router;
