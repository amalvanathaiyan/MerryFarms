-- Row-level security: second lock behind the app's tenant scoping (src/lib/tenant-db.ts).
--
-- The app talks to Postgres through Prisma as the database owner, so these
-- policies do not affect it. They exist to shut the other door: Supabase exposes
-- every public table through its REST API to the "anon" and "authenticated" roles.
-- Enabling RLS with no policies for those roles means the anon key can read or
-- write nothing, even if it leaks.
--
-- Run after every schema change that adds a table: npm run db:rls

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'
  LOOP
    -- ENABLE, not FORCE: the table owner (the app via Prisma) must keep working.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Belt and braces: the public API roles get no table privileges at all.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;
