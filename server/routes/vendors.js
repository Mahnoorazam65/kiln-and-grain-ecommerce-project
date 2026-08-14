const express = require("express");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/vendors — admin: list every vendor
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  const vendors = await Vendor.find().sort({ createdAt: -1 });
  res.json({ vendors });
});

// GET /api/vendors/me — vendor: my shop info + my products + my orders
router.get("/me", requireAuth, requireRole("vendor"), async (req, res) => {
  const vendor = await Vendor.findById(req.user.vendor);
  const products = await Product.find({ vendor: req.user.vendor }).sort({ createdAt: -1 });
  const orders = await Order.find({ "items.vendor": req.user.vendor }).sort({ createdAt: -1 });
  res.json({ vendor, products, orders });
});

// PATCH /api/vendors/:id/status — admin: approve or suspend a vendor
router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.body;
  if (!["pending", "approved", "suspended"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!vendor) return res.status(404).json({ error: "Vendor not found." });
  res.json({ vendor });
});

module.exports = router;
