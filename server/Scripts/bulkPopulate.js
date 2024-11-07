// server/scripts/bulkPopulate.js

const { connectDB, Company, Earnings, PriceHistory } = require('../db/mongodb');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Progress tracking schema
const progressSchema = new mongoose.Schema({
    lastProcessedSymbol: String,
    totalCompanies: Number,
    processedCompanies: Number,
    successfulCompanies: Number,
    failedCompanies: [{
        symbol: String,
        error: String,
        lastAttempt: Date
    }],
    startTime: Date,
    lastUpdateTime: Date,
    status: {
        type: String,
        enum: ['running', 'paused', 'completed', 'failed'],
        default: 'running'
    }
});

const Progress = mongoose.model('Progress', progressSchema);

// Configuration
const DELAY_BETWEEN_CALLS = 2000; // 2 seconds between API calls
const MAX_RETRIES = 3;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Helper functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function updateProgress(updates) {
    const progress = await Progress.findOne() || new Progress({
        processedCompanies: 0,
        successfulCompanies: 0,
        failedCompanies: [],
        startTime: new Date()
    });

    Object.assign(progress, {
        ...updates,
        lastUpdateTime: new Date()
    });

    await progress.save();
    return progress;
}

async function fetchWithRetry(url, symbol, operation, retries = 0) {
    try {
        const response = await axios.get(url);
        
        if (response.data.Note) {
            console.log('API Rate limit hit, waiting 60 seconds...');
            await wait(60000); // Wait 60 seconds
            throw new Error('Rate limit hit, retrying...');
        }

        return response.data;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            console.log(`Retry ${retries + 1}/${MAX_RETRIES} for ${symbol} ${operation}...`);
            await wait(DELAY_BETWEEN_CALLS * (retries + 1));
            return fetchWithRetry(url, symbol, operation, retries + 1);
        }
        throw error;
    }
}

