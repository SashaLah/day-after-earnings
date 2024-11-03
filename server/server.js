const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Storage configuration
const STORAGE_DIR = path.join(__dirname, 'storage');
const EARNINGS_FILE = path.join(STORAGE_DIR, 'earnings_data.json');
const PRICES_FILE = path.join(STORAGE_DIR, 'prices_data.json');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

// Save debouncing
let saveTimeout = null;
const SAVE_DELAY = 5000; // 5 seconds

// Frequently searched symbols
const POPULAR_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'TSLA'];

// In-memory cache
let earningsCache = {};
let pricesCache = {};
let metadataCache = {};

// Initialize storage system
async function initializeStorage() {
    try {
        // Create storage directory if it doesn't exist
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        
        try {
            const earningsData = await fs.readFile(EARNINGS_FILE, 'utf8');
            earningsCache = JSON.parse(earningsData);
        } catch (e) {
            earningsCache = {};
            await fs.writeFile(EARNINGS_FILE, JSON.stringify(earningsCache, null, 2));
        }

        try {
            const pricesData = await fs.readFile(PRICES_FILE, 'utf8');
            pricesCache = JSON.parse(pricesData);
        } catch (e) {
            pricesCache = {};
            await fs.writeFile(PRICES_FILE, JSON.stringify(pricesCache, null, 2));
        }

        try {
            const metadataData = await fs.readFile(METADATA_FILE, 'utf8');
            metadataCache = JSON.parse(metadataData);
        } catch (e) {
            metadataCache = {};
            await fs.writeFile(METADATA_FILE, JSON.stringify(metadataCache, null, 2));
        }

        console.log('Storage system initialized successfully');
    } catch (error) {
        console.error('Error initializing storage:', error);
        throw error;
    }
}

// Debounced save to storage
async function saveToStorage() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
        try {
            await Promise.all([
                fs.writeFile(EARNINGS_FILE, JSON.stringify(earningsCache, null, 2)),
                fs.writeFile(PRICES_FILE, JSON.stringify(pricesCache, null, 2)),
                fs.writeFile(METADATA_FILE, JSON.stringify(metadataCache, null, 2))
            ]);
            console.log('Data saved to storage');
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }, SAVE_DELAY);
}

// Check if data needs updating
function needsUpdate(symbol) {
    const metadata = metadataCache[symbol];
    if (!metadata) return true;

    const lastUpdate = new Date(metadata.lastUpdate);
    const now = new Date();
    
    // Update if last update was more than 12 hours ago during market hours
    const marketHours = now.getUTCHours() >= 13 && now.getUTCHours() <= 20; // 9 AM - 4 PM EST
    const isWeekday = now.getDay() > 0 && now.getDay() < 6;
    
    if (isWeekday && marketHours) {
        return now - lastUpdate > 12 * 60 * 60 * 1000; // 12 hours
    }
    
    // Otherwise, update if older than 24 hours
    return now - lastUpdate > 24 * 60 * 60 * 1000;
}

