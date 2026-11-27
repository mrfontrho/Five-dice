// Player profiles and performance stats for Five Dice.
// Pure functions work on a plain data object, so they run in Node for tests;
// load/save wrap localStorage in the browser.
(function (root) {
  const KEY = "five-dice-profiles";
  const S = typeof module !== "undefined" && module.exports ? require("./scoring.js") : root.Scoring;

  const empty = () => ({ version: 1, profiles: {} });

  function newId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && data.profiles ? data : empty();
    } catch { return empty(); }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  }

  const cleanName = (name) => String(name || "").trim().slice(0, 16);

  function nameTaken(data, name, exceptId) {
    const n = cleanName(name).toLowerCase();
    return Object.values(data.profiles).some((p) => p.id !== exceptId && p.name.toLowerCase() === n);
  }

  function createProfile(data, name) {
    const n = cleanName(name);
    if (!n) throw new Error("Enter a name.");
    if (nameTaken(data, n)) throw new Error(`"${n}" already exists.`);
    const p = { id: newId(), name: n, createdAt: new Date().toISOString(), games: [] };
    data.profiles[p.id] = p;
    return p;
  }

  function renameProfile(data, id, name) {
    const n = cleanName(name);
    if (!n) throw new Error("Enter a name.");
    if (nameTaken(data, n, id)) throw new Error(`"${n}" already exists.`);
    data.profiles[id].name = n;
  }

  function deleteProfile(data, id) { delete data.profiles[id]; }

  function list(data) {
    return Object.values(data.profiles).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Store one finished game for a profile.
  // result: { card, fiveKindBonus, opponents (number), won (bool), date? }
  function recordGame(data, id, result) {
    const p = data.profiles[id];
    if (!p) return null;
    const t = S.totals(result.card, result.fiveKindBonus);
    const game = {
      date: result.date || new Date().toISOString(),
      score: t.grand,
      upper: t.upper,
      upperBonus: t.upperBonus,
      lower: t.lower,
      fiveKindBonus: t.fiveKindBonus,
      fiveKinds: (result.card.fiveKind === 50 ? 1 : 0) + Math.round(t.fiveKindBonus / S.FIVE_KIND_BONUS),
      opponents: result.opponents || 0,
      won: !!result.won,
      card: { ...result.card },
    };
    const prevBest = p.games.reduce((m, g) => Math.max(m, g.score), 0);
    p.games.push(game);
    return { game, personalBest: p.games.length > 1 && game.score > prevBest };
  }

  function stats(profile) {
    const g = profile.games;
    const n = g.length;
    const multi = g.filter((x) => x.opponents > 0);
    const scores = g.map((x) => x.score);
    const avgOf = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const catAvg = {};
    for (const k of S.CATEGORIES) catAvg[k] = avgOf(g.map((x) => x.card[k] || 0));
    const catZeroRate = {};
    for (const k of S.CATEGORIES) catZeroRate[k] = n ? g.filter((x) => !x.card[k]).length / n : 0;
    const last10 = scores.slice(-10);
    return {
      games: n,
      best: n ? Math.max(...scores) : 0,
      worst: n ? Math.min(...scores) : 0,
      average: avgOf(scores),
      recentAverage: avgOf(last10),
      multiGames: multi.length,
      wins: multi.filter((x) => x.won).length,
      winRate: multi.length ? multi.filter((x) => x.won).length / multi.length : 0,
      bonusRate: n ? g.filter((x) => x.upperBonus > 0).length / n : 0,
      fiveKinds: g.reduce((a, x) => a + x.fiveKinds, 0),
      catAvg,
      catZeroRate,
      recentScores: scores.slice(-20),
      lastPlayed: n ? g[n - 1].date : null,
    };
  }

  // Merge an imported backup into existing data. Profiles with the same id are
  // replaced by whichever has more games; new ids are added.
  function merge(data, incoming) {
    if (!incoming || typeof incoming.profiles !== "object") throw new Error("Not a Five Dice backup file.");
    let added = 0, updated = 0;
    for (const p of Object.values(incoming.profiles)) {
      if (!p || !p.id || !p.name || !Array.isArray(p.games)) continue;
      const cur = data.profiles[p.id];
      if (!cur) {
        let name = cleanName(p.name), i = 2;
        while (nameTaken(data, name)) name = cleanName(p.name).slice(0, 13) + " " + i++;
        data.profiles[p.id] = { ...p, name };
        added++;
      } else if (p.games.length > cur.games.length) {
        data.profiles[p.id] = { ...p, name: cur.name };
        updated++;
      }
    }
    return { added, updated };
  }

  // ---------- Hall of Fame ----------
  // Minimum games before a player is ranked on the average and win % boards,
  // so one lucky game can't top the table.
  const HOF_MIN_GAMES = 3;

  // Sort by value (then tie-break) and assign competition ranks: 1, 1, 3, ...
  function rank(entries) {
    entries.sort((a, b) => b.value - a.value || b.tiebreak - a.tiebreak || a.name.localeCompare(b.name));
    entries.forEach((e, i) => {
      e.rank = i > 0 && e.value === entries[i - 1].value ? entries[i - 1].rank : i + 1;
    });
    return entries;
  }

  // Returns an array of leaderboards. Each board:
  //   { id, title, min (games needed, 0 if none), entries: [{ id, name, value, rank, ... }], unranked: [{ name, have }] }
  function hallOfFame(data, minGames = HOF_MIN_GAMES) {
    const rows = list(data).map((p) => ({ p, s: stats(p) })).filter((r) => r.s.games > 0);
    const board = (id, title, min, eligible, enough, toEntry, have) => ({
      id, title, min,
      entries: rank(rows.filter((r) => eligible(r) && enough(r)).map((r) => ({ id: r.p.id, name: r.p.name, ...toEntry(r) }))),
      unranked: rows.filter((r) => eligible(r) && !enough(r)).map((r) => ({ name: r.p.name, have: have(r) })),
    });
    const all = () => true;
    const multi = (r) => r.s.multiGames > 0;

    return [
      board("best", "Best game", 0, all, all, (r) => {
        const g = r.p.games.filter((x) => x.score === r.s.best).sort((a, b) => a.date.localeCompare(b.date))[0];
        return { value: r.s.best, tiebreak: r.s.average, date: g ? g.date : null };
      }),
      board("wins", "Most wins", 0, multi, all, (r) => (
        { value: r.s.wins, tiebreak: r.s.winRate, wins: r.s.wins, played: r.s.multiGames })),
      board("average", "Average", minGames, all, (r) => r.s.games >= minGames,
        (r) => ({ value: r.s.average, tiebreak: r.s.games, games: r.s.games }), (r) => r.s.games),
      board("winRate", "Win %", minGames, multi, (r) => r.s.multiGames >= minGames,
        (r) => ({ value: r.s.winRate, tiebreak: r.s.wins, wins: r.s.wins, played: r.s.multiGames }), (r) => r.s.multiGames),
    ];
  }

  const api = { load, save, empty, createProfile, renameProfile, deleteProfile, list, recordGame, stats, merge, nameTaken, hallOfFame, HOF_MIN_GAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Profiles = api;
})(typeof window !== "undefined" ? window : globalThis);
