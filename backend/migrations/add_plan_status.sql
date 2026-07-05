-- Run in Supabase SQL editor for plan approval workflow
ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_plan TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'pending';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;
