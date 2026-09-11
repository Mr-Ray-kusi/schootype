-- School-to-school in-app chat: who sent the message.
-- school_id = inbox owner / recipient. from_school_id = sending school (null for SCHOOLTYPE admin).
-- Run in Supabase SQL editor if school-to-school messages fail to persist.

ALTER TABLE platform_notifications
  ADD COLUMN IF NOT EXISTS from_school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_notifications_from_school
  ON platform_notifications (from_school_id, created_at DESC);
