-- Add zip_code and address_detail columns to users table
-- Migration: Add address fields for detailed address management
-- Date: 2026-02-09

-- Add zip_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE users ADD COLUMN zip_code text;
    RAISE NOTICE 'Added zip_code column to users table';
  ELSE
    RAISE NOTICE 'zip_code column already exists in users table';
  END IF;
END $$;

-- Add address_detail column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'address_detail'
  ) THEN
    ALTER TABLE users ADD COLUMN address_detail text;
    RAISE NOTICE 'Added address_detail column to users table';
  ELSE
    RAISE NOTICE 'address_detail column already exists in users table';
  END IF;
END $$;
