-- ============================================================================
-- 20261126062302_hero_prices_ro.sql  ·  P45.25 hero prices, read-only role
-- STATUS: APPLIED to prod 2026-11-26 (version 20261126062302, via the Supabase connector).
-- The role has NO password yet; it cannot log in until Art sets one (see PASSWORD).
--
-- WHAT IT GRANTS
--   One login role, hero_prices_ro, that can read one view, hero.prices_v.
--   The view returns daily price rows for the 10 hero cards only (a hard-coded
--   key list below), last 40 days, plus card_catalog.market_price for the
--   parity check. It has no access to the public schema tables, no other view,
--   and no function grants from this file. anon and authenticated get nothing.
--   The view runs as its owner (postgres, security_invoker = false), so the
--   role needs no grant on card_price_history or card_catalog.
--
--   Residual: Postgres gives EXECUTE on new functions to PUBLIC by default.
--   Any public function that was never revoked from PUBLIC is callable by every
--   role, this one included. That is true today for every login role and is
--   not widened here. The role also has no USAGE grant on schema public from
--   this file.
--
-- PASSWORD
--   The password is never in this file. Run the file, then set it once:
--     ALTER ROLE hero_prices_ro WITH PASSWORD '<new password>';
--   The GitHub secret HERO_PRICES_DB_URL is the pooler URL for this role:
--     postgresql://hero_prices_ro.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
--   (Supavisor wants user.project-ref as the user name.)
--
-- ROTATE
--   ALTER ROLE hero_prices_ro WITH PASSWORD '<new password>';
--   Then update the HERO_PRICES_DB_URL repo secret. The next run uses it.
--
-- DROP
--   DROP VIEW IF EXISTS hero.prices_v;
--   DROP SCHEMA IF EXISTS hero;
--   DROP ROLE IF EXISTS hero_prices_ro;
--   Then delete the HERO_PRICES_DB_URL repo secret. The workflow goes inert.
--
-- KEYS (must match price_key in hero/cards.json; the job fails if they drift)
--   One Piece: card_price_history.card_id is the catalog card_image_id.
--   Riftbound, Palworld: card_id + variant, catalog card_image_id = card_id_variant.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS hero;
ALTER SCHEMA hero OWNER TO postgres;
REVOKE ALL ON SCHEMA hero FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW hero.prices_v
WITH (security_invoker = false)
AS
WITH keys (hero_key, game, price_key, variant, source, catalog_image_id) AS (
  VALUES
    ('ST01-012',  'OP', 'ST01-012_p3',  'base',      'tcgplayer_en', 'ST01-012_p3'),
    ('OP05-119',  'OP', 'OP05-119_p8',  'base',      'tcgplayer_en', 'OP05-119_p8'),
    ('EB04-061',  'OP', 'EB04-061_p2',  'base',      'tcgplayer_en', 'EB04-061_p2'),
    ('OGN-299',   'RB', 'OGN-299',      'signature', 'tcgplayer_rb', 'OGN-299_signature'),
    ('OGN-303',   'RB', 'OGN-303',      'signature', 'tcgplayer_rb', 'OGN-303_signature'),
    ('VEN-189',   'RB', 'VEN-189',      'signature', 'tcgplayer_rb', 'VEN-189_signature'),
    ('SFD-227',   'RB', 'SFD-227',      'signature', 'tcgplayer_rb', 'SFD-227_signature'),
    ('EBP01-001', 'PW', 'PW-EBP01-001', 'ssp',       'tcgplayer_pw', 'PW-EBP01-001_ssp'),
    ('EBP01-049', 'PW', 'PW-EBP01-049', 'ssp',       'tcgplayer_pw', 'PW-EBP01-049_ssp'),
    ('EBP01-025', 'PW', 'PW-EBP01-025', 'ssp',       'tcgplayer_pw', 'PW-EBP01-025_ssp')
)
SELECT
  k.hero_key,
  k.price_key,
  k.source,
  k.variant,
  h.snapshot_date,
  h.price,
  h.quarantined,
  h.stale,
  c.market_price
FROM keys k
JOIN public.card_price_history h
  ON h.card_id = k.price_key
 AND h.variant = k.variant
 AND h.source  = k.source
 AND h.game    = k.game
LEFT JOIN public.card_catalog c
  ON c.game = k.game
 AND c.card_image_id = k.catalog_image_id
WHERE h.snapshot_date >= current_date - 40;

ALTER VIEW hero.prices_v OWNER TO postgres;
REVOKE ALL ON hero.prices_v FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON hero.prices_v FROM anon, authenticated, PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hero_prices_ro') THEN
    -- No password here. Art sets it right after this file runs (see header).
    CREATE ROLE hero_prices_ro LOGIN NOINHERIT;
  END IF;
END $$;

-- Supabase's postgres is not a superuser, so it cannot set SUPERUSER, REPLICATION or
-- BYPASSRLS on another role, even to NO. New roles default to NO on all three; assert it.
ALTER ROLE hero_prices_ro NOCREATEDB NOCREATEROLE CONNECTION LIMIT 3;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hero_prices_ro'
             AND (rolsuper OR rolreplication OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
    RAISE EXCEPTION 'hero_prices_ro has an elevated attribute; aborting';
  END IF;
END $$;
ALTER ROLE hero_prices_ro SET search_path = hero;
ALTER ROLE hero_prices_ro SET statement_timeout = '15s';
ALTER ROLE hero_prices_ro SET default_transaction_read_only = on;

GRANT USAGE ON SCHEMA hero TO hero_prices_ro;
GRANT SELECT ON hero.prices_v TO hero_prices_ro;

COMMIT;
