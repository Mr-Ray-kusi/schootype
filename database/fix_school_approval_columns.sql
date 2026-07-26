-- REQUIRED for school signup → super-admin approval.
-- Paste into Supabase → SQL Editor → Run.
-- Then also run: database/supabase_backend_access.sql

ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_plan TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_status TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS initial_password TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS scanner_token TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS next_payment_due DATE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_payment_at DATE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_started_at DATE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS role TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_scanner_token
  ON schools (scanner_token)
  WHERE scanner_token IS NOT NULL;

-- Subscription payment history (used when recording payments)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  plan TEXT,
  plan_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'GHS',
  payment_reference TEXT,
  momo_phone TEXT,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS plan_name TEXT;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_school
  ON subscription_payments (school_id, created_at DESC);

-- Backend uses its own JWT auth (not Supabase Auth) — disable RLS on tenant tables.
ALTER TABLE IF EXISTS schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nonstaffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscription_payments DISABLE ROW LEVEL SECURITY;
