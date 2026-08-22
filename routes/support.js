const express = require("express");
const router = express.Router();

// Help Center
router.get("/help", (req, res) => {
  res.render("support/help");
});

// Privacy Policy
router.get("/privacy-policy", (req, res) => {
  res.render("support/privacy-policy");
});

// Terms & Conditions
router.get("/terms", (req, res) => {
  res.render("support/terms");
});

// Contact Us
router.get("/contact", (req, res) => {
  res.render("support/contact");
});

// Contact form submit
router.post("/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    req.flash("error", "Please fill all fields.");
    return res.redirect("/contact");
  }

  // Abhi message ko database/email me save nahi kar rahe.
  // Baad me Contact model ya email service add kar sakte hain.

  req.flash("success", "Thank you! Your message has been received.");
  res.redirect("/contact");
});

module.exports = router;