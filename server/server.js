const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const stockService = require('./db/stockService');
const { connectDB, Company, Earnings } = require('./db/mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Rate limiting setup
let lastApiCall = 0;
const API_DELAY = 16000;

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
app.use(compression({
    level: 6,
    threshold: 100 * 1000
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : '*'
}));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../dist'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '1h',
    index: false,
    setHeaders: (res, path) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

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

            if (earningsData.length < 2) continue;

            let tradeReturn = 0;
            let holdValue = amount;
            let validTrades = 0;

            // Calculate trading returns
            earningsData.forEach(earning => {
                if (earning.closePriceDayBefore && earning.closePriceOnDay) {
                    const returnPercent = ((earning.closePriceOnDay - earning.closePriceDayBefore) / earning.closePriceDayBefore) * 100;
                    tradeReturn += (amount * (returnPercent / 100));
                    validTrades++;
                }
            });

            // Calculate buy & hold returns
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

// Stock data endpoint
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

        const formattedData = data
            .filter(item => 
                typeof item.closePriceDayBefore === 'number' &&
                typeof item.closePriceOnDay === 'number'
            )
            .map(item => {
                const earningsDate = new Date(item.date);
                earningsDate.setDate(earningsDate.getDate() + 1);
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
app.get('*', (req, res, next) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, '../dist/index.html'), err => {
            if (err) {
                console.error('Error sending index.html:', err);
                next(err);
            }
        });
    } else {
        next();
    }
});

// Enhanced error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(500).json({ 
        error: errorMessage,
        status: 'error'
    });
};

app.use(errorHandler);

// Server initialization
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`Server running on port ${PORT}`);
            console.log('MongoDB connected and ready');
            console.log(`Static files being served from: ${path.join(__dirname, '../dist')}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        console.error('Startup Error Details:', {
            mongoUrl: process.env.MONGODB_URI ? 'Set' : 'Not Set',
            nodeEnv: process.env.NODE_ENV,
            port: PORT
        });
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