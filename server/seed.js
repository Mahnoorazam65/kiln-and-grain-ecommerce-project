require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");
const Vendor = require("./models/Vendor");
const Product = require("./models/Product");
const Order = require("./models/Order");

// Real illustrated product images — actual JPG files shipped inside
// frontend/public/images, served from the frontend's own origin (not a
// third-party URL, not a data: URI). This is the standard way any real
// website bundles product photography, and the most reliable option since
// it depends on nothing outside this project.
const PHOTOS = {
  ashglaze1: "/images/ashglaze.jpg",
  oakservers1: "/images/oakservers.jpg",
  linenrunner1: "/images/linenrunner.jpg",
  forgedopener1: "/images/forgedopener.jpg",
  teacuppair1: "/images/teacuppair.jpg",
  walnutboard1: "/images/walnutboard.jpg",
  woolthrow1: "/images/woolthrow.jpg",
  copperplanter1: "/images/copperplanter.jpg",
};
const photo = (seed) => PHOTOS[seed] || "";

async function run() {
  await connectDB();
  console.log("Clearing existing data...");
  await Promise.all([User.deleteMany({}), Vendor.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);

  console.log("Creating vendors...");
  const [ashgrove, hollow, fen, coalveil] = await Vendor.insertMany([
    { name: "Ashgrove Pottery", stall: "No. 04", ownerEmail: "vendor@demo.com", status: "approved" },
    { name: "Hollow & Awl", stall: "No. 11", ownerEmail: "hollow@demo.com", status: "approved" },
    { name: "Fen Loom Textiles", stall: "No. 02", ownerEmail: "fen@demo.com", status: "approved" },
    { name: "Coalveil Metalworks", stall: "No. 17", ownerEmail: "coalveil@demo.com", status: "approved" },
  ]);

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash("demo", 10);
  await User.insertMany([
    { name: "Jordan Ellis", email: "customer@demo.com", passwordHash, role: "customer" },
    { name: "Ashgrove Pottery", email: "vendor@demo.com", passwordHash, role: "vendor", vendor: ashgrove._id },
    { name: "Site Admin", email: "admin@demo.com", passwordHash, role: "admin" },
  ]);

  console.log("Creating products...");
  await Product.insertMany([
    { name: "Ash-Glaze Pour Vessel", vendor: ashgrove._id, category: "Ceramics", price: 68, stock: 6, materials: "Stoneware, ash glaze", img: photo("ashglaze1"), status: "active", desc: "Wheel-thrown stoneware finished in a wood-ash glaze that pools darker at every edge — no two pours land the same.", reviews: [{ author: "Nadia R.", rating: 5, text: "The glaze pooling is even more striking in person." }, { author: "Theo M.", rating: 4, text: "Beautiful piece, took two weeks to ship since it's made to order." }] },
    { name: "Notched Oak Servers, Set of Two", vendor: hollow._id, category: "Woodwork", price: 54, stock: 3, materials: "White oak, walnut oil", img: photo("oakservers1"), status: "active", desc: "A pair of serving spoons cut from a single oak board, notched by hand so the grain runs unbroken end to end.", reviews: [{ author: "Priya K.", rating: 5, text: "Bought as a wedding gift and kept one set for myself." }] },
    { name: "Undyed Linen Table Runner", vendor: fen._id, category: "Textiles", price: 42, stock: 0, materials: "Belgian linen", img: photo("linenrunner1"), status: "active", desc: "Loomed in undyed linen and stone-washed for a soft hand. Fringed edges are left raw, on purpose.", reviews: [{ author: "Owen L.", rating: 4, text: "Lovely texture but ran smaller than the photos suggested." }] },
    { name: "Hand-Forged Bottle Opener", vendor: coalveil._id, category: "Metalwork", price: 29, stock: 14, materials: "Recycled mild steel", img: photo("forgedopener1"), status: "active", desc: "Forged from reclaimed steel stock, each opener carries the hammer marks of the maker who shaped it.", reviews: [{ author: "Marcus D.", rating: 5, text: "Heavier and sturdier than any bottle opener I've owned." }] },
    { name: "Cracked-Slip Teacup Pair", vendor: ashgrove._id, category: "Ceramics", price: 46, stock: 9, materials: "Porcelain, tenmoku glaze", img: photo("teacuppair1"), status: "active", desc: "Two teacups glazed in tenmoku, where iron blooms through the crackle at the cooling stage of the kiln.", reviews: [{ author: "Grace T.", rating: 5, text: "The tenmoku crackle is different on each cup." }] },
    { name: "Live-Edge Walnut Board", vendor: hollow._id, category: "Woodwork", price: 89, stock: 4, materials: "Black walnut", img: photo("walnutboard1"), status: "active", desc: "A single-slab serving board that keeps the tree's natural edge, oiled to bring out the walnut's grain.", reviews: [{ author: "Sam H.", rating: 5, text: "This is the board I show off when people come over." }] },
    { name: "Handwoven Wool Throw", vendor: fen._id, category: "Textiles", price: 118, stock: 5, materials: "Merino wool", img: photo("woolthrow1"), status: "active", desc: "Woven on a floor loom in a small run of six, dyed with madder root for a warm, uneven rust.", reviews: [{ author: "Renata F.", rating: 5, text: "The madder dye is gorgeous and slightly different in every light." }] },
    { name: "Riveted Copper Planter", vendor: coalveil._id, category: "Metalwork", price: 64, stock: 2, materials: "Copper sheet", img: photo("copperplanter1"), status: "active", desc: "Hand-riveted copper that will patina with age — a planter meant to look better each year, not worse.", reviews: [{ author: "Jules P.", rating: 4, text: "Already starting to patina after a few weeks outdoors." }] },
  ]);

  console.log("Done. Demo login: customer@demo.com / vendor@demo.com / admin@demo.com, password 'demo'.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
