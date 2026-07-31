-- Attendance punctuality + denormalized person labels
-- Run in Supabase SQL editor.

ALTER TABLE schools ADD COLUMN IF NOT EXISTS late_after_time TEXT DEFAULT '08:00';

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_label TEXT;
-- status values: early | late | present (legacy)