async function getEarningsData(symbol) {
    // Store the cached data in scope that's accessible to both try and catch blocks
    const cachedData = earningsCache[symbol];
    
    try {
        // Validate symbol format
        if (!/^[A-Z]{1,5}$/.test(symbol)) {
            throw new Error('Invalid symbol format');
        }

        const needsRefresh = needsUpdate(symbol);

        // Return cached data if it exists and doesn't need refresh
        if (cachedData && !needsRefresh) {
            console.log(`Using cached earnings data for ${symbol}`);
            return cachedData;
        }

        // Fetch new data
        const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`;
        console.log(`Fetching new earnings data for ${symbol}`);
        
        const response = await axios.get(url);
        
        if (response.data.Note || response.data.Information) {
            throw new Error(response.data.Note || response.data.Information);
        }

        if (!response.data.quarterlyEarnings || !response.data.quarterlyEarnings.length) {
            throw new Error('No earnings data available');
        }

        const newEarnings = response.data.quarterlyEarnings.map(earning => ({
            date: earning.reportedDate,
            symbol: symbol // Add symbol to each earning record
        }));

        let updatedEarnings;
        if (cachedData) {
            // Merge new earnings with cached data
            const allEarnings = [...newEarnings];
            const existingDates = new Set(newEarnings.map(e => e.date));
            
            cachedData.forEach(earning => {
                if (!existingDates.has(earning.date)) {
                    allEarnings.push(earning);
                }
            });

            // Sort by date
            allEarnings.sort((a, b) => new Date(b.date) - new Date(a.date));
            updatedEarnings = allEarnings;
        } else {
            updatedEarnings = newEarnings;
        }

        // Update cache
        earningsCache[symbol] = updatedEarnings;

        // Update metadata
        metadataCache[symbol] = {
            lastUpdate: new Date().toISOString(),
            lastEarningsDate: newEarnings[0]?.date,
            symbol: symbol
        };

        await saveToStorage();
        return updatedEarnings;
    } catch (error) {
        console.error(`Error fetching earnings data for ${symbol}:`, error.message);
        if (cachedData) {
            console.log(`Returning cached data for ${symbol} after error`);
            return cachedData;
        }
        throw error;
    }
}

async function getPriceData(symbol, fromDate, toDate) {
    // Store the cached data in scope that's accessible to both try and catch blocks
    const cachedData = pricesCache[symbol];
    
    try {
        // Validate dates
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        const needsRefresh = needsUpdate(symbol);

        // Check if we have all the required data in cache
        if (cachedData && !needsRefresh) {
            const filteredData = cachedData.filter(
                price => price.date >= fromDate && price.date <= toDate
            );
            if (filteredData.length > 0) {
                console.log(`Using cached price data for ${symbol}`);
                return filteredData;
            }
        }

        // Fetch new data
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${API_KEY}`;
        console.log(`Fetching new price data for ${symbol}`);
        
        const response = await axios.get(url);
        
        if (response.data.Note || response.data.Information) {
            throw new Error(response.data.Note || response.data.Information);
        }

        const dailyData = response.data['Time Series (Daily)'];
        if (!dailyData) {
            throw new Error('No price data available');
        }

        const newPriceData = Object.entries(dailyData).map(([date, data]) => ({
            date,
            open: parseFloat(data['1. open']),
            close: parseFloat(data['4. close']),
            symbol: symbol // Add symbol to each price record
        }));

        let updatedPrices;
        if (cachedData) {
            // Merge new prices with cached data
            const allPrices = [...newPriceData];
            const existingDates = new Set(newPriceData.map(p => p.date));
            
            cachedData.forEach(price => {
                if (!existingDates.has(price.date)) {
                    allPrices.push(price);
                }
            });

            // Sort by date
            allPrices.sort((a, b) => new Date(b.date) - new Date(a.date));
            updatedPrices = allPrices;
        } else {
            updatedPrices = newPriceData;
        }

        // Update cache
        pricesCache[symbol] = updatedPrices;

        // Update metadata
        metadataCache[symbol] = {
            ...metadataCache[symbol],
            lastUpdate: new Date().toISOString(),
            symbol: symbol
        };

        await saveToStorage();

        return updatedPrices.filter(
            price => price.date >= fromDate && price.date <= toDate
        );
    } catch (error) {
        console.error(`Error fetching price data for ${symbol}:`, error.message);
        if (cachedData) {
            console.log(`Returning cached price data for ${symbol} after error`);
            return cachedData.filter(
                price => price.date >= fromDate && price.date <= toDate
            );
        }
        throw error;
    }
}

// Pre-fetch popular symbols data
async function prefetchPopularData() {
    for (const symbol of POPULAR_SYMBOLS) {
        try {
            console.log(`Starting pre-fetch for ${symbol}...`);
            await getEarningsData(symbol);
            console.log(`Completed earnings pre-fetch for ${symbol}`);
            
            await new Promise(resolve => setTimeout(resolve, 15000)); // Respect API limits
            
            const today = new Date().toISOString().split('T')[0];
            await getPriceData(symbol, '2000-01-01', today);
            console.log(`Completed price data pre-fetch for ${symbol}`);
            
            await new Promise(resolve => setTimeout(resolve, 15000));
        } catch (error) {
            console.error(`Error pre-fetching data for ${symbol}:`, error.message);
        }
    }
}

// Express routes
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.json());

app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        
        console.log(`Processing earnings request for ${upperSymbol}`);
        const data = await getEarningsData(upperSymbol);
        
        if (!data || data.length === 0) {
            console.log(`No earnings data found for ${upperSymbol}`);
            return res.status(404).json({ error: 'No earnings data found for this symbol' });
        }
        
        console.log(`Successfully retrieved earnings data for ${upperSymbol}`);
        res.json(data);
    } catch (error) {
        console.error('Error processing earnings request:', error.message);
        res.status(500).json({ 
            error: error.message || 'Failed to fetch stock data'
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

        console.log(`Processing price request for ${symbol} from ${from} to ${to}`);
        const data = await getPriceData(symbol.toUpperCase(), from, to);
        
        console.log(`Successfully retrieved price data for ${symbol}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching price data:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to fetch price data'
        });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        cachedSymbols: Object.keys(earningsCache),
        lastUpdated: metadataCache
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Initialize and start server
(async () => {
    try {
        await initializeStorage();
        console.log('Storage initialized, starting pre-fetch...');
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            // Start pre-fetching popular symbols
            prefetchPopularData();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})();