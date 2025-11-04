const mongoose = require("mongoose");
const Project = require("../Model/Project");

// Create a new project (No change needed here)
const createProject = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ 
                message: "Unauthorized: Missing user ID for project creation." 
            });
        }
        
        console.log('Project creation attempt. User ID:', req.user.id);
        console.log('Project creation attempt. Data:', req.body);
        
        const { title, description, domain, techStack, challenges } = req.body;

        const project = new Project({
            title,
            description,
            domain,
            techStack,
            challenges,
            user: req.user.id
        });

        await project.save();
        
        res.status(201).json({ 
            message: "Project created successfully", 
            project: {
                ...project.toObject(),
                // project.projectId is likely '_id' if no projectId field is active
                projectId: project._id 
            }
        });
        
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ 
                message: "Validation Failed", 
                errors: messages 
            });
        }
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: "A project with this title already exists or a unique ID collision occurred." 
            });
        }
        console.error("Create Project Error:", error);
        res.status(500).json({ message: "An unexpected server error occurred." });
    }
};

// =========================================================================
// ✅ FIX 1: This function is for GETTING ALL projects of a user.
// =========================================================================
const getUserProjects = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
             return res.status(401).json({ message: "Unauthorized." });
        }
        
        // Find ALL projects linked to the authenticated user's ID
        const projects = await Project.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        console.error("Get User Projects Error:", error);
        res.status(500).json({ error: error.message });
    }
};


// =========================================================================
// ✅ FIX 2: Added the correct function to GET A SINGLE PROJECT BY ID.
// This is the function where your error was likely happening.
// =========================================================================
// ... (other functions) ...

const getProjectById = async (req, res) => {
    const projectId = req.params.id; 
    
    console.log('Fetching Project ID:', projectId);

    // ✅ FIX: Check if the ID is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        console.warn(`Attempted fetch with invalid ObjectId format (likely a Chat ID): ${projectId}`);
        // 404 return karo, yeh better hai.
        return res.status(404).json({ 
             message: `Project not found for ID: "${projectId}".`
        });
    }

    try {
        // If the ID is in the right *format*, Mongoose will proceed to search.
        const project = await Project.findById(projectId);

        if (!project) {
            // Document not found (This will happen if you use the right format but the wrong value, e.g., 63985065065fb0e7a8ce1435 instead of 63985065065fb0e7a8ce1435)
            return res.status(404).json({ 
                message: `Project document not found for ID: ${projectId}.` 
            });
        }

        res.json(project);
    } catch (error) {
        // Fallback for unexpected errors
        console.error("Get Project By ID Error:", error);
        res.status(500).json({ message: "Server error while fetching project." });
    }
};

module.exports = { createProject, getUserProjects, getProjectById };