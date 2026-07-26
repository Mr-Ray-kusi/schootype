-- Run in Supabase SQL editor.
-- Keeps schools, people, attendance, messages, subscriptions, wallets,
-- SMS units, and payment history on Postgres (Supabase).

-- ========== Schools: plans + subscriptions ==========
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_scanner_token
  ON schools (scanner_token)
  WHERE scanner_token IS NOT NULL;

-- ========== Subscription payment history ==========
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

-- ========== Wallets ==========
CREATE TABLE IF NOT EXISTS school_wallets (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  available_balance BIGINT NOT NULL DEFAULT 0,
  pending_balance BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GHS',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT,
  provider TEXT,
  currency TEXT NOT NULL DEFAULT 'GHS',
  paystack_recipient_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_school
  ON wallet_accounts (school_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  fee BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  channel TEXT,
  account_id UUID,
  reference TEXT UNIQUE NOT NULL,
  provider_reference TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_school
  ON wallet_transactions (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference
  ON wallet_transactions (reference);

-- ========== SMS units ==========
CREATE TABLE IF NOT EXISTS platform_sms_settings (
  id TEXT PRIMARY KEY,
  units_available BIGINT NOT NULL DEFAULT 0,
  unit_price_minor BIGINT NOT NULL DEFAULT 5,
  total_revenue_minor BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_sms_settings (id, units_available, unit_price_minor, total_revenue_minor, updated_at)
VALUES ('platform', 0, 5, 0, NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_sms_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_name TEXT,
  units BIGINT NOT NULL,
  amount_minor BIGINT NOT NULL DEFAULT 0,
  recipients_count BIGINT NOT NULL DEFAULT 0,
  segments BIGINT NOT NULL DEFAULT 0,
  reference TEXT UNIQUE NOT NULL,
  message_preview TEXT,
  sale_type TEXT NOT NULL DEFAULT 'broadcast',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_sales_school
  ON platform_sms_sales (school_id);
CREATE INDEX IF NOT EXISTS idx_sms_sales_created
  ON platform_sms_sales (created_at DESC);

CREATE TABLE IF NOT EXISTS school_sms_balances (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  units_available BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
