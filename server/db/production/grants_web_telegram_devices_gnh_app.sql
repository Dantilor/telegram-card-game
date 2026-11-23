-- Production grants for web_telegram_devices to app role gnh_app.
-- Apply on gnh_supabase after 024_web_telegram_devices.sql.
-- Safe to re-run. Does not alter plans/tariffs or migrations 012–023.

DO $$
BEGIN
  IF current_database() IS DISTINCT FROM 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing grants outside gnh_supabase (got %)', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_app') THEN
    RAISE EXCEPTION 'role gnh_app does not exist';
  END IF;
  IF to_regclass('public.web_telegram_devices') IS NULL THEN
    RAISE EXCEPTION 'web_telegram_devices missing — apply 024 before grants';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO gnh_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE web_telegram_devices TO gnh_app;