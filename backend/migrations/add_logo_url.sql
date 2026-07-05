-- Run this in your Supabase SQL editor to enable school logos
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
