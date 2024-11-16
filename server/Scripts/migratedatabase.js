// server/scripts/migrateDatabase.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company, Earnings } = require('../db/mongodb');

async function migrateDatabase() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');
        
        // Backup existing data structure
        console.log('\nBacking up existing data...');
        const existingCompanies = await Company.find().lean();
        const existingEarnings = await Earnings.find().lean();
        console.log(`Backed up ${existingCompanies.length} companies and ${existingEarnings.length} earnings records`);

        // Migrate companies
        console.log('\nMigrating companies...');
        const companyOps = existingCompanies.map(company => ({
            updateOne: {
                filter: { symbol: company.symbol },
                update: {
                    $set: {
                        symbol: company.symbol,
                        name: company.name,
                        exchange: company.exchange || 'OTHER',
                        isS500: company.isInSP500 || company.isS500 || false,
                        lastUpdated: new Date(),
                        // Preserve any existing fields that match our schema
                        ...(company.sector && { sector: company.sector }),
                        ...(company.industry && { industry: company.industry })
                    }
                },
                upsert: true
            }
        }));

        if (companyOps.length > 0) {
            const companyResult = await Company.bulkWrite(companyOps);
            console.log(`Updated ${companyResult.modifiedCount + companyResult.upsertedCount} companies`);
        }

        // Migrate earnings with improved error handling
        console.log('\nMigrating earnings records...');
        const earningsOps = existingEarnings.map(earning => {
            // Try to preserve or convert existing price data
            const priceData = {
                preEarningsClose: earning.preEarningsClose || earning.preClose || null,
                postEarningsClose: earning.postEarningsClose || earning.postClose || null
            };

            // Determine report time - preserve existing or default to TNS
            const reportTime = earning.reportTime || 'TNS';

            return {
                updateOne: {
                    filter: { 
                        symbol: earning.symbol,
                        date: earning.date
                    },
                    update: {
                        $set: {
                            symbol: earning.symbol,
                            date: earning.date,
                            reportTime: reportTime,
                            ...priceData,
                            lastUpdated: new Date(),
                            // Preserve any existing EPS data if available
                            ...(earning.estimatedEPS && { estimatedEPS: earning.estimatedEPS }),
                            ...(earning.actualEPS && { actualEPS: earning.actualEPS }),
                            ...(earning.epsSurprise && { epsSurprise: earning.epsSurprise }),
                            ...(earning.epsSurprisePercent && { epsSurprisePercent: earning.epsSurprisePercent }),
                            // Preserve fiscal data if available
                            ...(earning.fiscalQuarter && { fiscalQuarter: earning.fiscalQuarter }),
                            ...(earning.fiscalYear && { fiscalYear: earning.fiscalYear })
                        }
                    },
                    upsert: true
                }
            };
        });

        if (earningsOps.length > 0) {
            const earningsResult = await Earnings.bulkWrite(earningsOps);
            console.log(`Updated ${earningsResult.modifiedCount + earningsResult.upsertedCount} earnings records`);
        }

        // Verify migration
        console.log('\nVerifying migration...');
        const finalCompanyCount = await Company.countDocuments();
        const finalEarningsCount = await Earnings.countDocuments();
        
        console.log('\nMigration Summary:');
        console.log(`- Original Companies: ${existingCompanies.length}`);
        console.log(`- Final Companies: ${finalCompanyCount}`);
        console.log(`- Original Earnings: ${existingEarnings.length}`);
        console.log(`- Final Earnings: ${finalEarningsCount}`);

        // Sample verification
        console.log('\nSample records after migration:');
        const sampleCompany = await Company.findOne({ symbol: 'AAPL' }).lean();
        const sampleEarnings = await Earnings.findOne({ symbol: 'AAPL' }).lean();
        
        console.log('\nSample Company:', JSON.stringify(sampleCompany, null, 2));
        console.log('\nSample Earnings:', JSON.stringify(sampleEarnings, null, 2));

        console.log('\nMigration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\nMigration failed!');
        console.error('Error details:', error);
        
        // Enhanced error logging
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.codeName) {
            console.error('Error codeName:', error.codeName);
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        
        process.exit(1);
    }
}

// Run migration if script is called directly
if (require.main === module) {
    migrateDatabase();
}

module.exports = migrateDatabase;