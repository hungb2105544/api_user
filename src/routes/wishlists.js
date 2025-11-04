const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishlistController");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { body } = require("express-validator");

// Get user's wishlist
router.get("/", authMiddleware, wishlistController.getWishlist);

// Add product to wishlist
router.post(
  "/",
  authMiddleware,
  [body("product_id").isInt().withMessage("Invalid product ID")],
  wishlistController.addToWishlist
);

// Remove product from wishlist
router.delete("/:id", authMiddleware, wishlistController.removeFromWishlist);

// Admin: Get all wishlists (for analytics)
router.get(
  "/all",
  authMiddleware,
  adminMiddleware,
  wishlistController.getAllWishlists
);

module.exports = router;
