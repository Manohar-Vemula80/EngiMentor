const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); 

const projectSchema = new mongoose.Schema({
    // projectId: { 
    //     type: String, 
    //     // default: uuidv4, 
    //     unique: true,    // KEEP: This creates the index AND the uniqueness constraint
    //     required: true   
    // },
    title: { 
        type: String, 
        required: true,
        // If you want title unique per user, you'd use a compound index here 
    },
    description: { type: String, required: true },
    domain: { type: String, required: true },
    techStack: { type: String, required: true },
    challenges: { type: String }, 
    achievements: { type: String },
    screenshots: [String],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    githubExported: { type: Boolean, default: false },
    sharedPublicly: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

// ❌ REMOVE THIS LINE: 
// projectSchema.index({ projectId: 1 }); 
// It is no longer needed because 'unique: true' already indexed it.

module.exports = mongoose.model("Project", projectSchema);