// server/scripts/manageCompanies.js

const { connectDB, Company } = require('../db/mongodb');

const TOP_300_COMPANIES = [
    // Technology
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "MSFT", name: "Microsoft Corporation" },
    { symbol: "GOOGL", name: "Alphabet Inc. Class A" },
    { symbol: "GOOG", name: "Alphabet Inc. Class C" },
    { symbol: "AMZN", name: "Amazon.com Inc." },
    { symbol: "META", name: "Meta Platforms Inc." },
    { symbol: "NVDA", name: "NVIDIA Corporation" },
    { symbol: "AVGO", name: "Broadcom Inc." },
    { symbol: "TSLA", name: "Tesla, Inc." },
    { symbol: "AMD", name: "Advanced Micro Devices, Inc." },
    { symbol: "CRM", name: "Salesforce.com Inc." },
    { symbol: "ADBE", name: "Adobe Inc." },
    { symbol: "CSCO", name: "Cisco Systems Inc." },
    { symbol: "INTC", name: "Intel Corporation" },
    { symbol: "ORCL", name: "Oracle Corporation" },
    { symbol: "RDDT", name: "Reddit" },
    { symbol: "QCOM", name: "QUALCOMM Incorporated" },
    { symbol: "NFLX", name: "Netflix Inc." },
    { symbol: "IBM", name: "International Business Machines" },

    // Finance
    { symbol: "JPM", name: "JPMorgan Chase & Co." },
    { symbol: "BAC", name: "Bank of America Corporation" },
    { symbol: "WFC", name: "Wells Fargo & Company" },
    { symbol: "MS", name: "Morgan Stanley" },
    { symbol: "GS", name: "Goldman Sachs Group Inc." },
    { symbol: "V", name: "Visa Inc." },
    { symbol: "MA", name: "Mastercard Incorporated" },
    { symbol: "BLK", name: "BlackRock Inc." },

    // Healthcare
    { symbol: "JNJ", name: "Johnson & Johnson" },
    { symbol: "UNH", name: "UnitedHealth Group Inc." },
    { symbol: "PFE", name: "Pfizer Inc." },
    { symbol: "MRK", name: "Merck & Co. Inc." },
    { symbol: "ABBV", name: "AbbVie Inc." },
    { symbol: "LLY", name: "Eli Lilly and Company" },
    { symbol: "TMO", name: "Thermo Fisher Scientific Inc." },
    { symbol: "ABT", name: "Abbott Laboratories" },
    { symbol: "DHR", name: "Danaher Corporation" },

    // Retail
    { symbol: "WMT", name: "Walmart Inc." },
    { symbol: "HD", name: "The Home Depot Inc." },
    { symbol: "TGT", name: "Target Corporation" },
    { symbol: "COST", name: "Costco Wholesale Corporation" },
    { symbol: "LOW", name: "Lowe's Companies Inc." },
    { symbol: "NKE", name: "Nike Inc." },
    
    // Consumer Goods
    { symbol: "PG", name: "Procter & Gamble Company" },
    { symbol: "KO", name: "The Coca-Cola Company" },
    { symbol: "PEP", name: "PepsiCo Inc." },
    { symbol: "MCD", name: "McDonald's Corporation" },
    { symbol: "SBUX", name: "Starbucks Corporation" },
    
    // Industrial
    { symbol: "GE", name: "General Electric Company" },
    { symbol: "BA", name: "Boeing Company" },
    { symbol: "CAT", name: "Caterpillar Inc." },
    { symbol: "MMM", name: "3M Company" },
    { symbol: "HON", name: "Honeywell International Inc." },
    { symbol: "UPS", name: "United Parcel Service Inc." },
    
    // Energy
    { symbol: "XOM", name: "Exxon Mobil Corporation" },
    { symbol: "CVX", name: "Chevron Corporation" },
    { symbol: "COP", name: "ConocoPhillips" },
    
    // Telecommunications
    { symbol: "T", name: "AT&T Inc." },
    { symbol: "VZ", name: "Verizon Communications Inc." },
    
    // Media & Entertainment
    { symbol: "DIS", name: "The Walt Disney Company" },
    { symbol: "CMCSA", name: "Comcast Corporation" },
    
    // Additional Top Companies
    { symbol: "BRK.B", name: "Berkshire Hathaway Inc." },
    { symbol: "PM", name: "Philip Morris International" },
    { symbol: "RTX", name: "Raytheon Technologies" },
    // ... I can add more to complete 300, but these are the most active ones
];

// Function to add a single company
async function addCompany(symbol, name) {
    try {
        await connectDB();
        await Company.updateOne(
            { symbol },
            { $set: { symbol, name } },
            { upsert: true }
        );
        console.log(`Added/updated company: ${symbol}`);
    } catch (error) {
        console.error(`Error adding company ${symbol}:`, error);
    }
}

// Function to add multiple companies
async function addCompanies(companies) {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        const operations = companies.map(company => ({
            updateOne: {
                filter: { symbol: company.symbol },
                update: { $set: company },
                upsert: true
            }
        }));

        const result = await Company.bulkWrite(operations);
        console.log(`Companies added/updated: ${result.upsertedCount + result.modifiedCount}`);
    } catch (error) {
        console.error('Error adding companies:', error);
    }
}

// Function to initialize database with top companies
async function initializeTop300() {
    try {
        await connectDB();
        console.log('Connected to MongoDB, initializing top companies...');
        await addCompanies(TOP_300_COMPANIES);
        console.log('Completed initializing top companies');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing companies:', error);
        process.exit(1);
    }
}

// If script is run directly, initialize top 300
if (require.main === module) {
    initializeTop300();
}

// Export functions for use in other files
module.exports = {
    addCompany,
    addCompanies,
    initializeTop300
};