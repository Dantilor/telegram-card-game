-- Optional staging role for party RLS policies (migration 011).
-- Safe if role already exists. Does not touch production roles remotely —
-- run only against the staging database connection.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_app') THEN
    CREATE ROLE gnh_app NOLOGIN;
  END IF;
END $$;
