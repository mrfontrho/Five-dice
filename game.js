(function () {
  const S = window.Scoring;
  const MAX_PLAYERS = 4;
  const ROLLS_PER_TURN = 3;
  const BEST_KEY = "five-dice-best";

  // Pip positions on a 3x3 grid (0..8) for faces 1..6.
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  const $ = (id) => document.getElementById(id);
  const state = { players: [], current: 0, dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false], rollsUsed: 0, round: 1, over: false, lastPlaced: null };

  // ---------- best score (per-browser convenience) ----------
  function getBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
  function setBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* ignore */ } }
  function renderBest() { const b = getBest(); $("best").textContent = b ? `Best: ${b}` : ""; }

  // ---------- setup ----------
  function addPlayerInput(name = "") {
    const box = $("playerInputs");
    if (box.children.length >= MAX_PLAYERS) return;
    const row = document.createElement("div");
    row.className = "player-row";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = `Player ${box.children.length + 1}`;
    input.value = name;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
    row.appendChild(input);
    if (box.children.length > 0) {
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "ghost"; rm.textContent = "✕"; rm.setAttribute("aria-label", "Remove player");
      rm.addEventListener("click", () => { row.remove(); refreshPlaceholders(); });
      row.appendChild(rm);
    }
    box.appendChild(row);
    refreshPlaceholders();
  }
  function refreshPlaceholders() {
    [...$("playerInputs").querySelectorAll("input")].forEach((inp, i) => (inp.placeholder = `Player ${i + 1}`));
    $("addPlayer").disabled = $("playerInputs").children.length >= MAX_PLAYERS;
  }

  function startGame() {
    const names = [...$("playerInputs").querySelectorAll("input")].map((inp, i) => inp.value.trim() || `Player ${i + 1}`);
    state.players = names.map((name) => ({ name, card: {}, fiveKindBonus: 0 }));
    state.current = 0;
    state.round = 1;
    state.over = false;
    state.lastPlaced = null;
    resetTurn();
    $("setup").classList.add("hidden");
    $("game").classList.remove("hidden");
    buildCard();
    render();
    $("rollBtn").focus();
  }

  function showSetup() {
    $("game").classList.add("hidden");
    $("setup").classList.remove("hidden");
    if (!$("playerInputs").children.length) addPlayerInput();
  }

  // ---------- turn flow ----------
  function resetTurn() {
    state.rollsUsed = 0;
    state.held = [false, false, false, false, false];
  }

  function roll() {
    if (state.over || state.rollsUsed >= ROLLS_PER_TURN) return;
    const els = $("dice").children;
    state.dice = state.dice.map((d, i) => (state.held[i] && state.rollsUsed > 0 ? d : 1 + Math.floor(Math.random() * 6)));
    state.rollsUsed++;
    render();
    for (let i = 0; i < els.length; i++) {
      if (state.held[i]) continue;
      els[i].classList.remove("rolling");
      void els[i].offsetWidth; // restart animation
      els[i].classList.add("rolling");
    }
  }

  function toggleHold(i) {
    if (state.over || state.rollsUsed === 0 || state.rollsUsed >= ROLLS_PER_TURN) return;
    state.held[i] = !state.held[i];
    renderDice();
  }

  function place(category) {
    const p = state.players[state.current];
    if (state.over || state.rollsUsed === 0) return;
    if (!S.allowedCategories(state.dice, p.card).includes(category)) return;
    p.fiveKindBonus += S.bonusFor(state.dice, p.card);
    p.card[category] = S.scoreFor(category, state.dice, p.card);
    state.lastPlaced = { player: state.current, category };

    if (state.current === state.players.length - 1) {
      if (state.round === S.CATEGORIES.length) return finish();
      state.round++;
      state.current = 0;
    } else {
      state.current++;
    }
    resetTurn();
    render();
  }

  function finish() {
    state.over = true;
    render();
    const ranked = state.players
      .map((p) => ({ name: p.name, total: S.totals(p.card, p.fiveKindBonus).grand }))
      .sort((a, b) => b.total - a.total);
    const top = ranked[0].total;
    const winners = ranked.filter((r) => r.total === top);
    const isRecord = top > getBest();
    if (isRecord) setBest(top);
    renderBest();

    $("endTitle").textContent = state.players.length === 1
      ? `Final score: ${top}${isRecord ? " — new best!" : ""}`
      : (winners.length > 1 ? `Tie at ${top}!` : `${winners[0].name} wins with ${top}!`) + (isRecord ? " New best!" : "");
    $("endList").innerHTML = "";
    for (const r of ranked) {
      const li = document.createElement("li");
      li.textContent = `${r.name}: ${r.total}`;
      $("endList").appendChild(li);
    }
    $("endDialog").showModal();
  }

  // ---------- rendering ----------
  function buildDice() {
    const box = $("dice");
    box.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "die";
      for (let p = 0; p < 9; p++) { const pip = document.createElement("span"); pip.className = "pip"; d.appendChild(pip); }
      d.addEventListener("click", () => toggleHold(i));
      box.appendChild(d);
    }
  }

  function renderDice() {
    const els = $("dice").children;
    const canHold = state.rollsUsed > 0 && state.rollsUsed < ROLLS_PER_TURN && !state.over;
    for (let i = 0; i < 5; i++) {
      const el = els[i];
      const v = state.dice[i];
      el.classList.toggle("held", state.held[i]);
      el.classList.toggle("blank", state.rollsUsed === 0);
      el.disabled = !canHold;
      [...el.children].forEach((pip, idx) => pip.classList.toggle("on", PIPS[v].includes(idx)));
      el.setAttribute("aria-label", state.rollsUsed === 0 ? `Die ${i + 1}, not rolled` : `Die ${i + 1}: ${v}${state.held[i] ? ", held" : ""}`);
      el.setAttribute("aria-pressed", String(state.held[i]));
    }
  }

  function buildCard() {
    const head = $("cardHead");
    head.innerHTML = "<th>Category</th>";
    for (const p of state.players) {
      const th = document.createElement("th");
      th.textContent = p.name;
      head.appendChild(th);
    }
    const body = $("cardBody");
    body.innerHTML = "";
    const row = (label, key, cls, hint) => {
      const tr = document.createElement("tr");
      if (cls) tr.className = cls;
      const td = document.createElement("td");
      td.textContent = label;
      if (hint) { const h = document.createElement("span"); h.className = "hint"; h.textContent = hint; td.appendChild(h); }
      tr.appendChild(td);
      state.players.forEach((_, pi) => {
        const c = document.createElement("td");
        c.className = "cell";
        c.dataset.key = key;
        c.dataset.player = pi;
        if (S.CATEGORIES.includes(key)) {
          c.addEventListener("click", () => { if (pi === state.current) place(key); });
          c.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && pi === state.current) { e.preventDefault(); place(key); } });
        }
        tr.appendChild(c);
      });
      body.appendChild(tr);
    };
    row("Upper section", "", "section");
    S.UPPER.forEach((k) => row(S.LABELS[k], k, "", S.HINTS[k]));
    row("Upper total", "upper", "total");
    row(`Bonus (${S.UPPER_BONUS_THRESHOLD}+)`, "upperBonus", "total");
    row("Lower section", "", "section");
    S.LOWER.forEach((k) => row(S.LABELS[k], k, "", S.HINTS[k]));
    row("Five of a Kind bonus", "fiveKindBonus", "total");
    row("Grand total", "grand", "total");
  }

  function renderCard() {
    const heads = $("cardHead").children;
    state.players.forEach((_, pi) => heads[pi + 1].classList.toggle("active", pi === state.current && !state.over));

    for (const td of $("cardBody").querySelectorAll("td.cell")) {
      const key = td.dataset.key;
      if (!key) continue;
      const pi = Number(td.dataset.player);
      const p = state.players[pi];
      td.classList.remove("pick", "zero", "just");
      td.removeAttribute("tabindex");
      td.removeAttribute("role");

      if (S.CATEGORIES.includes(key)) {
        const filled = p.card[key] !== undefined;
        if (filled) {
          td.textContent = p.card[key];
          if (state.lastPlaced && state.lastPlaced.player === pi && state.lastPlaced.category === key) td.classList.add("just");
        } else if (pi === state.current && state.rollsUsed > 0 && !state.over
                   && S.allowedCategories(state.dice, p.card).includes(key)) {
          const v = S.scoreFor(key, state.dice, p.card);
          td.textContent = v;
          td.classList.add("pick");
          if (v === 0) td.classList.add("zero");
          td.tabIndex = 0;
          td.setAttribute("role", "button");
          td.setAttribute("aria-label", `Score ${v} in ${S.LABELS[key]}`);
        } else {
          td.textContent = "";
        }
      } else {
        const t = S.totals(p.card, p.fiveKindBonus);
        const v = t[key];
        td.textContent = key === "upperBonus" ? (v ? v : `${Math.max(0, S.UPPER_BONUS_THRESHOLD - t.upper)} to go`) : v;
        if (key === "upperBonus" && !v && S.UPPER.every((k) => p.card[k] !== undefined)) td.textContent = 0;
      }
    }
  }

  function render() {
    renderDice();
    renderCard();
    const p = state.players[state.current];
    const left = ROLLS_PER_TURN - state.rollsUsed;
    $("rollBtn").disabled = state.over || left === 0;
    $("rollBtn").textContent = state.rollsUsed === 0 ? "Roll" : left === 0 ? "No rolls left" : `Roll again`;
    $("rollsLeft").textContent = state.over ? "" : state.rollsUsed === 0
      ? "Roll to start your turn"
      : left === 0 ? "Pick a box to score" : `${left} roll${left === 1 ? "" : "s"} left · tap dice to hold`;
    $("turnBanner").textContent = state.over ? "Game over"
      : `Turn ${state.round} of ${S.CATEGORIES.length}` + (state.players.length > 1 ? ` · ${p.name}'s turn` : "");
  }

  // ---------- wiring ----------
  buildDice();
  addPlayerInput();
  renderBest();
  $("addPlayer").addEventListener("click", () => { addPlayerInput(); const ins = $("playerInputs").querySelectorAll("input"); ins[ins.length - 1].focus(); });
  $("startBtn").addEventListener("click", startGame);
  $("rollBtn").addEventListener("click", roll);
  $("newGameBtn").addEventListener("click", () => { if ($("endDialog").open) $("endDialog").close(); showSetup(); });
  $("playAgain").addEventListener("click", () => setTimeout(startGame, 0));

  document.addEventListener("keydown", (e) => {
    if ($("game").classList.contains("hidden") || $("endDialog").open) return;
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space" && !(e.target.classList && e.target.classList.contains("pick"))) { e.preventDefault(); roll(); }
    else if (/^[1-5]$/.test(e.key)) toggleHold(Number(e.key) - 1);
  });
})();
