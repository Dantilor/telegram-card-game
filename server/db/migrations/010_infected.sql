-- Заражённые
-- Next migration after 009_doubles.sql.
-- Backend DATABASE_URL keeps access. No client policies.

begin;

create table if not exists public.infected_rooms (
  id uuid primary key default gen_random_uuid(),
  code varchar(6) not null unique,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'briefing', 'operations', 'council', 'result', 'ended')),
  round integer not null default 0 check (round >= 0),
  max_rounds integer not null default 4 check (max_rounds between 1 and 12),
  tasks_done integer not null default 0 check (tasks_done >= 0),
  task_target integer not null default 0 check (task_target >= 0),
  crew_score integer not null default 0 check (crew_score >= 0),
  infection_level integer not null default 0 check (infection_level between 0 and 100),
  systems_json jsonb not null default '{"power":100,"lab":100,"comms":100,"life":100}'::jsonb,
  event_json jsonb not null default '{}'::jsonb,
  winner text check (winner is null or winner in ('crew', 'infected')),
  host_id uuid,
  lab_compromised_round integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint infected_rooms_code_format check (code ~ '^[A-Z2-9]{6}$')
);

create table if not exists public.infected_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.infected_rooms(id) on delete cascade,
  name varchar(20) not null,
  token varchar(96) not null unique,
  is_host boolean not null default false,
  job text not null default 'crew',
  infection_status text not null default 'healthy'
    check (infection_status in ('healthy', 'latent', 'active')),
  awaken_round integer not null default 0,
  original_infected boolean not null default false,
  quarantined boolean not null default false,
  ready boolean not null default false,
  task_done_round integer not null default 0,
  vote_target_id uuid references public.infected_players(id) on delete set null,
  dark_action_round integer not null default 0,
  conversion_used boolean not null default false,
  special_action_round integer not null default 0,
  protected_round integer not null default 0,
  analysis_text text not null default '',
  private_notice text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_infected_players_room_id
  on public.infected_players (room_id, created_at);

create index if not exists idx_infected_rooms_updated_at
  on public.infected_rooms (updated_at);

alter table public.infected_rooms
  drop constraint if exists infected_rooms_host_id_fkey;

alter table public.infected_rooms
  add constraint infected_rooms_host_id_fkey
  foreign key (host_id) references public.infected_players(id)
  on delete set null deferrable initially deferred;

alter table public.infected_rooms enable row level security;
alter table public.infected_players enable row level security;

revoke all on table public.infected_rooms from public;
revoke all on table public.infected_players from public;
grant all on table public.infected_rooms to current_user;
grant all on table public.infected_players to current_user;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.infected_rooms from anon';
    execute 'revoke all on table public.infected_players from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.infected_rooms from authenticated';
    execute 'revoke all on table public.infected_players from authenticated';
  end if;
end $$;

commit;
