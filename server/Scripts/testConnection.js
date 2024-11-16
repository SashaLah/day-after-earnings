// server/scripts/testConnection.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company, Earnings } = require('../db/mongodb');

async function testConnection() {
    try {
        console.log('Testing MongoDB Connection...');
        // Mask password in connection string for safe logging
        const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
        console.log('Using URI:', maskedUri);
        
        await connectDB();
        console.log('Successfully connected to MongoDB!\n');

        // Test Company collection
        const companyCount = await Company.countDocuments();
        console.log(`Found ${companyCount} companies in database`);
        
        // Test Earnings collection
        const earningsCount = await Earnings.countDocuments();
        console.log(`Found ${earningsCount} earnings records in database`);

        // Show sample data if available
        if (companyCount > 0) {
            const sampleCompany = await Company.findOne().lean();
            console.log('\nSample company record:', JSON.stringify(sampleCompany, null, 2));
        }

        if (earningsCount > 0) {
            const sampleEarnings = await Earnings.findOne().lean();
            console.log('\nSample earnings record:', JSON.stringify(sampleEarnings, null, 2));
        }

        // Test indexes
        const companyIndexes = await Company.collection.indexes();
        const earningsIndexes = await Earnings.collection.indexes();
        
        console.log('\nIndexes configured:');
        console.log('Company indexes:', companyIndexes.length);
        console.log('Earnings indexes:', earningsIndexes.length);

        console.log('\nDatabase connection test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\nConnection test failed!');
        console.error('Error details:', error.message);
        console.error('\nPlease verify:');
        console.error('1. Your MongoDB Atlas credentials are correct');
        console.error('2. Your IP address is whitelisted in MongoDB Atlas');
        console.error('3. Your database user has the correct permissions');
        console.error('4. Your connection string format is correct');
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

// Run the test
testConnection();