#!/usr/bin/env node
// scripts/site-stats.mjs · trust pyramid #9: one source for the catalog counts on the site.
//
//   node scripts/site-stats.mjs fetch                   live: hero.stats_v via HERO_PRICES_DB_URL (psql)
//   node scripts/site-stats.mjs fetch --fixture f.json  no network: rows come from the file
//   node scripts/site-stats.mjs render                  rewrite the counts in the pages from hero/stats.json
//   node scripts/site-stats.mjs check                   exit 1 if any page differs from hero/stats.json,
//                                                       or calls a priced game "next" or "soon"
//
// hero/stats.json is the one source. A game counts as live when it has at least one
// priced listed card. Totals (cards, sets, games) cover live games only, like the 11/20
// copy. Null never becomes 0: a missing or non-positive count fails the run and nothing
// is written. Before hero.stats_v exists (supabase/migrations/20261128090000_hero_stats_v.sql),
// fetch logs a notice and leaves hero/stats.json as committed.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATS = 'hero/stats.json';
const DROP_GUARD = 0.8; // a fetch that loses more than 20% of live cards is refused

// Display names. order is the brand order used in "the One Piece, Magic, ... tracker".
export const GAMES = {
  OP:  { order: 1, name: 'One Piece', long: 'One Piece',            seg: 'op',  logo: 'One Piece Card Game' },
  MTG: { order: 2, name: 'Magic',     long: 'Magic: The Gathering', seg: 'mtg', logo: 'Magic: The Gathering' },
  GD:  { order: 3, name: 'Gundam',    long: 'Gundam',               seg: 'gd',  logo: 'Gundam Card Game' },
  RB:  { order: 4, name: 'Riftbound', long: 'Riftbound',            seg: 'rb',  logo: 'Riftbound: League of Legends' },
  PW:  { order: 5, name: 'Palworld',  long: 'Palworld',             seg: 'pw',  logo: 'Palworld' },
  DM:  { order: 6, name: 'Digimon',   long: 'Digimon',              seg: 'dm',  logo: 'Digimon Card Game' },
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const isCount = (v) => Number.isInteger(v) && v > 0;
const fmt = (n) => n.toLocaleString('en-US');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function dateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw new Error(`as_of ${iso} is not YYYY-MM-DD`);
  return { y: +m[1], mo: +m[2], d: +m[3] };
}
export const shortDate = (iso) => { const p = dateParts(iso); return `${MONTHS[p.mo - 1].slice(0, 3)} ${p.d}, ${p.y}`; };
export const longDate = (iso) => { const p = dateParts(iso); return `${MONTHS[p.mo - 1]} ${p.d}, ${p.y}`; };

// "1.69M rows" prints as "1.6M+": always rounded down, so the + stays true.
export const pointsLabel = (n) => `${Math.floor(n / 100000) / 10}M+`;

/* ---------- stats ---------- */

// rows: [{ game, cards, sets, priced, price_points }] as hero.stats_v returns them.
export function buildStats(rows, asOf, prev) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('hero.stats_v returned no rows');
  const errors = [];
  const byGame = [];
  let points = null;
  for (const r of rows) {
    const g = String(r.game);
    if (!GAMES[g]) { errors.push(`${g}: no display name in GAMES (scripts/site-stats.mjs); add one`); continue; }
    for (const k of ['cards', 'sets']) if (!isCount(r[k])) errors.push(`${g}: ${k} is ${r[k]}, expected a positive count`);
    if (!Number.isInteger(r.priced) || r.priced < 0) errors.push(`${g}: priced is ${r.priced}`);
    if (!isCount(Number(r.price_points))) errors.push(`${g}: price_points is ${r.price_points}`);
    else if (points != null && points !== Number(r.price_points)) errors.push('price_points differs between rows');
    else points = Number(r.price_points);
    byGame.push({ game: g, cards: r.cards, sets: r.sets, priced: r.priced, live: r.priced > 0 });
  }
  if (errors.length) throw new Error(errors.join('; '));
  byGame.sort((a, b) => b.cards - a.cards || GAMES[a.game].order - GAMES[b.game].order);
  const live = byGame.filter((g) => g.live);
  if (!live.length) throw new Error('no game has a priced card');
  const stats = {
    as_of: asOf,
    source: 'hero.stats_v',
    cards: live.reduce((s, g) => s + g.cards, 0),
    sets: live.reduce((s, g) => s + g.sets, 0),
    games: live.length,
    price_points: points,
    by_game: byGame,
  };
  if (prev && isCount(prev.cards) && stats.cards < prev.cards * DROP_GUARD) {
    throw new Error(`live cards fell from ${prev.cards} to ${stats.cards}, more than ${Math.round((1 - DROP_GUARD) * 100)}%; check hero.stats_v`);
  }
  // Keep the old date when nothing moved, so the pages do not change every day.
  if (prev && JSON.stringify({ ...prev, as_of: null }) === JSON.stringify({ ...stats, as_of: null })) stats.as_of = prev.as_of;
  return stats;
}

