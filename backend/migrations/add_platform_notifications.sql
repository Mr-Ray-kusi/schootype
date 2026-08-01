-- Platform notifications (super admin ↔ schools) + subscription reminder tracking
-- Run in Supabase SQL editor.

ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_due_reminder_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS platform_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('super_admin', 'school')),
  parent_id UUID REFERENCES platform_notifications(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'message',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_school
  ON platform_notifications (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_notifications_unread
  ON platform_notifications (school_id)
  WHERE read_at IS NULL AND sender_role = 'super_admin';

CREATE INDEX IF NOT EXISTS idx_platform_notifications_parent
  ON platform_notifications (parent_id);
