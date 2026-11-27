(function () {
  const S = window.Scoring;
  const P = window.Profiles;
  const MAX_PLAYERS = 4;
  const ROLLS_PER_TURN = 3;
  const SAVE_KEY = "five-dice-current";
  const LINEUP_KEY = "five-dice-last-lineup";
  const NEW = "__new__";
  const GUEST = "__guest__";

  // Pip positions on a 3x3 grid (0..8) for faces 1..6.
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };

  let data = P.load();
  let state = null;

  // ---------- small storage helpers (all failures are non-fatal) ----------
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  // ---------- views ----------
  function showView(name) {
    const playing = state && !state.over;
    $("setup").classList.toggle("hidden", name !== "play" || playing);
    $("game").classList.toggle("hidden", name !== "play" || !playing);
    $("profilesView").classList.toggle("hidden", name !== "profiles");
    $("tabPlay").classList.toggle("active", name === "play");
    $("tabProfiles").classList.toggle("active", name === "profiles");
    $("tabPlay").setAttribute("aria-pressed", String(name === "play"));
    $("tabProfiles").setAttribute("aria-pressed", String(name === "profiles"));
    if (name === "profiles") renderProfiles();
    if (name === "play" && !playing) renderSetup();
  }

  // ---------- setup ----------
  function playerRow(choice) {
    const select = el("select", { className: "player-select", ariaLabel: "Player" });
    const nameInput = el("input", { type: "text", maxLength: 16, className: "player-name" });
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });

    for (const p of P.list(data)) select.append(el("option", { value: p.id, textContent: p.name }));
    select.append(el("option", { value: NEW, textContent: "+ New profile…" }));
    select.append(el("option", { value: GUEST, textContent: "Guest (stats not saved)" }));

    const sync = () => {
      const v = select.value;
      nameInput.classList.toggle("hidden", v !== NEW && v !== GUEST);
      nameInput.placeholder = v === NEW ? "Profile name" : "Guest name (optional)";
    };
    select.addEventListener("change", () => { sync(); if (!nameInput.classList.contains("hidden")) nameInput.focus(); });

    const row = el("div", { className: "player-row" }, select, nameInput);
    const rm = el("button", { type: "button", className: "ghost icon", textContent: "✕", ariaLabel: "Remove player" });
    rm.addEventListener("click", () => { row.remove(); refreshRows(); });
    row.append(rm);

    const valid = choice && (choice === GUEST || choice === NEW || data.profiles[choice]);
    select.value = valid ? choice : (P.list(data).length ? P.list(data)[0].id : NEW);
    sync();
    return row;
  }

  function refreshRows() {
    const rows = $("playerRows").children;
    for (const r of rows) r.querySelector(".icon").classList.toggle("invisible", rows.length === 1);
    $("addPlayer").disabled = rows.length >= MAX_PLAYERS;
  }

  function renderSetup() {
    const box = $("playerRows");
    box.innerHTML = "";
    const lineup = (store.get(LINEUP_KEY) || []).filter((id) => data.profiles[id]);
    (lineup.length ? lineup : [null]).forEach((id) => box.append(playerRow(id)));
    refreshRows();
    $("setupError").textContent = "";

    const saved = store.get(SAVE_KEY);
    $("resumeBox").classList.toggle("hidden", !saved);
    if (saved) $("resumeText").textContent =
      `Game in progress: turn ${saved.round} of 13 · ${saved.players.map((p) => p.name).join(", ")}`;
  }

  function addPlayerRow() {
    if ($("playerRows").children.length >= MAX_PLAYERS) return;
    // Suggest the first saved profile not already picked.
    const picked = [...$("playerRows").querySelectorAll("select")].map((s) => s.value);
    const next = P.list(data).find((p) => !picked.includes(p.id));
    const row = playerRow(next ? next.id : NEW);
    $("playerRows").append(row);
    refreshRows();
    row.querySelector("select").focus();
  }

  function startGame() {
    const err = (msg) => { $("setupError").textContent = msg; };
    const rows = [...$("playerRows").children];
    const chosen = [];
    const newNames = [];
    for (const [i, r] of rows.entries()) {
      const v = r.querySelector("select").value;
      const name = r.querySelector(".player-name").value.trim();
      if (v === NEW) {
        if (!name) return err(`Enter a name for player ${i + 1}'s new profile.`);
        if (P.nameTaken(data, name) || newNames.includes(name.toLowerCase()))
          return err(`"${name}" is already a profile. Pick it from the list instead.`);
        newNames.push(name.toLowerCase());
        chosen.push({ kind: "new", name });
      } else if (v === GUEST) {
        chosen.push({ kind: "guest", name: name || `Guest ${i + 1}` });
      } else {
        if (chosen.some((c) => c.id === v)) return err(`${data.profiles[v].name} is listed twice.`);
        chosen.push({ kind: "profile", id: v, name: data.profiles[v].name });
      }
    }
    for (const c of chosen) if (c.kind === "new") { c.id = P.createProfile(data, c.name).id; c.kind = "profile"; }
    if (newNames.length) P.save(data);
    store.set(LINEUP_KEY, chosen.filter((c) => c.kind === "profile").map((c) => c.id));

    const mode = document.querySelector('input[name="mode"]:checked').value;
    state = {
      mode,
      players: chosen.map((c) => ({ name: c.name, profileId: c.kind === "profile" ? c.id : null, card: {}, fiveKindBonus: 0 })),
      current: 0, round: 1, over: false, lastPlaced: null, undo: null,
      dice: [], held: [], rollsUsed: 0, tab: "dice", viewPlayer: null,
    };
    resetTurn();
    enterGame();
  }

  function enterGame() {
    buildCard();
    $("virtualControls").classList.toggle("hidden", state.mode !== "virtual");
    $("manualControls").classList.toggle("hidden", state.mode !== "manual");
    showView("play");
    setTab(state.tab || "dice");
    if (state.tab !== "card") (state.mode === "virtual" ? $("rollBtn") : $("facePad").firstChild).focus();
  }

  function setTab(tab) {
    if (!state) return;
    state.tab = tab;
    const dice = tab === "dice";
    $("dicePanel").hidden = !dice;
    $("cardPanel").hidden = dice;
    for (const [btn, on] of [[$("subDice"), dice], [$("subCard"), !dice]]) {
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", String(on));
      btn.tabIndex = on ? 0 : -1;
    }
    if (dice) state.viewPlayer = null;
    render();
  }

  function resumeGame() {
    const saved = store.get(SAVE_KEY);
    if (!saved) return renderSetup();
    state = { tab: "dice", viewPlayer: null, ...saved, rolling: false };
    // A profile deleted meanwhile becomes a guest.
    for (const p of state.players) if (p.profileId && !data.profiles[p.profileId]) p.profileId = null;
    enterGame();
  }

  // ---------- turn flow ----------
  function resetTurn() {
    state.rollsUsed = 0;
    state.held = [false, false, false, false, false];
    state.dice = state.mode === "manual" ? [null, null, null, null, null] : [1, 1, 1, 1, 1];
  }

  const ready = () => state.mode === "manual" ? state.dice.every(Boolean) : state.rollsUsed > 0 && !state.rolling;
  const randomFace = () => 1 + Math.floor(Math.random() * 6);
  const viewIdx = () => (state.viewPlayer == null || state.over ? state.current : state.viewPlayer);

  function setFace(dieEl, v) {
    [...dieEl.children].forEach((pip, idx) => pip.classList.toggle("on", PIPS[v].includes(idx)));
  }

  // Roll the unheld dice: they tumble and flicker through random faces,
  // slowing down before landing on the final values.
  function roll() {
    if (!state || state.over || state.mode !== "virtual" || state.rolling || state.rollsUsed >= ROLLS_PER_TURN) return;
    const moving = state.dice.map((_, i) => !(state.held[i] && state.rollsUsed > 0));
    const final = state.dice.map((d, i) => (moving[i] ? randomFace() : d));
    state.rollsUsed++;

    const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { state.dice = final; render(); return; }

    state.rolling = true;
    render();
    const els = $("dice").children;
    moving.forEach((m, i) => {
      if (!m) return;
      els[i].classList.remove("rolling", "land");
      els[i].style.setProperty("--spin", `${(Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 240)}deg`);
      void els[i].offsetWidth; // restart the animation
      els[i].classList.add("rolling");
    });
    const start = performance.now();
    const DURATION = 700;
    const tick = () => {
      const t = performance.now() - start;
      if (t < DURATION) {
        moving.forEach((m, i) => { if (m) setFace(els[i], randomFace()); });
        setTimeout(tick, 55 + t / 8); // frames get slower as the dice settle
        return;
      }
      state.dice = final;
      state.rolling = false;
      moving.forEach((m, i) => {
        if (!m) return;
        els[i].classList.remove("rolling");
        els[i].classList.add("land");
        setTimeout(() => els[i].classList.remove("land"), 300);
      });
      render();
    };
    tick();
  }

  function tapDie(i) {
    if (!state || state.over || state.rolling) return;
    if (state.mode === "manual") {
      state.dice[i] = state.dice[i] ? (state.dice[i] % 6) + 1 : 1; // cycle 1..6
    } else {
      if (state.rollsUsed === 0 || state.rollsUsed >= ROLLS_PER_TURN) return;
      state.held[i] = !state.held[i];
    }
    render();
  }

  function enterFace(v) {
    if (!state || state.over || state.mode !== "manual") return;
    const i = state.dice.indexOf(null);
    if (i === -1) return;
    state.dice[i] = v;
    render();
  }

  function removeLastFace() {
    if (!state || state.mode !== "manual") return;
    for (let i = 4; i >= 0; i--) if (state.dice[i]) { state.dice[i] = null; break; }
    render();
  }

  function snapshot() {
    const { undo, rolling, ...rest } = state;
    return JSON.parse(JSON.stringify(rest));
  }

  function place(category) {
    if (!state || state.over || !ready() || viewIdx() !== state.current) return;
    const p = state.players[state.current];
    if (!S.allowedCategories(state.dice, p.card).includes(category)) return;
    const before = snapshot();
    const bonus = S.bonusFor(state.dice, p.card);
    p.fiveKindBonus += bonus;
    p.card[category] = S.scoreFor(category, state.dice, p.card);
    state.lastPlaced = { player: state.current, category, value: p.card[category], bonus };

    if (state.current === state.players.length - 1) {
      if (state.round === S.CATEGORIES.length) return finish();
      state.round++;
      state.current = 0;
    } else {
      state.current++;
    }
    resetTurn();
    state.undo = before;
    setTab("dice"); // next turn starts on the Dice tab
  }

  function undo() {
    if (!state || !state.undo || state.rolling) return;
    state = { ...state.undo, undo: null, rolling: false };
    setTab(state.tab);
  }

  function quit() {
    if (!confirm("End this game without saving it to anyone's stats?")) return;
    store.del(SAVE_KEY);
    state = null;
    showView("play");
  }

  function finish() {
    state.over = true;
    state.undo = null;
    store.del(SAVE_KEY);
    renderCard();

    const results = state.players.map((p) => ({ p, total: S.totals(p.card, p.fiveKindBonus).grand }));
    const top = Math.max(...results.map((r) => r.total));
    const multi = state.players.length > 1;
    for (const r of results) {
      r.won = multi && r.total === top;
      if (r.p.profileId) {
        const rec = P.recordGame(data, r.p.profileId, {
          card: r.p.card, fiveKindBonus: r.p.fiveKindBonus, opponents: state.players.length - 1, won: r.won,
        });
        r.personalBest = rec && rec.personalBest;
      }
    }
    if (results.some((r) => r.p.profileId)) P.save(data);

    const winners = results.filter((r) => r.total === top);
    $("endTitle").textContent = !multi ? `Final score: ${top}`
      : winners.length > 1 ? `Tie at ${top}!` : `${winners[0].p.name} wins with ${top}!`;
    const list = $("endList");
    list.innerHTML = "";
    for (const r of [...results].sort((a, b) => b.total - a.total)) {
      const li = el("li", {}, el("span", { textContent: r.p.name }), el("b", { textContent: r.total }));
      if (r.personalBest) li.append(el("span", { className: "badge", textContent: "New personal best" }));
      if (!r.p.profileId) li.append(el("span", { className: "muted small-text", textContent: "guest" }));
      list.append(li);
    }
    $("viewStats").classList.toggle("hidden", !results.some((r) => r.p.profileId));
    $("endDialog").showModal();
  }

  // ---------- game rendering ----------
  function buildDice() {
    const box = $("dice");
    for (let i = 0; i < 5; i++) {
      const d = el("button", { type: "button", className: "die" });
      for (let p = 0; p < 9; p++) d.append(el("span", { className: "pip" }));
      d.addEventListener("click", () => tapDie(i));
      box.append(d);
    }
    const pad = $("facePad");
    for (let v = 1; v <= 6; v++) {
      const b = el("button", { type: "button", className: "face-btn", ariaLabel: `Enter ${v}` });
      for (let p = 0; p < 9; p++) b.append(el("span", { className: "pip" + (PIPS[v].includes(p) ? " on" : "") }));
      b.addEventListener("click", () => enterFace(v));
      pad.append(b);
    }
  }

  function renderDice() {
    const els = $("dice").children;
    const manual = state.mode === "manual";
    const canHold = !manual && state.rollsUsed > 0 && state.rollsUsed < ROLLS_PER_TURN && !state.over && !state.rolling;
    for (let i = 0; i < 5; i++) {
      const d = els[i];
      const v = state.dice[i];
      const blank = manual ? !v : state.rollsUsed === 0;
      d.classList.toggle("held", !manual && state.held[i]);
      d.classList.toggle("blank", blank);
      d.classList.toggle("editable", manual);
      d.disabled = manual ? state.over : !canHold;
      d.classList.toggle("holdable", canHold);
      if (!(state.rolling && d.classList.contains("rolling")))
        [...d.children].forEach((pip, idx) => pip.classList.toggle("on", !!v && !blank && PIPS[v].includes(idx)));
      if (manual) d.setAttribute("aria-label", v ? `Die ${i + 1}: ${v}. Tap to change.` : `Die ${i + 1}: empty. Tap to set.`);
      else d.setAttribute("aria-label", blank ? `Die ${i + 1}, not rolled` : `Die ${i + 1}: ${v}${state.held[i] ? ", held" : ""}`);
      if (manual) d.removeAttribute("aria-pressed"); else d.setAttribute("aria-pressed", String(state.held[i]));
    }
    for (const b of $("facePad").children) b.disabled = state.over || state.dice.every(Boolean);
    $("clearDice").disabled = !state.dice.some(Boolean);
  }

  function buildCard() {
    const body = $("cardBody");
    body.innerHTML = "";
    const row = (label, key, cls, hint) => {
      const first = el("td", { textContent: label });
      if (hint) first.append(el("span", { className: "hint", textContent: hint }));
      const cell = el("td", { className: "cell" });
      const tr = el("tr", { className: cls || "" }, first, cell);
      tr.dataset.key = key;
      if (S.CATEGORIES.includes(key)) {
        tr.addEventListener("click", () => { if (tr.classList.contains("pick")) place(key); });
        tr.addEventListener("keydown", (e) => {
          if ((e.key === "Enter" || e.key === " ") && tr.classList.contains("pick")) { e.preventDefault(); place(key); }
        });
      }
      body.append(tr);
    };
    row("Upper section", "", "section");
    S.UPPER.forEach((k) => row(S.LABELS[k], k, "", S.HINTS[k]));
    row("Upper total", "upper", "total");
    row(`Bonus (${S.UPPER_BONUS_THRESHOLD}+)`, "upperBonus", "total");
    row("Lower section", "", "section");
    S.LOWER.forEach((k) => row(S.LABELS[k], k, "", S.HINTS[k]));
    row("Five of a Kind bonus", "fiveKindBonus", "total");
    row("Grand total", "grand", "total grand");
  }

  // The scorecard tab shows one player's card: the current player by default,
  // or another player picked from the standings strip (read-only).
  function renderCard() {
    const pi = viewIdx();
    const p = state.players[pi];
    const mine = pi === state.current && !state.over;
    const live = mine && ready();
    const allowed = live ? S.allowedCategories(state.dice, p.card) : [];
    const t = S.totals(p.card, p.fiveKindBonus);
    $("cardWho").textContent = state.players.length > 1 ? p.name : "Score";

    for (const tr of $("cardBody").querySelectorAll("tr")) {
      const key = tr.dataset.key;
      if (!key) continue;
      const td = tr.lastChild;
      tr.classList.remove("pick", "zero", "just", "filled", "open");
      tr.removeAttribute("tabindex");
      tr.removeAttribute("role");
      tr.removeAttribute("aria-label");

      if (S.CATEGORIES.includes(key)) {
        if (p.card[key] !== undefined) {
          td.textContent = p.card[key];
          tr.classList.add("filled");
          const lp = state.lastPlaced;
          if (lp && lp.player === pi && lp.category === key && state.tab === "card") tr.classList.add("just");
        } else if (allowed.includes(key)) {
          const v = S.scoreFor(key, state.dice, p.card);
          td.textContent = v;
          tr.classList.add("pick");
          if (v === 0) tr.classList.add("zero");
          tr.tabIndex = 0;
          tr.setAttribute("role", "button");
          tr.setAttribute("aria-label", `Score ${v} in ${S.LABELS[key]}`);
        } else {
          td.textContent = "";
          tr.classList.add("open");
        }
      } else if (key === "upperBonus" && !t.upperBonus) {
        const done = S.UPPER.every((k) => p.card[k] !== undefined);
        td.textContent = done ? 0 : `${Math.max(0, S.UPPER_BONUS_THRESHOLD - t.upper)} to go`;
      } else {
        td.textContent = t[key];
      }
    }

    // Standings strip (multiplayer only): everyone's total, tap to view their card.
    const st = $("standings");
    st.innerHTML = "";
    st.classList.toggle("hidden", state.players.length < 2);
    state.players.forEach((pl, i) => {
      const chip = el("button", { type: "button", className: "chip" },
        el("span", { textContent: pl.name }), el("b", { textContent: S.totals(pl.card, pl.fiveKindBonus).grand }));
      chip.classList.toggle("selected", i === pi);
      chip.classList.toggle("turn", i === state.current && !state.over);
      chip.setAttribute("aria-pressed", String(i === pi));
      chip.setAttribute("aria-label", `${pl.name}: ${S.totals(pl.card, pl.fiveKindBonus).grand} points${i === state.current ? ", playing now" : ""}`);
      chip.addEventListener("click", () => { state.viewPlayer = i === state.current ? null : i; render(); });
      st.append(chip);
    });

    // Current dice, so you can see what you're scoring without switching tabs.
    const mini = $("miniDice");
    mini.innerHTML = "";
    const showDice = state.mode === "manual" ? state.dice.some(Boolean) : state.rollsUsed > 0;
    state.dice.forEach((v, i) => {
      const d = el("span", { className: "mini-die" });
      for (let k = 0; k < 9; k++) d.append(el("span", { className: "pip" + (showDice && v && PIPS[v].includes(k) ? " on" : "") }));
      d.classList.toggle("blank", !showDice || !v);
      d.classList.toggle("held", state.mode === "virtual" && state.held[i] && showDice);
      mini.append(d);
    });
    mini.setAttribute("aria-label", showDice ? `Current dice: ${state.dice.map((v) => v || "empty").join(", ")}` : "Not rolled yet");

    const note = $("cardNote");
    note.innerHTML = "";
    const backBtn = (label) => {
      const b = el("button", { type: "button", className: "ghost small", textContent: label });
      b.addEventListener("click", () => setTab("dice"));
      return b;
    };
    if (state.over) {
      note.append(el("span", { textContent: "Game over." }));
    } else if (!mine) {
      note.append(el("span", { textContent: `Viewing ${p.name}'s card. It's ${state.players[state.current].name}'s turn.` }));
    } else if (state.rolling) {
      note.append(el("span", { textContent: "Rolling…" }));
    } else if (!live) {
      note.append(el("span", { textContent: state.mode === "virtual" ? "Roll on the Dice tab to see what you can score." : "Enter your dice on the Dice tab to see what you can score." }),
        backBtn(state.mode === "virtual" ? "Go roll" : "Enter dice"));
    } else {
      const left = ROLLS_PER_TURN - state.rollsUsed;
      note.append(el("span", { textContent: "Tap a box to score it." }));
      if (state.mode === "virtual" && left > 0) note.append(backBtn(`Roll again (${left} left)`));
      if (state.mode === "manual") note.append(backBtn("Change dice"));
    }
  }

  function bestOption() {
    const p = state.players[state.current];
    let best = null;
    for (const k of S.allowedCategories(state.dice, p.card)) {
      const v = S.scoreFor(k, state.dice, p.card);
      if (!best || v > best.v) best = { k, v };
    }
    return best;
  }

  function render() {
    if (!state) return;
    renderDice();
    renderCard();
    const p = state.players[state.current];
    const multi = state.players.length > 1;
    $("turnBanner").textContent = state.over ? "Game over"
      : `Turn ${state.round} of ${S.CATEGORIES.length}` + (multi ? ` · ${p.name}'s turn` : "");
    $("undoBtn").disabled = !state.undo || state.rolling;

    const isReady = !state.over && ready();
    $("readyDot").classList.toggle("hidden", !(isReady && state.tab === "dice"));

    let status;
    if (state.mode === "virtual") {
      const left = ROLLS_PER_TURN - state.rollsUsed;
      $("rollBtn").disabled = state.over || left === 0 || state.rolling;
      $("rollBtn").textContent = state.rolling ? "Rolling…" : state.rollsUsed === 0 ? "Roll" : left === 0 ? "No rolls left" : "Roll again";
      [...$("rollPips").children].forEach((s, i) => s.classList.toggle("used", i < state.rollsUsed));
      status = state.rolling ? "" : state.rollsUsed === 0 ? "Roll to start the turn"
        : left === 0 ? "Out of rolls. Choose where to score."
        : `${left} roll${left === 1 ? "" : "s"} left · tap dice to hold them`;
    } else {
      const filled = state.dice.filter(Boolean).length;
      status = filled < 5 ? `Enter your final dice (${filled} of 5) · tap a die to change it` : "Dice entered.";
    }
    $("statusLine").textContent = state.over ? "" : status;

    const best = isReady ? bestOption() : null;
    $("toCardBtn").classList.toggle("hidden", !best);
    if (best) $("toCardBtn").textContent = `Open scorecard → best: ${S.LABELS[best.k]} ${best.v}`;

    const t = S.totals(p.card, p.fiveKindBonus);
    const foot = $("diceFoot");
    foot.innerHTML = "";
    foot.append(el("span", { textContent: `${multi ? p.name + ": " : "Total: "}${t.grand}` }),
      el("span", { className: "muted", textContent: t.upperBonus ? "Upper bonus earned" : `Upper ${t.upper}/${S.UPPER_BONUS_THRESHOLD}` }));
    const lp = state.lastPlaced;
    if (lp && !state.over && state.players[lp.player]) {
      foot.append(el("span", { className: "muted", textContent:
        `Last: ${multi ? state.players[lp.player].name + " · " : ""}${S.LABELS[lp.category]} ${lp.value}${lp.bonus ? ` (+${lp.bonus} bonus)` : ""}` }));
    }

    if (!state.over && !state.rolling) store.set(SAVE_KEY, snapshotForSave());
  }

  function snapshotForSave() { const { rolling, ...rest } = state; return rest; }

  // ---------- profiles view ----------
  const pct = (x) => `${Math.round(x * 100)}%`;
  const fmt1 = (x) => (Math.round(x * 10) / 10).toString();
  const dateStr = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function sparkline(scores, avg) {
    const W = 280, H = 64, PAD = 6;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "spark");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Last ${scores.length} scores: ${scores.join(", ")}`);
    const min = Math.min(...scores, avg), max = Math.max(...scores, avg);
    const span = Math.max(1, max - min);
    const x = (i) => scores.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (scores.length - 1);
    const y = (v) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
    const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

    svg.append(mk("line", { x1: PAD, x2: W - PAD, y1: y(avg), y2: y(avg), class: "spark-avg" }));
    if (scores.length > 1) svg.append(mk("polyline", { points: scores.map((v, i) => `${x(i)},${y(v)}`).join(" "), class: "spark-line" }));
    scores.forEach((v, i) => {
      const g = mk("g", { class: "spark-pt" });
      const t = mk("title", {}); t.textContent = `Game ${i + 1} of last ${scores.length}: ${v}`;
      g.append(t, mk("circle", { cx: x(i), cy: y(v), r: 12, class: "spark-hit" }), mk("circle", { cx: x(i), cy: y(v), r: 4, class: "spark-dot" }));
      svg.append(g);
    });
    return svg;
  }

  function tile(label, value, sub) {
    return el("div", { className: "tile" },
      el("span", { className: "tile-label", textContent: label }),
      el("span", { className: "tile-value", textContent: value }),
      sub ? el("span", { className: "tile-sub", textContent: sub }) : null);
  }

  function profileCard(p) {
    const s = P.stats(p);
    const card = el("article", { className: "panel profile" });

    const title = el("div", { className: "profile-head" },
      el("div", {}, el("h3", { textContent: p.name }),
        el("span", { className: "muted small-text", textContent: s.games
          ? `${s.games} game${s.games === 1 ? "" : "s"} · last played ${dateStr(s.lastPlayed)}`
          : "No games yet" })));
    const actions = el("div", { className: "row-gap" });
    const renameBtn = el("button", { type: "button", className: "ghost small", textContent: "Rename" });
    const delBtn = el("button", { type: "button", className: "ghost small danger", textContent: "Delete" });
    renameBtn.addEventListener("click", () => {
      const n = prompt("New name", p.name);
      if (n == null) return;
      try { P.renameProfile(data, p.id, n); P.save(data); renderProfiles(); }
      catch (e) { alert(e.message); }
    });
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete ${p.name} and all ${s.games} saved game${s.games === 1 ? "" : "s"}? This can't be undone.`)) return;
      P.deleteProfile(data, p.id); P.save(data); renderProfiles();
    });
    actions.append(renameBtn, delBtn);
    title.append(actions);
    card.append(title);

    if (!s.games) {
      card.append(el("p", { className: "muted", textContent: "Finish a game with this profile to start tracking stats." }));
      return card;
    }

    card.append(el("div", { className: "tiles" },
      tile("Best", s.best, `low ${s.worst}`),
      tile("Average", fmt1(s.average), `last 10: ${fmt1(s.recentAverage)}`),
      tile("Wins", s.multiGames ? `${s.wins}–${s.multiGames - s.wins}` : "—", s.multiGames ? `${pct(s.winRate)} of multiplayer` : "solo only"),
      tile("Upper bonus", pct(s.bonusRate), "of games"),
      tile("Five of a Kinds", s.fiveKinds, `${fmt1(s.fiveKinds / s.games)} per game`),
    ));

    const trend = el("div", { className: "trend" },
      el("div", { className: "trend-head" },
        el("span", { textContent: `Score trend (last ${s.recentScores.length})` }),
        el("span", { className: "muted small-text" }, el("span", { className: "avg-key" }), ` average ${fmt1(s.average)}`)));
    trend.append(sparkline(s.recentScores, s.average));
    card.append(trend);

    const tbl = el("table", { className: "breakdown" },
      el("thead", {}, el("tr", {}, el("th", { textContent: "Category" }), el("th", { textContent: "Avg" }), el("th", { textContent: "Scratched" }))));
    const tb = el("tbody");
    for (const k of S.CATEGORIES) {
      tb.append(el("tr", {}, el("td", { textContent: S.LABELS[k] }), el("td", { textContent: fmt1(s.catAvg[k]) }), el("td", { textContent: pct(s.catZeroRate[k]) })));
    }
    tbl.append(tb);
    card.append(el("details", { className: "more" }, el("summary", { textContent: "Category breakdown" }), tbl));

    const recent = el("ul", { className: "recent" });
    for (const g of p.games.slice(-8).reverse()) {
      const res = g.opponents ? (g.won ? "Won" : "Lost") : "Solo";
      recent.append(el("li", {},
        el("span", { textContent: dateStr(g.date) }),
        el("span", { className: "muted", textContent: g.opponents ? `${res} vs ${g.opponents}` : res }),
        el("b", { textContent: g.score })));
    }
    card.append(el("details", { className: "more" }, el("summary", { textContent: "Recent games" }), recent));
    return card;
  }

  function renderProfiles() {
    const box = $("profileList");
    box.innerHTML = "";
    const all = P.list(data);
    if (!all.length) box.append(el("p", { className: "panel muted", textContent: "No profiles yet. Add one above, or create one when you start a game." }));
    for (const p of all) box.append(profileCard(p));
  }

  function exportProfiles() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `five-dice-profiles-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("backupMsg").textContent = "Backup downloaded.";
  }

  async function importProfiles(file) {
    try {
      const r = P.merge(data, JSON.parse(await file.text()));
      P.save(data);
      $("backupMsg").textContent = `Imported: ${r.added} new, ${r.updated} updated.`;
      renderProfiles();
    } catch (e) {
      $("backupMsg").textContent = e instanceof SyntaxError ? "That file isn't valid JSON." : e.message;
    }
  }

  // ---------- wiring ----------
  buildDice();
  $("tabPlay").addEventListener("click", () => showView("play"));
  $("tabProfiles").addEventListener("click", () => showView("profiles"));
  $("addPlayer").addEventListener("click", addPlayerRow);
  $("startBtn").addEventListener("click", startGame);
  $("resumeBtn").addEventListener("click", resumeGame);
  $("discardBtn").addEventListener("click", () => { store.del(SAVE_KEY); renderSetup(); });
  $("rollBtn").addEventListener("click", roll);
  $("clearDice").addEventListener("click", () => { state.dice = [null, null, null, null, null]; render(); });
  $("undoBtn").addEventListener("click", undo);
  $("quitBtn").addEventListener("click", quit);
  $("playAgain").addEventListener("click", () => { $("endDialog").close(); state = null; showView("play"); });
  $("viewStats").addEventListener("click", () => { $("endDialog").close(); state = null; showView("profiles"); });
  $("endDialog").addEventListener("cancel", () => { state = null; setTimeout(() => showView("play"), 0); });
  $("newProfileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    try { P.createProfile(data, $("newProfileName").value); P.save(data); $("newProfileName").value = ""; $("profileError").textContent = ""; renderProfiles(); }
    catch (er) { $("profileError").textContent = er.message; }
  });
  $("exportBtn").addEventListener("click", exportProfiles);
  $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importProfiles(e.target.files[0]); e.target.value = ""; });

  document.addEventListener("keydown", (e) => {
    if (!state || state.over || $("game").classList.contains("hidden") || $("endDialog").open) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "s") return setTab("card");
    if (k === "d") return setTab("dice");
    if (state.tab !== "dice") return; // roll/hold/enter keys only act on the Dice tab
    if (state.mode === "virtual") {
      if (e.code === "Space" && e.target.tagName !== "BUTTON") { e.preventDefault(); roll(); }
      else if (e.code === "Space" && e.target === $("rollBtn")) { e.preventDefault(); roll(); }
      else if (/^[1-5]$/.test(e.key)) tapDie(Number(e.key) - 1);
    } else {
      if (/^[1-6]$/.test(e.key)) enterFace(Number(e.key));
      else if (e.key === "Backspace") { e.preventDefault(); removeLastFace(); }
    }
  });

  // Tabs: click, or arrow keys while a tab has focus.
  $("subDice").addEventListener("click", () => setTab("dice"));
  $("subCard").addEventListener("click", () => setTab("card"));
  for (const t of [$("subDice"), $("subCard")]) {
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const next = state.tab === "dice" ? "card" : "dice";
      setTab(next);
      $(next === "dice" ? "subDice" : "subCard").focus();
    });
  }
  $("toCardBtn").addEventListener("click", () => { setTab("card"); const first = $("cardBody").querySelector("tr.pick"); if (first) first.focus({ preventScroll: true }); });

  // Keep profiles in sync if another tab changes them.
  window.addEventListener("storage", (e) => { if (e.key === "five-dice-profiles") { data = P.load(); if (!$("profilesView").classList.contains("hidden")) renderProfiles(); } });

  showView("play");
})();
