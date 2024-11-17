// server/constants/earningsTiming.js

const STOCK_EARNINGS_TIMING = {
    // Technology - After Market Close (AMC)
    'AAPL': 'AMC',  // Apple - Always reports after market
    'MSFT': 'AMC',  // Microsoft - After market
    'GOOGL': 'AMC', // Alphabet - After market
    'GOOG': 'AMC',  // Alphabet Class C
    'META': 'AMC',  // Meta - After market
    'NVDA': 'AMC',  // NVIDIA - After market
    'AVGO': 'AMC',  // Broadcom - After market
    'CSCO': 'AMC',  // Cisco - After market
    'ADBE': 'AMC',  // Adobe - After market
    'ORCL': 'AMC',  // Oracle - After market
    'NFLX': 'AMC',  // Netflix - After market
    'CRM': 'AMC',   // Salesforce - After market

    // Before Market Open (BMO)
    'TGT': 'BMO',   // Target - Always before market
    'WMT': 'BMO',   // Walmart - Before market
    'PG': 'BMO',    // Procter & Gamble - Before market
    'JNJ': 'BMO',   // Johnson & Johnson - Before market
    'JPM': 'BMO',   // JPMorgan - Before market
    'BAC': 'BMO',   // Bank of America - Before market
    'WFC': 'BMO',   // Wells Fargo - Before market
    'GS': 'BMO',    // Goldman Sachs - Before market
    'MS': 'BMO',    // Morgan Stanley - Before market
    'UNH': 'BMO',   // UnitedHealth - Before market
    'CVX': 'BMO',   // Chevron - Before market
    'XOM': 'BMO',   // Exxon - Before market
    'PFE': 'BMO',   // Pfizer - Before market
    'MRK': 'BMO',   // Merck - Before market
    'KO': 'BMO',    // Coca-Cola - Before market
    'PEP': 'BMO',   // PepsiCo - Before market
    'MCD': 'BMO',   // McDonald's - Before market
    'HD': 'BMO',    // Home Depot - Before market
    'CAT': 'BMO',   // Caterpillar - Before market
    'BA': 'BMO',    // Boeing - Before market
    'UPS': 'BMO',   // UPS - Before market
    'GE': 'BMO',    // General Electric - Before market

    // Mixed (but mostly AMC)
    'AMZN': 'AMC',  // Amazon - Usually after market
    'TSLA': 'AMC',  // Tesla - Usually after market
    'AMD': 'AMC',   // AMD - Usually after market
    'INTC': 'AMC',  // Intel - Usually after market
    'IBM': 'AMC',   // IBM - Usually after market
    'QCOM': 'AMC',  // Qualcomm - Usually after market

    // Major Financial (Usually BMO)
    'V': 'AMC',     // Visa - Exception, reports AMC
    'MA': 'AMC',    // Mastercard - Exception, reports AMC
    'BLK': 'BMO',   // BlackRock - Before market

    // Major Healthcare (Usually BMO)
    'ABBV': 'BMO',  // AbbVie - Before market
    'LLY': 'BMO',   // Eli Lilly - Before market
    'TMO': 'BMO',   // Thermo Fisher - Before market
    'ABT': 'BMO',   // Abbott - Before market
    'DHR': 'BMO',   // Danaher - Before market

    // Retail (Mixed)
    'COST': 'AMC',  // Costco - After market
    'LOW': 'BMO',   // Lowe's - Before market
    'TJX': 'BMO',   // TJ Maxx - Before market
    'NKE': 'AMC',   // Nike - After market

    // Media & Telecom (Usually AMC)
    'DIS': 'BMO',   // Disney - Before market
    'CMCSA': 'BMO', // Comcast - Exception, reports BMO
    'T': 'BMO',     // AT&T - Before market
    'VZ': 'BMO',    // Verizon - Before market

    // Industrial & Transport (Usually BMO)
    'HON': 'BMO',   // Honeywell - Before market
    'MMM': 'BMO',   // 3M - Before market
    'RTX': 'BMO',   // Raytheon - Before market
    
    // Energy (Usually BMO)
    'COP': 'BMO',   // ConocoPhillips - Before market
    'SLB': 'BMO',   // Schlumberger - Before market
    
    // Consumer Staples (Usually BMO)
    'PM': 'BMO',    // Philip Morris - Before market
    'BUD': 'BMO',   // AB InBev - Before market
    
    // Default fallback
    'DEFAULT': 'AMC' // When in doubt, assume after market
};

// Helper function to get timing for a stock
function getEarningsTiming(symbol) {
    return STOCK_EARNINGS_TIMING[symbol] || STOCK_EARNINGS_TIMING.DEFAULT;
}

module.exports = {
    STOCK_EARNINGS_TIMING,
    getEarningsTiming
};