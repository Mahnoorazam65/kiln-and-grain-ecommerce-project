const express = require("express");
const Stripe = require("stripe");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// POST /api/payments/create-intent — body: { amount } in dollars
// Returns a client_secret the frontend's Stripe Elements form confirms the card against.
router.post(
  "/create-intent",
  requireAuth,
  requireRole("customer"),
  async (req, res) => {
    if (!stripe)
      return res
        .status(503)
        .json({ error: "Payments are not configured on this server yet." });
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0)
        return res.status(400).json({ error: "Invalid amount." });
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { userId: String(req.user._id) },
      });
      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Could not start payment.", detail: err.message });
    }
  },
);

module.exports = router;
