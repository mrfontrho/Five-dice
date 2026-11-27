// Run with: node --test tests/match.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../match.js");

test("solo matches are always scored by points", () => {
  assert.equal(M.newMatch(3, "wins", 1).method, "points");
  assert.equal(M.newMatch(3, "wins", 2).method, "wins");
});

test("points: totals add up and the match runs all games", () => {
  const m = M.newMatch(3, "points", 2);
  M.applyGame(m, [200, 150]);
  M.applyGame(m, [100, 250]);
  assert.deepEqual(m.points, [300, 400]);
  assert.equal(M.isOver(m), false);
  M.applyGame(m, [180, 60]);
  assert.equal(M.isOver(m), true);
  assert.deepEqual(M.leaders(m), [0]); // 480 vs 460
});

test("wins: best of 3 ends early at 2-0", () => {
  const m = M.newMatch(3, "wins", 2);
  M.applyGame(m, [200, 150]);
  assert.equal(M.isOver(m), false);
  M.applyGame(m, [210, 190]);
  assert.equal(M.isOver(m), true);
  assert.deepEqual(m.wins, [2, 0]);
  assert.deepEqual(M.leaders(m), [0]);
});

test("wins: not over while the trailer can still catch up", () => {
  const m = M.newMatch(5, "wins", 3);
  M.applyGame(m, [200, 100, 100]);
  M.applyGame(m, [200, 100, 100]);
  assert.equal(M.isOver(m), false); // 2-0-0 with 3 left
  M.applyGame(m, [200, 100, 100]);
  assert.equal(M.isOver(m), true); // 3-0-0 with 2 left
});

test("tied games give every leader a win", () => {
  const m = M.newMatch(3, "wins", 3);
  const won = M.applyGame(m, [180, 180, 90]);
  assert.deepEqual(won, [true, true, false]);
  assert.deepEqual(m.wins, [1, 1, 0]);
});

test("wins ties are broken by total points; full ties share the match", () => {
  const m = M.newMatch(2, "wins", 2);
  M.applyGame(m, [200, 150]);
  M.applyGame(m, [100, 120]);
  assert.deepEqual(M.leaders(m), [0]); // 1-1, 300 vs 270
  const t = M.newMatch(1, "points", 2);
  M.applyGame(t, [150, 150]);
  assert.deepEqual(M.leaders(t), [0, 1]);
});

test("game count is clamped to a sane range", () => {
  assert.equal(M.newMatch(0, "points", 2).games, 1);
  assert.equal(M.newMatch(500, "points", 2).games, 99);
});
