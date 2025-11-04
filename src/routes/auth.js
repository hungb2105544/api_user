const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { body } = require("express-validator");

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Invalid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("phone_number")
      .matches(/^(0|\+84)[1-9][0-9]{8,9}$/)
      .withMessage("Invalid phone number"),
  ],
  authController.register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.login
);

module.exports = router;
