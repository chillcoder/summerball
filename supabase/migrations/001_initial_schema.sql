-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  is_guest boolean not null default false,
  joined_at timestamptz not null default now()
);

-- Games
create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  played_at date not null default current_date,
  opponent text,
  lineup_mode text not null default 'continuous' check (lineup_mode in ('continuous', 'fixed')),
  final_score_us int,
  final_score_them int,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  notes text,
  created_at timestamptz not null default now()
);

-- Game lineups
create table game_lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  batting_position int,
  status text not null default 'played' check (status in ('played', 'dnp', 'bench')),
  unique(game_id, player_id)
);

-- At-bats
create table at_bats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  sequence_in_game int not null,
  outcome text not null check (outcome in ('1B','2B','3B','HR','BB','K','groundout','flyout','lineout','FC','ROE','SAC')),
  rbis int not null default 0,
  runs_scored int not null default 0,
  recorded_by_user_id uuid references auth.users(id),
  recorded_at timestamptz not null default now(),
  is_pending boolean not null default false,
  was_self_ab boolean not null default false,
  unique(game_id, sequence_in_game)
);

-- Team members (auth users tied to teams)
create table team_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'recorder', 'viewer')),
  invited_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

-- Magic link tokens for pinch-recorder handoff
create table game_tokens (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  token text not null unique,
  created_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index on players(team_id);
create index on games(team_id, played_at desc);
create index on game_lineups(game_id);
create index on at_bats(game_id, sequence_in_game);
create index on at_bats(player_id);
create index on team_members(user_id);
