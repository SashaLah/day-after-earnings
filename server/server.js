// server/server.js

const express = require('express');
const path = require('path');
const axios = require('axios');
const stockService = require('./db/stockService');
const { connectDB, Company, Earnings, PriceHistory } = require('./db/mongodb');
const eventRoutes = require('./routes/eventRoutes');  // Add this line
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Rate limiting setup
let lastApiCall = 0;
const API_DELAY = 12000; // 12 seconds between calls

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

// Mount event routes
app.use('/api/events', eventRoutes);  // Add this line

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Updated Company search endpoint using MongoDB
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

    // Direct MongoDB checks
    const earnings = await Earnings.find({ symbol: symbol.toUpperCase() }).lean();
    const prices = await PriceHistory.find({ symbol: symbol.toUpperCase() }).lean();
    
    console.log('DEBUG - Earnings count:', earnings.length);
    console.log('DEBUG - First earnings record:', JSON.stringify(earnings[0], null, 2));
    console.log('DEBUG - Prices count:', prices.length);
    console.log('DEBUG - First price record:', JSON.stringify(prices[0], null, 2));
    console.log('=== Debug Info End ===\n');

    const data = await stockService.getStockData(symbol.toUpperCase());
    console.log('Data returned from stockService:', data?.length || 0, 'records');
    
    if (!data || data.length === 0) {
      console.log('No data returned from stockService');
      return res.status(404).json({ error: 'No data found for this symbol' });
    }

    // Make sure all required fields exist and are numbers
    const formattedData = data
      .filter(item => 
        typeof item.preEarningsOpen === 'number' &&
        typeof item.preEarningsClose === 'number' &&
        typeof item.postEarningsOpen === 'number'
      )
      .map(item => ({
        date: item.date,
        preEarningsOpen: Number(item.preEarningsOpen).toFixed(2),
        preEarningsClose: Number(item.preEarningsClose).toFixed(2),
        postEarningsOpen: Number(item.postEarningsOpen).toFixed(2),
        preEarningsChange: ((item.preEarningsClose - item.preEarningsOpen) / item.preEarningsOpen * 100).toFixed(2),
        earningsEffect: ((item.postEarningsOpen - item.preEarningsClose) / item.preEarningsClose * 100).toFixed(2)
      }));

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

// Price data endpoint
app.get('/api/prices/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { date } = req.query;

    if (!symbol || !/^[A-Za-z]{1,5}$/.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    console.log(`Processing price request for ${symbol} on ${date}`);
    
    const prices = await stockService.getPriceData(symbol.toUpperCase(), new Date(date));
    if (!prices) {
      return res.status(404).json({ error: 'No price data available for this date' });
    }

    res.json(prices);
  } catch (error) {
    console.error('Error fetching price data:', error);
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const [companyCount, earningsCount, priceCount] = await Promise.all([
      Company.countDocuments(),
      Earnings.countDocuments(),
      PriceHistory.countDocuments()
    ]);

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      lastApiCall: lastApiCall ? new Date(lastApiCall).toISOString() : null,
      stats: {
        companies: companyCount,
        earnings: earningsCount,
        prices: priceCount
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