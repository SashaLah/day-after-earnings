const axios = require('axios');
const path = require('path');
const { Company, Earnings } = require('./mongodb');
const { API_CONFIG } = require('../config');

// Debug imports
console.log('Current directory:', __dirname);
console.log('earningsTiming.js path:', path.resolve(__dirname, '../constants/earningsTiming.js'));

const { STOCK_EARNINGS_TIMING } = require('../constants/earningsTiming');
console.log('Loaded STOCK_EARNINGS_TIMING:', STOCK_EARNINGS_TIMING);

// API rate limiting
let lastApiCall = 0;
const API_DELAY = 16000; // 16 seconds between calls
const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 30000; // 30 seconds timeout for API calls

// Helper function to format dates consistently
const formatDate = (date) => {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    return date.toISOString().split('T')[0];
};

// Helper function to add business days to a date
const addBusinessDays = (date, days) => {
    let result = new Date(date);
    let count = 0;
    while (count < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) {
            count++;
        }
    }
    return result;
};

// Helper function to find last trading day with data
const findLastTradingDay = (date, prices) => {
    let searchDate = new Date(date);
    let dateStr = formatDate(searchDate);
    
    // Go back until we find a trading day with data
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    
    while (attempts < MAX_ATTEMPTS) {
        if (searchDate.getDay() === 0) { // Sunday
            searchDate.setDate(searchDate.getDate() - 2); // Go to Friday
        } else if (searchDate.getDay() === 6) { // Saturday
            searchDate.setDate(searchDate.getDate() - 1); // Go to Friday
        }
        dateStr = formatDate(searchDate);
        
        // If we found a trading day with data, return it
        if (prices[dateStr]) {
            return { date: searchDate, dateStr };
        }
        
        // If no data, go back one more day
        searchDate.setDate(searchDate.getDate() - 1);
        attempts++;
    }
    return null;
};

