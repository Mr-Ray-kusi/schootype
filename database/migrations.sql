-- Run this in your Supabase SQL editor to enable all new features

-- Extend schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ussd_code TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_count_month INT DEFAULT 0;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_month_reset TEXT;

-- Extend students
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'unpaid';

-- Subscription payments (school pays platform)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'GHS',
  payment_reference TEXT,
  momo_phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Fee payments (parents pay school)
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  payer_type TEXT NOT NULL,
  payer_id UUID,
  payer_name TEXT,
  payer_class TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  payment_month TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report card uploads
CREATE TABLE IF NOT EXISTS report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  teacher_name TEXT,
  class_name TEXT,
  course TEXT,
  title TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'Pending',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class fee defaults for USSD
CREATE TABLE IF NOT EXISTS class_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0
);
