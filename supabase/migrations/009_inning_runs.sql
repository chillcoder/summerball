-- True runs per inning (our offense). Recorded live with a per-inning stepper,
-- decoupled from RBIs so error/FC runs count too. One row per (game, inning).
create table if not exists game_innings (
  game_id uuid not null references games(id) on delete cascade,
  inning int not null,
  runs int not null default 0,
  primary key (game_id, inning)
);

alter table game_innings enable row level security;

-- Public read (line score is on the public game page); authenticated write,
-- matching the single-team magic-link model from migration 007.
create policy "game_innings_public_read" on game_innings for select using (true);
create policy "game_innings_auth_insert" on game_innings for insert
  with check (auth.uid() is not null);
create policy "game_innings_auth_update" on game_innings for update
  using (auth.uid() is not null);
create policy "game_innings_auth_delete" on game_innings for delete
  using (auth.uid() is not null);
