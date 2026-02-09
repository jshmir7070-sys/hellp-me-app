/**
 * Add address columns to users table
 * Run with: npx tsx scripts/add-address-columns.ts
 */

import 'dotenv/config';
import { pool } from '../server/db';

async function addAddressColumns() {
  console.log('🔧 Adding address columns to users table...');

  try {
    // Add zip_code column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'zip_code'
        ) THEN
          ALTER TABLE users ADD COLUMN zip_code text;
          RAISE NOTICE 'Added zip_code column to users table';
        ELSE
          RAISE NOTICE 'zip_code column already exists';
        END IF;
      END $$;
    `);

    // Add address_detail column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'address_detail'
        ) THEN
          ALTER TABLE users ADD COLUMN address_detail text;
          RAISE NOTICE 'Added address_detail column to users table';
        ELSE
          RAISE NOTICE 'address_detail column already exists';
        END IF;
      END $$;
    `);

    console.log('✅ Address columns added successfully!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addAddressColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
