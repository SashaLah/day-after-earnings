// server/scripts/checkApiStatus.js

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

async function checkApiStatus() {
    console.log('\n=== Alpha Vantage API Status Check ===\n');

    // Test simple API call
    try {
        console.log('Testing API key...');
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=${API_KEY}`
        );

        if (response.data.Note) {
            console.log('\n❌ API LIMIT MESSAGE DETECTED:');
            console.log(response.data.Note);
            console.log('\nThis suggests you have hit your API call limit.');
            console.log('Standard API key limits:');
            console.log('- 25 API calls per day for free tier');
            console.log('- 500 API calls per day for paid basic tier');
            console.log('- 5 API calls per minute');
        } else if (response.data['Time Series (Daily)']) {
            console.log('\n✅ API KEY IS VALID AND WORKING');
            console.log('Successfully retrieved market data');
        } else {
            console.log('\n⚠️ UNEXPECTED API RESPONSE:');
            console.log(JSON.stringify(response.data, null, 2));
        }

        // Test earnings endpoint
        console.log('\nTesting earnings endpoint...');
        const earningsResponse = await axios.get(
            `https://www.alphavantage.co/query?function=EARNINGS&symbol=IBM&apikey=${API_KEY}`
        );

        if (earningsResponse.data.Note) {
            console.log('\n❌ API LIMIT MESSAGE ON EARNINGS ENDPOINT:');
            console.log(earningsResponse.data.Note);
        } else if (earningsResponse.data.quarterlyEarnings) {
            console.log('✅ Earnings endpoint working');
        }

    } catch (error) {
        console.log('\n❌ API TEST FAILED');
        if (error.response) {
            console.log('Error status:', error.response.status);
            console.log('Error data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }

    console.log('\n=== API Key Details ===');
    console.log('Your API Key:', API_KEY ? `${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}` : 'NOT FOUND');
    
    if (!API_KEY) {
        console.log('\n❌ NO API KEY FOUND');
        console.log('Make sure your .env file contains: ALPHA_VANTAGE_API_KEY=your_key_here');
    }

    console.log('\n=== Recommendations ===');
    console.log('1. If you\'re hitting limits:');
    console.log('   - Wait until tomorrow for limit reset');
    console.log('   - Consider upgrading your API plan');
    console.log('2. If API key is invalid:');
    console.log('   - Verify key at: https://www.alphavantage.co/support/#api-key');
    console.log('   - Check your .env file configuration');
    console.log('\n3. For immediate testing:');
    console.log('   - Use existing database data');
    console.log('   - Add console.log(process.env.ALPHA_VANTAGE_API_KEY) to verify key');

    process.exit(0);
}

// Run if called directly
if (require.main === module) {
    checkApiStatus();
}

module.exports = checkApiStatus;