import fs from  "fs";
import path from  "path";
import axios from  "axios";
import db from  "../config/db.js"; // this should export pool.promise()

// ✅ Add Product
export const addProduct = async (req, res) => {
  const user_id = req.user.id;
  const userRole = req.user.role;

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
    image,
  } = req.body;

  // Basic validation
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
  if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
    return res.status(400).json({ message: "Expiry date must be valid and in the future" });
  }

  try {
    // 🧠 Step 1: Download product image
    const imageResponse = await axios.get(image, { responseType: "arraybuffer" });

    const fileName = `${Date.now()}-${path.basename(image.split("?")[0])}`;
    const folderPath = path.join(__dirname, "../public/products");

    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, imageResponse.data);
    const imagePath = `/products/${fileName}`;

    // 🧠 Step 2: Insert product into DB
    const query = `
      INSERT INTO products (
        business_id, user_id, product_name, description, price, weight, stock, category, expiry_date, image
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

    const [result] = await db.query(query, values);

    res.status(201).json({
      message: "Product added successfully",
      product_id: result.insertId,
      image_path: imagePath,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(500).json({ message: "Error adding product" });
  }
};

// ✅ Fetch Products
export const fetchProducts = async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM products ORDER BY id DESC");
    res.status(200).json({ products: results });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
};

// ✅ Delete Product
export const deleteProduct = async (req, res) => {
  const { productId } = req.params;
  const userRole = req.user.role;
  const user_id = req.user.id;

  if (!user_id) return res.status(401).json({ message: "Unauthorized: User ID missing" });
  if (!productId) return res.status(400).json({ message: "Product ID is required" });

  try {
    const [results] = await db.query("SELECT user_id FROM products WHERE id = ?", [productId]);

    if (results.length === 0) return res.status(404).json({ message: "Product not found" });

    const productOwnerId = results[0].user_id;

    if (userRole !== "admin" && productOwnerId !== user_id) {
      return res.status(403).json({ message: "You are not authorized to delete this product" });
    }

    const [delResult] = await db.query("DELETE FROM products WHERE id = ?", [productId]);

    if (delResult.affectedRows === 0)
      return res.status(404).json({ message: "Product not found or already deleted" });

    res.status(200).json({
      message:
        userRole === "admin"
          ? "Product deleted successfully by admin"
          : "Your product was deleted successfully",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ message: "Error deleting product" });
  }
};

// ✅ Update Product
export const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const userRole = req.user.role;
  const user_id = req.user.id;

  if (!user_id || !productId)
    return res.status(401).json({ message: "Unauthorized: User ID or Product ID missing" });

  try {
    const [results] = await db.query("SELECT user_id FROM products WHERE id = ?", [productId]);

    if (results.length === 0)
      return res.status(404).json({ message: "Product not found" });

    const productOwnerId = results[0].user_id;

    if (userRole !== "admin" && productOwnerId !== user_id) {
      return res.status(403).json({ message: "You are not authorized to update this product" });
    }

    const [updateResult] = await db.query("UPDATE products SET ? WHERE id = ?", [req.body, productId]);

    if (updateResult.affectedRows === 0)
      return res.status(404).json({ message: "Product not found or already updated" });

    res.status(200).json({
      message:
        userRole === "admin"
          ? "Product updated successfully by admin"
          : "Your product was updated successfully",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ message: "Error updating product" });
  }
};

