const express=require("express")
const dotenv=require("dotenv")
const cors=require("cors")
const db=require("./config/db")
const userRoutes =require("./routes/userRoutes")
const productRoutes =require("./routes/productRoute")
const orderRoutes =require("./routes/orderRoutes")
dotenv.config();

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
