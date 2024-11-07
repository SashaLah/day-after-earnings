// server/scripts/manageStocks.js

const { connectDB, Company, Earnings, PriceHistory } = require('../db/mongodb');
const stockService = require('../db/stockService');
const axios = require('axios');
require('dotenv').config();

// Enhanced stats tracking
let stats = {
    processedCompanies: 0,
    successfulCompanies: 0,
    failedCompanies: [],
    startTime: null,
    endTime: null,
    apiCalls: 0,
    errors: []
};

// System diagnostics
async function runDiagnostics() {
    console.log('\n=== Running System Diagnostics ===');
    
    try {
        // MongoDB Connection
        console.log('\nChecking MongoDB connection...');
        const dbStatus = await checkDatabaseConnection();
        console.log('MongoDB Status:', dbStatus ? '✅ Connected' : '❌ Failed');

        // Collection Stats
        console.log('\nChecking Collections...');
        const collectionStats = await getCollectionStats();
        console.log('Companies:', collectionStats.companies);
        console.log('Earnings Records:', collectionStats.earnings);
        console.log('Price Records:', collectionStats.prices);

        // API Connection
        console.log('\nChecking Alpha Vantage API...');
        const apiStatus = await checkApiConnection();
        console.log('API Status:', apiStatus ? '✅ Connected' : '❌ Failed');

        // Data Consistency
        console.log('\nChecking Data Consistency...');
        const consistencyResults = await checkDataConsistency();
        console.log('Consistency Check:', consistencyResults.isConsistent ? '✅ Passed' : '❌ Issues Found');
        if (!consistencyResults.isConsistent) {
            console.log('Issues:', consistencyResults.issues);
        }

        return true;
    } catch (error) {
        console.error('Diagnostics failed:', error);
        return false;
    }
}

async function checkDatabaseConnection() {
    try {
        await connectDB();
        return mongoose.connection.readyState === 1;
    } catch (error) {
        console.error('Database connection error:', error);
        return false;
    }
}

async function getCollectionStats() {
    const companies = await Company.countDocuments();
    const earnings = await Earnings.countDocuments();
    const prices = await PriceHistory.countDocuments();

    const sampleCompany = await Company.findOne();
    let companyBreakdown = [];
    
    if (sampleCompany) {
        const companiesWithData = await Company.aggregate([
            {
                $lookup: {
                    from: 'earnings',
                    localField: 'symbol',
                    foreignField: 'symbol',
                    as: 'earnings'
                }
            },
            {
                $project: {
                    symbol: 1,
                    hasEarnings: { $size: '$earnings' }
                }
            }
        ]);

        companyBreakdown = companiesWithData.map(c => ({
            symbol: c.symbol,
            earningsCount: c.hasEarnings
        }));
    }

    return {
        companies,
        earnings,
        prices,
        companyBreakdown
    };
}

async function checkApiConnection() {
    try {
        const testSymbol = 'AAPL';
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=EARNINGS&symbol=${testSymbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
        );
        return !response.data.Note && !response.data.Information;
    } catch (error) {
        console.error('API connection error:', error);
        return false;
    }
}

async function checkDataConsistency() {
    const issues = [];
    let isConsistent = true;

    // Check each company has both earnings and price data
    const companies = await Company.find().lean();
    
    for (const company of companies) {
        const earnings = await Earnings.find({ symbol: company.symbol }).lean();
        const prices = await PriceHistory.find({ symbol: company.symbol }).lean();

        if (earnings.length === 0) {
            issues.push(`${company.symbol}: No earnings data`);
            isConsistent = false;
        }

        if (prices.length === 0) {
            issues.push(`${company.symbol}: No price data`);
            isConsistent = false;
        }

        // Check if each earnings date has corresponding price data
        for (const earning of earnings) {
            const hasPrice = prices.some(p => 
                p.earningsDate.toISOString() === earning.date.toISOString()
            );
            
            if (!hasPrice) {
                issues.push(`${company.symbol}: Missing price data for earnings date ${earning.date}`);
                isConsistent = false;
            }
        }
    }

    return { isConsistent, issues };
}

// Enhanced company management functions
async function addCompany(symbol, name, options = { verify: true }) {
    try {
        await connectDB();
        console.log(`Adding company ${symbol}${name ? ` (${name})` : ''}...`);
        
        // Add to companies collection
        await Company.updateOne(
            { symbol },
            { 
                $set: { 
                    symbol, 
                    name: name || symbol,
                    lastUpdated: new Date()
                } 
            },
            { upsert: true }
        );

        // Populate historical data
        console.log('Fetching historical data...');
        const result = await stockService.populateHistoricalData(symbol);
        
        if (options.verify) {
            console.log('\nVerifying data...');
            const earnings = await Earnings.find({ symbol }).countDocuments();
            const prices = await PriceHistory.find({ symbol }).countDocuments();
            
            console.log(`Verification Results:`);
            console.log(`- Earnings records: ${earnings}`);
            console.log(`- Price records: ${prices}`);
        }

        console.log('Company added successfully!');
        return true;
    } catch (error) {
        console.error(`Failed to add company ${symbol}:`, error.message);
        return false;
    }
}

// Command line interface with enhanced options
const args = process.argv.slice(2);
const command = args[0];
const options = {
    symbol: args.find(arg => arg.startsWith('--symbol='))?.split('=')[1],
    name: args.find(arg => arg.startsWith('--name='))?.split('=')[1],
    verify: !args.includes('--no-verify'),
    force: args.includes('--force')
};

async function handleCommand() {
    try {
        switch (command) {
            case 'diagnostics':
            case 'check':
                await runDiagnostics();
                break;

            case 'stats':
                const stats = await getCollectionStats();
                console.log('\n=== Database Statistics ===');
                console.log(JSON.stringify(stats, null, 2));
                break;

            case 'verify':
                if (!options.symbol) {
                    throw new Error('Symbol required. Use --symbol=SYMBOL');
                }
                const consistency = await checkDataConsistency();
                console.log('\n=== Verification Results ===');
                console.log(JSON.stringify(consistency, null, 2));
                break;

            // ... (previous command handlers remain the same)

            default:
                console.log(`
Usage:
  System Check:   node manageStocks.js diagnostics
  Show Stats:     node manageStocks.js stats
  Verify Data:    node manageStocks.js verify --symbol=SYMBOL
  Add Company:    node manageStocks.js add --symbol=SYMBOL [--name="Company Name"] [--no-verify]
  Update Company: node manageStocks.js update --symbol=SYMBOL [--force]
  Check New:      node manageStocks.js check-new --symbol=SYMBOL
  Bulk Update:    node manageStocks.js bulk-update
                `);
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

// Run if called directly
if (require.main === module) {
    handleCommand();
}

module.exports = {
    addCompany,
    updateCompany,
    checkNewEarnings,
    bulkUpdate,
    runDiagnostics,
    getCollectionStats,
    checkDataConsistency
};