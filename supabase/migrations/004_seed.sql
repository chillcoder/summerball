-- Dev seed: one team with a full roster
-- Run manually in Supabase SQL editor or with `supabase db seed`

insert into teams (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Summer Ball');

insert into players (team_id, name, is_active, is_guest) values
  ('00000000-0000-0000-0000-000000000001', 'Lucas', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Mike', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Jake', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Chris', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Tom', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Dave', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Ryan', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Matt', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Kevin', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Steve', true, false),
  ('00000000-0000-0000-0000-000000000001', 'Brian', true, false);
