const { connectDB, PriceHistory, Earnings } = require('./mongodb');

async function cleanupMongo() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // Remove any price records with invalid dates or numbers
        const invalidPrices = await PriceHistory.deleteMany({
            $or: [
                { date: { $exists: false } },
                { date: null },
                { open: { $exists: false } },
                { close: { $exists: false } },
                { open: null },
                { close: null }
            ]
        });

        console.log(`Removed ${invalidPrices.deletedCount} invalid price records`);

        // Remove any earnings records with invalid dates
        const invalidEarnings = await Earnings.deleteMany({
            $or: [
                { date: { $exists: false } },
                { date: null }
            ]
        });

        console.log(`Removed ${invalidEarnings.deletedCount} invalid earnings records`);

        // Verify the cleanup
        const priceCount = await PriceHistory.countDocuments();
        const earningsCount = await Earnings.countDocuments();

        console.log(`
            Cleanup complete!
            Remaining price records: ${priceCount}
            Remaining earnings records: ${earningsCount}
        `);

        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    cleanupMongo();
}

module.exports = cleanupMongo;