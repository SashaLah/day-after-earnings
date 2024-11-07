// server/db/mongodb.js

const mongoose = require('mongoose');
const { DB_CONFIG } = require('../config');
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
      console.error('MongoDB Atlas connection error:', error.message);
      console.error('Full error:', error);
      process.exit(1);
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
  lastEarningsDate: {
    type: Date,
    default: null
  },
  lastChecked: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  collection: 'companies'
});

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
  reportTime: {
    type: String,
    enum: ['BMO', 'AMC', 'TNS'], // Before Market Open, After Market Close, Time Not Specified
    default: 'TNS'
  }
}, {
  timestamps: true,
  collection: 'earnings'
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
  earningsDate: {
    type: Date,
    required: true,
    index: true
  },
  preEarningsOpen: {
    type: Number,
    required: true
  },
  preEarningsClose: {
    type: Number,
    required: true
  },
  postEarningsOpen: {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  collection: 'pricehistory'
});

// Create compound indexes for price history
priceHistorySchema.index({ symbol: 1, date: 1 }, { unique: true });
priceHistorySchema.index({ symbol: 1, earningsDate: 1 }, { unique: true });

// Static methods for Earnings
earningsSchema.static('getLatestBySymbol', function(symbol) {
  return this.findOne({ symbol: symbol.toUpperCase() })
    .sort({ date: -1 })
    .lean();
});

earningsSchema.static('getBySymbol', function(symbol) {
  return this.find({ symbol: symbol.toUpperCase() })
    .sort({ date: -1 })
    .lean();
});

// Static methods for PriceHistory
priceHistorySchema.static('getBySymbolAndEarningsDate', function(symbol, earningsDate) {
  return this.findOne({
    symbol: symbol.toUpperCase(),
    earningsDate: earningsDate
  }).lean();
});

priceHistorySchema.static('getBySymbol', function(symbol) {
  return this.find({
    symbol: symbol.toUpperCase()
  })
  .sort({ date: -1 })
  .lean();
});

// Instance methods
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

// Middleware
earningsSchema.pre('save', function(next) {
  this.symbol = this.symbol.toUpperCase();
  next();
});

priceHistorySchema.pre('save', function(next) {
  this.symbol = this.symbol.toUpperCase();
  next();
});

// Create models
const Company = mongoose.model('Company', companySchema);
const Earnings = mongoose.model('Earnings', earningsSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Debug logging for MongoDB operations
if (process.env.NODE_ENV !== 'production') {
  mongoose.set('debug', true);
}

// Close MongoDB connection properly on app termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

module.exports = {
  connectDB,
  Company,
  Earnings,
  PriceHistory
};