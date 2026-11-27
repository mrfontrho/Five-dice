// Run with: node --test five-dice/tests/profiles.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../profiles.js");

const fullCard = (overrides = {}) => ({
  ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
  threeKind: 20, fourKind: 0, fullHouse: 25, smallStraight: 30, largeStraight: 0, fiveKind: 0, chance: 22,
  ...overrides,
});

test("create, rename, and reject duplicate names", () => {
  const d = P.empty();
  const a = P.createProfile(d, "  Ana ");
  assert.equal(a.name, "Ana");
  assert.throws(() => P.createProfile(d, "ana"), /already exists/);
  assert.throws(() => P.createProfile(d, "   "), /Enter a name/);
  P.renameProfile(d, a.id, "Anna");
  assert.equal(d.profiles[a.id].name, "Anna");
});

test("recordGame stores totals and detects personal bests", () => {
  const d = P.empty();
  const a = P.createProfile(d, "Ana");
  const r1 = P.recordGame(d, a.id, { card: fullCard(), fiveKindBonus: 0, opponents: 0 });
  assert.equal(r1.game.score, 63 + 35 + 97);
  assert.equal(r1.personalBest, false); // first game isn't a "new" best
  const r2 = P.recordGame(d, a.id, { card: fullCard({ chance: 30 }), fiveKindBonus: 0 });
  assert.equal(r2.personalBest, true);
  const r3 = P.recordGame(d, a.id, { card: fullCard({ chance: 5 }), fiveKindBonus: 0 });
  assert.equal(r3.personalBest, false);
});

test("stats: averages, win rate, bonus rate, five of a kinds", () => {
  const d = P.empty();
  const a = P.createProfile(d, "Ana");
  P.recordGame(d, a.id, { card: fullCard(), fiveKindBonus: 0, opponents: 1, won: true });
  P.recordGame(d, a.id, { card: fullCard({ sixes: 0, fiveKind: 50 }), fiveKindBonus: 100, opponents: 1, won: false });
  P.recordGame(d, a.id, { card: fullCard(), fiveKindBonus: 0, opponents: 0 });
  const s = P.stats(d.profiles[a.id]);
  assert.equal(s.games, 3);
  assert.equal(s.multiGames, 2);
  assert.equal(s.wins, 1);
  assert.equal(s.winRate, 0.5);
  assert.equal(s.fiveKinds, 2);
  assert.ok(Math.abs(s.bonusRate - 2 / 3) < 1e-9);
  assert.equal(s.catZeroRate.fourKind, 1);
  assert.equal(s.catAvg.fiveKind, 50 / 3);
  assert.equal(s.recentScores.length, 3);
});

test("stats on a profile with no games", () => {
  const d = P.empty();
  const s = P.stats(P.createProfile(d, "New"));
  assert.equal(s.games, 0);
  assert.equal(s.average, 0);
  assert.equal(s.lastPlayed, null);
});

test("merge adds new profiles, keeps the fuller history, renames clashes", () => {
  const d = P.empty();
  const a = P.createProfile(d, "Ana");
  const other = P.empty();
  other.profiles[a.id] = { ...d.profiles[a.id], name: "Ana", games: [{ score: 1, card: {} }] };
  other.profiles.x1 = { id: "x1", name: "Ana", createdAt: "", games: [] };
  const r = P.merge(d, other);
  assert.deepEqual(r, { added: 1, updated: 1 });
  assert.equal(d.profiles[a.id].games.length, 1);
  assert.equal(d.profiles.x1.name, "Ana 2");
  assert.throws(() => P.merge(d, { nope: 1 }), /Not a Five Dice backup/);
});
