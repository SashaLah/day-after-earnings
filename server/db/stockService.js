// server/db/stockService.js

const axios = require('axios');
const { Company, Earnings, PriceHistory } = require('./mongodb');
const { API_CONFIG, isMarketHours } = require('../config');

// API rate limiting
let lastApiCall = 0;
const API_DELAY = 12000; // 12 seconds between calls
const MAX_RETRIES = 3;

const waitForApiDelay = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  const waitTime = Math.max(0, API_DELAY - timeSinceLastCall);
  
  if (waitTime > 0) {
    console.log(`API rate limit: waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCall = Date.now();
};

const stockService = {
    async fetchWithRetry(url, operation, retries = 0) {
        try {
            await waitForApiDelay();
            const response = await axios.get(url);
            
            // Check for API limit messages
            if (response.data.Note || response.data.Information) {
                console.log('API Message:', response.data.Note || response.data.Information);
                if (retries < MAX_RETRIES) {
                    console.log('Waiting 60 seconds before retry...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    return this.fetchWithRetry(url, operation, retries + 1);
                }
                throw new Error('API limit reached');
            }

            return response.data;
        } catch (error) {
            if (retries < MAX_RETRIES) {
                console.log(`Retry ${retries + 1}/${MAX_RETRIES} for ${operation}...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
                return this.fetchWithRetry(url, operation, retries + 1);
            }
            throw error;
        }
    },

    async fetchEarningsData(symbol) {
        try {
            // First check if we have recent data in the database
            const existingEarnings = await Earnings.find({ symbol })
                .sort({ date: -1 })
                .lean();

            if (existingEarnings.length > 0) {
                console.log(`Using existing earnings data for ${symbol}`);
                return existingEarnings;
            }

            const url = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.EARNINGS}&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log(`Fetching earnings data for ${symbol}...`);
            
            const data = await this.fetchWithRetry(url, 'earnings');
            console.log('API Response:', data ? 'Received data' : 'No data received');

            if (!data || !data.quarterlyEarnings || data.quarterlyEarnings.length === 0) {
                if (existingEarnings.length > 0) {
                    console.log(`Using existing earnings data for ${symbol}`);
                    return existingEarnings;
                }
                throw new Error('No earnings data available');
            }

            const earnings = data.quarterlyEarnings;
            earnings.forEach(earning => {
                earning.reportedTime = 'BMO';
                earning.reportedDate = earning.fiscalDateEnding;
            });

            return earnings;
        } catch (error) {
            console.error(`Error fetching earnings for ${symbol}:`, error.message);
            // Try to use existing data
            const existingEarnings = await Earnings.find({ symbol }).lean();
            if (existingEarnings.length > 0) {
                console.log('Using existing earnings data from database');
                return existingEarnings;
            }
            throw error;
        }
    },

    async fetchPriceData(symbol) {
        try {
            // First check if we have recent data in the database
            const existingPrices = await PriceHistory.find({ symbol })
                .sort({ date: -1 })
                .lean();

            if (existingPrices.length > 0 && !isMarketHours()) {
                console.log(`Using existing price data for ${symbol}`);
                return existingPrices;
            }

            const url = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.DAILY_PRICES}&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log(`Fetching price data for ${symbol}...`);
            
            const data = await this.fetchWithRetry(url, 'prices');
            if (!data || !data['Time Series (Daily)']) {
                if (existingPrices.length > 0) {
                    console.log('Using existing price data from database');
                    return existingPrices;
                }
                throw new Error('No price data available');
            }
            return data['Time Series (Daily)'];
        } catch (error) {
            console.error(`Error fetching prices for ${symbol}:`, error.message);
            // Try to use existing data
            const existingPrices = await PriceHistory.find({ symbol }).lean();
            if (existingPrices.length > 0) {
                console.log('Using existing price data from database');
                return existingPrices;
            }
            throw error;
        }
    },

    async checkForNewEarnings(symbol, lastKnownEarningsDate) {
        try {
            console.log(`Checking for new earnings for ${symbol}...`);
            const latestEarnings = await this.fetchEarningsData(symbol);
            
            if (!latestEarnings.length) return false;
            
            const newEarningsDate = new Date(latestEarnings[0].reportedDate);
            const lastKnown = new Date(lastKnownEarningsDate);
            
            return newEarningsDate > lastKnown;
        } catch (error) {
            console.error(`Error checking new earnings for ${symbol}:`, error.message);
            return false;
        }
    },

    async storeEarningsAndPrices(symbol, earningsData, priceData) {
        try {
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
                            reportTime: earning.reportedTime || 'BMO'
                        }
                    },
                    upsert: true
                }
            }));

            await Earnings.bulkWrite(earningsOps);
            console.log(`Stored ${earningsOps.length} earnings records for ${symbol}`);

            // Store price data with proper date handling
            const priceOps = [];
            for (const earning of earningsData) {
                const reportDate = new Date(earning.reportedDate);
                
                // Get the day before the report date for pre-earnings prices
                const priceDate = new Date(reportDate);
                priceDate.setDate(priceDate.getDate() - 1);

                const priceDateStr = priceDate.toISOString().split('T')[0];
                const reportDateStr = reportDate.toISOString().split('T')[0];

                console.log(`Processing ${symbol} earnings:
                    Report Date: ${reportDateStr}
                    Pre-earnings Date: ${priceDateStr}`);

                if (priceData[priceDateStr] && priceData[reportDateStr]) {
                    priceOps.push({
                        updateOne: {
                            filter: {
                                symbol,
                                earningsDate: reportDate
                            },
                            update: {
                                $set: {
                                    symbol,
                                    date: reportDate,
                                    earningsDate: reportDate,
                                    preEarningsOpen: parseFloat(priceData[priceDateStr]['1. open']),
                                    preEarningsClose: parseFloat(priceData[priceDateStr]['4. close']),
                                    postEarningsOpen: parseFloat(priceData[reportDateStr]['1. open'])
                                }
                            },
                            upsert: true
                        }
                    });

                    console.log(`Price data found:
                        Pre-earnings Close (${priceDateStr}): ${priceData[priceDateStr]['4. close']}
                        Post-earnings Open (${reportDateStr}): ${priceData[reportDateStr]['1. open']}`);
                } else {
                    console.log(`Missing price data for dates: ${priceDateStr} or ${reportDateStr}`);
                }
            }

            if (priceOps.length > 0) {
                await PriceHistory.bulkWrite(priceOps);
                console.log(`Stored ${priceOps.length} price records for ${symbol}`);
            }

            return {
                earningsCount: earningsData.length,
                priceCount: priceOps.length
            };
        } catch (error) {
            console.error(`Error storing data for ${symbol}:`, error.message);
            throw error;
        }
    },

    async populateHistoricalData(symbol) {
        try {
            console.log(`Populating historical data for ${symbol}...`);
            
            const earningsData = await this.fetchEarningsData(symbol);
            if (!earningsData || earningsData.length === 0) {
                // Try to use existing data
                const existingData = await PriceHistory.find({ symbol })
                    .sort({ date: -1 })
                    .lean();
                if (existingData.length > 0) {
                    console.log(`Using existing data for ${symbol}`);
                    return {
                        earningsCount: existingData.length,
                        priceCount: existingData.length
                    };
                }
                throw new Error('No earnings data available');
            }

            const priceData = await this.fetchPriceData(symbol);
            if (!priceData || Object.keys(priceData).length === 0) {
                throw new Error('No price data available');
            }

            const result = await this.storeEarningsAndPrices(symbol, earningsData, priceData);
            console.log(`Stored ${result.earningsCount} earnings dates and ${result.priceCount} price records for ${symbol}`);
            
            return result;
        } catch (error) {
            console.error(`Error populating data for ${symbol}:`, error.message);
            throw error;
        }
    },

    async getStockData(symbol) {
        try {
            console.log(`Getting stock data for ${symbol}...`);
            
            // Check for existing data first
            const existingData = await PriceHistory.find({ symbol })
                .sort({ date: -1 })
                .lean();

            if (existingData.length > 0) {
                console.log(`Found existing data for ${symbol}`);
                if (!isMarketHours()) {
                    console.log('Outside market hours, using existing data');
                    return existingData;
                }
            }

            try {
                const result = await this.populateHistoricalData(symbol);
                if (result) {
                    return await PriceHistory.find({ symbol })
                        .sort({ date: -1 })
                        .lean();
                }
            } catch (error) {
                console.error('Error fetching new data:', error.message);
                if (existingData.length > 0) {
                    console.log('Returning existing data due to API error');
                    return existingData;
                }
                throw error;
            }
        } catch (error) {
            console.error(`Error in getStockData for ${symbol}:`, error.message);
            throw error;
        }
    }
};

module.exports = stockService;