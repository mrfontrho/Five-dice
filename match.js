// Match rules for Five Dice: a series of games scored by total points or by
// games won. Pure functions over a plain object, shared by the game and tests.
(function (root) {
  function newMatch(games, method, players) {
    const n = Math.max(1, players);
    return {
      games: Math.max(1, Math.min(99, Math.floor(games) || 1)),
      // Counting wins needs an opponent; a solo match is always scored by points.
      method: method === "wins" && n > 1 ? "wins" : "points",
      played: 0,
      points: Array(n).fill(0),
      wins: Array(n).fill(0),
    };
  }

  // Everyone tied for the top score wins the game (multiplayer only).
  function gameWinners(totals) {
    if (totals.length < 2) return totals.map(() => false);
    const top = Math.max(...totals);
    return totals.map((t) => t === top);
  }

  // Record one finished game. Returns who won it.
  function applyGame(match, totals) {
    const won = gameWinners(totals);
    totals.forEach((t, i) => {
      match.points[i] += t;
      if (won[i]) match.wins[i]++;
    });
    match.played++;
    return won;
  }

  const score = (match, i) => (match.method === "wins" ? match.wins[i] : match.points[i]);

  // Over when all games are played, or (wins) when nobody can catch the leader.
  function isOver(match) {
    if (match.played >= match.games) return true;
    if (match.method !== "wins") return false;
    const remaining = match.games - match.played;
    const sorted = [...match.wins].sort((a, b) => b - a);
    return sorted[0] > sorted[1] + remaining;
  }

  // Player indexes in standings order. Wins ties are broken by total points.
  function standings(match) {
    return match.points.map((_, i) => i).sort((a, b) =>
      score(match, b) - score(match, a) || match.points[b] - match.points[a] || a - b);
  }

  // Indexes of the match leader(s), applying the same tie-break as standings.
  function leaders(match) {
    const order = standings(match);
    const best = order[0];
    return order.filter((i) => score(match, i) === score(match, best) && match.points[i] === match.points[best]);
  }

  const api = { newMatch, gameWinners, applyGame, score, isOver, standings, leaders };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Match = api;
})(typeof window !== "undefined" ? window : globalThis);
