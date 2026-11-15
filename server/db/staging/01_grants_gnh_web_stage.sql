-- Staging-only grants for the Timeweb app LOGIN role `gnh_web_stage`.
-- Run only while connected to database `gnh_web_staging`.
-- Does NOT touch gnh_supabase. Does NOT REVOKE/GRANT/ALTER on production objects.
-- Does NOT grant membership in production role `gnh_app` (cluster-wide).
-- Role `gnh_web_stage` must already exist (create LOGIN in Timeweb panel).

DO $$
BEGIN
  IF current_database() = 'gnh_supabase' THEN
    RAISE EXCEPTION 'refusing grants on production database gnh_supabase';
  END IF;
  IF current_database() IS DISTINCT FROM 'gnh_web_staging' THEN
    RAISE EXCEPTION 'refusing grants outside gnh_web_staging (got %)', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gnh_web_stage') THEN
    RAISE EXCEPTION 'role gnh_web_stage does not exist — create the LOGIN role in Timeweb first';
  END IF;

  -- Hard stop if someone already made gnh_web_stage a member of gnh_app.
  IF EXISTS (
    SELECT 1
      FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      JOIN pg_roles u ON u.oid = m.member
     WHERE r.rolname = 'gnh_app'
       AND u.rolname = 'gnh_web_stage'
  ) THEN
    RAISE EXCEPTION 'gnh_web_stage is a member of gnh_app — revoke that membership manually before staging grants (cluster-wide; do not alter from gnh_supabase)';
  END IF;
END $$;

-- CONNECT / USAGE: skip when already present (idempotent; migrate role may lack GRANT OPTION).
DO $$
BEGIN
  IF NOT has_database_privilege('gnh_web_stage', 'gnh_web_staging', 'CONNECT') THEN
    EXECUTE 'GRANT CONNECT ON DATABASE gnh_web_staging TO gnh_web_stage';
  END IF;
  IF NOT has_schema_privilege('gnh_web_stage', 'public', 'USAGE') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO gnh_web_stage';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  users,
  subscriptions,
  payments,
  events,
  plans,
  legal_document_versions,
  legal_document_activations,
  legal_evidence,
  legal_preferences,
  marketing_queue,
  web_sessions,
  web_oidc_states,
  web_oidc_token_replays,
  web_accounts,
  web_entitlements,
  web_telegram_links,
  web_telegram_link_challenges,
  web_email_otps,
  web_payments,
  web_rate_buckets,
  sled_rooms,
  sled_participants,
  sled_room_events,
  mafia_rooms,
  mafia_players,
  mafia_actions,
  mafia_events,
  doubles_rooms,
  doubles_players,
  infected_rooms,
  infected_players
TO gnh_web_stage;

DO $$
DECLARE
  seq text;
BEGIN
  FOREACH seq IN ARRAY ARRAY[
    'payments_id_seq',
    'events_id_seq',
    'legal_document_versions_id_seq',
    'legal_document_activations_id_seq',
    'legal_evidence_id_seq',
    'marketing_queue_id_seq',
    'web_sessions_id_seq',
    'web_entitlements_id_seq',
    'web_telegram_links_id_seq',
    'web_telegram_link_challenges_id_seq',
    'web_email_otps_id_seq',
    'sled_room_events_id_seq',
    'mafia_actions_id_seq',
    'mafia_events_id_seq'
  ]
  LOOP
    IF to_regclass(seq) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I TO gnh_web_stage', seq);
    END IF;
  END LOOP;
END $$;

-- Dedicated RLS policies for gnh_web_stage only (no inheritance from gnh_app).
DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'sled_rooms', 'sled_participants', 'sled_room_events',
    'mafia_rooms', 'mafia_players', 'mafia_actions', 'mafia_events',
    'doubles_rooms', 'doubles_players',
    'infected_rooms', 'infected_players'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS party_gnh_web_stage_backend ON %I', rel);
    EXECUTE format(
      'CREATE POLICY party_gnh_web_stage_backend ON %I FOR ALL TO gnh_web_stage USING (true) WITH CHECK (true)',
      rel
    );
  END LOOP;
END $$;
