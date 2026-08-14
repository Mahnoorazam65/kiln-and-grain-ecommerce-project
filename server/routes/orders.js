const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// POST /api/orders — place an order from the current cart
// body: { items: [{ productId, qty }], shippingInfo, stripePaymentIntentId? }
router.post("/", requireAuth, requireRole("customer"), async (req, res) => {
  const { items, shippingInfo, stripePaymentIntentId } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Cart is empty." });

  const orderItems = [];
  let subtotal = 0;

  for (const line of items) {
    const product = await Product.findById(line.productId);
    if (!product) return res.status(404).json({ error: `Product ${line.productId} not found.` });
    if (product.stock < line.qty) return res.status(409).json({ error: `${product.name} only has ${product.stock} left in stock.` });
    orderItems.push({ product: product._id, vendor: product.vendor, name: product.name, price: product.price, qty: line.qty });
    subtotal += product.price * line.qty;
  }

  const shippingFee = subtotal > 75 ? 0 : 8;
  const total = subtotal + shippingFee;

  // Decrement stock for each item (best-effort; use a Mongo transaction in production
  // if your Atlas cluster is a replica set, which the free tier is by default)
  for (const line of items) {
    await Product.findByIdAndUpdate(line.productId, { $inc: { stock: -line.qty } });
  }

  const order = await Order.create({
    customer: req.user._id,
    items: orderItems,
    subtotal,
    shippingFee,
    total,
    shippingInfo,
    stripePaymentIntentId: stripePaymentIntentId || null,
    paymentStatus: stripePaymentIntentId ? "paid" : "pending",
  });

  res.status(201).json({ order });
});

// GET /api/orders/mine — customer's own order history
router.get("/mine", requireAuth, requireRole("customer"), async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

// GET /api/orders — admin: every order
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  const orders = await Order.find().populate("customer", "name email").sort({ createdAt: -1 });
  res.json({ orders });
});

// PATCH /api/orders/:id/status — admin updates fulfillment status
router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const { status } = req.body;
  if (!["Processing", "Shipped", "Delivered", "Cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order });
});

module.exports = router;
