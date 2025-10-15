import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import db from "./config/db.js"
import userRoutes  from "./routes/userRoutes.js"
import productRoutes  from "./routes/productRoute.js"
import orderRoutes  from "./routes/orderRoutes.js"

dotenv.config()

const app = express();

// Connect database (just ensure db.js runs)
db;

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend API is running...");
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/uploads", express.static("uploads"));
//app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
