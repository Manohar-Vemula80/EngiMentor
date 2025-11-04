const mongoose = require("mongoose");

const AnalysisSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    prompt: { type: String, default: "" },
    analysis: { type: String, default: "" },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    model: { type: String, default: "gemini-2.5-flash" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", AnalysisSchema);