function liveRows() {
  const url = process.env.HERO_PRICES_DB_URL;
  if (!url) throw new Error('HERO_PRICES_DB_URL is not set');
  let u;
  try { u = new URL(url); } catch { throw new Error('HERO_PRICES_DB_URL is not a valid URL'); }
  const env = {
    PATH: process.env.PATH,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    PGSSLMODE: u.searchParams.get('sslmode') || 'require',
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'site-stats',
  };
  const sql = `select coalesce(json_agg(t order by t.game), '[]'::json)
    from (select game, cards, sets, priced, price_points from hero.stats_v) t`;
  try {
    const out = execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
    });
    return JSON.parse(out.trim() || '[]');
  } catch (e) {
    const msg = String(e.stderr || e.message || '').split('\n')[0].replace(/postgres(ql)?:\/\/\S+/g, '<url>');
    if (/hero\.stats_v.*does not exist|relation .* does not exist/.test(msg)) return null;
    throw new Error(`psql failed: ${msg}`);
  }
}

/* ---------- render ---------- */

const NAMES = Object.values(GAMES).map((g) => esc(g.name)).join('|');
const LONGS = Object.values(GAMES).map((g) => esc(g.long)).join('|');
const LOGOS = Object.values(GAMES).map((g) => esc(g.logo)).join('|');

