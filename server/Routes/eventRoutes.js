const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Parse the query string to extract meaningful information
const parseQuery = (query) => {
  // Remove the word "since" and clean up the query
  const cleanQuery = query.toLowerCase().replace('since', '').trim();
  
  // Try different date/event patterns
  const patterns = [
    // Match product launches (e.g., "iphone 5 release", "vision pro launch")
    {
      pattern: /(iphone|vision pro|macbook|ipad|apple watch).*?(release|launch)/i,
      type: 'product_launch'
    },
    // Match specific dates (e.g., "January 2020", "2020-01-15")
    {
      pattern: /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
      type: 'date'
    },
    {
      pattern: /\d{4}-\d{2}-\d{2}/,
      type: 'date'
    },
    // Match years (e.g., "2020")
    {
      pattern: /\b20\d{2}\b/,
      type: 'year'
    }
  ];

  for (const { pattern, type } of patterns) {
    if (pattern.test(cleanQuery)) {
      return {
        query: cleanQuery,
        type: type,
        originalQuery: query
      };
    }
  }
  
  return {
    query: cleanQuery,
    type: 'unknown',
    originalQuery: query
  };
};

router.get('/analyze', async (req, res) => {
  try {
    const { query } = req.query;
    const parsedQuery = parseQuery(query);

    // Search Knowledge Graph for information
    const kgResponse = await axios.get(
      'https://kgsearch.googleapis.com/v1/entities:search',
      {
        params: {
          query: parsedQuery.query,
          key: GOOGLE_API_KEY,
          limit: 1,
          languages: 'en'
        }
      }
    );

    let eventDate;

    if (!kgResponse.data.itemListElement || kgResponse.data.itemListElement.length === 0) {
      // If no Knowledge Graph result, try to determine date from query directly
      if (parsedQuery.type === 'date') {
        eventDate = new Date(parsedQuery.query).toISOString().split('T')[0];
      } else if (parsedQuery.type === 'year') {
        eventDate = `${parsedQuery.query}-01-01`;
      } else {
        return res.status(400).json({
          error: 'Could not understand the date or product. Try something like "since iPhone 5 release" or "since January 2020"'
        });
      }
    } else {
      const item = kgResponse.data.itemListElement[0].result;
      console.log('Knowledge Graph Response:', JSON.stringify(item, null, 2));

      // Try to extract date from Knowledge Graph result
      if (item.detailedDescription?.articleBody) {
        // Look for dates in the description
        const dateMatch = item.detailedDescription.articleBody.match(
          /\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/
        ) || item.detailedDescription.articleBody.match(
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(19|20)\d{2}\b/
        );

        if (dateMatch) {
          eventDate = new Date(dateMatch[0]).toISOString().split('T')[0];
        }
      }
    }

    if (!eventDate) {
      return res.status(400).json({ 
        error: 'Could not determine the date. Please try a more specific query.'
      });
    }

    // Get stock data since the event date
    const stockResponse = await axios.get(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPY&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`
    );

    if (!stockResponse.data['Time Series (Daily)']) {
      return res.status(400).json({ error: 'No stock market data available' });
    }

    const timeSeriesData = stockResponse.data['Time Series (Daily)'];
    
    // Find closest date after event
    const dates = Object.keys(timeSeriesData)
      .sort()
      .filter(date => date >= eventDate);

    if (dates.length === 0) {
      return res.status(400).json({ error: 'No market data available for this date range' });
    }

    const startDate = dates[0];
    const startPrice = parseFloat(timeSeriesData[startDate]['4. close']);
    const latestDate = Object.keys(timeSeriesData)[0];
    const currentPrice = parseFloat(timeSeriesData[latestDate]['4. close']);
    const percentChange = ((currentPrice - startPrice) / startPrice * 100).toFixed(2);

    // Get additional stock data
    const topStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const stockComparisons = await Promise.all(
      topStocks.map(async (symbol) => {
        try {
          const response = await axios.get(
            `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`
          );

          const data = response.data['Time Series (Daily)'];
          if (!data) return null;

          const stockStartDate = dates[0];
          const stockStartPrice = parseFloat(data[stockStartDate]['4. close']);
          const stockCurrentPrice = parseFloat(data[latestDate]['4. close']);
          const stockPercentChange = ((stockCurrentPrice - stockStartPrice) / stockStartPrice * 100).toFixed(2);

          return {
            symbol,
            startPrice: stockStartPrice,
            currentPrice: stockCurrentPrice,
            percentChange: parseFloat(stockPercentChange)
          };
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          return null;
        }
      })
    );

    res.json({
      event: {
        name: parsedQuery.query,
        description: `Analysis starting from ${new Date(eventDate).toLocaleDateString()}`,
        date: eventDate
      },
      market: {
        symbol: 'SPY',
        startDate,
        startPrice,
        currentDate: latestDate,
        currentPrice,
        percentChange: parseFloat(percentChange)
      },
      comparisons: stockComparisons.filter(stock => stock !== null)
    });

  } catch (error) {
    console.error('Event analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze event',
      details: error.message
    });
  }
});

module.exports = router;