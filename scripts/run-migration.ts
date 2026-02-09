/**
 * Run SQL migration file
 * Usage: npx tsx scripts/run-migration.ts <migration-file.sql>
 */

import 'dotenv/config';
import { pool } from '../server/db';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Please provide a migration file name');
    console.error('Usage: npx tsx scripts/run-migration.ts <migration-file.sql>');
    process.exit(1);
  }

  const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  console.log(`🔧 Running migration: ${migrationFile}`);

  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
