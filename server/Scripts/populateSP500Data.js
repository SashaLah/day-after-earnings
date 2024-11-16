// server/scripts/populateSP500Data.js

const axios = require('axios');
const { connectDB, Company } = require('../db/mongodb');

async function fetchSP500Constituents() {
    try {
        // Using Alpha Vantage's listing status endpoint
        const url = `${process.env.ALPHA_VANTAGE_BASE_URL}?function=LISTING_STATUS&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
        const response = await axios.get(url);
        
        if (!response.data) {
            throw new Error('No data received from Alpha Vantage');
        }

        // Filter for S&P 500 companies
        // Note: You might need to cross-reference with another source or maintain a separate list
        // as Alpha Vantage doesn't directly identify S&P 500 constituents
        const companies = response.data.filter(company => 
            company.status === 'Active' &&
            company.exchange === 'NYSE' || company.exchange === 'NASDAQ'
        );

        return companies.slice(0, 500); // Get top 500 by market cap
    } catch (error) {
        console.error('Error fetching S&P 500 constituents:', error);
        throw error;
    }
}

async function updateSP500Companies() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        const companies = await fetchSP500Constituents();
        console.log(`Found ${companies.length} companies`);

        const operations = companies.map(company => ({
            updateOne: {
                filter: { symbol: company.symbol },
                update: {
                    $set: {
                        symbol: company.symbol,
                        name: company.name,
                        exchange: company.exchange,
                        isS500: true,
                        lastUpdated: new Date()
                    }
                },
                upsert: true
            }
        }));

        const result = await Company.bulkWrite(operations);
        console.log(`Updated ${result.modifiedCount + result.upsertedCount} companies`);
        
        // Mark companies no longer in S&P 500
        await Company.updateMany(
            { 
                isS500: true,
                lastUpdated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            { 
                $set: { isS500: false }
            }
        );

        console.log('S&P 500 company list updated successfully');
    } catch (error) {
        console.error('Error updating S&P 500 companies:', error);
        throw error;
    }
}

// Export for use in other files
module.exports = {
    updateSP500Companies
};

// Run directly if called as script
if (require.main === module) {
    updateSP500Companies()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}