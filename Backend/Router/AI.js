const express = require("express");
const router = express.Router();
const aiCtrl = require("../Controller/AI");
// optional: const { authMiddleware } = require("../middleware/authmiddleware");

// GET /api/ai/analysis?projectId=...
router.get("/analysis", /* authMiddleware, */ aiCtrl.getAnalyses);

// (keep your existing POST /analyze route if present)
router.post("/analyze", /* authMiddleware, */ aiCtrl.analyzeProject);

module.exports = router;
