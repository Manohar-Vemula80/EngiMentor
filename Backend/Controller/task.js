const mongoose = require("mongoose");
const Task = require("../Model/task");
// 💡 NOTE: Humne yahan 'Project' model ko require kiya hai, lekin agar phir bhi problem aaye, 
// toh hum use direct mongoose se access karenge, jaisa ki 'getTasks' mein kiya hai.
const Project = require("../Model/Project"); 

// GET /api/progress/:projectId -> Ab tasks, project title, aur feedback return karega
exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.params; 
    let projectTitle = "Project Tasks"; // Default title
    
    // --- Project Title Fetch Karne Ka Logic ---
    try {
        // 💡 FINAL HACK/FIX: Agar Project model import ke baad kaam nahi kar raha, 
        // toh hum Mongoose ke global model cache se isko nikalte hain.
        // Yeh line Mongoose ko Project Model load karne ke liye force karti hai.
        const ProjectModel = mongoose.models.Project || mongoose.model('Project');
        
        // Kyunki humne 'find' use kiya hai, 'projects' ek array hoga.
        const projects = await ProjectModel.find({ projectId: projectId }).select("title"); 
        
        // 💡 DEBUG: Final check (Server console mein output dekhiye!)
        console.log(`DB Query Result (Count: ${projects.length}):`, projects);
        
        // Array check aur pehla element use karna.
        if (projects.length > 0 && projects[0].title) {
            projectTitle = projects[0].title; // Real title set ho jayega
            console.log(`Successfully fetched title: ${projectTitle}`); 
        } else {
            // Agar project nahi mila, toh yeh log hoga.
            console.warn(`Project document not found for ID: ${projectId}. Showing default title.`);
        }
    } catch (e) {
        // Yeh block catch karega agar Mongoose CastError de ya connection problem ho.
        console.error("CRITICAL ERROR in Project Title Fetching (Query Failure):", e.message);
    }
    
    // Tasks fetching logic
    const tasks = await Task.find({ projectId }).sort({ createdAt: 1 });
    
    // Feedback Logic (unchanged)
    const incomplete = tasks.filter((t) => !t.done);
    let feedback = "";
    if (incomplete.length === 0) {
      feedback = "🎉 Saare tasks complete! Ab aap apne project ko showcase kar sakte hain.";
    } else if (incomplete.length <= 2) {
      feedback = "Bas thoda aur! Baaki bache tasks ko jaldi khatam karein.";
    } else {
      feedback = "Lage raho! Apne roadmap ko step-by-step follow karte rahein.";
    }

    // Saara data frontend ko bhejेंगे
    res.json({ tasks, projectTitle, feedback });
  } catch (err) {
    console.error("Server Error in getTasks:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/progress/
exports.addTask = async (req, res) => {
  try {
    const { projectId, text } = req.body;
    if (!projectId || !text) return res.status(400).json({ message: "All fields required" });
    const task = await Task.create({ projectId, text });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// PUT /api/progress/:taskId
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { done } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.done = done;
    await task.save();

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/progress/feedback/:projectId
exports.getFeedback = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId });

    const incomplete = tasks.filter((t) => !t.done);

    let feedback = "";
    if (incomplete.length === 0) {
      feedback = "🎉 Saare tasks complete! Ab aap apne project ko showcase kar sakte hain.";
    } else if (incomplete.length <= 2) {
      feedback = "Bas thoda aur! Baaki bache tasks ko jaldi khatam karein.";
    } else {
      feedback = "Lage raho! Apne roadmap ko step-by-step follow karte rahein.";
    }

    res.json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// DELETE /api/progress/:taskId
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!taskId) return res.status(400).json({ message: "taskId required" });

    const task = await Task.findByIdAndDelete(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    return res.json({ message: "Task deleted", task });
  } catch (err) {
    console.error("deleteTask error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};
