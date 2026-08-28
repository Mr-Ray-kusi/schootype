-- Platform usage telemetry for super-admin analytics (GES / municipality).
-- Run in the Supabase SQL editor, or with database/migrations.sql.

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  school_name TEXT,
  email TEXT,
  role TEXT,
  event_type TEXT NOT NULL,
  path TEXT,
  duration_ms INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created
  ON platform_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_type_created
  ON platform_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_school_created
  ON platform_events (school_id, created_at DESC);

ALTER TABLE IF EXISTS platform_events DISABLE ROW LEVEL SECURITY;
