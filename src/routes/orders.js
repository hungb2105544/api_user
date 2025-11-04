const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authMiddleware } = require("../middleware/auth");

router.get("/", authMiddleware, orderController.getOrders);
router.post("/", authMiddleware, orderController.createOrder);
router.get("/:id", authMiddleware, orderController.getOrderById);

module.exports = router;
