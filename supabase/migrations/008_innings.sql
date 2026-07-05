-- Inning tracking. Every at-bat is tagged with the inning it happened in
-- (enables per-inning box scores later), and the game remembers its current
-- inning so a mid-game reload resumes correctly.
alter table at_bats add column if not exists inning int not null default 1;
alter table games add column if not exists current_inning int not null default 1;
