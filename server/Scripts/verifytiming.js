// server/scripts/verifyTiming.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Earnings } = require('../db/mongodb');
const { STOCK_EARNINGS_TIMING } = require('../constants/earningsTiming');
const stockService = require('../db/stockService');

async function verifyAndFixTiming(symbol) {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // 1. Delete existing data
        console.log(`\nDeleting existing data for ${symbol}...`);
        const deleteResult = await Earnings.deleteMany({ symbol });
        console.log(`Deleted ${deleteResult.deletedCount} records`);

        // 2. Verify timing from our constants
        const expectedTiming = STOCK_EARNINGS_TIMING[symbol];
        console.log(`Expected timing for ${symbol}: ${expectedTiming}`);

        // 3. Fetch and store new data
        console.log('\nFetching new data with correct timing...');
        const data = await stockService.getStockData(symbol);

        // 4. Verify stored data
        const verifyRecord = await Earnings.findOne({ symbol }).sort({ date: -1 });
        console.log('\nVerifying stored data:');
        console.log('Sample record timing:', verifyRecord?.reportTime);
        console.log('Price calculation using:', verifyRecord?.reportTime === 'BMO' ? 'Before Market Open' : 'After Market Close');
        
        if (verifyRecord?.reportTime !== expectedTiming) {
            console.error(`WARNING: Timing mismatch - Expected ${expectedTiming} but got ${verifyRecord?.reportTime}`);
        } else {
            console.log('Timing verified correctly');
        }

        console.log('\nComplete! Please check your frontend to verify the data is displaying correctly.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

const symbol = process.argv[2];
if (!symbol) {
    console.error('Please provide a symbol: node verifyTiming.js TGT');
    process.exit(1);
}

verifyAndFixTiming(symbol);