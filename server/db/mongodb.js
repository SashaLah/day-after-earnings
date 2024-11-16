// server/db/mongodb.js

const mongoose = require('mongoose');

// Company Schema
const companySchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    exchange: {
        type: String,
        enum: ['NYSE', 'NASDAQ', 'AMEX', 'OTHER'],
        default: 'OTHER'
    },
    isS500: {
        type: Boolean,
        default: false
    },
    sector: String,
    industry: String,
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Earnings Schema with new field names
const earningsSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    reportTime: {
        type: String,
        enum: ['BMO', 'AMC', 'TNS'], // Before Market Open, After Market Close, Time Not Specified
        default: 'TNS'
    },
    // New price fields with clear naming
    closePriceDayBefore: {
        type: Number,
        get: v => v ? parseFloat(v.toFixed(2)) : null
    },
    closePriceOnDay: {
        type: Number,
        get: v => v ? parseFloat(v.toFixed(2)) : null
    },
    // Optional earnings data
    fiscalQuarter: String,
    fiscalYear: String,
    estimatedEPS: Number,
    actualEPS: Number,
    epsSurprise: Number,
    epsSurprisePercent: Number,
    // Metadata
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { getters: true }
});

// Compound index for efficient queries
earningsSchema.index({ symbol: 1, date: -1 });

// Virtual for calculating price change percentage
earningsSchema.virtual('priceChange').get(function() {
    if (!this.closePriceDayBefore || !this.closePriceOnDay) return null;
    const change = ((this.closePriceOnDay - this.closePriceDayBefore) / this.closePriceDayBefore * 100);
    return parseFloat(change.toFixed(2));
});

// Connect to MongoDB function
const connectDB = async () => {
    try {
        // Removed deprecated options
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

// Mongoose connection error handlers
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// Create models
const Company = mongoose.model('Company', companySchema);
const Earnings = mongoose.model('Earnings', earningsSchema);

// Export everything
module.exports = {
    connectDB,
    Company,
    Earnings,
    connection: mongoose.connection
};