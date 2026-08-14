const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    stall: { type: String, default: "" },
    ownerEmail: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "suspended"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
