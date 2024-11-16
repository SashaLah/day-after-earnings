// server/scripts/populateSingleStock.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company, Earnings } = require('../db/mongodb');
const stockService = require('../db/stockService');

async function populateStockData(symbol) {
    try {
        if (!symbol) {
            console.error('Please provide a stock symbol');
            process.exit(1);
        }

        symbol = symbol.toUpperCase();
        console.log(`Populating data for ${symbol}...`);

        await connectDB();
        console.log('Connected to MongoDB');

        // Verify company exists
        const company = await Company.findOne({ symbol });
        if (!company) {
            console.log('Company not found in database, adding it...');
            const { COMPANIES } = require('../config');
            const companyInfo = COMPANIES.find(c => c.symbol === symbol);
            
            if (!companyInfo) {
                throw new Error(`${symbol} not found in configured companies list`);
            }

            await Company.create(companyInfo);
            console.log(`Added ${symbol} to companies collection`);
        }

        // Check existing data
        const existingCount = await Earnings.countDocuments({ symbol });
        console.log(`Found ${existingCount} existing earnings records for ${symbol}`);

        // Fetch and store new data
        console.log('Fetching new data from Alpha Vantage...');
        const data = await stockService.getStockData(symbol);
        
        console.log('\nPopulation Summary:');
        console.log(`Total records: ${data.length}`);
        
        // Show sample of the data
        if (data.length > 0) {
            console.log('\nMost recent earnings record:');
            console.log(JSON.stringify(data[0], null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Get symbol from command line argument
const symbol = process.argv[2];
if (!symbol) {
    console.error('Please provide a stock symbol as an argument');
    console.log('Usage: node populateSingleStock.js AAPL');
    process.exit(1);
}

populateStockData(symbol);