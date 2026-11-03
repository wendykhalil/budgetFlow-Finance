const mongoose = require("mongoose")

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.")
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI)

    console.log("MongoDB connected.")
  } catch (error) {
    // Log the original error safely for diagnostics (never log connection strings)
    // Extract error message, removing any connection string or credential details
    let errorMessage = error.message || error.toString()
    
    // Remove common MongoDB connection string patterns to avoid logging credentials
    errorMessage = errorMessage.replace(
      /mongodb(\+srv)?:\/\/[^\s/]+@[^\s/]+\/[^\s/]*/g,
      "mongodb://[redacted]",
    )
    errorMessage = errorMessage.replace(
      /mongodb(\+srv)?:\/\/[^\s]*/g,
      "mongodb://[redacted]",
    )

    console.error("MongoDB connection failed:", errorMessage)
    if (error.code) {
      console.error("Error code:", error.code)
    }

    throw new Error(
      "MongoDB connection failed. Check MONGODB_URI and database availability.",
    )
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1
}

module.exports = { connectDB, isDatabaseConnected }
