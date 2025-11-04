const express = require("express");
const router = express.Router();
const progressController = require("../Controller/task");

// GET /api/progress/:projectId -> Fetches tasks, project title, and feedback for the project UUID
router.get("/:projectId", progressController.getTasks); 

// POST /api/progress/ -> Adds a new task to the project 
router.post("/", progressController.addTask);

// PUT /api/progress/:taskId -> Updates the completion status of a specific task
router.put("/:taskId", progressController.updateTask);

// GET /api/progress/feedback/:projectId -> Fetches just the AI feedback 
router.get("/feedback/:projectId", progressController.getFeedback);

// DELETE /api/progress/:taskId
router.delete("/:taskId", progressController.deleteTask);
module.exports = router;