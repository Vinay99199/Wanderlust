const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const razorpay = require("../utils/razorpay");

// Create Booking
module.exports.createBooking = async (req, res) => {
    try {
        const { listingId } = req.params;
        const {
            checkIn,
            checkOut,
            guests
        } = req.body;

        const listing = await Listing.findById(listingId);

        if (!listing) {
            req.flash("error", "Listing not found.");
            return res.redirect("/listings");
        }

        // Owner apni listing book nahi kar sakta
        if (listing.owner.equals(req.user._id)) {
            req.flash("error", "You cannot book your own listing.");
            return res.redirect(`/listings/${listingId}`);
        }

        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);

        const nights = Math.ceil(
            (outDate - inDate) / (1000 * 60 * 60 * 24)
        );

        if (nights <= 0) {
            req.flash("error", "Invalid booking dates.");
            return res.redirect(`/listings/${listingId}`);
        }

        const totalPrice = nights * listing.price;
        const booking = new Booking({
            listing: listing._id,
            guest: req.user._id,
            owner: listing.owner,
            checkIn: inDate,
            checkOut: outDate,
            guests,
            nights,
            pricePerNight: listing.price,
            totalPrice
        });

        await booking.save();

        req.flash("success", "Booking successful!");

        res.redirect("/bookings/my");

    } catch (err) {
        console.log(err);
        req.flash("error", "Booking failed.");
        res.redirect("back");
    }
};


module.exports.myBookings = async (req, res) => {
    let bookings = await Booking.find({
        guest: req.user._id
    }).populate("listing");

    bookings = bookings.filter(b => b.listing);

    res.render("bookings/my", { bookings });
};


module.exports.cancelBooking = async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings/my");
    }

    // Sirf booking karne wala user hi cancel kar sakta hai
    if (!booking.guest.equals(req.user._id)) {
        req.flash("error", "Not authorized to cancel this booking");
        return res.redirect("/bookings/my");
    }

    await Booking.findByIdAndDelete(id);

    req.flash("success", "Booking cancelled successfully!");
    res.redirect("/bookings/my");
};


module.exports.ownerBookings = async (req, res) => {
    let bookings = await Booking.find({
        owner: req.user._id
    })
    .populate("listing")
    .populate("guest");

    bookings = bookings.filter(b => b.listing);

    res.render("bookings/owner", { bookings });
};

module.exports.confirmBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings/owner");
    }

    if (!booking.owner.equals(req.user._id)) {
        req.flash("error", "Unauthorized");
        return res.redirect("/bookings/owner");
    }

    booking.bookingStatus = "Confirmed";
    await booking.save();

    req.flash("success", "Booking confirmed.");
    res.redirect("/bookings/owner");
};

module.exports.rejectBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings/owner");
    }

    if (!booking.owner.equals(req.user._id)) {
        req.flash("error", "Unauthorized");
        return res.redirect("/bookings/owner");
    }

    booking.bookingStatus = "Cancelled";
    booking.cancelledAt = new Date();

    await booking.save();

    req.flash("success", "Booking cancelled.");
    res.redirect("/bookings/owner");
};

module.exports.updateBookingStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    await Booking.findByIdAndUpdate(id, {
        bookingStatus: status,
    });

    req.flash("success", "Booking status updated!");
    res.redirect("/bookings/owner");
};

module.exports.createOrder = async (req, res) => {
    try {
        console.log("Create Order Hit");

        const listing = await Listing.findById(req.params.listingId);

        console.log("Listing:", listing);

        const options = {
            amount: listing.price * 100,
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        console.log("Order:", order);

        res.json(order);

    } catch (err) {
        console.log("RAZORPAY ERROR =>", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

module.exports.verifyPayment = async (req, res) => {

    console.log(req.body);
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            checkIn,
            checkOut,
            guests
        } = req.body;

        const { listingId } = req.params;

        // ==========================
        // Validate Dates
        // ==========================

        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);

        const nights = Math.ceil(
            (outDate - inDate) / (1000 * 60 * 60 * 24)
        );

        if (nights <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking dates"
            });
        }

        // ==========================
        // Verify Razorpay Signature
        // ==========================

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {

            return res.status(400).json({
                success: false,
                message: "Payment Verification Failed"
            });

        }

        // ==========================
        // Find Listing
        // ==========================

        const listing = await Listing.findById(listingId);

        if (!listing) {

            return res.status(404).json({
                success: false,
                message: "Listing not found"
            });

        }

        const totalPrice = nights * listing.price;

        // ==========================
        // Save Booking
        // ==========================

        const booking = new Booking({

            listing: listing._id,
            guest: req.user._id,
            owner: listing.owner,

            checkIn: inDate,
            checkOut: outDate,
            guests,

            nights,
            pricePerNight: listing.price,
            totalPrice,

            bookingStatus: "Pending",
            paymentStatus: "Paid",

            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature

        });

        await booking.save();

        return res.json({
            success: true,
            message: "Payment Verified"
        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};
