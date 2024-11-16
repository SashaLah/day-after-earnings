// server/scripts/migrateFieldNames.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company, Earnings } = require('../db/mongodb');

async function migrateFieldNames() {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        // First, create a backup of existing data
        console.log('Creating backup of existing earnings records...');
        const existingEarnings = await Earnings.find().lean();
        
        // Save backup to file
        const fs = require('fs');
        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, `earnings_backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(existingEarnings, null, 2));
        console.log(`Backup created at: ${backupPath}`);

        // Migrate the field names
        console.log('\nMigrating field names...');
        const results = await Earnings.updateMany(
            {}, // Match all documents
            [{
                $set: {
                    // Map old field names to new ones
                    closePriceDayBefore: '$preEarningsClose',
                    closePriceOnDay: '$postEarningsClose',
                    // Remove old fields
                    preEarningsClose: '$$REMOVE',
                    postEarningsClose: '$$REMOVE',
                    earningsEffect: '$$REMOVE'
                }
            }]
        );

        console.log('\nMigration Summary:');
        console.log(`Total documents processed: ${results.matchedCount}`);
        console.log(`Documents modified: ${results.modifiedCount}`);

        // Verify the migration
        const verifyCount = await Earnings.countDocuments({
            closePriceDayBefore: { $exists: true },
            closePriceOnDay: { $exists: true }
        });
        
        console.log(`\nVerification: ${verifyCount} records have new field names`);

        // Show sample of migrated data
        const sampleRecord = await Earnings.findOne().lean();
        console.log('\nSample migrated record:');
        console.log(JSON.stringify(sampleRecord, null, 2));

        console.log('\nMigration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if script is called directly
if (require.main === module) {
    migrateFieldNames();
}

module.exports = migrateFieldNames;