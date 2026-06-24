-- ============================================================
-- TASKFLOW FULL DATA CLEANUP
-- WARNING: This removes all app data and all login users.
-- Run only when you want a fresh project database.
-- ============================================================

-- Remove all app tables in public schema.
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', table_record.tablename);
  END LOOP;
END $$;

-- Remove all Supabase Auth users: interns, admins, and super admins.
-- Profiles are already cleaned above, but auth users must be deleted too
-- or old accounts can still sign in.
DELETE FROM auth.users;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
