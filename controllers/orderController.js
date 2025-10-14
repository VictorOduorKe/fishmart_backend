// controllers/orderController.js
import db from "../config/db.js"; // ✅ Using pooled connection (promise-based)

const TAX_RATE = 0.07;
const DELIVERY_FEE = 255.0;

// ==================== PLACE ORDER ====================
export const placeOrder = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const { cart_items } = req.body;

    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
      return res.status(400).json({ message: "Cart items are required" });
    }

    for (const item of cart_items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          message: "Each cart item must have a valid product_id and quantity greater than 0",
        });
      }
    }

    // 🔹 Step 1: Prevent duplicate pending orders
    const [pendingOrders] = await db.query(
      "SELECT id FROM orders WHERE user_id = ? AND status = 'pending' LIMIT 1",
      [user_id]
    );

    if (pendingOrders.length > 0) {
      return res.status(400).json({ message: "You already have a pending order." });
    }

    // 🔹 Step 2: Fetch product prices & availability
    const productIds = cart_items.map((item) => item.product_id);
    const placeholders = productIds.map(() => "?").join(",");
    const [products] = await db.query(
      `SELECT id, price, stock FROM products WHERE id IN (${placeholders})`,
      productIds
    );

    if (products.length !== productIds.length) {
      return res.status(400).json({ message: "Some products are unavailable or invalid" });
    }

    const productMap = {};
    products.forEach((p) => (productMap[p.id] = { price: p.price, stock: p.stock }));

    // 🔹 Step 3: Calculate totals
    let subtotal = 0;
    for (const item of cart_items) {
      const product = productMap[item.product_id];
      if (!product) {
        return res.status(400).json({ message: `Product ID ${item.product_id} not found` });
      }
      if (item.quantity > product.stock) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for product ID ${item.product_id}` });
      }
      subtotal += product.price * item.quantity;
    }

    const taxAmount = subtotal * TAX_RATE;
    const totalAmount = subtotal + taxAmount + DELIVERY_FEE;

    // 🔹 Step 4: Insert order
    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, subtotal, tax, delivery_fee, total_amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [user_id, subtotal, taxAmount, DELIVERY_FEE, totalAmount]
    );

    const orderId = orderResult.insertId;

    // 🔹 Step 5: Insert order items
    const itemsData = cart_items.map((item) => [
      orderId,
      item.product_id,
      item.quantity,
      productMap[item.product_id].price,
    ]);
    await db.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?", [
      itemsData,
    ]);

    // 🔹 Step 6: Update product stock
    for (const item of cart_items) {
      const newStock = productMap[item.product_id].stock - item.quantity;
      await db.query("UPDATE products SET stock = ? WHERE id = ?", [newStock, item.product_id]);
    }

    res.status(201).json({
      message: "Order placed successfully",
      orderId,
      totalAmount,
    });
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ message: "Error placing order", error: err.message });
  }
};

// ==================== CONFIRM ORDER ====================
export const confirmOrder = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const role = req.user?.role;
    const { order_id } = req.body;

    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }
    if (!order_id) {
      return res.status(400).json({ message: "Order ID is required" });
    }
    if (role !== "admin") {
      return res.status(403).json({ message: "Only admins can confirm orders" });
    }

    const [orders] = await db.query("SELECT id, total_amount, status FROM orders WHERE id = ?", [
      order_id,
    ]);

    if (orders.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orders[0];
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Order already processed or confirmed" });
    }

    const paymentConfirmed = true; // Replace with actual payment logic
    if (!paymentConfirmed) {
      return res.status(400).json({ message: "Payment not confirmed yet" });
    }

    await db.query(
      `UPDATE orders SET status = 'confirmed', confirmed_by = ?, confirmed_at = NOW() WHERE id = ?`,
      [user_id, order_id]
    );

    res.status(200).json({
      message: "Order confirmed successfully",
      order_id,
      confirmed_by: user_id,
    });
  } catch (err) {
    console.error("Confirm order error:", err);
    res.status(500).json({ message: "Error confirming order", error: err.message });
  }
};

// ==================== GET ORDERS ====================
export const getOrders = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const role = req.user?.role;

    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    let query, params;
    if (role === "admin") {
      query = "SELECT * FROM orders ORDER BY created_at DESC";
      params = [];
    } else {
      query = "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC";
      params = [user_id];
    }

    const [orders] = await db.query(query, params);
    res.status(200).json({ orders });
  } catch (err) {
    console.error("Get orders error:", err);
    res.status(500).json({ message: "Error fetching orders", error: err.message });
  }
};


