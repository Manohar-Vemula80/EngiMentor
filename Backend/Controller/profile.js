const Project = require("../Model/Project");

// Create a new project
const createProject = async (req, res) => {
  try {
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
    res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all projects of a user
const getUserProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createProject, getUserProjects };
