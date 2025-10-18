import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import db from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoute.js";
import orderRoutes from "./routes/orderRoutes.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// ✅ Resolve __dirname (since ES modules don’t have it)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Connect database
db;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Create uploads folder if missing
const uploadDir = path.join(__dirname, "uploads/business");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Created upload directory:", uploadDir);
}

// ✅ Serve uploads folder as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Backend API is running...");
});
// after your routes
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max size is 2MB." });
    }
  } else if (err.message.includes("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  }

  next(err);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
