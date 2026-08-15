const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Kiln & Grain API listening on port ${PORT}`),
    );
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
