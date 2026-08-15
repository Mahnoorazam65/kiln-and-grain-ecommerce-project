const app = require("../app");
const connectDB = require("../config/db");

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    res.status(500).json({ error: "Database connection failed." });
    return;
  }
  app(req, res);
};
