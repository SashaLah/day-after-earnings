const { connectDB, Company } = require('../db/mongodb');
const { STOCK_EARNINGS_TIMING } = require('../constants/earningsTiming');

async function syncCompanies() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // Get all symbols from STOCK_EARNINGS_TIMING (excluding DEFAULT)
        const symbols = Object.keys(STOCK_EARNINGS_TIMING).filter(sym => sym !== 'DEFAULT');
        
        console.log(`Found ${symbols.length} companies to sync`);

        for (const symbol of symbols) {
            await Company.findOneAndUpdate(
                { symbol },
                { 
                    symbol,
                    earningsTiming: STOCK_EARNINGS_TIMING[symbol],
                    // Add a basic name for now - you can update it later
                    name: symbol
                },
                { upsert: true }
            );
            console.log(`Synced ${symbol}`);
        }

        console.log('Sync completed');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing companies:', error);
        process.exit(1);
    }
}

syncCompanies(); 