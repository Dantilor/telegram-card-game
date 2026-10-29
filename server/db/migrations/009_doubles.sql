-- Двойники
-- Next migration after 008_mafia_shadows.sql.
-- Backend DATABASE_URL keeps access. No client policies.

begin;

create table if not exists public.doubles_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  host_token uuid not null default gen_random_uuid(),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'reveal', 'testimony', 'interrogation', 'evidence', 'vote', 'finished')),
  case_key text not null default 'professor',
  phase_ends_at bigint,
  public_message text not null default 'Соберите всех участников расследования.',
  result_player_id uuid,
  created_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  updated_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint)
);

create index if not exists idx_doubles_rooms_updated_at
  on public.doubles_rooms (updated_at);

create table if not exists public.doubles_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.doubles_rooms(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  name text not null,
  avatar integer not null default 0,
  is_host boolean not null default false,
  archetype text check (archetype is null or archetype in ('claimant', 'witness', 'erased')),
  identity_key text,
  identity_title text,
  identity_subtitle text,
  dossier_json jsonb not null default '[]'::jsonb,
  secret_task text not null default '',
  interrogation_prompt text not null default '',
  is_original boolean not null default false,
  hidden_identity text,
  echoes_json jsonb not null default '[]'::jsonb,
  revealed boolean not null default false,
  vote_target_id uuid,
  identity_guess text,
  joined_at bigint not null default ((extract(epoch from clock_timestamp()) * 1000)::bigint),
  constraint doubles_players_room_name_unique unique (room_id, name)
);

create index if not exists idx_doubles_players_room
  on public.doubles_players (room_id);

alter table public.doubles_rooms
  drop constraint if exists doubles_rooms_result_player_id_fkey;

alter table public.doubles_rooms
  add constraint doubles_rooms_result_player_id_fkey
  foreign key (result_player_id) references public.doubles_players(id)
  on delete set null;

alter table public.doubles_rooms enable row level security;
alter table public.doubles_players enable row level security;

revoke all on table public.doubles_rooms from public;
revoke all on table public.doubles_players from public;
grant all on table public.doubles_rooms to current_user;
grant all on table public.doubles_players to current_user;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.doubles_rooms from anon';
    execute 'revoke all on table public.doubles_players from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.doubles_rooms from authenticated';
    execute 'revoke all on table public.doubles_players from authenticated';
  end if;
end $$;

commit;
