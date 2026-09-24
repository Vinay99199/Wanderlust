const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const User = require("../models/user");
const {
    isLoggedIn,
    isOwner,
    validateListing
} = require("../middleware.js");

const listingController = require("../controllers/listings.js");

const multer = require("multer");
const { storage } = require("../cloudConfig.js");

const upload = multer({ storage });


// Index & Create

router.route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.single("listing[image]"),
        validateListing,
        wrapAsync(listingController.createListing)
    );


// New route

router.get(
    "/new",
    isLoggedIn,
    listingController.renderNewForm
);


// Favourites

router.get(
    "/favourites",
    isLoggedIn,
    wrapAsync(listingController.renderFavourites)
);


// Wishlist
router.post(
    "/:id/wishlist",
    isLoggedIn,
    async (req, res) => {
        try {
            const listingId = req.params.id;

            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User not found"
                });
            }

            if (user.wishlist.includes(listingId)) {
                user.wishlist.pull(listingId);
            } else {
                user.wishlist.push(listingId);
            }

            await user.save();

            const isFavourite = user.wishlist.some(
                id => id.toString() === listingId.toString()
            );

            return res.json({
                success: true,
                isFavourite
            });

        } catch (error) {
            console.error("WISHLIST ERROR:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to update favourite"
            });
        }
    }
);

// Show, Update & Delete

router.route("/:id")
    .get(wrapAsync(listingController.showListing))
    .put(
        isLoggedIn,
        isOwner,
        upload.single("listing[image]"),
        validateListing,
        wrapAsync(listingController.updateListing)
    )
    .delete(
        isLoggedIn,
        isOwner,
        wrapAsync(listingController.destroyListing)
    );


// Edit route

router.get(
    "/:id/edit",
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.renderEditForm)
);


module.exports = router;