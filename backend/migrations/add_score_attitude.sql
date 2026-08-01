-- Attitude on teacher-entered student scores
-- Run in Supabase SQL editor.

ALTER TABLE student_scores ADD COLUMN IF NOT EXISTS attitude TEXT;
