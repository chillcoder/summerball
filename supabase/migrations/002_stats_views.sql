-- Reusable CTE for per-player stats over any set of at-bats.
-- Used by both season and per-game views.

create or replace view player_season_stats as
with ab_counts as (
  select
    ab.player_id,
    p.team_id,
    p.name as player_name,
    count(distinct ab.game_id) as games_played,
    -- Official AB: exclude BB and SAC
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
  where g.status = 'final'
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
  -- AVG: hits / AB (null-safe)
  case when ab > 0 then round(hits::numeric / ab, 3) else 0 end as avg,
  -- OBP: (hits + bb) / (ab + bb + sac)
  case when (ab + walks + sac) > 0
    then round((hits + walks)::numeric / (ab + walks + sac), 3)
    else 0
  end as obp,
  -- SLG: total bases / AB
  case when ab > 0
    then round((singles + doubles*2 + triples*3 + home_runs*4)::numeric / ab, 3)
    else 0
  end as slg,
  -- OPS: OBP + SLG
  case when ab > 0
    then round(
      (hits + walks)::numeric / nullif(ab + walks + sac, 0) +
      (singles + doubles*2 + triples*3 + home_runs*4)::numeric / ab,
      3
    )
    else 0
  end as ops
from ab_counts;

-- Per-game stats for a player (for game history on player card)
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
  where g.status = 'final'
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

-- Game box score view
create or replace view game_box_score as
select
  ab.game_id,
  ab.player_id,
  p.name as player_name,
  gl.batting_position,
  count(*) filter (where ab.outcome not in ('BB','SAC') and ab.is_pending = false) as ab,
  count(*) filter (where ab.outcome in ('1B','2B','3B','HR') and ab.is_pending = false) as hits,
  count(*) filter (where ab.outcome = 'HR' and ab.is_pending = false) as home_runs,
  sum(ab.rbis) filter (where ab.is_pending = false) as rbi,
  count(*) filter (where ab.outcome = 'BB' and ab.is_pending = false) as walks,
  count(*) filter (where ab.outcome = 'K' and ab.is_pending = false) as strikeouts
from at_bats ab
join players p on p.id = ab.player_id
left join game_lineups gl on gl.game_id = ab.game_id and gl.player_id = ab.player_id
group by ab.game_id, ab.player_id, p.name, gl.batting_position
order by gl.batting_position nulls last, p.name;
