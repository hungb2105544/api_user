const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);
router.post("/", productController.createProduct); // Admin only
router.put("/:id", productController.updateProduct); // Admin only
router.delete("/:id", productController.deleteProduct); // Admin only

module.exports = router;
