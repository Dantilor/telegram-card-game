-- Allow digits 0 and 1 in Infected room codes.
-- Server generates numericRoomCode() as 100000–999999 (includes 0 and 1).
-- Production gnh_supabase already fixed manually — this migration is idempotent.
-- Safe to re-run.

DO $$
BEGIN
  IF to_regclass('public.infected_rooms') IS NULL THEN
    RAISE NOTICE '015_infected_rooms_code_digits: infected_rooms missing, skip';
    RETURN;
  END IF;

  ALTER TABLE public.infected_rooms
    DROP CONSTRAINT IF EXISTS infected_rooms_code_format;

  ALTER TABLE public.infected_rooms
    ADD CONSTRAINT infected_rooms_code_format
    CHECK (code ~ '^[A-Z0-9]{6}$');
END $$;
