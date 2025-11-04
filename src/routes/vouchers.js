const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/voucherController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { body } = require("express-validator");

// Get all active vouchers (public)
router.get("/", voucherController.getVouchers);

// Get voucher by ID (public)
router.get("/:id", voucherController.getVoucherById);

// Apply voucher to order (user only)
router.post(
  "/apply",
  authMiddleware,
  [
    body("voucher_code").notEmpty().withMessage("Voucher code is required"),
    body("order_id").isInt().withMessage("Invalid order ID"),
  ],
  voucherController.applyVoucher
);

module.exports = router;
