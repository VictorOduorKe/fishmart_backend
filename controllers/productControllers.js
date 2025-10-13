const db = require("../config/db");

// Fetch Products
const fetchProducts = (req, res) => {
  const query = `
    SELECT product_name, description, price, category, stock, expiry_date, user_id
    FROM products
    WHERE expiry_date >= NOW() - INTERVAL 7 DAY AND stock > 0
    ORDER BY expiry_date DESC
  `;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching products: " + err.message });
    }
    return res.status(200).json({ products: results });
  });
};

// Add Product (protected)
const addProduct = (req, res) => {
  const user_id = req.user.id; // ✅ comes from decoded token (protect middleware)
  const userRole = req.user.role; // ✅ comes from decoded token (protect middleware)

  if (userRole !== "seller" && userRole !== "admin") {
    return res.status(403).json({ message: "Only sellers or admins can add products" });
  }
  const { name, description, price, category, stock, fished_time } = req.body;

  if (!name || !description || !price || !category || !stock || !fished_time) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (isNaN(price) || price <= 0) {
    return res.status(400).json({ message: "Price must be a positive number" });
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ message: "Stock must be a non-negative integer" });
  }

  const currentDate = new Date();
  const fishedDate = new Date(fished_time);

  if (isNaN(fishedDate)) {
    return res.status(400).json({ message: "Invalid fished date format" });
  }

  if (fishedDate > currentDate) {
    return res.status(400).json({ message: "Fished date cannot be in the future." });
  }

  const expiryDate = new Date(fishedDate);
  expiryDate.setDate(expiryDate.getDate() + 7);

  if (expiryDate <= currentDate) {
    return res.status(400).json({ message: "Cannot add product — this fish has already expired." });
  }

  const query = `
    INSERT INTO products (product_name, description, price, category, stock, fished_time, expiry_date, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [name, description, price, category, stock, fished_time, expiryDate, user_id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Error adding product" });
    }

    res.status(201).json({
      message: "Product added successfully",
      expiry_date: expiryDate,
      productId: result.insertId,
    });
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
