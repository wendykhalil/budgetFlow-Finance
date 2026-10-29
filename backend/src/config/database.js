const mongoose = require('mongoose');

async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected.');
  } catch (error) {
    console.error('MongoDB connection failed. Check MONGODB_URI and database availability.');
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDatabaseConnected };
