-- Run in Supabase SQL editor if these columns are missing
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS house_address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
