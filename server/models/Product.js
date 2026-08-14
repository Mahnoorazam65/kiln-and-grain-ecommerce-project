const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    materials: { type: String, default: "" },
    desc: { type: String, default: "" },
    img: { type: String, default: "" },
    status: { type: String, enum: ["active", "pending", "removed"], default: "active" },
    reviews: [reviewSchema],
  },
  { timestamps: true }
);

productSchema.virtual("rating").get(function () {
  if (!this.reviews.length) return 0;
  const sum = this.reviews.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / this.reviews.length) * 10) / 10;
});
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
