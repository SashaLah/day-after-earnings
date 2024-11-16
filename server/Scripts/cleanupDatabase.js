// server/scripts/cleanupDatabase.js

const path = require('path');
const fs = require('fs').promises;
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB, Company, Earnings } = require('../db/mongodb');

async function cleanupDatabase() {
    try {
        console.log('Starting database cleanup...');
        console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Missing');
        
        await connectDB();
        console.log('Connected to MongoDB successfully');

        // Create backups directory
        const backupDir = path.join(__dirname, '../../backups');
        console.log('Creating backup directory at:', backupDir);
        await fs.mkdir(backupDir, { recursive: true });

        // Backup companies
        console.log('\nBacking up companies...');
        const companies = await Company.find().lean();
        console.log(`Found ${companies.length} companies to backup`);
        
        const companyBackupPath = path.join(backupDir, `companies_backup_${Date.now()}.json`);
        await fs.writeFile(
            companyBackupPath,
            JSON.stringify(companies, null, 2)
        );
        console.log('Companies backup created at:', companyBackupPath);

        // Backup earnings
        console.log('\nBacking up earnings...');
        const earnings = await Earnings.find().lean();
        console.log(`Found ${earnings.length} earnings records to backup`);
        
        const earningsBackupPath = path.join(backupDir, `earnings_backup_${Date.now()}.json`);
        await fs.writeFile(
            earningsBackupPath,
            JSON.stringify(earnings, null, 2)
        );
        console.log('Earnings backup created at:', earningsBackupPath);

        // Clear earnings data
        console.log('\nClearing earnings collection...');
        const deleteResult = await Earnings.deleteMany({});
        console.log(`Deleted ${deleteResult.deletedCount} earnings records`);

        // Reset company lastUpdated fields
        console.log('\nResetting company lastUpdated timestamps...');
        const updateResult = await Company.updateMany({}, { 
            $set: { 
                lastUpdated: null 
            }
        });
        console.log(`Updated ${updateResult.modifiedCount} company records`);

        // Verify cleanup
        const remainingEarnings = await Earnings.countDocuments();
        console.log('\nVerification:');
        console.log(`Remaining earnings records: ${remainingEarnings}`);
        
        const companiesWithLastUpdated = await Company.countDocuments({ lastUpdated: { $ne: null } });
        console.log(`Companies with lastUpdated: ${companiesWithLastUpdated}`);

        console.log('\nDatabase cleanup completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\nCleanup failed with error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

if (require.main === module) {
    cleanupDatabase();
}

module.exports = cleanupDatabase;