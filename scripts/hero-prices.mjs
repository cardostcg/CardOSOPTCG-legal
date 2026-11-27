#!/usr/bin/env node
// scripts/hero-prices.mjs · P45.25
// Builds hero/prices.json from hero.prices_v (read-only role, see
// supabase/migrations/20261126062302_hero_prices_ro.sql).
//
//   node scripts/hero-prices.mjs                    live: reads HERO_PRICES_DB_URL via psql
//   node scripts/hero-prices.mjs --fixture rows.json  no network: rows come from the file
//   options: --cards <file>     default hero/cards.json
//            --prev <file>      default hero/prices.json (last committed values, mapping guard)
//            --baseline <file>  hand values to guard against when --prev has no number
//                               (default: hero/cards.json at origin/main, the 11/11 values)
//            --out <file>       default hero/prices.json
//
// Exits non-zero, with a message per card, and writes nothing when any check fails.
// P45.29c: a card whose rows are all quarantined, stale or unpriced, or whose catalog
// price is null, is skipped (left out of prices.json, so the page shows art and name
// with no number) instead of failing the run. More than MAX_SKIPS skipped cards, or a
// game left with no priced card, still fails. Wrong keys, parity and the guard still fail.
// Never writes 0 for a missing number. Null stays null.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PARITY_TOL = 0.01;   // job price vs card_catalog.market_price
const GUARD_HI = 10;       // new / last committed
const GUARD_LO = 0.1;
const MAX_SKIPS = 3;      // of the 10 hand-list cards, per run
const MOVE_MIN_DAYS = 25;  // 30 day move only from a row 25 to 35 days older
const MOVE_MAX_DAYS = 35;
const SERIES_WEEKS = 5;    // up to 5 weekly points: -28, -21, -14, -7, 0 days
const SERIES_SLACK = 3;    // a weekly point may sit up to 3 days off its target

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v == null || v.startsWith('--')) throw new Error(`--${k} needs a value`);
    out[k] = v;
    i++;
  }
  return out;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const dayNum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Number.isFinite(t) ? Math.round(t / 86400000) : null;
};
const round2 = (v) => Math.round(v * 100) / 100;
const round1 = (v) => Math.round(v * 10) / 10;
const num = (v) => (v == null || v === '' ? null : Number(v));

function readJson(file, what) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`cannot read ${what} (${file}): ${e.message}`);
  }
}

/* ---------- rows ---------- */

function liveRows() {
  const url = process.env.HERO_PRICES_DB_URL;
  if (!url) throw new Error('HERO_PRICES_DB_URL is not set');
  let u;
  try { u = new URL(url); } catch { throw new Error('HERO_PRICES_DB_URL is not a valid URL'); }
  // The URL goes to psql through PG* env vars, never argv, so it is not in the process list.
  const env = {
    PATH: process.env.PATH,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    PGSSLMODE: u.searchParams.get('sslmode') || 'require',
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'hero-prices',
  };
  const sql = `select coalesce(json_agg(t order by t.hero_key, t.snapshot_date), '[]'::json)
    from (select hero_key, price_key, source, variant, snapshot_date::text as snapshot_date,
                 price::float8 as price, quarantined, stale, market_price::float8 as market_price
            from hero.prices_v) t`;
  let out;
  try {
    out = execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
    });
  } catch (e) {
    const msg = String(e.stderr || e.message || '').split('\n')[0];
    throw new Error(`psql failed: ${msg.replace(/postgres(ql)?:\/\/\S+/g, '<url>')}`);
  }
  return JSON.parse(out.trim() || '[]');
}

/* ---------- baseline for the mapping guard ---------- */

function loadPrev(file) {
  if (!existsSync(file)) return null;
  return readJson(file, 'previous prices');
}

