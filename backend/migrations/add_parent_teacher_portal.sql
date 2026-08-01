-- Student photo + parent details + teacher portal fields
-- Run in Supabase SQL editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_relationship TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS house_address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_number TEXT;

ALTER TABLE staffs ADD COLUMN IF NOT EXISTS secret_code TEXT;
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS subjects TEXT;
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS class_names TEXT;
ALTER TABLE staffs ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS staff_portal_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_staff_portal_token
  ON schools (staff_portal_token)
  WHERE staff_portal_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staffs(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  class_name TEXT,
  term TEXT DEFAULT 'Term 1',
  score NUMERIC,
  max_score NUMERIC DEFAULT 100,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_scores_school
  ON student_scores (school_id, subject);

CREATE INDEX IF NOT EXISTS idx_student_scores_student
  ON student_scores (student_id);
