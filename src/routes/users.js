const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { body } = require("express-validator");

// Get current user profile
router.get("/profile", authMiddleware, userController.getProfile);

// Update user profile
router.put(
  "/profile",
  authMiddleware,
  [
    body("full_name")
      .optional()
      .notEmpty()
      .withMessage("Full name cannot be empty"),
    body("phone_number")
      .optional()
      .matches(/^(0|\+84)[1-9][0-9]{8,9}$/)
      .withMessage("Invalid phone number"),
    body("gender")
      .optional()
      .isIn(["male", "female", "other"])
      .withMessage("Invalid gender"),
    body("date_of_birth")
      .optional()
      .isDate()
      .withMessage("Invalid date of birth"),
  ],
  userController.updateProfile
);

// Manage user addresses
router.get("/addresses", authMiddleware, userController.getAddresses);
router.post(
  "/addresses",
  authMiddleware,
  [
    body("street").notEmpty().withMessage("Street is required"),
    body("ward").notEmpty().withMessage("Ward is required"),
    body("district").notEmpty().withMessage("District is required"),
    body("province").notEmpty().withMessage("Province is required"),
    body("receiver_name").notEmpty().withMessage("Receiver name is required"),
    body("receiver_phone")
      .matches(/^(0|\+84)[1-9][0-9]{8,9}$/)
      .withMessage("Invalid receiver phone"),
    body("is_default")
      .optional()
      .isBoolean()
      .withMessage("is_default must be a boolean"),
  ],
  userController.addAddress
);
router.put("/addresses/:id", authMiddleware, userController.updateAddress);
router.delete("/addresses/:id", authMiddleware, userController.deleteAddress);

// Get user rank
router.get("/rank", authMiddleware, userController.getRank);

// Get user vouchers
router.get("/vouchers", authMiddleware, userController.getVouchers);

// Get user notifications
router.get("/notifications", authMiddleware, userController.getNotifications);
router.put(
  "/notifications/:id/read",
  authMiddleware,
  userController.markNotificationRead
);

// Admin: List all users
router.get("/", authMiddleware, adminMiddleware, userController.getAllUsers);

// Admin: Update user role
router.put(
  "/:id/role",
  authMiddleware,
  adminMiddleware,
  userController.updateUserRole
);

module.exports = router;
