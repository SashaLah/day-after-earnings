const fs = require('fs').promises;
const path = require('path');
const { connectDB } = require('./mongodb');
const stockService = require('./stockService');

async function migrateFileToMongo() {
    try {
        // Connect to MongoDB
        await connectDB();
        console.log('Connected to MongoDB');

        // Read existing cache files
        const STORAGE_DIR = path.join(__dirname, '..', 'storage');
        
        // Read prices data
        console.log('\nReading price data from file cache...');
        const pricesData = JSON.parse(
            await fs.readFile(path.join(STORAGE_DIR, 'prices_data.json'), 'utf8')
        );

        // Migrate each symbol's price data
        const symbols = Object.keys(pricesData);
        console.log(`Found ${symbols.length} symbols with price data`);

        for (const symbol of symbols) {
            console.log(`\nMigrating prices for ${symbol}...`);
            const prices = pricesData[symbol];
            console.log(`Found ${prices.length} price records`);

            // Transform price data to ensure correct format
            const formattedPrices = prices.map(price => ({
                symbol: symbol,
                date: price.date,
                open: parseFloat(price.open),
                close: parseFloat(price.close)
            }));

            try {
                // Process in smaller batches to avoid memory issues
                const batchSize = 1000;
                for (let i = 0; i < formattedPrices.length; i += batchSize) {
                    const batch = formattedPrices.slice(i, i + batchSize);
                    await stockService.upsertPrices(symbol, batch);
                    console.log(`Migrated batch ${i/batchSize + 1} for ${symbol}`);
                }
                console.log(`✅ Completed migration for ${symbol}`);
            } catch (error) {
                console.error(`❌ Error migrating prices for ${symbol}:`, error);
            }
        }

        // Verify the migration
        console.log('\nVerifying migration...');
        const priceCount = await stockService.verifyData(symbols[0]);
        console.log('Migration verification:', priceCount);

        // Final verification
        const verifyMongoDBData = require('./verifyData');
        await verifyMongoDBData();

        console.log('\nMigration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateFileToMongo();
}

module.exports = migrateFileToMongo;