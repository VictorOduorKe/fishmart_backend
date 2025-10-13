const express = require("express");
const { 
    addProduct,
    fetchProducts,
    deleteProduct,
    updateProduct
} = require("../controllers/productControllers");
const { protect } = require("../midleware/authMidleware");

const router = express.Router();

router.post("/add-product", protect, addProduct);
router.get("/fetch-products", fetchProducts);
router.delete("/:product_id", protect, deleteProduct);
router.put("/:product_id", protect, updateProduct);

module.exports = router;