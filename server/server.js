const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.json());

async function getEarningsData(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`;
    console.log('Fetching earnings data...');
    
    const response = await axios.get(url);
    
    if (!response.data || !response.data.quarterlyEarnings || !response.data.quarterlyEarnings.length) {
      throw new Error('No earnings data available for this symbol');
    }

    // Get last 2 earnings dates
    const earnings = response.data.quarterlyEarnings
      .slice(0, 2)
      .map(earning => ({
        date: earning.reportedDate
      }));

    return earnings;
  } catch (error) {
    console.error('Error fetching earnings data:', error.message);
    throw new Error(error.response?.data?.error || error.message);
  }
}

async function getPriceData(symbol, fromDate, toDate) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;
    console.log('Fetching price data...');
    
    const response = await axios.get(url);
    
    if (!response.data || !response.data['Time Series (Daily)']) {
      throw new Error('No price data available for this symbol');
    }

    const dailyData = response.data['Time Series (Daily)'];
    const priceData = [];
    
    for (let date in dailyData) {
      if (date >= fromDate && date <= toDate) {
        priceData.push({
          date: date,
          open: parseFloat(dailyData[date]['1. open']),
          close: parseFloat(dailyData[date]['4. close'])
        });
      }
    }

    return priceData.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error('Error fetching price data:', error.message);
    throw new Error(error.response?.data?.error || error.message);
  }
}

app.get('/api/stock/:symbol', async (req, res) => {
  try {
    if (!API_KEY) {
      throw new Error('API key is not configured');
    }

    const { symbol } = req.params;
    console.log('Processing request for symbol:', symbol);
    
    const data = await getEarningsData(symbol.toUpperCase());
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No earnings data found for this symbol' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch stock data',
      details: error.message
    });
  }
});

app.get('/api/prices/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both from and to dates are required' });
    }

    const data = await getPriceData(symbol.toUpperCase(), from, to);
    res.json(data);
  } catch (error) {
    console.error('Error fetching price data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price data',
      details: error.message
    });
  }
});

// Handle all other routes by serving the main HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});