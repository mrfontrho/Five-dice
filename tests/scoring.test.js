// Run with: node --test five-dice/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../scoring.js");

test("upper section sums matching faces", () => {
  assert.equal(S.rawScore("ones", [1, 1, 3, 4, 1]), 3);
  assert.equal(S.rawScore("sixes", [6, 6, 2, 6, 5]), 18);
  assert.equal(S.rawScore("fives", [1, 2, 3, 4, 6]), 0);
});

test("of-a-kind categories", () => {
  assert.equal(S.rawScore("threeKind", [3, 3, 3, 2, 1]), 12);
  assert.equal(S.rawScore("threeKind", [3, 3, 2, 2, 1]), 0);
  assert.equal(S.rawScore("fourKind", [5, 5, 5, 5, 2]), 22);
  assert.equal(S.rawScore("fourKind", [5, 5, 5, 2, 2]), 0);
  assert.equal(S.rawScore("fiveKind", [4, 4, 4, 4, 4]), 50);
  assert.equal(S.rawScore("fiveKind", [4, 4, 4, 4, 3]), 0);
});

test("full house needs exactly 3 + 2", () => {
  assert.equal(S.rawScore("fullHouse", [2, 2, 3, 3, 3]), 25);
  assert.equal(S.rawScore("fullHouse", [2, 2, 2, 2, 3]), 0);
  assert.equal(S.rawScore("fullHouse", [6, 6, 6, 6, 6]), 0);
});

test("straights", () => {
  assert.equal(S.rawScore("smallStraight", [1, 2, 3, 4, 6]), 30);
  assert.equal(S.rawScore("smallStraight", [3, 4, 5, 6, 6]), 30);
  assert.equal(S.rawScore("smallStraight", [1, 2, 3, 5, 6]), 0);
  assert.equal(S.rawScore("largeStraight", [2, 3, 4, 5, 6]), 40);
  assert.equal(S.rawScore("largeStraight", [1, 2, 3, 4, 6]), 0);
});

test("chance is the sum", () => {
  assert.equal(S.rawScore("chance", [1, 2, 3, 4, 6]), 16);
});

test("upper bonus at 63", () => {
  const card = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
  assert.equal(S.totals(card).upperBonus, 35);
  assert.equal(S.totals({ ...card, sixes: 12 }).upperBonus, 0);
});

test("extra five of a kind gives 100 only when box holds 50", () => {
  assert.equal(S.bonusFor([3, 3, 3, 3, 3], { fiveKind: 50 }), 100);
  assert.equal(S.bonusFor([3, 3, 3, 3, 3], { fiveKind: 0 }), 0);
  assert.equal(S.bonusFor([3, 3, 3, 3, 3], {}), 0);
});

test("joker forces matching upper box when open", () => {
  const card = { fiveKind: 50 };
  assert.deepEqual(S.allowedCategories([4, 4, 4, 4, 4], card), ["fours"]);
});

test("joker allows lower boxes at full value when upper box used", () => {
  const card = { fiveKind: 50, fours: 12 };
  const allowed = S.allowedCategories([4, 4, 4, 4, 4], card);
  assert.ok(!allowed.some((k) => S.UPPER.includes(k)));
  assert.equal(S.scoreFor("largeStraight", [4, 4, 4, 4, 4], card), 40);
  assert.equal(S.scoreFor("fullHouse", [4, 4, 4, 4, 4], card), 25);
});

test("no joker before five of a kind is scored", () => {
  const allowed = S.allowedCategories([4, 4, 4, 4, 4], {});
  assert.equal(allowed.length, 13);
  assert.equal(S.scoreFor("largeStraight", [4, 4, 4, 4, 4], {}), 0);
});
