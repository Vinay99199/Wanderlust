const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const razorpay = require("../utils/razorpay");


const refundBookingPayment = async (
  booking,
  reason = "Host cancelled booking"
) => {
  // Already refunded
  if (booking.paymentStatus === "Refunded") {
    console.log("PAYMENT ALREADY REFUNDED");
    return null;
  }

  // Payment was not successful
  if (booking.paymentStatus !== "Paid") {
    console.log(
      "REFUND NOT REQUIRED. PAYMENT STATUS:",
      booking.paymentStatus
    );
    return null;
  }

  // Payment ID missing
  if (!booking.razorpayPaymentId) {
    throw new Error("Razorpay payment ID not found.");
  }

  // Get actual payment from Razorpay
  const payment = await razorpay.payments.fetch(
    booking.razorpayPaymentId
  );

  console.log("RAZORPAY PAYMENT:", payment);

  // Payment must be captured
  if (payment.status !== "captured") {
    throw new Error(
      `Payment is not captured. Current status: ${payment.status}`
    );
  }

  // If already fully refunded
  if (
    payment.amount_refunded &&
    payment.amount_refunded >= payment.amount
  ) {
    console.log("RAZORPAY PAYMENT IS ALREADY FULLY REFUNDED");

    booking.paymentStatus = "Refunded";
    booking.refundStatus = "Processed";
    booking.refundedAt = new Date();

    return null;
  }

  // Refund actual captured amount
  const refund = await razorpay.payments.refund(
    booking.razorpayPaymentId,
    {
      amount: payment.amount,
      notes: {
        bookingId: booking._id.toString(),
        reason: reason
      }
    }
  );

  console.log("REFUND SUCCESS:", {
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    paymentId: booking.razorpayPaymentId
  });

  // Update booking refund details
  booking.paymentStatus = "Refunded";
  booking.refundId = refund.id;
  booking.refundStatus = "Processed";
  booking.refundedAt = new Date();

  return refund;
};


// Create Booking
module.exports.createOrder = async (req, res) => {
  try {
    console.log("Create Order Hit");

    const { listingId } = req.params;
    const { checkIn, checkOut, guests } = req.body;

    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // Owner apni listing book nahi kar sakta
    if (listing.owner.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own listing.",
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: "Please select Check In and Check Out dates.",
      });
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);

    if (isNaN(inDate) || isNaN(outDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking dates.",
      });
    }

    if (outDate <= inDate) {
      return res.status(400).json({
        success: false,
        message: "Check Out must be after Check In.",
      });
    }

    const nights = Math.ceil(
      (outDate - inDate) / (1000 * 60 * 60 * 24)
    );

    // Already booked date check
    const existingBooking = await Booking.findOne({
      listing: listingId,
      bookingStatus: {
        $in: ["Pending", "Confirmed"],
      },
      checkIn: {
        $lt: outDate,
      },
      checkOut: {
        $gt: inDate,
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "This listing is already booked for these dates.",
      });
    }

    // COMPLETE BOOKING AMOUNT
    const totalPrice = nights * listing.price;

    const options = {
      amount: totalPrice * 100,
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
      error: err.message,
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
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/owner");
    }

    // Only booking owner can cancel
    if (!booking.owner.equals(req.user._id)) {
      req.flash(
        "error",
        "You are not authorized to cancel this booking."
      );

      return res.redirect("/bookings/owner");
    }

    // Already cancelled
    if (booking.bookingStatus === "Cancelled") {
      req.flash(
        "error",
        "Booking is already cancelled."
      );

      return res.redirect("/bookings/owner");
    }

    // Completed booking cannot be cancelled
    if (booking.bookingStatus === "Completed") {
      req.flash(
        "error",
        "Completed booking cannot be cancelled."
      );

      return res.redirect("/bookings/owner");
    }

    console.log("HOST REJECT REQUEST:", {
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      paymentId: booking.razorpayPaymentId
    });

    // Refund if payment was successful
    if (booking.paymentStatus === "Paid") {
      await refundBookingPayment(
        booking,
        "Host cancelled booking"
      );
    }

    console.log("AFTER REJECT REFUND:", {
      paymentStatus: booking.paymentStatus,
      refundStatus: booking.refundStatus,
      refundId: booking.refundId
    });

    booking.bookingStatus = "Cancelled";
    booking.cancelledAt = new Date();

    await booking.save();

    console.log("REJECT BOOKING SAVED:", {
      bookingId: booking._id,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      refundStatus: booking.refundStatus
    });

    req.flash(
      "success",
      "Booking cancelled and payment refunded successfully."
    );

    return res.redirect("/bookings/owner");

  } catch (err) {
    console.error(
      "REJECT BOOKING ERROR:",
      err
    );

    req.flash(
      "error",
      err.message ||
      "Could not cancel booking."
    );

    return res.redirect("/bookings/owner");
  }
};

