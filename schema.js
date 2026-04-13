const Joi= require("joi");//joi ek validation library hai jo data ko validate karne ke liye use hota hai. Iska use hum apne data ko validate karne ke liye karte hain, jaise ki user input, form data, etc. Iska use hum apne code ko secure banane ke liye karte hain, taki hum apne code ko malicious input se bachaa sakein.
module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().required().min(0),
    location: Joi.string().required(),
    country: Joi.string().required(),
    image: Joi.string().allow("", null)
  }).required()
});
module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required()
  }).required()
});