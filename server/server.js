const express = require('express');
const path = require('path');
const axios = require('axios');
const stockService = require('./db/stockService');
const { connectDB, Company, Earnings } = require('./db/mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Rate limiting setup
let lastApiCall = 0;
const API_DELAY = 16000; // 16 seconds between calls

const waitForApiDelay = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    const waitTime = Math.max(0, API_DELAY - timeSinceLastCall);
    if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastApiCall = Date.now();
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Calculator endpoint
app.get('/api/calculator', async (req, res) => {
    try {
        console.log('\n=== Calculator Request Start ===');
        const amount = parseFloat(req.query.amount);
        const earningsCount = parseInt(req.query.earnings);

        console.log('Investment Amount:', amount);
        console.log('Earnings Count:', earningsCount);

        // Validate parameters
        if (isNaN(amount) || amount <= 0 || amount > 10000000) {
            return res.status(400).json({ error: 'Invalid investment amount' });
        }
        if (isNaN(earningsCount) || earningsCount < 1 || earningsCount > 100) {
            return res.status(400).json({ error: 'Invalid earnings count' });
        }

        // Get all companies
        const companies = await Company.find().lean();
        console.log(`Processing ${companies.length} companies`);

        const results = [];
        
        for (const company of companies) {
            // Get earnings data for each company
            const earningsData = await Earnings.find({ symbol: company.symbol })
                .sort({ date: -1 })
                .limit(earningsCount)
                .lean();

            if (earningsData.length < 2) continue; // Skip if not enough earnings data

            let tradeReturn = 0;
            let holdValue = amount;
            let validTrades = 0;

            // Calculate trading returns (invest fixed amount each time)
            earningsData.forEach(earning => {
                if (earning.closePriceDayBefore && earning.closePriceOnDay) {
                    const returnPercent = ((earning.closePriceOnDay - earning.closePriceDayBefore) / earning.closePriceDayBefore) * 100;
                    tradeReturn += (amount * (returnPercent / 100));
                    validTrades++;
                }
            });

            // Calculate buy & hold returns (reinvest same amount each time)
            earningsData.reverse(); // Process oldest to newest
            for (const earning of earningsData) {
                if (earning.closePriceDayBefore && earning.closePriceOnDay) {
                    const returnPercent = ((earning.closePriceOnDay - earning.closePriceDayBefore) / earning.closePriceDayBefore) * 100;
                    holdValue = holdValue * (1 + (returnPercent / 100));
                    holdValue += amount; // Add new investment
                }
            }

            if (validTrades > 0) {
                results.push({
                    symbol: company.symbol,
                    name: company.name,
                    tradeReturn: tradeReturn,
                    tradeReturnPercent: (tradeReturn / (amount * validTrades)) * 100,
                    holdValue: holdValue,
                    holdReturn: ((holdValue - (amount * validTrades)) / (amount * validTrades)) * 100,
                    avgReturn: tradeReturn / (amount * validTrades) * 100,
                    tradesCount: validTrades
                });
            }
        }

        // Sort by trade return and take top 100
        const topResults = results
            .sort((a, b) => b.tradeReturn - a.tradeReturn)
            .slice(0, 100);

        console.log(`Returning top ${topResults.length} results`);
        console.log('Sample result:', topResults[0]);

        res.json(topResults);
    } catch (error) {
        console.error('Calculator error:', error);
        res.status(500).json({ error: 'Failed to calculate returns' });
    }
});

// Company search endpoint
app.get('/api/search/companies', async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase();
        if (!query) {
            return res.json([]);
        }

        // Search MongoDB for companies
        const matches = await Company.find({
            $or: [
                { symbol: { $regex: query, $options: 'i' }},
                { name: { $regex: query, $options: 'i' }}
            ]
        })
        .limit(10)
        .lean();

        res.json(matches);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Main stock data endpoint with debug logging
app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol || !/^[A-Za-z]{1,5}$/.test(symbol)) {
            return res.status(400).json({ error: 'Invalid symbol format' });
        }

        console.log('\n=== Debug Info Start ===');
        console.log('Symbol requested:', symbol);

        const data = await stockService.getStockData(symbol.toUpperCase());
        console.log('Data returned from stockService:', data?.length || 0, 'records');
        
        if (!data || data.length === 0) {
            console.log('No data returned from stockService');
            return res.status(404).json({ error: 'No data found for this symbol' });
        }

        // Format the data for frontend display
        const formattedData = data
            .filter(item => 
                typeof item.closePriceDayBefore === 'number' &&
                typeof item.closePriceOnDay === 'number'
            )
            .map(item => {
                // Ensure date is properly formatted
                const earningsDate = new Date(item.date);
                earningsDate.setDate(earningsDate.getDate() + 1); // Add one day to the display date
                return {
                    date: earningsDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }),
                    reportTime: item.reportTime,
                    closePriceDayBefore: Number(item.closePriceDayBefore).toFixed(2),
                    closePriceOnDay: Number(item.closePriceOnDay).toFixed(2),
                    priceChange: ((item.closePriceOnDay - item.closePriceDayBefore) / item.closePriceDayBefore * 100).toFixed(2)
                };
            });

        console.log('Formatted data length:', formattedData.length);
        if (formattedData.length > 0) {
            console.log('Sample formatted record:', formattedData[0]);
        }

        res.json(formattedData);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// Status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const [companyCount, earningsCount] = await Promise.all([
            Company.countDocuments(),
            Earnings.countDocuments()
        ]);

        res.json({
            status: 'operational',
            timestamp: new Date().toISOString(),
            lastApiCall: lastApiCall ? new Date(lastApiCall).toISOString() : null,
            stats: {
                companies: companyCount,
                earnings: earningsCount
            }
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// Catch-all route for React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Initialize server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log('MongoDB connected and ready');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

// Handle process errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

module.exports = app;