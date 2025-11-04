const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  projectId: { type: String, required: true },  // Can be replaced with actual user system
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
});

module.exports = mongoose.model("Task", TaskSchema);
