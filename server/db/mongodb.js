const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stockdata');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Test the connection by creating indexes
    await Promise.all([
      Earnings.createIndexes(),
      PriceHistory.createIndexes()
    ]);
    console.log('MongoDB indexes created successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Company Schema
const companySchema = new mongoose.Schema({
  symbol: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true
  },
  name: { 
    type: String, 
    required: true 
  }
}, { timestamps: true });

// Earnings Schema
const earningsSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  date: {
    type: Date,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for unique earnings dates per symbol
earningsSchema.index({ symbol: 1, date: 1 }, { unique: true });

// Price History Schema
const priceHistorySchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  date: {
    type: Date,
    required: true
  },
  open: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for unique price dates per symbol
priceHistorySchema.index({ symbol: 1, date: 1 }, { unique: true });

// Create models
const Company = mongoose.model('Company', companySchema);
const Earnings = mongoose.model('Earnings', earningsSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

module.exports = {
  connectDB,
  Company,
  Earnings,
  PriceHistory
};