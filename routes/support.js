const express = require("express");
const router = express.Router();

const User = require("../models/user.js");
const { isLoggedIn } = require("../middleware.js");

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
router.get("/contact", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id);

    res.render("support/contact", {
        user
    });
});

// Contact form submit
router.post("/contact", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id);
    const { message } = req.body;

    if (!message) {
        req.flash("error", "Please enter your message.");
        return res.redirect("/contact");
    }

    req.flash("success", "Thank you! Your message has been received.");
    res.redirect("/contact");
});

module.exports = router;