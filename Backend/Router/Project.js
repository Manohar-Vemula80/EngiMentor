const express = require("express");
const router = express.Router();
// ✅ FIX 3: getProjectById ko import kiya gaya
const { createProject, getUserProjects, getProjectById } = require("../Controller/Project");
const { authMiddleware } = require("../middleware/authmiddleware");

router.post("/create", authMiddleware, createProject);
router.get("/my-projects", authMiddleware, getUserProjects);

// =========================================================================
// ✅ FIX 4: Single Project Fetch karne ka route add kiya gaya
// Yeh route '/api/projects/63985065065fb0e7a8ce1435' jaisa dikhega
// =========================================================================
router.get("/:id", authMiddleware, getProjectById);

module.exports = router;