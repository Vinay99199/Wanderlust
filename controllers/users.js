const User = require("../models/user.js");

module.exports.renderSignupForm=(req, res) => {
    res.render("users/signup.ejs");
};


module.exports.signup=async(req, res) => {
    try{
    let {username, email, password} = req.body;
    const newUser = new User({username, email});
    const registeredUser = await User.register(newUser, password);
    console.log(registeredUser);
    req.login(registeredUser, (err) => {
        if(err){
            return next(err);
        }
        req.flash("success", "Welcome to Wanderlust!");
        res.redirect("/listings");
    });
    }catch(e){
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};


module.exports.renderLoginForm=(req, res) => {
    res.render("users/login.ejs");
};


module.exports.login=async (req, res) => {
    req.flash("success", "Welcome back to Wanderlust!");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
  };


module.exports.logout= (req, res) => {
    req.logout((err)=>{
        if(err){
            return next (err);
        }
        req.flash("success", "Logged out successfully!");
        res.redirect("/listings");
    });
};

module.exports.profile = async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate("wishlist");

    res.render("users/profile.ejs", { user });
};

module.exports.renderEditProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    res.render("users/editProfile.ejs", { user });
};

module.exports.updateProfile = async (req, res) => {
    const { email, phone, bio, profileImage } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
        email,
        phone,
        bio,
        profileImage: {
            url: profileImage,
            filename: "",
        },
    });

    req.flash("success", "Profile updated successfully!");
    res.redirect("/profile");
};