-- Store the generated post-game recap so the infographic reads it instead of
-- re-calling Claude on every view. Tolerant: the app falls back to live
-- generation if these columns are absent.
alter table games add column if not exists recap_bullets jsonb;
alter table games add column if not exists recap_source text;
alter table games add column if not exists recap_generated_at timestamptz;

-- Rename the seeded team to match the Beerkats brand used on the infographic.
update teams set name = 'Beerkats'
where id = '00000000-0000-0000-0000-000000000001' and name = 'Summer Ball';
