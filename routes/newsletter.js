const express = require("express");
const router = express.Router();
const Newsletter = require("../models/newsletter");

router.post("/subscribe", async (req, res) => {
  try {
    let { email } = req.body;

    // Check email exists
    if (!email) {
      req.flash("error", "Email is required");
      return res.redirect("/");
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      req.flash("error", "Please enter a valid email address");
      return res.redirect("/");
    }

    // Check duplicate email
    const existing = await Newsletter.findOne({ email });

    if (existing) {
      req.flash("error", "Already subscribed!");
      return res.redirect("/");
    }

    // Save subscriber
    await Newsletter.create({ email });

    req.flash("success", "Subscribed successfully!");

    return res.redirect("/");

  } catch (err) {
    console.error("Newsletter Error:", err);

    // MongoDB duplicate key error
    if (err.code === 11000) {
      req.flash("error", "Already subscribed!");
      return res.redirect("/");
    }

    req.flash("error", "Something went wrong");
    return res.redirect("/");
  }
});

module.exports = router;