module.exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Confirmed",
      "Cancelled",
      "Completed"
    ];

    // Validate status
    if (!allowedStatuses.includes(status)) {
      req.flash("error", "Invalid booking status.");
      return res.redirect("/bookings/owner");
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      req.flash("error", "Booking not found.");
      return res.redirect("/bookings/owner");
    }

    // Only owner can update booking
    if (!booking.owner.equals(req.user._id)) {
      req.flash(
        "error",
        "You are not authorized to update this booking."
      );

      return res.redirect("/bookings/owner");
    }

    // Already completed/cancelled
    if (
      booking.bookingStatus === "Cancelled" ||
      booking.bookingStatus === "Completed"
    ) {
      req.flash(
        "error",
        "This booking can no longer be updated."
      );

      return res.redirect("/bookings/owner");
    }

    // HOST CANCELS BOOKING
    if (status === "Cancelled") {

      console.log("HOST CANCEL REQUEST:", {
        bookingId: booking._id,
        paymentStatus: booking.paymentStatus,
        paymentId: booking.razorpayPaymentId
      });

      // Refund payment
      if (booking.paymentStatus === "Paid") {
        await refundBookingPayment(
          booking,
          "Host cancelled booking"
        );
      }

      console.log("AFTER REFUND:", {
        paymentStatus: booking.paymentStatus,
        refundStatus: booking.refundStatus,
        refundId: booking.refundId
      });

      booking.bookingStatus = "Cancelled";
      booking.cancelledAt = new Date();

      await booking.save();

      console.log("BOOKING SAVED:", {
        bookingId: booking._id,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        refundStatus: booking.refundStatus
      });

      req.flash(
        "success",
        "Booking cancelled and payment refunded successfully."
      );

      return res.redirect("/bookings/owner");
    }

    // CONFIRM / COMPLETE
    booking.bookingStatus = status;

    await booking.save();

    req.flash(
      "success",
      `Booking status updated to ${status}.`
    );

    return res.redirect("/bookings/owner");

  } catch (err) {
    console.error(
      "BOOKING STATUS ERROR:",
      err
    );

    req.flash(
      "error",
      err.message ||
      "Could not update booking status."
    );

    return res.redirect("/bookings/owner");
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

    // BASIC VALIDATION
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details are missing."
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: "Check In and Check Out dates are required."
      });
    }

    if (!guests || Number(guests) < 1) {
      return res.status(400).json({
        success: false,
        message: "At least 1 guest is required."
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

    const nights = Math.ceil(
      (outDate - inDate) / (1000 * 60 * 60 * 24)
    );

    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking dates."
      });
    }

    // VERIFY RAZORPAY PAYMENT SIGNATURE
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

    // CHECK DUPLICATE PAYMENT
    const existingPayment = await Booking.findOne({
      razorpayPaymentId: razorpay_payment_id
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "This payment has already been processed."
      });
    }

    // LISTING CHECK
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found."
      });
    }

    // OWNER CANNOT BOOK OWN LISTING
    if (listing.owner.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own listing."
      });
    }

    // CALCULATE TOTAL PRICE
    const totalPrice = nights * listing.price;

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

    // PAYMENT SUCCESSFUL BUT
    // DATES ARE NO LONGER AVAILABLE
    if (existingBooking) {
      try {
        // Fetch actual Razorpay payment
        const payment = await razorpay.payments.fetch(
          razorpay_payment_id
        );

        console.log("AUTO REFUND PAYMENT:", {
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status
        });

        if (payment.status !== "captured") {
          return res.status(400).json({
            success: false,
            message: "Payment is not captured."
          });
        }

        // Refund actual captured amount
        const refund = await razorpay.payments.refund(
          razorpay_payment_id,
          {
            amount: payment.amount,
            notes: {
              reason: "Booking dates became unavailable",
              listingId: listingId.toString(),
              userId: req.user._id.toString()
            }
          }
        );

        console.log("AUTO REFUND SUCCESS:", {
          refundId: refund.id,
          amount: refund.amount,
          status: refund.status
        });

      } catch (refundError) {
        console.error(
          "AUTO REFUND ERROR:",
          refundError
        );

        return res.status(500).json({
          success: false,
          message:
            "Payment was successful, but the booking dates are no longer available. Please contact support for the refund."
        });
      }

      return res.status(400).json({
        success: false,
        message:
          "Sorry! These dates have already been booked. Your payment has been refunded."
      });
    }

    // CREATE BOOKING
    const booking = new Booking({
      listing: listing._id,

      guest: req.user._id,

      owner: listing.owner,

      checkIn: inDate,

      checkOut: outDate,

      guests: Number(guests),

      nights,

      pricePerNight: listing.price,

      totalPrice,

      bookingStatus: "Pending",

      paymentStatus: "Paid",

      razorpayOrderId: razorpay_order_id,

      razorpayPaymentId: razorpay_payment_id,

      razorpaySignature: razorpay_signature,

      refundStatus: "Not Requested"
    });

    await booking.save();

    console.log("BOOKING CREATED:", {
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      paymentId: booking.razorpayPaymentId
    });

    // SUCCESS RESPONSE
    return res.json({
      success: true,
      message: "Payment Verified & Booking Created"
    });

  } catch (err) {
    console.error(
      "VERIFY PAYMENT ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};