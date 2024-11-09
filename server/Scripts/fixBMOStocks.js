// server/scripts/fixBMOStocks.js

const { connectDB, Earnings, PriceHistory } = require('../db/mongodb');
const stockService = require('../db/stockService');

// Known BMO stocks
const BMO_STOCKS = [
    'MA',  // Mastercard
    'TGT', // Target
    // Add more BMO stocks here
];

async function fixBMOStocks() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        for (const symbol of BMO_STOCKS) {
            console.log(`\nProcessing ${symbol}...`);
            
            // Update earnings records to BMO
            const updateResult = await Earnings.updateMany(
                { symbol },
                { $set: { reportTime: 'BMO' } }
            );
            
            console.log(`Updated ${updateResult.modifiedCount} earnings records for ${symbol}`);

            // Delete existing price records
            const deleteResult = await PriceHistory.deleteMany({ symbol });
            console.log(`Deleted ${deleteResult.deletedCount} price records for ${symbol}`);

            // Repopulate data with correct BMO timing
            await stockService.populateHistoricalData(symbol);
            
            console.log(`Completed processing ${symbol}`);
        }

        console.log('\nAll BMO stocks have been updated');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing BMO stocks:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    fixBMOStocks();
}

module.exports = fixBMOStocks;