const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();
const { connectDB } = require('./db/mongodb');
const stockService = require('./db/stockService');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Company data for search functionality
const companiesData = {
    companies: [
        { symbol: "AAPL", name: "Apple Inc." },
        { symbol: "MSFT", name: "Microsoft Corporation" },
        { symbol: "GOOGL", name: "Alphabet Inc." },
        { symbol: "AMZN", name: "Amazon.com Inc." },
        { symbol: "META", name: "Meta Platforms Inc." },
        { symbol: "NVDA", name: "NVIDIA Corporation" },
        { symbol: "TSLA", name: "Tesla Inc." },
        { symbol: "JPM", name: "JPMorgan Chase & Co." },
        { symbol: "V", name: "Visa Inc." },
        { symbol: "WMT", name: "Walmart Inc." },
        { symbol: "JNJ", name: "Johnson & Johnson" },
        { symbol: "MA", name: "Mastercard Incorporated" },
        { symbol: "PG", name: "Procter & Gamble Company" },
        { symbol: "NFLX", name: "Netflix Inc." },
        { symbol: "DIS", name: "The Walt Disney Company" },
        { symbol: "ADBE", name: "Adobe Inc." },
        { symbol: "CSCO", name: "Cisco Systems Inc." },
        { symbol: "INTC", name: "Intel Corporation" },
        { symbol: "VZ", name: "Verizon Communications Inc." },
        { symbol: "KO", name: "The Coca-Cola Company" },
        { symbol: "PEP", name: "PepsiCo Inc." },
        { symbol: "MCD", name: "McDonald's Corporation" },
        { symbol: "NKE", name: "Nike Inc." },
        { symbol: "PYPL", name: "PayPal Holdings Inc." },
        { symbol: "T", name: "AT&T Inc." },
        { symbol: "BAC", name: "Bank of America Corporation" },
        { symbol: "HD", name: "The Home Depot Inc." },
        { symbol: "CRM", name: "Salesforce Inc." },
        { symbol: "AMD", name: "Advanced Micro Devices Inc." },
        { symbol: "QCOM", name: "Qualcomm Incorporated" }
    ]
};

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

        console.log('File storage system initialized successfully');
    } catch (error) {
        console.error('Error initializing file storage:', error);
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
            console.log('Data saved to file storage');
        } catch (error) {
            console.error('Error saving to file storage:', error);
        }
    }, SAVE_DELAY);
}

// Check if data needs updating
function needsUpdate(metadata) {
    if (!metadata) return true;

    const lastUpdate = new Date(metadata.lastUpdate);
    const now = new Date();
    
    const marketHours = now.getUTCHours() >= 13 && now.getUTCHours() <= 20; // 9 AM - 4 PM EST
    const isWeekday = now.getDay() > 0 && now.getDay() < 6;
    
    if (isWeekday && marketHours) {
        return now - lastUpdate > 12 * 60 * 60 * 1000; // 12 hours
    }
    
    return now - lastUpdate > 24 * 60 * 60 * 1000;
}

async function getEarningsData(symbol) {
    try {
        if (!/^[A-Z]{1,5}$/.test(symbol)) {
            throw new Error('Invalid symbol format');
        }

        // Try MongoDB first
        try {
            const mongoData = await stockService.getEarningsData(symbol);
            if (mongoData && mongoData.length > 0) {
                const lastUpdate = mongoData[0].lastUpdated;
                if (!needsUpdate({ lastUpdate })) {
                    console.log(`Using MongoDB earnings data for ${symbol}`);
                    return mongoData;
                }
            }
        } catch (mongoError) {
            console.log('Falling back to file cache for earnings data');
        }

        // Check file cache
        const cachedData = earningsCache[symbol];
        if (cachedData && !needsUpdate(metadataCache[symbol])) {
            console.log(`Using file cached earnings data for ${symbol}`);
            
            // Save to MongoDB while returning the data
            try {
                await stockService.upsertEarnings(symbol, cachedData);
                console.log(`Saved ${symbol} earnings data to MongoDB`);
            } catch (saveError) {
                console.error('Error saving to MongoDB:', saveError);
            }
            
            return cachedData;
        }

        // Fetch new data if needed
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
            symbol: symbol
        }));

        let updatedEarnings;
        if (cachedData) {
            const allEarnings = [...newEarnings];
            const existingDates = new Set(newEarnings.map(e => e.date));
            
            cachedData.forEach(earning => {
                if (!existingDates.has(earning.date)) {
                    allEarnings.push(earning);
                }
            });

            allEarnings.sort((a, b) => new Date(b.date) - new Date(a.date));
            updatedEarnings = allEarnings;
        } else {
            updatedEarnings = newEarnings;
        }

        // Save to both storage systems
        earningsCache[symbol] = updatedEarnings;
        metadataCache[symbol] = {
            lastUpdate: new Date().toISOString(),
            lastEarningsDate: newEarnings[0]?.date,
            symbol: symbol
        };

        await Promise.all([
            saveToStorage(),
            stockService.upsertEarnings(symbol, updatedEarnings)
        ]);

        return updatedEarnings;
    } catch (error) {
        console.error(`Error fetching earnings data for ${symbol}:`, error.message);
        if (earningsCache[symbol]) {
            console.log(`Returning file cached data for ${symbol} after error`);
            
            // Try to save cached data to MongoDB even in error case
            try {
                await stockService.upsertEarnings(symbol, earningsCache[symbol]);
                console.log(`Saved cached ${symbol} earnings data to MongoDB during error recovery`);
            } catch (saveError) {
                console.error('Error saving to MongoDB during error recovery:', saveError);
            }
            
            return earningsCache[symbol];
        }
        throw error;
    }
}