function listWords(names) {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// Each rule: a pattern, how many times it must match, and the replacement.
// A different match count means the page changed shape: fail rather than guess.
function indexRules(s) {
  const live = s.by_game.filter((g) => g.live);
  const soon = s.by_game.filter((g) => !g.live);
  const brand = [...live].sort((a, b) => GAMES[a.game].order - GAMES[b.game].order).map((g) => GAMES[g.game].name);
  const total = live.reduce((t, g) => t + g.cards, 0);
  const pct = (n) => Math.max(1, Math.round((n / total) * 100));
  const word = WORDS[s.games] || String(s.games);
  const soonText = soon.map((g) => ` ${GAMES[g.game].name} prices are coming soon.`).join('');
  const perGame = live.map((g) => `${GAMES[g.game].name} ${fmt(g.cards)}`).join(', ');
  const split = [
    `<div class="split-bar" role="img" aria-label="Catalog split: ${live.map((g, i) => `${GAMES[g.game].name} ${fmt(g.cards)}${i === 0 ? ' cards' : ''}`).join(', ')}.">`,
    ...live.map((g) => `            <span class="seg seg-${GAMES[g.game].seg}" title="${GAMES[g.game].name}: ${fmt(g.cards)} cards (${pct(g.cards)}%)"></span>`),
    '          </div>',
    '          <ul class="split-legend">',
    ...live.map((g) => `            <li><i class="d d-${GAMES[g.game].seg}"></i>${GAMES[g.game].name}<b>${fmt(g.cards)}</b><span class="st live">Live</span></li>`),
    '          </ul>',
  ].join('\n');
  const rules = [
    { what: 'game list in the descriptions and footer', n: 6,
      re: new RegExp(`the (?:${NAMES})(?:, (?:${NAMES}))*,? and (?:${NAMES}) portfolio tracker`, 'g'),
      to: () => `the ${listWords(brand)} portfolio tracker` },
    { what: 'cards, sets, price points', n: 5,
      re: /[\d,]+ cards, \d+ sets, [\d.]+M\+ price points/g,
      to: () => `${fmt(s.cards)} cards, ${s.sets} sets, ${pointsLabel(s.price_points)} price points` },
    { what: 'cards across games and sets', n: 2,
      re: /[\d,]+ cards across \d+ games and \d+ sets, including promos and starter decks, with [\d.]+M\+ price points/g,
      to: () => `${fmt(s.cards)} cards across ${s.games} games and ${s.sets} sets, including promos and starter decks, with ${pointsLabel(s.price_points)} price points` },
    { what: 'per-game counts', n: 2,
      re: new RegExp(`(?:(?:${NAMES}) [\\d,]+, )+as of [A-Z][a-z]{2} \\d{1,2}, \\d{4}`, 'g'),
      to: () => `${perGame}, as of ${shortDate(s.as_of)}` },
    { what: 'all live line', n: 2,
      re: new RegExp(`All \\w+ are live\\.(?: (?:${NAMES}) prices are coming soon\\.)*`, 'g'),
      to: () => `All ${word} are live.${soonText}` },
    { what: 'readout cards', n: 1,
      re: /data-n="\d+">[\d,]+<\/div><div class="small">Cards in catalog/g,
      to: () => `data-n="${s.cards}">${fmt(s.cards)}</div><div class="small">Cards in catalog` },
    { what: 'readout sets', n: 1,
      re: /data-n="\d+">[\d,]+<\/div><div class="small">Sets ·/g,
      to: () => `data-n="${s.sets}">${fmt(s.sets)}</div><div class="small">Sets ·` },
    { what: 'readout price points', n: 1,
      re: /<div class="big">[\d.]+M\+<\/div><div class="small">Price points/g,
      to: () => `<div class="big">${pointsLabel(s.price_points)}</div><div class="small">Price points` },
    { what: 'readout games', n: 1,
      re: /data-n="\d+">\d+<\/div><div class="small">Games · [^<]*<\/div>/g,
      to: () => `data-n="${s.games}">${s.games}</div><div class="small">Games · ${soon.length ? `${soon.map((g) => GAMES[g.game].name).join(', ')} next` : 'all live'}</div>` },
    { what: 'game logos', n: Object.keys(GAMES).length,
      re: new RegExp(`alt="(${LOGOS}) logo" /><span class="st(?: live)?">(?:Live|Prices soon)</span>`, 'g'),
      to: (_m, logo) => {
        const code = Object.keys(GAMES).find((k) => GAMES[k].logo === logo);
        const g = s.by_game.find((x) => x.game === code);
        if (!g) throw new Error(`${logo} logo is on the page but ${code} has no listed cards in ${STATS}`);
        return `alt="${logo} logo" /><span class="st${g.live ? ' live">Live' : '">Prices soon'}</span>`;
      } },
    { what: 'catalog split', n: 1,
      re: /<div class="split-bar"[\s\S]*?<\/ul>/g,
      to: () => split },
    { what: 'readout date', n: 1,
      re: /Catalog readout as of [A-Z][a-z]{2} \d{1,2}, \d{4}\./g,
      to: () => `Catalog readout as of ${shortDate(s.as_of)}.` },
  ];
  for (const g of live) {
    const seg = GAMES[g.game].seg;
    rules.push({ what: `.seg-${seg} width`, n: 1,
      re: new RegExp(`\\.seg-${seg} \\{ flex: \\d+ 1 0%;`, 'g'),
      to: () => `.seg-${seg} { flex: ${g.cards} 1 0%;` });
  }
  return rules;
}

function pricesPageRules(s) {
  return [
    { what: 'coverage table rows', n: s.by_game.length,
      re: new RegExp(`<tr><td>(${LONGS})</td><td class="num">\\d+</td><td class="num">[\\d,]+</td><td>([^<]*)</td></tr>`, 'g'),
      to: (_m, long, cell) => {
        const code = Object.keys(GAMES).find((k) => GAMES[k].long === long);
        const g = s.by_game.find((x) => x.game === code);
        if (!g) throw new Error(`${long} row is in the coverage table but has no listed cards in ${STATS}`);
        let src = cell;
        if (!g.live) src = 'Prices soon';
        else if (/soon/i.test(cell)) throw new Error(`${long} is priced now: write its price source in the coverage table by hand`);
        return `<tr><td>${long}</td><td class="num">${g.sets}</td><td class="num">${fmt(g.cards)}</td><td>${src}</td></tr>`;
      } },
    { what: 'coverage date', n: 1,
      re: /Catalog counts as of [A-Z][a-z]+ \d{1,2}, \d{4}\./g,
      to: () => `Catalog counts as of ${longDate(s.as_of)}.` },
  ];
}

export const PAGES = { 'index.html': indexRules, 'how-cardos-prices-cards.html': pricesPageRules };

export function renderPage(html, rules) {
  const errors = [];
  let out = html;
  for (const r of rules) {
    const hits = out.match(r.re) || [];
    if (hits.length !== r.n) { errors.push(`${r.what}: found ${hits.length}, expected ${r.n}`); continue; }
    out = out.replace(r.re, r.to);
  }
  return { out, errors };
}

// Free text the render cannot own: a priced game must never read as "next" or "soon",
// and a spelled-out game count must match.
export function bannedPhrases(html, s) {
  const found = [];
  for (const g of s.by_game.filter((x) => x.live)) {
    const n = esc(GAMES[g.game].name);
    const res = [
      new RegExp(`\\b${n} next\\b`, 'i'),
      new RegExp(`\\b${n}\\b[^.<]{0,80}\\b(?:prices? (?:are |is )?(?:coming )?soon|waiting on prices)`, 'i'),
      new RegExp(`waiting on prices, like ${n}`, 'i'),
    ];
    for (const re of res) { const m = html.match(re); if (m) found.push(`"${m[0]}" (${GAMES[g.game].name} is priced)`); }
  }
  const words = new RegExp(`\\b(${WORDS.join('|')}|\\d+) games\\b`, 'gi');
  for (const m of html.matchAll(words)) {
    const v = /^\d+$/.test(m[1]) ? +m[1] : WORDS.indexOf(m[1].toLowerCase());
    if (v !== s.games) found.push(`"${m[0]}" (live games: ${s.games})`);
  }
  return found;
}

function sitePages() {
  return readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'index.draft.html');
}

