const { Company, Earnings, PriceHistory } = require('./mongodb');

const stockService = {
  async upsertCompany(symbol, name) {
    try {
      console.log(`MongoDB: Upserting company data for ${symbol}`);
      return await Company.findOneAndUpdate(
        { symbol: symbol.toUpperCase() },
        { name },
        { upsert: true, new: true }
      );
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
      console.log(`MongoDB: Successfully upserted earnings for ${symbol}`);
      return result;
    } catch (error) {
      console.error('MongoDB Error upserting earnings:', error);
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
      throw error;
    }
  },

  async upsertPrices(symbol, priceData) {
    try {
      if (!Array.isArray(priceData)) {
        console.error('Invalid price data format');
        return;
      }

      console.log(`MongoDB: Upserting ${priceData.length} price records for ${symbol}`);
      
      const operations = priceData.map(price => ({
        updateOne: {
          filter: { 
            symbol: symbol.toUpperCase(), 
            date: new Date(price.date)
          },
          update: { 
            $set: { 
              symbol: symbol.toUpperCase(),
              date: new Date(price.date),
              open: parseFloat(price.open),
              close: parseFloat(price.close),
              lastUpdated: new Date()
            }
          },
          upsert: true
        }
      }));

      const result = await PriceHistory.bulkWrite(operations);
      console.log(`MongoDB: Successfully upserted ${result.nUpserted + result.nModified} price records for ${symbol}`);
      return result;
    } catch (error) {
      console.error('MongoDB Error upserting prices:', error);
      console.error('Sample price data:', priceData[0]);
      throw error;
    }
  },

  async saveNewStockData(symbol, fileData) {
    try {
      const { earnings, prices } = fileData;
      await this.upsertEarnings(symbol, earnings);
      await this.upsertPrices(symbol, prices);
      console.log(`MongoDB: Successfully saved all data for ${symbol}`);
    } catch (error) {
      console.error('Error saving new stock data:', error);
      throw error;
    }
  }
};

module.exports = stockService;