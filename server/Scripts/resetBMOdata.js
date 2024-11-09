// server/scripts/resetBMOData.js
const { connectDB, Earnings, PriceHistory } = require('../db/mongodb');
const stockService = require('../db/stockService');

async function resetBMOData() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        const symbols = ['MA', 'TGT']; // Add more BMO stocks as needed

        for (const symbol of symbols) {
            console.log(`\nResetting data for ${symbol}...`);
            
            // Delete existing data
            await Promise.all([
                Earnings.deleteMany({ symbol }),
                PriceHistory.deleteMany({ symbol })
            ]);

            console.log(`Deleted existing data for ${symbol}`);

            // Repopulate with correct BMO timing
            await stockService.populateHistoricalData(symbol);
            
            console.log(`Completed repopulating ${symbol}`);
        }

        console.log('\nAll BMO stocks have been reset and repopulated');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting BMO data:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    resetBMOData();
}

module.exports = resetBMOData;