-- ============================================================================
-- 20261128090000_hero_stats_v.sql  ·  trust pyramid #9, site counts from the DB
-- STATUS: NOT APPLIED. Art applies it. Until then scripts/site-stats.mjs logs a notice
-- and leaves hero/stats.json as committed.
--
-- WHAT IT GRANTS
--   One more view for the existing hero_prices_ro role: hero.stats_v, one row per game
--   that has listed cards, with the catalog counts the site prints. Counts only: no card
--   ids, no prices, no user data. Same pattern as hero.prices_v: the view runs as its
--   owner (postgres, security_invoker = false), so the role needs no grant on
--   card_catalog or card_price_history. anon and authenticated get nothing.
--
-- WHAT IT RETURNS
--   game          catalog game code (OP, MTG, GD, RB, PW, DM, ...)
--   cards         card_catalog rows with listed = true
--   sets          distinct set_code among those rows
--   priced        of those, rows with a market_price (null never counts as priced)
--   price_points  card_price_history rows, all games (same value on every row)
--   These match the 11/20 copy: 31,008 cards and 170 sets were the listed counts.
--   price_points is about 4 s today, inside the role's 15 s statement_timeout.
--
-- DROP
--   DROP VIEW IF EXISTS hero.stats_v;
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW hero.stats_v
WITH (security_invoker = false)
AS
SELECT
  c.game,
  count(*)::int                                        AS cards,
  count(DISTINCT c.set_code)::int                      AS sets,
  count(*) FILTER (WHERE c.market_price IS NOT NULL)::int AS priced,
  (SELECT count(*) FROM public.card_price_history)::bigint AS price_points
FROM public.card_catalog c
WHERE c.listed
GROUP BY c.game;

ALTER VIEW hero.stats_v OWNER TO postgres;
REVOKE ALL ON hero.stats_v FROM PUBLIC, anon, authenticated;
GRANT SELECT ON hero.stats_v TO hero_prices_ro;

COMMIT;
