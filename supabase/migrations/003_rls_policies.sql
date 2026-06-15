-- Row Level Security
alter table teams enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table game_lineups enable row level security;
alter table at_bats enable row level security;
alter table team_members enable row level security;
alter table game_tokens enable row level security;

-- Helper: is the current user a member of a team?
create or replace function is_team_member(tid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from team_members
    where user_id = auth.uid() and team_id = tid
  );
$$;

-- Helper: is the current user a recorder/owner of a team?
create or replace function is_team_recorder(tid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from team_members
    where user_id = auth.uid() and team_id = tid and role in ('owner', 'recorder')
  );
$$;

-- Teams: anyone can read, only members can see details
create policy "teams_public_read" on teams for select using (true);
create policy "teams_member_insert" on teams for insert with check (true); -- first team setup
create policy "teams_owner_update" on teams for update using (is_team_recorder(id));

-- Players: public read, recorders write
create policy "players_public_read" on players for select using (true);
create policy "players_recorder_insert" on players for insert with check (is_team_recorder(team_id));
create policy "players_recorder_update" on players for update using (is_team_recorder(team_id));

-- Games: public read, recorders write
create policy "games_public_read" on games for select using (true);
create policy "games_recorder_insert" on games for insert with check (is_team_recorder(team_id));
create policy "games_recorder_update" on games for update using (is_team_recorder(team_id));

-- Game lineups: public read, recorders write
create policy "lineups_public_read" on game_lineups for select using (true);
create policy "lineups_recorder_write" on game_lineups for insert with check (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);
create policy "lineups_recorder_update" on game_lineups for update using (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);

-- At-bats: public read, recorders write, also allow token-based writes (handled in API)
create policy "at_bats_public_read" on at_bats for select using (true);
create policy "at_bats_recorder_insert" on at_bats for insert with check (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);
create policy "at_bats_recorder_update" on at_bats for update using (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);
create policy "at_bats_recorder_delete" on at_bats for delete using (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);

-- Team members
create policy "team_members_self_read" on team_members for select using (user_id = auth.uid());
create policy "team_members_owner_all" on team_members for all using (
  exists (select 1 from team_members tm where tm.user_id = auth.uid() and tm.team_id = team_id and tm.role = 'owner')
);
create policy "team_members_self_insert" on team_members for insert with check (user_id = auth.uid());

-- Game tokens
create policy "tokens_auth_read" on game_tokens for select using (auth.uid() is not null);
create policy "tokens_recorder_insert" on game_tokens for insert with check (
  exists (select 1 from games g where g.id = game_id and is_team_recorder(g.team_id))
);
create policy "tokens_recorder_update" on game_tokens for update using (created_by = auth.uid());

-- Grant anon/authenticated access to views
grant select on player_season_stats to anon, authenticated;
grant select on player_game_stats to anon, authenticated;
grant select on game_box_score to anon, authenticated;
