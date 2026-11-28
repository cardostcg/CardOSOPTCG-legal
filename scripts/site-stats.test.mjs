// node --test scripts/site-stats.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStats, renderPage, bannedPhrases, pointsLabel, shortDate, longDate, PAGES } from './site-stats.mjs';

const row = (game, cards, sets, priced, price_points = 1688793) => ({ game, cards, sets, priced, price_points });
const ROWS = [row('OP', 6320, 67, 5678), row('MTG', 29870, 76, 20602), row('DM', 9391, 101, 0)];

test('totals cover live games only; a game with no priced card is not live', () => {
  const s = buildStats(ROWS, '2026-11-28', null);
  assert.equal(s.cards, 36190);
  assert.equal(s.sets, 143);
  assert.equal(s.games, 2);
  assert.deepEqual(s.by_game.map((g) => [g.game, g.live]), [['MTG', true], ['DM', false], ['OP', true]]);
});

test('a null or zero count fails instead of printing 0', () => {
  assert.throws(() => buildStats([row('OP', null, 67, 1)], '2026-11-28', null), /OP: cards is null/);
  assert.throws(() => buildStats([row('OP', 6320, 0, 1)], '2026-11-28', null), /OP: sets is 0/);
  assert.throws(() => buildStats([row('OP', 6320, 67, 1, null)], '2026-11-28', null), /price_points/);
  assert.throws(() => buildStats([], '2026-11-28', null), /no rows/);
});

test('an unknown game needs a display name', () => {
  assert.throws(() => buildStats([row('XX', 10, 1, 1)], '2026-11-28', null), /XX: no display name/);
});

test('a large drop is refused', () => {
  const prev = buildStats(ROWS, '2026-11-27', null);
  assert.throws(() => buildStats([row('OP', 6320, 67, 5678)], '2026-11-28', prev), /fell from 36190 to 6320/);
});

test('unchanged counts keep the old date', () => {
  const prev = buildStats(ROWS, '2026-11-20', null);
  assert.equal(buildStats(ROWS, '2026-11-28', prev).as_of, '2026-11-20');
  assert.equal(buildStats([...ROWS.slice(0, 2), row('DM', 9391, 101, 5)], '2026-11-28', prev).as_of, '2026-11-28');
});

test('labels', () => {
  assert.equal(pointsLabel(1688793), '1.6M+');
  assert.equal(pointsLabel(1400000), '1.4M+');
  assert.equal(shortDate('2026-11-08'), 'Nov 8, 2026');
  assert.equal(longDate('2026-11-08'), 'November 8, 2026');
});

test('a page that changed shape fails rather than half-rendering', () => {
  const s = buildStats(ROWS, '2026-11-28', null);
  const { errors } = renderPage('<p>nothing to fill</p>', PAGES['index.html'](s));
  assert.ok(errors.some((e) => /cards, sets, price points: found 0, expected 5/.test(e)));
});

test('a priced game cannot read as next or soon, and the game count must match', () => {
  const s = buildStats([...ROWS.slice(0, 2), row('DM', 9391, 101, 9117)], '2026-11-28', null);
  const found = bannedPhrases('Games · Digimon next. Digimon prices soon. Five games: x. 2 games. 3 games.', s);
  assert.equal(found.length, 4);
  assert.deepEqual(bannedPhrases('Three games. Digimon live.', s), []);
});
