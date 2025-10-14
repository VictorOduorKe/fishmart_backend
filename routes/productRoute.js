import express from "express";
import { 
    addProduct,
    fetchProducts,
    deleteProduct,
    updateProduct
} from "../controllers/productControllers.js";
import { protect } from "../midleware/authMidleware.js";

const router = express.Router();

router.post("/add-product", protect, addProduct);
router.get("/fetch-products", fetchProducts);
router.delete("/:product_id", protect, deleteProduct);
router.put("/:product_id", protect, updateProduct);

export default router;