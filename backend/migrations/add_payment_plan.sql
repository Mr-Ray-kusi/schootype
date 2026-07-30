-- Run in Supabase SQL editor for payment plan support
ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_plan TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS initial_password TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;
