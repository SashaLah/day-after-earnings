// server/config.js

const API_CONFIG = {
    BASE_URL: 'https://www.alphavantage.co/query',
    FUNCTIONS: {
        EARNINGS: 'EARNINGS',
        DAILY_PRICES: 'TIME_SERIES_DAILY',
        EARNINGS_CALENDAR: 'EARNINGS_CALENDAR',
        COMPANY_OVERVIEW: 'OVERVIEW'
    },
    RATE_LIMIT: {
        DELAY_MS: 16000  // 16 seconds between calls
    }
};

// Market Hours Configuration
const MARKET_HOURS = {
    START_HOUR_UTC: 13, // 9:00 AM EST
    END_HOUR_UTC: 20,   // 4:00 PM EST
    TRADING_DAYS: [1, 2, 3, 4, 5] // Monday through Friday
};

// Company configurations including earnings timing
const COMPANIES = [
    { symbol: "AAPL", name: "Apple Inc.", reportTime: "AMC" },
    { symbol: "MSFT", name: "Microsoft Corporation", reportTime: "AMC" },
    { symbol: "GOOGL", name: "Alphabet Inc.", reportTime: "AMC" },
    { symbol: "AMZN", name: "Amazon.com Inc.", reportTime: "AMC" },
    { symbol: "META", name: "Meta Platforms Inc.", reportTime: "AMC" },
    { symbol: "NVDA", name: "NVIDIA Corporation", reportTime: "AMC" },
    { symbol: "TSLA", name: "Tesla Inc.", reportTime: "AMC" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", reportTime: "BMO" },
    { symbol: "V", name: "Visa Inc.", reportTime: "AMC" },
    { symbol: "WMT", name: "Walmart Inc.", reportTime: "BMO" },
    { symbol: "JNJ", name: "Johnson & Johnson", reportTime: "BMO" },
    { symbol: "MA", name: "Mastercard Incorporated", reportTime: "AMC" },
    { symbol: "PG", name: "Procter & Gamble Company", reportTime: "BMO" },
    { symbol: "NFLX", name: "Netflix Inc.", reportTime: "AMC" },
    { symbol: "DIS", name: "The Walt Disney Company", reportTime: "AMC" },
    { symbol: "ADBE", name: "Adobe Inc.", reportTime: "AMC" },
    { symbol: "CSCO", name: "Cisco Systems Inc.", reportTime: "AMC" },
    { symbol: "INTC", name: "Intel Corporation", reportTime: "AMC" },
    { symbol: "VZ", name: "Verizon Communications Inc.", reportTime: "BMO" },
    { symbol: "KO", name: "The Coca-Cola Company", reportTime: "BMO" },
    { symbol: "PEP", name: "PepsiCo Inc.", reportTime: "BMO" },
    { symbol: "MCD", name: "McDonald's Corporation", reportTime: "BMO" },
    { symbol: "NKE", name: "Nike Inc.", reportTime: "AMC" },
    { symbol: "PYPL", name: "PayPal Holdings Inc.", reportTime: "AMC" },
    { symbol: "T", name: "AT&T Inc.", reportTime: "BMO" },
    { symbol: "BAC", name: "Bank of America Corporation", reportTime: "BMO" },
    { symbol: "HD", name: "The Home Depot Inc.", reportTime: "BMO" },
    { symbol: "CRM", name: "Salesforce Inc.", reportTime: "AMC" },
    { symbol: "AMD", name: "Advanced Micro Devices Inc.", reportTime: "AMC" },
    { symbol: "QCOM", name: "Qualcomm Incorporated", reportTime: "AMC" },
    { symbol: "GS", name: "Goldman Sachs Group Inc.", reportTime: "BMO" },
    { symbol: "MS", name: "Morgan Stanley", reportTime: "BMO" },
    { symbol: "C", name: "Citigroup Inc.", reportTime: "BMO" },
    { symbol: "WFC", name: "Wells Fargo & Company", reportTime: "BMO" },
    { symbol: "UNH", name: "UnitedHealth Group Inc.", reportTime: "BMO" },
    { symbol: "CVX", name: "Chevron Corporation", reportTime: "BMO" },
    { symbol: "XOM", name: "Exxon Mobil Corporation", reportTime: "BMO" },
    { symbol: "ABBV", name: "AbbVie Inc.", reportTime: "BMO" },
    { symbol: "LLY", name: "Eli Lilly and Company", reportTime: "BMO" },
    { symbol: "PFE", name: "Pfizer Inc.", reportTime: "BMO" },
    { symbol: "TM", name: "Toyota", reportTime: "AMC" },
    { symbol: "WDAY", name: "Workday Inc.", reportTime: "AMC" },
    { symbol: "ABNB", name: "Airbnb Inc.", reportTime: "AMC" },
    { symbol: "WDAY", name: "Workday Inc.", reportTime: "AMC" },
    { symbol: "ADSK", name: "Autodesk Inc.", reportTime: "AMC" },
    { symbol: "GILD", name: "Gilead Sciences Inc.", reportTime: "AMC" },
    { symbol: "SNPS", name: "Synopsys Inc.", reportTime: "AMC" },
    { symbol: "INTU", name: "Intuit Inc.", reportTime: "AMC" },
    { symbol: "MRVL", name: "Marvell Technology Inc.", reportTime: "AMC" },
    { symbol: "TGT", name: "Target Corporation", reportTime: "BMO" }  // Added Target
];

// Earnings timing map for quick lookups
const EARNINGS_TIMING = COMPANIES.reduce((map, company) => {
    map[company.symbol] = company.reportTime;
    return map;
}, {});

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

const getEarningsTiming = (symbol) => {
    return EARNINGS_TIMING[symbol] || 'AMC'; // Default to AMC if not found
};

// Trading day helpers
const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

const getNextTradingDay = (date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (isWeekend(next)) {
        next.setDate(next.getDate() + 1);
    }
    return next;
};

const getPreviousTradingDay = (date) => {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    while (isWeekend(prev)) {
        prev.setDate(prev.getDate() - 1);
    }
    return prev;
};

module.exports = {
    API_CONFIG,
    MARKET_HOURS,
    COMPANIES,
    EARNINGS_TIMING,
    isMarketHours,
    searchCompanies,
    getEarningsTiming,
    isWeekend,
    getNextTradingDay,
    getPreviousTradingDay
};