async function fetchEarningsData(symbol) {
    const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`;
    console.log(`Fetching earnings data for ${symbol}...`);
    
    const data = await fetchWithRetry(url, symbol, 'earnings');
    return data.quarterlyEarnings || [];
}

async function fetchPriceData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;
    console.log(`Fetching price data for ${symbol}...`);
    
    const data = await fetchWithRetry(url, symbol, 'prices');
    return data['Time Series (Daily)'] || {};
}

async function processCompany(symbol) {
    console.log(`\nProcessing ${symbol}...`);
    
    try {
        // Get earnings dates
        const earningsData = await fetchEarningsData(symbol);
        await wait(DELAY_BETWEEN_CALLS);

        if (earningsData.length === 0) {
            throw new Error('No earnings data available');
        }

        // Get price data
        const priceData = await fetchPriceData(symbol);
        await wait(DELAY_BETWEEN_CALLS);

        // Store earnings dates
        const earningsOps = earningsData.map(earning => ({
            updateOne: {
                filter: { 
                    symbol, 
                    date: new Date(earning.reportedDate)
                },
                update: {
                    $set: {
                        symbol,
                        date: new Date(earning.reportedDate),
                        reportTime: earning.reportedTime || 'TNS'
                    }
                },
                upsert: true
            }
        }));

        await Earnings.bulkWrite(earningsOps);
        
        // Store price data for each earnings date
        const priceOps = [];
        let validPriceRecords = 0;
        
        for (const earning of earningsData) {
            const earningDate = new Date(earning.reportedDate);
            const nextDay = new Date(earningDate);
            nextDay.setDate(nextDay.getDate() + 1);

            const dateStr = earningDate.toISOString().split('T')[0];
            const nextDateStr = nextDay.toISOString().split('T')[0];

            if (priceData[dateStr] && priceData[nextDateStr]) {
                validPriceRecords++;
                priceOps.push({
                    updateOne: {
                        filter: {
                            symbol,
                            earningsDate: earningDate
                        },
                        update: {
                            $set: {
                                symbol,
                                date: earningDate,
                                earningsDate: earningDate,
                                preEarningsOpen: parseFloat(priceData[dateStr]['1. open']),
                                preEarningsClose: parseFloat(priceData[dateStr]['4. close']),
                                postEarningsOpen: parseFloat(priceData[nextDateStr]['1. open'])
                            }
                        },
                        upsert: true
                    }
                });
            }
        }

        if (priceOps.length > 0) {
            await PriceHistory.bulkWrite(priceOps);
        }

        console.log(`Successfully processed ${symbol}:`);
        console.log(`- ${earningsData.length} earnings dates found`);
        console.log(`- ${validPriceRecords} complete price records stored`);
        return true;
        
    } catch (error) {
        console.error(`Failed to process ${symbol}:`, error.message);
        throw error;
    }
}

async function bulkPopulate(options = { resume: true }) {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // Get or create progress tracker
        let progress = await Progress.findOne();
        let companies;

        if (progress && options.resume) {
            console.log('Resuming previous population...');
            companies = await Company.find({
                symbol: { $gt: progress.lastProcessedSymbol }
            }).sort({ symbol: 1 }).lean();
        } else {
            console.log('Starting new population...');
            companies = await Company.find({}).sort({ symbol: 1 }).lean();
            progress = await updateProgress({
                totalCompanies: companies.length,
                processedCompanies: 0,
                successfulCompanies: 0,
                failedCompanies: [],
                startTime: new Date(),
                status: 'running'
            });
        }

        console.log(`Processing ${companies.length} companies...`);

        for (const company of companies) {
            try {
                const success = await processCompany(company.symbol);
                
                await updateProgress({
                    lastProcessedSymbol: company.symbol,
                    processedCompanies: progress.processedCompanies + 1,
                    successfulCompanies: success ? progress.successfulCompanies + 1 : progress.successfulCompanies
                });

                // Update progress in memory
                progress.processedCompanies++;
                if (success) progress.successfulCompanies++;

                // Log progress
                const percentage = ((progress.processedCompanies / progress.totalCompanies) * 100).toFixed(2);
                console.log(`\nProgress: ${percentage}%`);
                console.log(`Processed: ${progress.processedCompanies}/${progress.totalCompanies}`);
                console.log(`Successful: ${progress.successfulCompanies}`);
                console.log(`Failed: ${progress.failedCompanies.length}`);
                
            } catch (error) {
                const failedCompany = {
                    symbol: company.symbol,
                    error: error.message,
                    lastAttempt: new Date()
                };

                await Progress.findOneAndUpdate({}, {
                    $push: { failedCompanies: failedCompany }
                });

                console.log(`Added ${company.symbol} to failed companies list`);
            }

            // Small delay between companies
            await wait(DELAY_BETWEEN_CALLS);
        }

        // Update final status
        await updateProgress({
            status: 'completed',
            lastUpdateTime: new Date()
        });

        console.log('\nPopulation completed!');
        await printFinalSummary();

    } catch (error) {
        console.error('Bulk population failed:', error);
        await updateProgress({ status: 'failed' });
    }
}

async function printFinalSummary() {
    const progress = await Progress.findOne();
    if (!progress) return;

    const duration = (new Date() - progress.startTime) / 1000 / 60; // in minutes

    console.log('\n=== Final Summary ===');
    console.log(`Total Companies Processed: ${progress.processedCompanies}`);
    console.log(`Successfully Processed: ${progress.successfulCompanies}`);
    console.log(`Failed: ${progress.failedCompanies.length}`);
    console.log(`Total Duration: ${duration.toFixed(2)} minutes`);
    
    if (progress.failedCompanies.length > 0) {
        console.log('\nFailed Companies:');
        progress.failedCompanies.forEach(fail => {
            console.log(`- ${fail.symbol}: ${fail.error}`);
        });
    }
}

// Command line options
const args = process.argv.slice(2);
const options = {
    resume: !args.includes('--restart'),
    symbol: args.find(arg => arg.startsWith('--symbol='))?.split('=')[1]
};

// Start the population if run directly
if (require.main === module) {
    if (options.symbol) {
        // Process single symbol
        processCompany(options.symbol)
            .then(() => process.exit(0))
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    } else {
        // Bulk process all companies
        bulkPopulate(options)
            .then(() => process.exit(0))
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    }
}

module.exports = { bulkPopulate, processCompany };