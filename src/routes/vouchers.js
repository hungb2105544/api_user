const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/voucherController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { body } = require("express-validator");

// Get all active vouchers (public)
router.get("/", voucherController.getVouchers);

// Get voucher by ID (public)
router.get("/:id", voucherController.getVoucherById);

// Create voucher (admin only)
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  [
    body("code").notEmpty().withMessage("Voucher code is required"),
    body("name").notEmpty().withMessage("Name is required"),
    body("type")
      .isIn(["percentage", "fixed_amount", "free_shipping"])
      .withMessage("Invalid voucher type"),
    body("value")
      .isInt({ min: 1 })
      .withMessage("Value must be a positive integer"),
    body("min_order_value")
      .optional()
      .isNumeric()
      .withMessage("Min order value must be numeric"),
    body("max_discount_amount")
      .optional()
      .isNumeric()
      .withMessage("Max discount amount must be numeric"),
    body("usage_limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Usage limit must be a positive integer"),
    body("usage_limit_per_user")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Usage limit per user must be a positive integer"),
    body("valid_from").isISO8601().withMessage("Invalid valid_from date"),
    body("valid_to").isISO8601().withMessage("Invalid valid_to date"),
  ],
  voucherController.createVoucher
);

// Update voucher (admin only)
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  [
    body("code")
      .optional()
      .notEmpty()
      .withMessage("Voucher code cannot be empty"),
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("type")
      .optional()
      .isIn(["percentage", "fixed_amount", "free_shipping"])
      .withMessage("Invalid voucher type"),
    body("value")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Value must be a positive integer"),
  ],
  voucherController.updateVoucher
);

// Delete voucher (admin only)
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  voucherController.deleteVoucher
);

// Assign voucher to user (admin only)
router.post(
  "/:id/assign",
  authMiddleware,
  adminMiddleware,
  [body("user_id").isUUID().withMessage("Invalid user ID")],
  voucherController.assignVoucher
);

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
