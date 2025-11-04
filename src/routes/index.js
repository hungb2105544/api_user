const express = require("express");
const router = express.Router();
const authRoutes = require("./auth");
const userRoutes = require("./users");
const productRoutes = require("./products");
const cartRoutes = require("./carts");
const orderRoutes = require("./orders");
const voucherRoutes = require("./vouchers");
const wishlistRoutes = require("./wishlists");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/carts", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/vouchers", voucherRoutes);
router.use("/wishlists", wishlistRoutes);

module.exports = router;
