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
            
            if (response.data.Note) {
                console.log('API Rate limit hit, waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
                throw new Error('Rate limit hit, retrying...');
            }

            return response.data;
        } catch (error) {
            if (retries < MAX_RETRIES) {
                console.log(`Retry ${retries + 1}/${MAX_RETRIES} for ${operation}...`);
                return this.fetchWithRetry(url, operation, retries + 1);
            }
            throw error;
        }
    },

    async fetchEarningsData(symbol) {
        try {
            const url = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.EARNINGS}&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log(`Fetching earnings data for ${symbol}...`);
            
            const data = await this.fetchWithRetry(url, 'earnings');
            return data.quarterlyEarnings || [];
        } catch (error) {
            console.error(`Error fetching earnings for ${symbol}:`, error.message);
            throw error;
        }
    },

    async fetchPriceData(symbol, date) {
        try {
            const url = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.DAILY_PRICES}&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log(`Fetching price data for ${symbol}...`);
            
            const data = await this.fetchWithRetry(url, 'prices');
            return data['Time Series (Daily)'] || {};
        } catch (error) {
            console.error(`Error fetching prices for ${symbol}:`, error.message);
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
            // Store earnings dates with reportTime
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
            console.log(`Stored ${earningsOps.length} earnings records for ${symbol}`);

            // Store price data
            const priceOps = [];
            for (const earning of earningsData) {
                const isBMO = earning.reportedTime === 'BMO';
                const reportDate = new Date(earning.reportedDate);
                
                // FIXED BMO LOGIC HERE
                if (isBMO) {
                    // For BMO announcements:
                    // preEarningsClose should be from the day before the announcement (reportDate - 1)
                    // postEarningsOpen should be from the announcement day itself (reportDate)
                    const preDate = new Date(reportDate);
                    preDate.setDate(preDate.getDate() - 1);
                    const postDate = reportDate;

                    const preDateStr = preDate.toISOString().split('T')[0];
                    const postDateStr = postDate.toISOString().split('T')[0];

                    console.log(`Processing ${symbol} BMO earnings:
                        Report Date: ${earning.reportedDate}
                        Pre Close Date: ${preDateStr}
                        Post Open Date: ${postDateStr}`);

                    if (priceData[preDateStr] && priceData[postDateStr]) {
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
                                        preEarningsOpen: parseFloat(priceData[preDateStr]['1. open']),
                                        preEarningsClose: parseFloat(priceData[preDateStr]['4. close']),
                                        postEarningsOpen: parseFloat(priceData[postDateStr]['1. open'])
                                    }
                                },
                                upsert: true
                            }
                        });
                    }
                } else {
                    // For AMC/TNS announcements:
                    // Use same day close and next day open
                    const nextDay = new Date(reportDate);
                    nextDay.setDate(nextDay.getDate() + 1);

                    const reportDateStr = reportDate.toISOString().split('T')[0];
                    const nextDayStr = nextDay.toISOString().split('T')[0];

                    if (priceData[reportDateStr] && priceData[nextDayStr]) {
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
                                        preEarningsOpen: parseFloat(priceData[reportDateStr]['1. open']),
                                        preEarningsClose: parseFloat(priceData[reportDateStr]['4. close']),
                                        postEarningsOpen: parseFloat(priceData[nextDayStr]['1. open'])
                                    }
                                },
                                upsert: true
                            }
                        });
                    }
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
            if (!earningsData.length) {
                throw new Error('No earnings data available');
            }

            const priceData = await this.fetchPriceData(symbol);
            if (!Object.keys(priceData).length) {
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
            
            // Check if we have any data
            const existingData = await PriceHistory.find({ symbol }).lean();
            
            // If no data exists, fetch and store everything
            if (existingData.length === 0) {
                console.log(`No existing data found for ${symbol}, fetching historical data...`);
                await this.populateHistoricalData(symbol);
                return await PriceHistory.find({ symbol }).lean();
            }

            // If we have data and it's market hours, check for updates
            if (isMarketHours()) {
                const latestEarnings = await Earnings.findOne({ symbol })
                    .sort({ date: -1 })
                    .lean();
                
                const hasNewEarnings = await this.checkForNewEarnings(
                    symbol, 
                    latestEarnings.date
                );

                if (hasNewEarnings) {
                    console.log(`New earnings found for ${symbol}, updating data...`);
                    await this.populateHistoricalData(symbol);
                }
            }

            // Return all price history
            const priceHistory = await PriceHistory.find({ symbol })
                .sort({ date: -1 })
                .lean();

            console.log(`Returning ${priceHistory.length} records for ${symbol}`);
            return priceHistory;
        } catch (error) {
            console.error(`Error in getStockData for ${symbol}:`, error.message);
            throw error;
        }
    }
};

module.exports = stockService;