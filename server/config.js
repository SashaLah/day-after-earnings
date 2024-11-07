// server/config.js

const API_CONFIG = {
    BASE_URL: 'https://www.alphavantage.co/query',
    FUNCTIONS: {
        EARNINGS: 'EARNINGS',
        DAILY_PRICES: 'TIME_SERIES_DAILY'
    },
    RATE_LIMIT: {
        DELAY_MS: 12000  // 12 seconds between calls
    }
};

// Market Hours Configuration
const MARKET_HOURS = {
    START_HOUR_UTC: 13, // 9:00 AM EST
    END_HOUR_UTC: 20,   // 4:00 PM EST
    TRADING_DAYS: [1, 2, 3, 4, 5] // Monday through Friday
};

const COMPANIES = [
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
];

// Helper functions
const isMarketHours = () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getDay();
    return MARKET_HOURS.TRADING_DAYS.includes(day) && 
           hour >= MARKET_HOURS.START_HOUR_UTC && 
           hour <= MARKET_HOURS.END_HOUR_UTC;
};

const searchCompanies = (query) => {
    const lowercaseQuery = query.toLowerCase();
    return COMPANIES.filter(company => 
        company.symbol.toLowerCase().includes(lowercaseQuery) ||
        company.name.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10);
};

module.exports = {
    API_CONFIG,
    MARKET_HOURS,
    COMPANIES,
    isMarketHours,
    searchCompanies
};