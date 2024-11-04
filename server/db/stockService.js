const { Company, Earnings, PriceHistory } = require('./mongodb');

const stockService = {
  async upsertCompany(symbol, name) {
    try {
      console.log(`MongoDB: Upserting company data for ${symbol}`);
      const result = await Company.findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { name },
        { upsert: true, new: true }
      );
      console.log(`MongoDB: Company data upserted successfully for ${symbol}`);
      return result;
    } catch (error) {
      console.error('MongoDB Error upserting company:', error);
      throw error;
    }
  },

  async getEarningsData(symbol) {
    try {
      console.log(`MongoDB: Fetching earnings data for ${symbol}`);
      const data = await Earnings.find({ symbol: symbol.toUpperCase() })
        .sort({ date: -1 })
        .lean();
      console.log(`MongoDB: Found ${data.length} earnings records for ${symbol}`);
      return data;
    } catch (error) {
      console.error('MongoDB Error getting earnings data:', error);
      throw error;
    }
  },

  async upsertEarnings(symbol, earningsData) {
    try {
      console.log(`MongoDB: Upserting ${earningsData.length} earnings records for ${symbol}`);
      const operations = earningsData.map(earning => ({
        updateOne: {
          filter: { 
            symbol: symbol.toUpperCase(), 
            date: new Date(earning.date)
          },
          update: { 
            $set: { 
              symbol: symbol.toUpperCase(),
              date: new Date(earning.date),
              lastUpdated: new Date() 
            }
          },
          upsert: true
        }
      }));

      const result = await Earnings.bulkWrite(operations);
      console.log(`MongoDB: Successfully upserted earnings for ${symbol}:`, {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });
      return result;
    } catch (error) {
      console.error('MongoDB Error upserting earnings:', error);
      console.error('Sample data causing error:', earningsData[0]);
      throw error;
    }
  },

  async getPriceData(symbol, fromDate, toDate) {
    try {
      console.log(`MongoDB: Fetching price data for ${symbol} from ${fromDate} to ${toDate}`);
      const data = await PriceHistory.find({
        symbol: symbol.toUpperCase(),
        date: {
          $gte: new Date(fromDate),
          $lte: new Date(toDate)
        }
      })
      .sort({ date: 1 })
      .lean();
      console.log(`MongoDB: Found ${data.length} price records for ${symbol}`);
      return data;
    } catch (error) {
      console.error('MongoDB Error getting price data:', error);
      console.error('Query parameters:', { symbol, fromDate, toDate });
      throw error;
    }
  },

  async upsertPrices(symbol, priceData) {
    try {
      console.log(`MongoDB: Upserting ${priceData.length} price records for ${symbol}`);
      
      // Validate and transform price data
      const validatedPriceData = priceData.map(price => ({
        symbol: symbol.toUpperCase(),
        date: new Date(price.date),
        open: parseFloat(price.open),
        close: parseFloat(price.close)
      }));

      // Create bulk operations
      const operations = validatedPriceData.map(price => ({
        updateOne: {
          filter: { 
            symbol: price.symbol, 
            date: price.date
          },
          update: { 
            $set: { 
              ...price,
              lastUpdated: new Date()
            }
          },
          upsert: true
        }
      }));

      // Log sample operation for debugging
      if (operations.length > 0) {
        console.log('MongoDB: Sample price operation:', JSON.stringify(operations[0], null, 2));
      }

      const result = await PriceHistory.bulkWrite(operations);
      console.log(`MongoDB: Successfully upserted prices for ${symbol}:`, {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });
      return result;
    } catch (error) {
      console.error('MongoDB Error upserting prices:', error);
      if (priceData.length > 0) {
        console.error('Sample data causing error:', priceData[0]);
      }
      throw error;
    }
  },

  // Utility function to check data validity
  async verifyData(symbol) {
    try {
      const earnings = await Earnings.find({ symbol: symbol.toUpperCase() }).count();
      const prices = await PriceHistory.find({ symbol: symbol.toUpperCase() }).count();
      return {
        symbol,
        earningsCount: earnings,
        pricesCount: prices,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('MongoDB Error verifying data:', error);
      throw error;
    }
  }
};

module.exports = stockService;