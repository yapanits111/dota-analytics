CREATE TABLE IF NOT EXISTS heroes (
  hero_id      INT PRIMARY KEY,
  name         TEXT NOT NULL,
  local_name   TEXT,
  primary_attr TEXT,
  attack_type  TEXT,
  roles        TEXT[]
);

CREATE TABLE IF NOT EXISTS matches (
  match_id    BIGINT PRIMARY KEY,
  duration    INT,
  game_mode   INT,
  start_time  TIMESTAMP,
  patch       TEXT,
  radiant_win BOOLEAN
);

CREATE TABLE IF NOT EXISTS player_matches (
  match_id    BIGINT REFERENCES matches(match_id),
  account_id  BIGINT,
  hero_id     INT REFERENCES heroes(hero_id),
  kills       INT,
  deaths      INT,
  assists     INT,
  gpm         INT,
  xpm         INT,
  last_hits   INT,
  denies      INT,
  net_worth   INT,
  won         BOOLEAN,
  player_slot INT,
  PRIMARY KEY (match_id, account_id)
);

CREATE OR REPLACE VIEW hero_win_rates AS
SELECT
  pm.account_id,
  h.local_name                                          AS hero,
  h.primary_attr,
  COUNT(*)                                              AS games,
  SUM(pm.won::int)                                      AS wins,
  ROUND(100.0 * SUM(pm.won::int) / COUNT(*), 1)        AS win_rate,
  ROUND(AVG(pm.kills), 1)                               AS avg_kills,
  ROUND(AVG(pm.deaths), 1)                              AS avg_deaths,
  ROUND(AVG(pm.assists), 1)                             AS avg_assists,
  ROUND(AVG(pm.gpm), 0)                                 AS avg_gpm
FROM player_matches pm
JOIN heroes h ON pm.hero_id = h.hero_id
GROUP BY pm.account_id, h.hero_id, h.local_name, h.primary_attr;

CREATE OR REPLACE VIEW duration_performance AS
SELECT
  pm.account_id,
  CASE
    WHEN m.duration < 1200 THEN 'early (<20 min)'
    WHEN m.duration < 2100 THEN 'mid (20-35 min)'
    ELSE 'late (>35 min)'
  END                                                   AS bucket,
  COUNT(*)                                              AS games,
  SUM(pm.won::int)                                      AS wins,
  ROUND(100.0 * SUM(pm.won::int) / COUNT(*), 1)        AS win_rate
FROM player_matches pm
JOIN matches m ON pm.match_id = m.match_id
GROUP BY pm.account_id, bucket;
