const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const razorpay = require("../utils/razorpay");

// Create Booking
module.exports.createOrder = async (req, res) => {
    try {
        console.log("Create Order Hit");

        const { listingId } = req.params;
        const { checkIn, checkOut, guests } = req.body;

        // Listing check
        const listing = await Listing.findById(listingId);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: "Listing not found"
            });
        }

        // Owner apni listing book nahi kar sakta
        if (listing.owner.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot book your own listing."
            });
        }

        // Date check
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: "Please select Check In and Check Out dates."
            });
        }

        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);

        if (isNaN(inDate) || isNaN(outDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking dates."
            });
        }

        if (outDate <= inDate) {
            return res.status(400).json({
                success: false,
                message: "Check Out must be after Check In."
            });
        }

       
        // IMPORTANT: ALREADY BOOKED DATE CHECK
        const existingBooking = await Booking.findOne({
            listing: listingId,

            bookingStatus: {
                $in: ["Pending", "Confirmed"]
            },

            checkIn: {
                $lt: outDate
            },

            checkOut: {
                $gt: inDate
            }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: "This listing is already booked for these dates."
            });
        }

        // RAZORPAY ORDER
        const options = {
            amount: listing.price * 100,
            currency: "INR",
            receipt: "receipt_" + Date.now()
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

        // BASIC DATE VALIDATION
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: "Check In and Check Out dates are required."
            });
        }

        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);

        if (isNaN(inDate) || isNaN(outDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking dates."
            });
        }

        const nights = Math.ceil(
            (outDate - inDate) / (1000 * 60 * 60 * 24)
        );

        if (nights <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking dates"
            });
        }

        // VERIFY RAZORPAY PAYMENT
        const body =
            razorpay_order_id +
            "|" +
            razorpay_payment_id;

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

    
        // LISTING CHECK
        const listing = await Listing.findById(listingId);

        if (!listing) {

            return res.status(404).json({
                success: false,
                message: "Listing not found"
            });

        }

        // Owner apni listing book nahi kar sakta
        if (listing.owner.equals(req.user._id)) {

            return res.status(400).json({
                success: false,
                message: "You cannot book your own listing."
            });

        }

        // FINAL AVAILABILITY CHECK
        const existingBooking = await Booking.findOne({
            listing: listingId,
            bookingStatus: {
                $in: ["Pending", "Confirmed"]
            },
            checkIn: {
                $lt: outDate
            },
            checkOut: {
                $gt: inDate
            }
        });
        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: "Sorry! These dates have already been booked."
            });

        }

        // CREATE BOOKING
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
            message: "Payment Verified & Booking Created"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: "Server Error"

        });
    }
};
