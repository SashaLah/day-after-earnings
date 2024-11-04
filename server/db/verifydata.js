const { connectDB, Earnings, PriceHistory } = require('./mongodb');

async function verifyMongoDBData() {
    try {
        await connectDB();
        
        // Check earnings data
        const earningsCount = await Earnings.countDocuments();
        console.log(`Total earnings records: ${earningsCount}`);
        
        // Check price data
        const pricesCount = await PriceHistory.countDocuments();
        console.log(`Total price records: ${pricesCount}`);
        
        // Sample some recent data
        const recentEarnings = await Earnings.find()
            .sort({ date: -1 })
            .limit(5)
            .lean();
        
        const recentPrices = await PriceHistory.find()
            .sort({ date: -1 })
            .limit(5)
            .lean();
            
        console.log('\nRecent Earnings:', recentEarnings);
        console.log('\nRecent Prices:', recentPrices);
        
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    verifyMongoDBData();
}

module.exports = verifyMongoDBData;