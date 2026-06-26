const express = require("express");
const router = express.Router();
const Newsletter = require("../models/newsletter");

router.post("/subscribe", async (req, res) => {
  try {
    let { email } = req.body;

    // Email validation
    if (!email) {
      req.flash("error", "Email is required");
      return res.redirect("/");
    }

    // Normalize email
    email = email.trim().toLowerCase();

    console.log("Submitted Email:", email);

    // Check duplicate
    const existing = await Newsletter.findOne({ email });

    console.log("Existing:", existing);

    if (existing) {
      console.log("Duplicate Found");
      req.flash("error", "Already subscribed!");
      return res.redirect("/");
    }

    // Save email
    const subscriber = await Newsletter.create({ email });

    console.log("Saved:", subscriber);

    req.flash("success", "Subscribed successfully!");
    return res.redirect("/");

  } catch (err) {
    console.error(err);

    // Handle Mongo duplicate error
    if (err.code === 11000) {
      req.flash("error", "Already subscribed!");
      return res.redirect("/");
    }

    req.flash("error", "Something went wrong");
    return res.redirect("/");
  }
});

module.exports = router;