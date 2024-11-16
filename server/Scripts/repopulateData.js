// server/scripts/repopulateData.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company } = require('../db/mongodb');
const stockService = require('../db/stockService');

async function repopulateData() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // Get all companies
        const companies = await Company.find().select('symbol name').lean();
        console.log(`Found ${companies.length} companies to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const [index, company] of companies.entries()) {
            try {
                console.log(`\nProcessing ${company.symbol} (${index + 1}/${companies.length})...`);
                
                // Use the updated stockService to fetch and store data
                await stockService.getStockData(company.symbol);
                
                successCount++;
                console.log(`Successfully processed ${company.symbol}`);
                
                // Wait between companies to respect API rate limits
                await new Promise(resolve => setTimeout(resolve, 16000));
            } catch (error) {
                console.error(`Error processing ${company.symbol}:`, error.message);
                errorCount++;
                continue;
            }
        }

        console.log('\nRepopulation Summary:');
        console.log(`Total companies processed: ${companies.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        
        console.log('\nRepopulation completed!');
        process.exit(0);
    } catch (error) {
        console.error('Repopulation failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    repopulateData();
}

module.exports = repopulateData;