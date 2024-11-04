const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    
    // Test the connection by creating indexes
    await Promise.all([
      Earnings.createIndexes(),
      PriceHistory.createIndexes()
    ]);
    console.log('MongoDB indexes created successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB Atlas connection error:', error);
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
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Earnings Schema
const earningsSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for unique earnings dates per symbol
earningsSchema.index({ symbol: 1, date: 1 }, { unique: true });

// Price History Schema
const priceHistorySchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
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
}, {
  timestamps: true
});

// Create compound index for unique price dates per symbol
priceHistorySchema.index({ symbol: 1, date: 1 }, { unique: true });

// Add methods to schemas
earningsSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  return obj;
};

priceHistorySchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  return obj;
};

// Create models
const Company = mongoose.model('Company', companySchema);
const Earnings = mongoose.model('Earnings', earningsSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Add model methods for common operations
Earnings.getBySymbol = async function(symbol) {
  return this.find({ symbol: symbol.toUpperCase() })
    .sort({ date: -1 })
    .lean();
};

PriceHistory.getBySymbolAndDateRange = async function(symbol, fromDate, toDate) {
  return this.find({
    symbol: symbol.toUpperCase(),
    date: {
      $gte: new Date(fromDate),
      $lte: new Date(toDate)
    }
  })
  .sort({ date: 1 })
  .lean();
};

module.exports = {
  connectDB,
  Company,
  Earnings,
  PriceHistory
};