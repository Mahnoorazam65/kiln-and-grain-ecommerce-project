const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "vendor", "admin"], default: "customer" },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
