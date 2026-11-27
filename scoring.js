// Pure scoring rules for Five Dice. Works in the browser (window.Scoring)
// and in Node (module.exports) so it can be unit-tested.
(function (root) {
  const UPPER = ["ones", "twos", "threes", "fours", "fives", "sixes"];
  const LOWER = ["threeKind", "fourKind", "fullHouse", "smallStraight", "largeStraight", "fiveKind", "chance"];
  const CATEGORIES = [...UPPER, ...LOWER];

  const LABELS = {
    ones: "Ones", twos: "Twos", threes: "Threes", fours: "Fours", fives: "Fives", sixes: "Sixes",
    threeKind: "Three of a Kind", fourKind: "Four of a Kind", fullHouse: "Full House",
    smallStraight: "Small Straight", largeStraight: "Large Straight", fiveKind: "Five of a Kind",
    chance: "Chance",
  };

  const HINTS = {
    ones: "Sum of 1s", twos: "Sum of 2s", threes: "Sum of 3s", fours: "Sum of 4s", fives: "Sum of 5s", sixes: "Sum of 6s",
    threeKind: "3 alike: sum of all dice", fourKind: "4 alike: sum of all dice", fullHouse: "3 + 2 alike: 25",
    smallStraight: "4 in a row: 30", largeStraight: "5 in a row: 40", fiveKind: "5 alike: 50", chance: "Sum of all dice",
  };

  const UPPER_BONUS_THRESHOLD = 63;
  const UPPER_BONUS = 35;
  const FIVE_KIND_BONUS = 100;

  const sum = (dice) => dice.reduce((a, b) => a + b, 0);

  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) c[d]++;
    return c;
  }

  function hasRun(dice, length) {
    const set = new Set(dice);
    for (let start = 1; start + length - 1 <= 6; start++) {
      let ok = true;
      for (let v = start; v < start + length; v++) if (!set.has(v)) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  const isFiveKind = (dice) => dice.length === 5 && counts(dice).some((n) => n === 5);

  // Raw score of a category, ignoring joker rules.
  function rawScore(category, dice) {
    const c = counts(dice);
    const upperIdx = UPPER.indexOf(category);
    if (upperIdx >= 0) return c[upperIdx + 1] * (upperIdx + 1);
    switch (category) {
      case "threeKind": return c.some((n) => n >= 3) ? sum(dice) : 0;
      case "fourKind": return c.some((n) => n >= 4) ? sum(dice) : 0;
      case "fullHouse": return c.includes(3) && c.includes(2) ? 25 : 0;
      case "smallStraight": return hasRun(dice, 4) ? 30 : 0;
      case "largeStraight": return hasRun(dice, 5) ? 40 : 0;
      case "fiveKind": return isFiveKind(dice) ? 50 : 0;
      case "chance": return sum(dice);
    }
    throw new Error("Unknown category: " + category);
  }

  // Joker applies when rolling five of a kind after Five of a Kind is already scored
  // (with 50 or 0). Then: the matching upper box must be used if open; otherwise any
  // lower box scores full value (FH 25, SS 30, LS 40); otherwise an upper box scores 0.
  function jokerActive(dice, card) {
    return isFiveKind(dice) && card.fiveKind !== undefined && card.fiveKind !== null;
  }

  // Which categories may be chosen right now.
  function allowedCategories(dice, card) {
    const open = CATEGORIES.filter((k) => card[k] === undefined || card[k] === null);
    if (!jokerActive(dice, card)) return open;
    const matchingUpper = UPPER[dice[0] - 1];
    if (open.includes(matchingUpper)) return [matchingUpper];
    const openLower = open.filter((k) => LOWER.includes(k));
    if (openLower.length) return openLower;
    return open;
  }

  // Score for placing these dice in a category given the current card.
  function scoreFor(category, dice, card) {
    if (!jokerActive(dice, card)) return rawScore(category, dice);
    if (category === "fullHouse") return 25;
    if (category === "smallStraight") return 30;
    if (category === "largeStraight") return 40;
    return rawScore(category, dice);
  }

  // Bonus earned for this placement (extra five of a kind when the box holds 50).
  function bonusFor(dice, card) {
    return isFiveKind(dice) && card.fiveKind === 50 ? FIVE_KIND_BONUS : 0;
  }

  function totals(card, fiveKindBonus = 0) {
    const upper = UPPER.reduce((a, k) => a + (card[k] || 0), 0);
    const upperBonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
    const lower = LOWER.reduce((a, k) => a + (card[k] || 0), 0);
    return { upper, upperBonus, lower, fiveKindBonus, grand: upper + upperBonus + lower + fiveKindBonus };
  }

  const api = {
    UPPER, LOWER, CATEGORIES, LABELS, HINTS,
    UPPER_BONUS_THRESHOLD, UPPER_BONUS, FIVE_KIND_BONUS,
    rawScore, scoreFor, bonusFor, allowedCategories, totals, isFiveKind,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scoring = api;
})(typeof window !== "undefined" ? window : globalThis);
