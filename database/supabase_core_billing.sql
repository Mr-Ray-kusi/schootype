-- Schooltype core billing columns on public.schools
-- Run this FIRST in the Supabase SQL Editor.

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS payment_plan TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'pending';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan_selected_at TIMESTAMPTZ;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS initial_password TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_schools_email ON public.schools (email);
CREATE INDEX IF NOT EXISTS idx_schools_plan_status ON public.schools (plan_status);
