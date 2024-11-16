// server/scripts/deleteSingleStock.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Earnings } = require('../db/mongodb');

async function deleteStockData(symbol) {
    try {
        if (!symbol) {
            console.error('Please provide a stock symbol');
            process.exit(1);
        }

        symbol = symbol.toUpperCase();
        console.log(`Deleting data for ${symbol}...`);

        await connectDB();
        console.log('Connected to MongoDB');

        // Create backup of existing data
        const existingData = await Earnings.find({ symbol }).lean();
        if (existingData.length > 0) {
            const fs = require('fs');
            const backupDir = path.join(__dirname, '../../backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const backupPath = path.join(backupDir, `${symbol}_backup_${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(existingData, null, 2));
            console.log(`Backup created at: ${backupPath}`);
        }

        // Delete the data
        const result = await Earnings.deleteMany({ symbol });
        console.log(`Deleted ${result.deletedCount} earnings records for ${symbol}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Get symbol from command line argument
const symbol = process.argv[2];
if (!symbol) {
    console.error('Please provide a stock symbol as an argument');
    console.log('Usage: node deleteSingleStock.js AAPL');
    process.exit(1);
}

deleteStockData(symbol);