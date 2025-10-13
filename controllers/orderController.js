const db=require("../config/db");


const placeOrder = (req, res) => {
  const user_id = req.user?.id; //  from token (protect middleware)
  const { cart_items } = req.body;

  const TAX_RATE = 0.07;         // 7% tax
  const DELIVERY_FEE = 255.00;   // flat delivery fee

  // 🔹 Step 1: Basic validation
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

  // 🔹 Step 2: Check for existing pending orders (to prevent duplicates)
  const pendingOrderQuery = "SELECT id FROM orders WHERE user_id = ? AND status = 'pending' LIMIT 1";
  db.query(pendingOrderQuery, [user_id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database query error" });

    if (results.length > 0) {
      return res.status(400).json({ message: "You already have a pending order." });
    }

    // 🔹 Step 3: Fetch product prices and availability
    const productIds = cart_items.map(item => item.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const fetchProductsQuery = `SELECT id, price, stock FROM products WHERE id IN (${placeholders})`;

    db.query(fetchProductsQuery, productIds, (err, products) => {
      if (err) return res.status(500).json({ message: "Database query error" });
      if (products.length !== productIds.length) {
        return res.status(400).json({ message: "Some products are unavailable or invalid" });
      }

      // 🔹 Step 4: Calculate total cost and verify stock
      const productMap = {};
      products.forEach(p => (productMap[p.id] = { price: p.price, stock: p.stock }));

      let subtotal = 0;
      for (const item of cart_items) {
        const product = productMap[item.product_id];
        if (!product) {
          return res.status(400).json({ message: `Product ID ${item.product_id} not found` });
        }
        if (item.quantity > product.stock) {
          return res.status(400).json({ message: `Insufficient stock for product ID ${item.product_id}` });
        }
        subtotal += product.price * item.quantity;
      }

      const taxAmount = subtotal * TAX_RATE;
      const totalAmount = subtotal + taxAmount + DELIVERY_FEE;

      // 🔹 Step 5: Create order
      const insertOrderQuery = `
        INSERT INTO orders (user_id, subtotal, tax, delivery_fee, total_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NOW())
      `;
      db.query(insertOrderQuery, [user_id, subtotal, taxAmount, DELIVERY_FEE, totalAmount], (err, orderResult) => {
        if (err) return res.status(500).json({ message: "Error creating order" });

        const orderId = orderResult.insertId;

        // 🔹 Step 6: Insert order items
        const insertItemsQuery = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?";
        const itemsData = cart_items.map(item => [
          orderId,
          item.product_id,
          item.quantity,
          productMap[item.product_id].price,
        ]);

        db.query(insertItemsQuery, [itemsData], (err) => {
          if (err) return res.status(500).json({ message: "Error adding order items" });

          // 🔹 Step 7: Reduce product stock
          const updateStockQueries = cart_items.map(item => {
            const newStock = productMap[item.product_id].stock - item.quantity;
            return new Promise((resolve, reject) => {
              db.query("UPDATE products SET stock = ? WHERE id = ?", [newStock, item.product_id], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });

          Promise.all(updateStockQueries)
            .then(() => {
              res.status(201).json({
                message: "Order placed successfully",
                orderId,
                totalAmount,
              });
            })
            .catch(() => {
              res.status(500).json({ message: "Error updating product stock" });
            });
        });
      });
    });
  });
};

const confirmOrder = (req, res) => {
  const user_id = req.user?.id;     // ✅ from token
  const role = req.user?.role;      // ✅ from token
  const { order_id } = req.body;

  // 🔹 Step 1: Validation
  if (!user_id) {
    return res.status(401).json({ message: "Unauthorized: User ID missing" });
  }

  if (!order_id) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  // 🔹 Step 2: Restrict access to admins only
  if (role !== "admin") {
    return res.status(403).json({ message: "Only admins can confirm orders" });
  }

  // 🔹 Step 3: Retrieve order details (check if it exists & pending)
  const getOrderQuery = "SELECT id, total_amount, status FROM orders WHERE id = ?";

  db.query(getOrderQuery, [order_id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database query error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = results[0];

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Order already processed or confirmed" });
    }

    // 🔹 Step 4: Validate payment (placeholder for integration)
    const paymentConfirmed = true; // You’ll replace this with actual payment verification logic
    const paymentAmountValid = order.total_amount > 0; // Example validation

    if (!paymentConfirmed) {
      return res.status(400).json({ message: "Payment not confirmed yet" });
    }

    if (!paymentAmountValid) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    // 🔹 Step 5: Confirm the order
    const confirmOrderQuery = `
      UPDATE orders 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = NOW()
      WHERE id = ?
    `;

    db.query(confirmOrderQuery, [user_id, order_id], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error confirming order" });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: "Order confirmation failed" });
      }

      res.status(200).json({
        message: "Order confirmed successfully",
        order_id,
        confirmed_by: user_id,
      });
    });
  });
};

const getOrders = (req, res) => {
  const user_id = req.user?.id; // from token (protect middleware)
  const role = req.user?.role;  // from token (protect middleware)

  if (!user_id) {
    return res.status(401).json({ message: "Unauthorized: User ID missing" });
  }

  let getOrdersQuery;
  let queryParams = [];

  if (role === "admin") {
    // Admins can see all orders
    getOrdersQuery = "SELECT * FROM orders ORDER BY created_at DESC";
  } else {
    // Regular users can only see their own orders
    getOrdersQuery = "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC";
    queryParams.push(user_id);
  }

  db.query(getOrdersQuery, queryParams, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database query error" });
    }

    res.status(200).json({ orders: results });
  });
};

module.exports = {
  placeOrder,
  confirmOrder,
  getOrders,
};
  