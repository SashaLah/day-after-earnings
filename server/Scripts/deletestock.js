const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

// Company Schema
const companySchema = new mongoose.Schema({
    symbol: String,
    name: String
});

const Company = mongoose.model('Company', companySchema);

// Delete function
const deleteStock = async (symbol) => {
    try {
        // Check if stock exists
        const stock = await Company.findOne({ symbol: symbol.toUpperCase() });
        
        if (!stock) {
            console.log(`Stock ${symbol} not found in database`);
            return;
        }

        // Delete the stock
        await Company.deleteOne({ symbol: symbol.toUpperCase() });
        console.log(`Successfully deleted ${symbol}`);

        // Optional: Show remaining companies
        const remaining = await Company.find({}).lean();
        console.log('\nRemaining companies:', remaining.length);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
};

// Run the script
connectDB().then(() => {
    // Replace 'GOOG' with whatever symbol you want to delete
    deleteStock('GOOG');
});