async function getPriceData(symbol, fromDate, toDate) {
    try {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        // Try MongoDB first
        try {
            const mongoData = await stockService.getPriceData(symbol, fromDate, toDate);
            if (mongoData && mongoData.length > 0) {
                const lastUpdate = mongoData[0].lastUpdated;
                if (!needsUpdate({ lastUpdate })) {
                    console.log(`Using MongoDB price data for ${symbol}`);
                    return mongoData;
                }
            }
        } catch (mongoError) {
            console.log('Falling back to file cache for price data');
        }

        // Check file cache
        const cachedData = pricesCache[symbol];
        if (cachedData && !needsUpdate(metadataCache[symbol])) {
            const filteredData = cachedData.filter(
                price => price.date >= fromDate && price.date <= toDate
            );
            if (filteredData.length > 0) {
                console.log(`Using file cached price data for ${symbol}`);
                
                // Save to MongoDB while returning the data
                try {
                    await stockService.upsertPrices(symbol, cachedData);
                    console.log(`Saved ${symbol} price data to MongoDB`);
                } catch (saveError) {
                    console.error('Error saving to MongoDB:', saveError);
                }
                
                return filteredData;
            }
        }

        // Fetch new data if needed
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

        const priceData = Object.entries(dailyData).map(([date, data]) => ({
            date,
            open: parseFloat(data['1. open']),
            close: parseFloat(data['4. close']),
            symbol: symbol
        }));

        // Save to both storage systems
        pricesCache[symbol] = priceData;
        metadataCache[symbol] = {
            ...metadataCache[symbol],
            lastUpdate: new Date().toISOString(),
            symbol: symbol
        };

        await Promise.all([
            saveToStorage(),
            stockService.upsertPrices(symbol, priceData)
        ]);

        return priceData.filter(
            price => price.date >= fromDate && price.date <= toDate
        );
    } catch (error) {
        console.error(`Error fetching price data for ${symbol}:`, error.message);
        if (pricesCache[symbol]) {
            console.log(`Returning file cached price data for ${symbol} after error`);
            
            // Try to save cached data to MongoDB even in error case
            try {
                await stockService.upsertPrices(symbol, pricesCache[symbol]);
                console.log(`Saved cached ${symbol} price data to MongoDB during error recovery`);
            } catch (saveError) {
                console.error('Error saving to MongoDB during error recovery:', saveError);
            }
            
            return pricesCache[symbol].filter(
                price => price.date >= fromDate && price.date <= toDate
            );
        }
        throw error;
    }
}

async function prefetchPopularData() {
    for (const symbol of POPULAR_SYMBOLS) {
        try {
            console.log(`Starting pre-fetch for ${symbol}...`);
            await getEarningsData(symbol);
            console.log(`Completed earnings pre-fetch for ${symbol}`);
            
            await new Promise(resolve => setTimeout(resolve, 15000));
            
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

// Unified search endpoint for both company names and symbols
app.get('/api/search/companies', (req, res) => {
    const query = req.query.q?.toLowerCase();
    
    if (!query) {
        return res.json([]);
    }

    const matches = companiesData.companies.filter(company => 
        company.name.toLowerCase().includes(query) || 
        company.symbol.toLowerCase().includes(query)
    ).slice(0, 10);

    res.json(matches);
});

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
        // Connect to MongoDB first
        await connectDB();
        console.log('MongoDB connected successfully');

        // Then initialize file storage
        await initializeStorage();
        console.log('Storage initialized, starting pre-fetch...');
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            prefetchPopularData();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})();

module.exports = app;