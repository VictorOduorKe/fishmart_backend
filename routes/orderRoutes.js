import express from "express";
import { placeOrder,getOrders,confirmOrder } from "../controllers/orderController.js";
import { protect } from "../midleware/authMidleware.js";
const router = express.Router();

router.post("/place-order", protect, placeOrder);
router.get("/orders", protect, getOrders);
router.post("/confirm-order", protect, confirmOrder);

export default router;