function loadBaseline(file) {
  if (file) return readJson(file, 'baseline');
  try {
    const txt = execFileSync('git', ['show', 'origin/main:hero/cards.json'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function baselineFor(cardId, prev, baseline) {
  const p = prev && prev.cards && prev.cards[cardId];
  if (p && isNum(p.price) && p.price > 0) return { value: p.price, from: 'hero/prices.json' };
  const b = baseline && Array.isArray(baseline.cards) && baseline.cards.find((c) => String(c.card_id) === cardId);
  if (b && isNum(b.price) && b.price > 0) return { value: b.price, from: `hand value as of ${b.as_of || baseline.as_of || 'origin/main'}` };
  return null;
}

/* ---------- per card ---------- */

function nearest(rows, target, maxOff) {
  let best = null;
  for (const r of rows) {
    const off = Math.abs(r.day - target);
    if (off > maxOff) continue;
    if (!best || off < best.off || (off === best.off && r.day > best.r.day)) best = { r, off };
  }
  return best ? best.r : null;
}

function priceCard(card, rows, guardBase) {
  const errors = [];
  const id = card.card_id;
  const key = card.price_key;
  if (!key || typeof key !== 'object' || !key.id || !key.variant || !key.source) {
    return { errors: [`${id}: price_key missing in hero/cards.json`] };
  }
  if (key.unconfirmed || /UNCONFIRMED/i.test(`${key.id} ${key.variant} ${key.source}`)) {
    return { errors: [`${id}: price_key is UNCONFIRMED; Art must confirm it before the job can price this card`] };
  }
  if (/_low$/.test(key.source)) {
    return { errors: [`${id}: source ${key.source} is a low source; hero prices never use *_low`] };
  }
  const mine = rows.filter((r) => r.hero_key === id);
  if (!mine.length) return { errors: [`${id}: key ${key.id}/${key.variant}/${key.source} returned no rows`] };
  const drift = mine.find((r) => r.price_key !== key.id || r.variant !== key.variant || r.source !== key.source);
  if (drift) {
    return { errors: [`${id}: view key ${drift.price_key}/${drift.variant}/${drift.source} does not match cards.json ${key.id}/${key.variant}/${key.source}`] };
  }
  const good = mine
    .filter((r) => r.quarantined !== true && r.stale !== true)
    .map((r) => ({ ...r, price: num(r.price), day: dayNum(r.snapshot_date) }))
    .filter((r) => isNum(r.price) && r.price > 0 && r.day != null)
    .sort((a, b) => a.day - b.day);
  if (!good.length) {
    return { errors: [], skip: `${mine.length} row(s), all quarantined, stale or unpriced` };
  }
  const latest = good[good.length - 1];
  const price = round2(latest.price);

  // Parity with the number the app shows.
  const mkt = num(latest.market_price);
  if (!isNum(mkt) || mkt <= 0) {
    // The app shows no price for this print, so the hero shows none either.
    return { errors: [], skip: 'catalog market_price is null, the app shows no price' };
  }
  if (Math.abs(price - mkt) / mkt > PARITY_TOL) {
    errors.push(`${id}: parity fail, job ${price} vs catalog market_price ${mkt} (${(((price / mkt) - 1) * 100).toFixed(2)}%)`);
  }

  // Mapping guard against the last committed value.
  if (!guardBase) {
    errors.push(`${id}: no last committed price to guard the mapping against`);
  } else {
    const ratio = price / guardBase.value;
    if (ratio > GUARD_HI || ratio < GUARD_LO) {
      errors.push(`${id}: mapping guard fail, ${price} is ${ratio.toFixed(4)}x the ${guardBase.from} ${guardBase.value}`);
    }
  }

  // 30 day move: latest against the row nearest 30 days back, only 25 to 35 days older.
  let move = null;
  const back = good.filter((r) => latest.day - r.day >= MOVE_MIN_DAYS && latest.day - r.day <= MOVE_MAX_DAYS);
  if (back.length) {
    const old = nearest(back, latest.day - 30, MOVE_MAX_DAYS);
    if (old && old.price > 0) move = round1((latest.price / old.price - 1) * 100);
    if (Object.is(move, -0)) move = 0;
  }

  // Weekly series, oldest first. Null unless at least two points.
  const pts = [];
  for (let w = SERIES_WEEKS - 1; w >= 0; w--) {
    const target = latest.day - w * 7;
    const r = w === 0 ? latest : nearest(good.filter((g) => g.day < latest.day), target, SERIES_SLACK);
    if (r && !pts.some((p) => p.day === r.day)) pts.push(r);
  }
  const series = pts.length >= 2 ? pts.map((p) => round2(p.price)) : null;

  return {
    errors,
    entry: { price, move_30d: move, series_30d: series, as_of: latest.snapshot_date, source: key.source },
  };
}

/* ---------- main ---------- */

function main() {
  const cardsFile = resolve(ROOT, args.cards || 'hero/cards.json');
  const prevFile = resolve(ROOT, args.prev || 'hero/prices.json');
  const outFile = resolve(ROOT, args.out || 'hero/prices.json');
  const hand = readJson(cardsFile, 'hand list');
  const list = Array.isArray(hand.cards) ? hand.cards : [];
  if (!list.length) throw new Error('hand list has no cards');

  const rows = args.fixture ? readJson(resolve(process.cwd(), args.fixture), 'fixture') : liveRows();
  if (!Array.isArray(rows)) throw new Error('rows are not an array');

  const prev = loadPrev(prevFile);
  const baseline = loadBaseline(args.baseline ? resolve(process.cwd(), args.baseline) : null);

  const errors = [];
  const cards = {};
  const pricedByGame = {};
  const skipped = [];
  for (const c of list) {
    const id = String(c.card_id);
    pricedByGame[c.game] = pricedByGame[c.game] || 0;
    const res = priceCard(c, rows, baselineFor(id, prev, baseline));
    errors.push(...res.errors);
    if (res.skip) skipped.push(`${id}: ${res.skip}`);
    if (res.entry && !res.errors.length) {
      cards[id] = res.entry;
      pricedByGame[c.game]++;
    }
  }
  for (const [game, n] of Object.entries(pricedByGame)) {
    if (n === 0) errors.push(`${game}: zero priced cards`);
  }
  if (skipped.length > MAX_SKIPS) errors.push(`${skipped.length} cards skipped, more than ${MAX_SKIPS}`);
  for (const sk of skipped) console.log(`hero-prices: skip ${sk}`);
  const unknown = [...new Set(rows.map((r) => r.hero_key))].filter((k) => !list.some((c) => String(c.card_id) === k));
  if (unknown.length) errors.push(`view returned cards not in the hand list: ${unknown.join(', ')}`);

  if (errors.length) {
    console.error(`hero-prices: FAIL, ${errors.length} problem(s). Nothing written.`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (prev && prev.cards && JSON.stringify(prev.cards) === JSON.stringify(cards)) {
    console.log(`hero-prices: ok, ${list.length} cards, unchanged. Nothing written.`);
    return;
  }
  const out = { generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), cards };
  writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
  for (const c of list) {
    const e = cards[String(c.card_id)];
    if (!e) { console.log(`  ${String(c.card_id).padEnd(10)} skipped, no number`); continue; }
    console.log(`  ${String(c.card_id).padEnd(10)} ${String(e.price).padStart(10)}  move ${e.move_30d ?? 'null'}  series ${e.series_30d ? e.series_30d.length : 'null'}  as_of ${e.as_of}`);
  }
  console.log(`hero-prices: ok, wrote ${list.length} cards to ${outFile.replace(ROOT + '/', '')}`);
}

try {
  main();
} catch (e) {
  console.error(`hero-prices: FAIL, ${e.message}. Nothing written.`);
  process.exit(1);
}
