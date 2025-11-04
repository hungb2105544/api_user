const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { authMiddleware } = require("../middleware/auth");

router.get("/", authMiddleware, cartController.getCart);
router.post("/items", authMiddleware, cartController.addToCart);
router.put("/items/:id", authMiddleware, cartController.updateCartItem);
router.delete("/items/:id", authMiddleware, cartController.removeFromCart);
module.exports = router;
