const User = require("../Model/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  try {
    console.log("REGISTER request body:", req.body); // <-- debug
    const email = (req.body.email || "").trim().toLowerCase();
    console.log("Normalized email for register:", email);

    // existing uniqueness check — make sure it uses normalized email
    const existing = await User.findOne({ email: email });
    console.log("Existing user:", existing ? existing._id : null);

    const { name, password, branch, skills } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      branch,
      skills,
    });

    // Include name in token payload
    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      // { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error registering user",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Always include name
    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10d" }
    );

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error logging in",
      error: error.message,
    });
  }
};

async function updateMe(req, res) {
  try {
    const userId = req.userId || req.user?.id; // set by your authMiddleware
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const updates = { ...req.body };
    // remove protected fields
    delete updates.password;
    delete updates.role;

    const updated = await User.findByIdAndUpdate(userId, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "User not found" });

    return res.json({ user: updated });
  } catch (err) {
    console.error("updateMe error:", err);
    return res.status(500).json({ message: "Failed to update user" });
  }
}

async function getMe(req, res) {
  try {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const u = await User.findById(userId).select("-password").lean();
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json({ user: u });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  registerUser,
  loginUser,
  updateMe,
  getMe,
};
