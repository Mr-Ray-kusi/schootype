ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS form TEXT;

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects (school_id);
