const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(async () => {
    console.log("connected to DB");
    await initDB();
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});

  const seededData = initData.data.map((obj) => ({
    ...obj,
    owner: new mongoose.Types.ObjectId("69ca88029ac08c0f23d74c9c"),
    geocoding: obj.geocoding || {
      type: "Point",
      coordinates: [0, 0],
    },
  }));

  await Listing.insertMany(seededData);
  console.log("data was initialized");
};