/* ---------- main ---------- */

function readStats() {
  const f = resolve(ROOT, STATS);
  if (!existsSync(f)) throw new Error(`${STATS} is missing`);
  return JSON.parse(readFileSync(f, 'utf8'));
}

function renderAll(s) {
  const errors = [];
  const changed = [];
  for (const [file, rulesFor] of Object.entries(PAGES)) {
    const path = resolve(ROOT, file);
    const html = readFileSync(path, 'utf8');
    let res;
    try { res = renderPage(html, rulesFor(s)); } catch (e) { errors.push(`${file}: ${e.message}`); continue; }
    for (const e of res.errors) errors.push(`${file}: ${e}`);
    if (!res.errors.length && res.out !== html) changed.push({ file, path, out: res.out });
  }
  for (const file of sitePages()) {
    const html = changed.find((c) => c.file === file)?.out ?? readFileSync(resolve(ROOT, file), 'utf8');
    for (const b of bannedPhrases(html, s)) errors.push(`${file}: ${b}`);
  }
  return { errors, changed };
}

function main(argv) {
  const cmd = argv[0];
  const fx = argv.indexOf('--fixture');
  if (cmd === 'fetch') {
    const rows = fx > -1 ? JSON.parse(readFileSync(resolve(process.cwd(), argv[fx + 1]), 'utf8')) : liveRows();
    if (rows === null) {
      console.log(`::notice::hero.stats_v does not exist yet (apply supabase/migrations/20261128090000_hero_stats_v.sql). ${STATS} left as committed.`);
      return 0;
    }
    const prevPath = resolve(ROOT, STATS);
    const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : null;
    const stats = buildStats(rows, new Date().toISOString().slice(0, 10), prev);
    const txt = JSON.stringify(stats, null, 2) + '\n';
    if (prev && JSON.stringify(prev, null, 2) + '\n' === txt) { console.log(`site-stats: ${STATS} unchanged`); return 0; }
    writeFileSync(prevPath, txt);
    console.log(`site-stats: wrote ${STATS}: ${stats.cards} cards, ${stats.sets} sets, ${stats.games} games, ${stats.price_points} price points`);
    return 0;
  }
  if (cmd === 'render' || cmd === 'check') {
    const { errors, changed } = renderAll(readStats());
    if (errors.length) {
      console.error(`site-stats: FAIL, ${errors.length} problem(s). Nothing written.`);
      for (const e of errors) console.error(`  - ${e}`);
      return 1;
    }
    if (cmd === 'check') {
      if (changed.length) {
        console.error(`site-stats: FAIL, ${changed.map((c) => c.file).join(', ')} differ from ${STATS}. Run: node scripts/site-stats.mjs render`);
        return 1;
      }
      console.log(`site-stats: ok, pages match ${STATS}`);
      return 0;
    }
    for (const c of changed) writeFileSync(c.path, c.out);
    console.log(changed.length ? `site-stats: rendered ${changed.map((c) => c.file).join(', ')}` : 'site-stats: pages already match');
    return 0;
  }
  console.error('usage: site-stats.mjs fetch [--fixture rows.json] | render | check');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`site-stats: FAIL, ${e.message}. Nothing written.`);
    process.exitCode = 1;
  }
}
