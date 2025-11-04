const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // 💡 FIX: Mongoose ke liye zaroori options add kiye. 
    // MONGO_URI ek environment variable hai jismein database ka path hota hai.
    await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser: true,      // Deprecated, but good for backward compatibility
      // useUnifiedTopology: true,   // Recommended for stable connection monitoring
      // NOTE: useFindAndModify and useCreateIndex options are deprecated and removed.
    });
    
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    // Exit process with failure
    process.exit(1); 
  }
};

module.exports = connectDB;
