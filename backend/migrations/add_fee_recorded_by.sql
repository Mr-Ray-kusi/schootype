ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS recorded_by_role TEXT;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS recorded_by_staff_id UUID;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS recorded_by_name TEXT;
