-- Schooltype backend access for custom JWT server (not Supabase Auth)
-- Run this AFTER database/supabase_core_billing.sql in the Supabase SQL Editor.
--
-- Your Node backend must use SUPABASE_SERVICE_ROLE_KEY (Project Settings → API).
-- The service role bypasses RLS. Do NOT put the service role key in frontend code.

-- Ensure RLS is enabled (safe even if already on)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Optional: allow authenticated Supabase users read-only (not required for this app).
-- The Schooltype Express API uses the service role and does not rely on these policies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schools' AND policyname = 'schools_service_role_all'
  ) THEN
    -- Explicit policy for service_role (belt-and-suspenders; service role already bypasses RLS)
    CREATE POLICY schools_service_role_all
      ON public.schools
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- If students/staffs/nonstaffs also block inserts under anon key, grant service_role there too.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['students', 'staffs', 'nonstaffs']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_service_role_all'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
          t || '_service_role_all',
          t
        );
      END IF;
    END IF;
  END LOOP;
END $$;
