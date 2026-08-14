const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    vendorId: user.vendor || null,
  };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, shopName } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required." });
    if (role === "vendor" && !shopName) return res.status(400).json({ error: "Shop name is required for vendor accounts." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: role === "vendor" ? "vendor" : "customer" });

    if (role === "vendor") {
      const vendor = await Vendor.create({ name: shopName, ownerEmail: email, status: "pending" });
      user.vendor = vendor._id;
      await user.save();
    }

    const token = sign(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Could not create account.", detail: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) return res.status(401).json({ error: "No account matches that email and password." });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "No account matches that email and password." });
    const token = sign(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Login failed.", detail: err.message });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
