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

// ---------- Hall of Fame ----------
function seed() {
  const d = P.empty();
  const add = (name, games) => {
    const p = P.createProfile(d, name);
    for (const [chance, opponents, won] of games)
      P.recordGame(d, p.id, { card: fullCard({ chance }), fiveKindBonus: 0, opponents, won, date: `2026-11-${10 + p.games.length}T00:00:00Z` });
    return p;
  };
  // fullCard() scores 195 with chance 22, so score = 173 + chance
  add("Ana", [[22, 1, true], [10, 1, false], [30, 1, true], [5, 1, true]]); // 195,183,203,178 · 3W of 4
  add("Ben", [[40, 1, true], [0, 1, false], [0, 1, false]]);                 // 213,173,173 · 1W of 3
  add("Cy", [[22, 0, false], [22, 0, false], [22, 0, false]]);               // solo only, 195 x3
  add("Dee", [[50, 1, true]]);                                               // one game, 223 · 1W of 1
  P.createProfile(d, "Eve");                                                 // no games
  return d;
}
const board = (boards, id) => boards.find((b) => b.id === id);
const names = (b) => b.entries.map((e) => `${e.rank}:${e.name}`);

test("hall of fame returns four boards in order", () => {
  const boards = P.hallOfFame(seed());
  assert.deepEqual(boards.map((b) => b.id), ["best", "wins", "average", "winRate"]);
});

test("best game ranks each player's top score, with date", () => {
  const b = board(P.hallOfFame(seed()), "best");
  assert.deepEqual(names(b), ["1:Dee", "2:Ben", "3:Ana", "4:Cy"]); // Eve has no games
  assert.equal(b.entries[0].value, 223);
  assert.equal(b.entries[2].value, 203);
  assert.ok(b.entries[0].date.startsWith("2026-11-10"));
});

test("most wins counts multiplayer wins; solo-only players are excluded", () => {
  const b = board(P.hallOfFame(seed()), "wins");
  assert.deepEqual(names(b), ["1:Ana", "2:Dee", "2:Ben"]); // 1 win each: shared rank, Dee listed first on win %
  assert.equal(b.entries[0].value, 3);
});

test("average and win % need the minimum number of games", () => {
  const boards = P.hallOfFame(seed());
  const avg = board(boards, "average");
  assert.deepEqual(names(avg), ["1:Cy", "2:Ana", "3:Ben"]);
  assert.deepEqual(avg.unranked, [{ name: "Dee", have: 1 }]);
  assert.equal(avg.min, 3);
  const wr = board(boards, "winRate");
  assert.deepEqual(names(wr), ["1:Ana", "2:Ben"]);
  assert.equal(wr.entries[0].value, 0.75);
  assert.deepEqual(wr.unranked, [{ name: "Dee", have: 1 }]);
});

test("equal values share a rank", () => {
  const d = P.empty();
  for (const n of ["A", "B", "C"]) {
    const p = P.createProfile(d, n);
    P.recordGame(d, p.id, { card: fullCard({ chance: n === "C" ? 0 : 22 }), fiveKindBonus: 0 });
  }
  // A and B tie on best (195) and on average tie-break input too -> both rank 1, C is 3
  assert.deepEqual(board(P.hallOfFame(d), "best").entries.map((e) => e.rank), [1, 1, 3]);
});

test("empty data gives empty boards", () => {
  const boards = P.hallOfFame(P.empty());
  assert.ok(boards.every((b) => b.entries.length === 0 && b.unranked.length === 0));
});
