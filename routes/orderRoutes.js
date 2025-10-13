const express = require("express");
const { placeOrder,getOrders,confirmOrder } = require("../controllers/orderController");
const { protect } = require("../midleware/authMidleware");

const router = express.Router();

router.post("/place-order", protect, placeOrder);
router.get("/orders", protect, getOrders);
router.post("/confirm-order", protect, confirmOrder);

module.exports = router;