const express = require("express");
const { getProfile, updateProfile } = require("../Controller/profile");
const { authMiddleware } = require("../middleware/authmiddleware");

const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;
