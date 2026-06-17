-- Fix write access for the single-team, magic-link app.
--
-- The original policies (003) gated all writes on team_members recorder/owner
-- membership via is_team_recorder(), but nothing ever inserts a team_members
-- row — so every authenticated write (create game, add/rename player, save
-- lineup, record at-bat) was blocked by RLS. Per the PRD, read is public and
-- write is "any magic-link-authenticated user", which is what we set here.
--
-- Also: drop the self-referential team_members policy that caused
-- "infinite recursion detected in policy" (42P17), and add the games DELETE
-- policy the test-game cleanup needs (none existed).

-- Players (roster add + rename)
drop policy if exists "players_recorder_insert" on players;
drop policy if exists "players_recorder_update" on players;
create policy "players_auth_insert" on players for insert
  with check (auth.uid() is not null);
create policy "players_auth_update" on players for update
  using (auth.uid() is not null);

-- Games (create / start / finalize / delete test game)
drop policy if exists "games_recorder_insert" on games;
drop policy if exists "games_recorder_update" on games;
create policy "games_auth_insert" on games for insert
  with check (auth.uid() is not null);
create policy "games_auth_update" on games for update
  using (auth.uid() is not null);
create policy "games_auth_delete" on games for delete
  using (auth.uid() is not null);

-- Game lineups
drop policy if exists "lineups_recorder_write" on game_lineups;
drop policy if exists "lineups_recorder_update" on game_lineups;
create policy "lineups_auth_insert" on game_lineups for insert
  with check (auth.uid() is not null);
create policy "lineups_auth_update" on game_lineups for update
  using (auth.uid() is not null);

-- At-bats (record / edit / undo)
drop policy if exists "at_bats_recorder_insert" on at_bats;
drop policy if exists "at_bats_recorder_update" on at_bats;
drop policy if exists "at_bats_recorder_delete" on at_bats;
create policy "at_bats_auth_insert" on at_bats for insert
  with check (auth.uid() is not null);
create policy "at_bats_auth_update" on at_bats for update
  using (auth.uid() is not null);
create policy "at_bats_auth_delete" on at_bats for delete
  using (auth.uid() is not null);

-- Remove the recursive team_members policy (it queried team_members from within
-- a policy ON team_members). Self read/insert policies from 003 remain.
drop policy if exists "team_members_owner_all" on team_members;
