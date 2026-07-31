-- Email ownership verification for school admin signup (magic link).
-- Run in Supabase SQL editor (also included in database/supabase_core_billing.sql).

ALTER TABLE schools ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Existing accounts stay usable; new signups set email_verified = false explicitly.
UPDATE schools
SET email_verified = TRUE
WHERE email_verified IS NULL;

CREATE INDEX IF NOT EXISTS idx_schools_email_verification_token
  ON schools (email_verification_token)
  WHERE email_verification_token IS NOT NULL;
