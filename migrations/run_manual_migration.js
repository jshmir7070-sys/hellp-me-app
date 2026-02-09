/**
 * Manual Migration Runner
 * Adds zip_code and address_detail columns to users table
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hellp_me_db'
  });

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'manual_add_address_fields.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('🔧 Running manual migration: Add address fields to users table');
    console.log('===================================================================');

    // Execute the migration
    const result = await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('Notices:', result);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
