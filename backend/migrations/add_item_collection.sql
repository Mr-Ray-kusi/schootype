-- Shared collection QR + unit code (hall/SRC item hand-out).
-- Run in the Supabase SQL editor if tables are missing.

CREATE TABLE IF NOT EXISTS item_collection_settings (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  collection_token TEXT UNIQUE NOT NULL,
  unit_code_hash TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_collection_settings_token
  ON item_collection_settings (collection_token);

CREATE TABLE IF NOT EXISTS item_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL,
  person_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  person_label TEXT,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, person_type, person_id)
);

CREATE INDEX IF NOT EXISTS idx_item_collections_school
  ON item_collections (school_id, collected_at DESC);

ALTER TABLE IF EXISTS item_collection_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS item_collections DISABLE ROW LEVEL SECURITY;
