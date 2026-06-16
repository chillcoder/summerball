-- Test / exhibition games: a flag so Lucas can rehearse the full recording flow
-- without polluting season stats. Excluded from the season + per-game stat views
-- below; the per-game box score still shows on the game's own page.
alter table games add column if not exists is_exhibition boolean not null default false;

-- Recreate the season + per-game views with the exhibition filter.
-- (Identical to 002_stats_views.sql except for `and g.is_exhibition = false`.)

create or replace view player_season_stats as
with ab_counts as (
  select
    ab.player_id,
    p.team_id,
    p.name as player_name,
    count(distinct ab.game_id) as games_played,
    count(*) filter (where ab.outcome not in ('BB','SAC') and ab.is_pending = false) as ab,
    count(*) filter (where ab.is_pending = false) as pa,
    count(*) filter (where ab.outcome in ('1B','2B','3B','HR') and ab.is_pending = false) as hits,
    count(*) filter (where ab.outcome = '1B' and ab.is_pending = false) as singles,
    count(*) filter (where ab.outcome = '2B' and ab.is_pending = false) as doubles,
    count(*) filter (where ab.outcome = '3B' and ab.is_pending = false) as triples,
    count(*) filter (where ab.outcome = 'HR' and ab.is_pending = false) as home_runs,
    count(*) filter (where ab.outcome = 'BB' and ab.is_pending = false) as walks,
    count(*) filter (where ab.outcome = 'K' and ab.is_pending = false) as strikeouts,
    count(*) filter (where ab.outcome = 'SAC' and ab.is_pending = false) as sac,
    sum(ab.rbis) filter (where ab.is_pending = false) as rbi,
    sum(ab.runs_scored) filter (where ab.is_pending = false) as runs
  from at_bats ab
  join players p on p.id = ab.player_id
  join games g on g.id = ab.game_id
  where g.status = 'final' and g.is_exhibition = false
  group by ab.player_id, p.team_id, p.name
)
select
  player_id,
  team_id,
  player_name,
  games_played,
  ab,
  pa,
  hits,
  singles,
  doubles,
  triples,
  home_runs,
  walks,
  strikeouts,
  sac,
  rbi,
  runs,
  case when ab > 0 then round(hits::numeric / ab, 3) else 0 end as avg,
  case when (ab + walks + sac) > 0
    then round((hits + walks)::numeric / (ab + walks + sac), 3)
    else 0
  end as obp,
  case when ab > 0
    then round((singles + doubles*2 + triples*3 + home_runs*4)::numeric / ab, 3)
    else 0
  end as slg,
  case when ab > 0
    then round(
      (hits + walks)::numeric / nullif(ab + walks + sac, 0) +
      (singles + doubles*2 + triples*3 + home_runs*4)::numeric / ab,
      3
    )
    else 0
  end as ops
from ab_counts;

create or replace view player_game_stats as
with ab_counts as (
  select
    ab.player_id,
    ab.game_id,
    g.played_at,
    g.opponent,
    count(*) filter (where ab.outcome not in ('BB','SAC') and ab.is_pending = false) as ab,
    count(*) filter (where ab.outcome in ('1B','2B','3B','HR') and ab.is_pending = false) as hits,
    count(*) filter (where ab.outcome = '1B' and ab.is_pending = false) as singles,
    count(*) filter (where ab.outcome = '2B' and ab.is_pending = false) as doubles,
    count(*) filter (where ab.outcome = '3B' and ab.is_pending = false) as triples,
    count(*) filter (where ab.outcome = 'HR' and ab.is_pending = false) as home_runs,
    count(*) filter (where ab.outcome = 'BB' and ab.is_pending = false) as walks,
    count(*) filter (where ab.outcome = 'SAC' and ab.is_pending = false) as sac,
    sum(ab.rbis) filter (where ab.is_pending = false) as rbi
  from at_bats ab
  join games g on g.id = ab.game_id
  where g.status = 'final' and g.is_exhibition = false
  group by ab.player_id, ab.game_id, g.played_at, g.opponent
)
select
  *,
  case when ab > 0 then round(hits::numeric / ab, 3) else 0 end as avg,
  case when (ab + walks + sac) > 0
    then round((hits + walks)::numeric / (ab + walks + sac), 3)
    else 0
  end as obp
from ab_counts
order by played_at desc;
