const mongoose = require("mongoose")

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.")
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    console.log("MongoDB connected.")
  } catch {
    throw new Error(
      "MongoDB connection failed. Check MONGODB_URI and database availability.",
    )
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}

module.exports = { connectDB, isDatabaseConnected }