// API rate limiting function
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
            console.log(`Fetching ${operation} data...`);
            
            const response = await axios.get(url, {
                timeout: FETCH_TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            });
            
            if (response.data.Note) {
                console.log('API Rate limit hit, waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
                throw new Error('Rate limit hit, retrying...');
            }

            if (!response.data) {
                throw new Error('Empty response from API');
            }

            return response.data;
        } catch (error) {
            if (retries < MAX_RETRIES) {
                console.log(`Retry ${retries + 1}/${MAX_RETRIES} for ${operation}...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                return this.fetchWithRetry(url, operation, retries + 1);
            }
            throw error;
        }
    },

    async fetchEarningsData(symbol) {
        try {
            console.log(`\nFetching earnings data for ${symbol}...`);
            console.log('STOCK_EARNINGS_TIMING content:', STOCK_EARNINGS_TIMING);
            console.log(`Lookup timing for ${symbol}:`, STOCK_EARNINGS_TIMING[symbol]);
            console.log('Default timing:', STOCK_EARNINGS_TIMING.DEFAULT);
            
            // Get historical earnings data
            const historicalUrl = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.EARNINGS}&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log('Fetching historical earnings...');
            const historicalData = await this.fetchWithRetry(historicalUrl, 'earnings');

            // Use hardcoded timing from our constants
            const reportTime = STOCK_EARNINGS_TIMING[symbol] || STOCK_EARNINGS_TIMING.DEFAULT;
            console.log(`Using timing for ${symbol}: ${reportTime}`);

            if (!historicalData.quarterlyEarnings || !Array.isArray(historicalData.quarterlyEarnings)) {
                console.error('Invalid earnings data structure:', historicalData);
                throw new Error('Invalid earnings data received from API');
            }

            const earningsData = historicalData.quarterlyEarnings
                .filter(earning => earning.reportedDate)
                .map(earning => {
                    const reportDate = new Date(earning.reportedDate);
                    console.log(`Processing earnings date: ${formatDate(reportDate)} with timing: ${reportTime}`);

                    return {
                        reportedDate: formatDate(reportDate),
                        reportTime: reportTime,
                        fiscalDateEnding: earning.fiscalDateEnding,
                        fiscalQuarter: earning.fiscalQuarter,
                        estimatedEPS: parseFloat(earning.estimatedEPS) || null,
                        actualEPS: parseFloat(earning.reportedEPS) || null,
                        epsSurprise: parseFloat(earning.surprise) || null,
                        epsSurprisePercent: parseFloat(earning.surprisePercentage) || null
                    };
                });

            console.log(`Found ${earningsData.length} valid earnings records for ${symbol}`);
            return earningsData;
        } catch (error) {
            console.error(`Error fetching earnings for ${symbol}:`, error.message);
            throw error;
        }
    },

    async fetchPriceData(symbol) {
        try {
            const url = `${API_CONFIG.BASE_URL}?function=${API_CONFIG.FUNCTIONS.DAILY_PRICES}&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
            console.log(`\nFetching price data for ${symbol}...`);
            
            const data = await this.fetchWithRetry(url, 'prices');
            const prices = data['Time Series (Daily)'] || {};
            
            if (Object.keys(prices).length === 0) {
                throw new Error('No price data received from API');
            }

            console.log(`Found price data for ${Object.keys(prices).length} days`);
            return prices;
        } catch (error) {
            console.error(`Error fetching prices for ${symbol}:`, error.message);
            throw error;
        }
    },

    getPricesForEarnings(prices, announcementDate, reportTime) {
        const dateObj = new Date(announcementDate);
        const announcementDateStr = formatDate(dateObj);
        
        // For day before, first move back exactly one calendar day
        let dayBefore = new Date(dateObj);
        dayBefore.setDate(dayBefore.getDate() - 1);
        let dayBeforeStr = formatDate(dayBefore);
        
        // If it's a weekend or holiday, find the last trading day
        if (!prices[dayBeforeStr]) {
            const lastTrading = findLastTradingDay(dayBefore, prices);
            if (lastTrading) {
                dayBefore = lastTrading.date;
                dayBeforeStr = lastTrading.dateStr;
            }
        }
        
        // For next day, first move forward exactly one calendar day
        let dayAfter = new Date(dateObj);
        dayAfter.setDate(dayAfter.getDate() + 1);
        let dayAfterStr = formatDate(dayAfter);
        
        // If it's a weekend or holiday, find the next trading day
        while (!prices[dayAfterStr] && dayAfter.getTime() < dateObj.getTime() + (7 * 24 * 60 * 60 * 1000)) {
            dayAfter.setDate(dayAfter.getDate() + 1);
            dayAfterStr = formatDate(dayAfter);
        }

        console.log(`\nProcessing earnings for ${announcementDateStr} (${reportTime})`);
        console.log('Day before:', dayBeforeStr);
        console.log('Announcement day:', announcementDateStr);
        console.log('Day after:', dayAfterStr);
        console.log('Price data available for day before:', !!prices[dayBeforeStr]);

        if (reportTime === 'BMO') {
            // Before Market Open:
            // closePriceDayBefore = previous calendar day's last trading close
            // closePriceOnDay = announcement day's close
            const priceData = {
                closePriceDayBefore: prices[dayBeforeStr] ? parseFloat(prices[dayBeforeStr]['4. close']) : null,
                closePriceOnDay: prices[announcementDateStr] ? parseFloat(prices[announcementDateStr]['4. close']) : null
            };
            console.log('BMO Price Data:', priceData);
            return priceData;
        } else {
            // After Market Close:
            // closePriceDayBefore = announcement day's close
            // closePriceOnDay = next day's close
            const priceData = {
                closePriceDayBefore: prices[announcementDateStr] ? parseFloat(prices[announcementDateStr]['4. close']) : null,
                closePriceOnDay: prices[dayAfterStr] ? parseFloat(prices[dayAfterStr]['4. close']) : null
            };
            console.log('AMC Price Data:', priceData);
            return priceData;
        }
    },

    async storeEarningsAndPrices(symbol, earningsData, priceData) {
        try {
            console.log(`\nStoring data for ${symbol}...`);
            const operations = earningsData.map(earning => {
                const announcementDate = new Date(earning.reportedDate);
                const priceInfo = this.getPricesForEarnings(priceData, announcementDate, earning.reportTime);

                console.log(`\nStoring earnings for ${formatDate(announcementDate)}`);
                console.log('Report Time:', earning.reportTime);
                console.log('Price Data:', priceInfo);

                return {
                    updateOne: {
                        filter: { 
                            symbol,
                            date: announcementDate
                        },
                        update: {
                            $set: {
                                symbol,
                                date: announcementDate,
                                reportTime: earning.reportTime,
                                closePriceDayBefore: priceInfo.closePriceDayBefore,
                                closePriceOnDay: priceInfo.closePriceOnDay,
                                fiscalQuarter: earning.fiscalQuarter,
                                fiscalDateEnding: earning.fiscalDateEnding,
                                estimatedEPS: earning.estimatedEPS,
                                actualEPS: earning.actualEPS,
                                epsSurprise: earning.epsSurprise,
                                epsSurprisePercent: earning.epsSurprisePercent,
                                lastUpdated: new Date()
                            }
                        },
                        upsert: true
                    }
                };
            });

            if (operations.length > 0) {
                const result = await Earnings.bulkWrite(operations);
                console.log(`Updated ${result.modifiedCount + result.upsertedCount} earnings records`);
            }

            return {
                earningsCount: operations.length
            };
        } catch (error) {
            console.error(`Error storing data for ${symbol}:`, error.message);
            throw error;
        }
    },

    async getStockData(symbol) {
        try {
            console.log(`\nGetting stock data for ${symbol}...`);
            
            // First check database
            const existingData = await Earnings.find({ symbol })
                .sort({ date: -1 })
                .lean();

            // If we have data that's less than 24 hours old, use it
            if (existingData.length > 0) {
                const mostRecentUpdate = existingData[0].lastUpdated;
                const timeSinceUpdate = Date.now() - new Date(mostRecentUpdate).getTime();
                const ONE_DAY = 24 * 60 * 60 * 1000;

                if (timeSinceUpdate < ONE_DAY) {
                    console.log('Using recent data from database');
                    return existingData;
                }
            }

            // Otherwise, fetch new data
            console.log('Fetching new data...');
            const earningsData = await this.fetchEarningsData(symbol);
            const priceData = await this.fetchPriceData(symbol);
            
            // Store the data
            await this.storeEarningsAndPrices(symbol, earningsData, priceData);

            // Return fresh data
            const updatedData = await Earnings.find({ symbol })
                .sort({ date: -1 })
                .lean();

            console.log(`Returning ${updatedData.length} earnings records`);
            return updatedData;
        } catch (error) {
            console.error(`Error in getStockData for ${symbol}:`, error.message);
            
            // If we have existing data, return it despite the error
            if (existingData?.length > 0) {
                console.log('Error occurred, returning existing data from database');
                return existingData;
            }
            
            throw error;
        }
    }
};

module.exports = stockService;