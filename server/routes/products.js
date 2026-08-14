const express = require("express");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/products — public storefront listing (active products from approved vendors only)
router.get("/", async (req, res) => {
  const { category, q } = req.query;
  const approvedVendorIds = (await Vendor.find({ status: "approved" }).select("_id")).map((v) => v._id);
  const filter = { status: "active", vendor: { $in: approvedVendorIds } };
  if (category && category !== "All") filter.category = category;
  if (q) filter.name = { $regex: q, $options: "i" };
  const products = await Product.find(filter).populate("vendor", "name stall status").sort({ createdAt: -1 });
  res.json({ products });
});

// GET /api/products/admin/all — admin: every product regardless of status/vendor approval
router.get("/admin/all", requireAuth, requireRole("admin"), async (req, res) => {
  const products = await Product.find().populate("vendor", "name stall status").sort({ createdAt: -1 });
  res.json({ products });
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("vendor", "name stall status");
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json({ product });
});

// POST /api/products — vendor creates a product for their own shop
// Generates a local, no-network SVG placeholder for products added without a
// photo — same technique as seed.js, so nothing ever depends on an external
// image host being reachable.
function localPlaceholder(text) {
  const words = String(text || "Product").split(" ");
  let line1 = "", line2 = "";
  for (const w of words) { if ((line1 + " " + w).trim().length <= 16) line1 = (line1 + " " + w).trim(); else line2 = (line2 + " " + w).trim(); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="100%" height="100%" fill="#E8E1CE"/><text x="50%" y="47%" font-family="Georgia, serif" font-size="32" fill="#4A463D" text-anchor="middle">${line1}</text><text x="50%" y="57%" font-family="Georgia, serif" font-size="32" fill="#4A463D" text-anchor="middle">${line2}</text></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

router.post("/", requireAuth, requireRole("vendor"), async (req, res) => {
  const { name, category, price, stock, materials, desc, img } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "Name and price are required." });
  const product = await Product.create({
    name, category, materials, desc, img: img || localPlaceholder(name),
    price: Number(price), stock: Number(stock) || 0,
    vendor: req.user.vendor, status: "active",
  });
  res.status(201).json({ product });
});

// PATCH /api/products/:id — vendor edits their own product, or admin edits any
router.patch("/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (req.user.role === "vendor" && String(product.vendor) !== String(req.user.vendor)) {
    return res.status(403).json({ error: "You can only edit your own products." });
  }
  const allowed = ["name", "category", "price", "stock", "materials", "desc", "img", "status"];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) product[key] = req.body[key];
  });
  await product.save();
  res.json({ product });
});

// DELETE /api/products/:id — vendor deletes their own product, or admin deletes any
router.delete("/:id", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (req.user.role === "vendor" && String(product.vendor) !== String(req.user.vendor)) {
    return res.status(403).json({ error: "You can only delete your own products." });
  }
  await product.deleteOne();
  res.json({ ok: true });
});

// POST /api/products/:id/reviews — any logged-in customer leaves a review
router.post("/:id/reviews", requireAuth, async (req, res) => {
  const { rating, text } = req.body;
  if (!rating || !text) return res.status(400).json({ error: "Rating and review text are required." });
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  product.reviews.push({ author: req.user.name, rating, text, user: req.user._id });
  await product.save();
  res.status(201).json({ product });
});

module.exports = router;
