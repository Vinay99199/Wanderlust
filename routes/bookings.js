const express = require("express");
const router = express.Router();

const bookingsController = require("../controllers/bookings");
const { isLoggedIn } = require("../middleware");

// User Bookings
router.get(
    "/my",
    isLoggedIn,
    bookingsController.myBookings
);

// Owner Bookings
router.get(
    "/owner",
    isLoggedIn,
    bookingsController.ownerBookings
);

// Razorpay Order Create
router.post(
    "/:listingId/create-order",
    isLoggedIn,
    bookingsController.createOrder
);

// Razorpay Payment Verify + Booking Create
router.post(
    "/:listingId/verify-payment",
    isLoggedIn,
    bookingsController.verifyPayment
);

// Owner Actions
router.put(
    "/:id/status",
    isLoggedIn,
    bookingsController.updateBookingStatus
);

router.patch(
    "/:id/confirm",
    isLoggedIn,
    bookingsController.confirmBooking
);

router.patch(
    "/:id/cancel",
    isLoggedIn,
    bookingsController.rejectBooking
);

// User Cancel Booking
router.delete(
    "/:id",
    isLoggedIn,
    bookingsController.cancelBooking
);

module.exports = router;
