require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const Analysis = require("../Model/Analysis"); // ensure model exists

// Initialize Gemini SDK with your API key from .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to extract AI text response (safe fallback)
const extractAnalysis = (response) => {
  if (!response) return "No response received.";

  // Log raw JSON for debugging
  console.log("✅ Raw Gemini Response:", JSON.stringify(response, null, 2));

  try {
    const candidates = response.candidates || [];
    const firstCandidate = candidates[0] || {};
    const contentParts = firstCandidate.content?.parts || [];

    // Extract text if available
    const resultText = contentParts.map((p) => p.text || "").join("\n").trim();

    // Handle empty output gracefully
    if (!resultText) {
      if (firstCandidate.finishReason === "MAX_TOKENS") {
        return "The model stopped early. Try increasing maxOutputTokens or simplifying your prompt.";
      }
      return "Gemini produced no text output. Try again.";
    }

    return resultText;
  } catch (err) {
    console.error("⚠️ Parsing Gemini response failed:", err.message);
    return "Error parsing Gemini response.";
  }
};

// Controller: handles /api/analyze POST requests
const analyzeProject = async (req, res) => {
  try {
    const { projectDescription, projectId } = req.body;
    if (!projectDescription) {
      return res.status(400).json({ message: "Project description is required" });
    }

    // Strong, structured prompt for Gemini
    const prompt = `
You are an expert software architect and product manager. 
Analyze the following project idea and generate a detailed, attractive roadmap in Markdown format. 
Include clear sections for:
- Project Overview
- Value Proposition
- Recommended Tech Stack (Frontend, Backend, Database, APIs)
- Step-by-step Roadmap (with milestones)
- Key Features
- Implementation Approach
- Potential Challenges and Solutions
- Best Practices

Project Idea: ${projectDescription}
`;

    console.log("🧠 Sending prompt to Gemini model...");

    // Call the Gemini API with increased token limit
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 3056 },
    });

    const analysis = extractAnalysis(response);

    // Save analysis to DB
    try {
      const doc = new Analysis({
        project: projectId || null,
        prompt,
        analysis,
        rawResponse: response,
        model: "gemini-2.5-flash",
        createdBy: req.userId || (req.user && req.user.id) || null,
      });
      await doc.save();

      // return analysis + id of saved document
      return res.status(200).json({ success: true, analysis, analysisId: doc._id });
    } catch (dbErr) {
      console.error("Failed to save analysis:", dbErr);
      // still return analysis even if save fails
      return res.status(200).json({ success: true, analysis, saved: false });
    }
  } catch (error) {
    console.error("❌ Gemini API Error:", error.message);
    res.status(500).json({
      message: "AI analysis failed",
      error: error.message,
    });
  }
};

// Add this function to return analyses for a given projectId (or all analyses)
const getAnalyses = async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = {};
    if (projectId) filter.project = projectId;
    // You can add pagination later
    const analyses = await Analysis.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, analyses });
  } catch (err) {
    console.error("getAnalyses error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch analyses" });
  }
};

module.exports = {
  analyzeProject, // if already exported
  getAnalyses,
};
