const db = require("../config/db");

// Fetch Products
const fs = require("fs");
const path = require("path");
const axios = require("axios"); // to fetch image from URL
const db = require("../config/db"); // adjust path if needed

const addProduct = async (req, res) => {
  const user_id = req.user.id;
  const userRole = req.user.role;

  // Only sellers or admins can add products
  if (userRole !== "seller" && userRole !== "admin") {
    return res.status(403).json({ message: "Only sellers or admins can add products" });
  }

  const {
    business_id,
    product_name,
    description,
    price,
    weight,
    stock,
    category,
    expiry_date,
    image, // This is the image URL from frontend
  } = req.body;

  // Basic field validation
  if (
    !business_id ||
    !product_name ||
    !description ||
    !price ||
    !stock ||
    !category ||
    !expiry_date ||
    !image
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ message: "Price must be a positive number" });
  }

  if (!Number.isInteger(Number(stock)) || stock < 0) {
    return res.status(400).json({ message: "Stock must be a non-negative integer" });
  }

  const expiryDate = new Date(expiry_date);
  const now = new Date();

  if (isNaN(expiryDate.getTime()) || expiryDate <= now) {
    return res.status(400).json({ message: "Expiry date must be valid and in the future" });
  }

  // ✅ Step 1: Download image and store in local folder
  try {
    const imageResponse = await axios.get(image, { responseType: "arraybuffer" });

    // Extract image file name from URL (or generate one)
    const fileName = `${Date.now()}-${path.basename(image.split("?")[0])}`;
    const folderPath = path.join(__dirname, "../public/products");

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Full path to save the image
    const filePath = path.join(folderPath, fileName);

    // Write the image to the folder
    fs.writeFileSync(filePath, imageResponse.data);

    // Relative path to store in DB (to be served by Express static)
    const imagePath = `/products/${fileName}`;

    // ✅ Step 2: Save product in DB
    const query = `
      INSERT INTO products (
        business_id,
        user_id,
        product_name,
        description,
        price,
        weight,
        stock,
        category,
        expiry_date,
        image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      business_id,
      user_id,
      product_name,
      description,
      price,
      weight || 0,
      stock,
      category,
      expiryDate,
      imagePath,
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error adding product" });
      }

      res.status(201).json({
        message: "Product added successfully",
        product_id: result.insertId,
        image_path: imagePath,
        expiry_date: expiryDate,
      });
    });
  } catch (error) {
    console.error("Error downloading image:", error);
    return res.status(400).json({ message: "Failed to download image from URL" });
  }
};
const fetchProducts = (req, res) => {
  const sql = "SELECT * FROM products";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Error fetching products" });
    }
    res.status(200).json({ products: results });
  });
};

//Delete Product — Only product owner (seller) or admin can delete
const deleteProduct = (req, res) => {
  const { productId } = req.params;
  const userRole = req.user.role;
  const user_id = req.user.id;

  if (!user_id) {
    return res.status(401).json({ message: "Unauthorized: User ID missing" });
  }

  if (!productId) {
    return res.status(400).json({ message: "Product ID is required" });
  }

  // Step 1️⃣: Check if product exists and who owns it
  const checkQuery = "SELECT user_id FROM products WHERE id = ?";

  db.query(checkQuery, [productId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Error checking product ownership" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productOwnerId = results[0].user_id;

    // Step 2️⃣: Check user permissions
    if (userRole !== "admin" && productOwnerId !== user_id) {
      return res.status(403).json({
        message: "You are not authorized to delete this product",
      });
    }

    // Step 3️⃣: Proceed to delete (admin can delete any, seller only own)
    const deleteQuery = "DELETE FROM products WHERE id = ?";

    db.query(deleteQuery, [productId], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error deleting product" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found or already deleted" });
      }

      res.status(200).json({
        message:
          userRole === "admin"
            ? "Product deleted successfully by admin"
            : "Your product was deleted successfully",
      });
    });
  });
};

const updateProduct = (req, res) => {
  const productId = req.params.productId;
  const userRole = req.user.role;
  const user_id = req.user.id;

  if (!user_id || !productId) {
    return res.status(401).json({ message: "Unauthorized: User ID or Product ID missing" });
  }

  const checkQuery = "SELECT user_id FROM products WHERE id = ?";

  db.query(checkQuery, [productId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Error checking product ownership" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productOwnerId = results[0].user_id;

    // Step 2️⃣: Check user permissions
    if (userRole !== "admin" && productOwnerId !== user_id) {
      return res.status(403).json({
        message: "You are not authorized to update this product",
      });
    }

    // Step 3️⃣: Proceed to update (admin can update any, seller only own)
    const updateQuery = "UPDATE products SET ? WHERE id = ?";

    db.query(updateQuery, [req.body, productId], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error updating product" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Product not found or already updated" });
      }

      res.status(200).json({
        message:
          userRole === "admin"
            ? "Product updated successfully by admin"
            : "Your product was updated successfully",
      });
    });
  });
};

module.exports = { fetchProducts, addProduct, deleteProduct, updateProduct };
