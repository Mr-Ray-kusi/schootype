-- Student skills (talents) for public ID / school records
-- Run in the Supabase SQL editor if skills are not saving yet.

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS skills TEXT;
