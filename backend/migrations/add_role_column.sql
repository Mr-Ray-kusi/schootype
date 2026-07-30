-- Run this in your Supabase SQL editor to enable super admin roles
ALTER TABLE schools ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
