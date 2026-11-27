# Five Dice

A browser dice game and scorekeeper with the classic five-dice, 13-category rules, plus
saved player profiles with performance stats. Plain HTML/CSS/JS: no build step, no dependencies.

## Play

Open `index.html` in any modern browser (double-click it, or serve the folder with
`python3 -m http.server` and visit http://localhost:8000).

### On your phone

Open the GitHub Pages link, then add it to your home screen (iPhone Safari: **Share → Add to
Home Screen**; Android Chrome: **⋮ → Add to Home screen**). It opens full-screen with its own
icon and works offline once it has loaded. When a new version is out, it downloads in the
background and an **Update ready** button appears at the top; tap it to switch (a game in
progress picks up where you left off).

### Sharing

Tap the share icon in the top-right corner to send the game's link with your phone's share
menu (or copy it, on browsers without one). Each person's profiles and stats stay on their own
device; use **Profiles → Export / Import** to share them.

### Dice tab and Scorecard tab

During a game you switch between two tabs (tap them, or press `D` / `S`):

- **Dice:** roll (button or `Space`) and watch the unheld dice tumble and land. Tap dice
  (or press `1`–`5`) to hold them between rolls; you get up to three rolls per turn. Once you've
  rolled, a dot appears on the Scorecard tab and a shortcut shows your best-scoring option.
- **Scorecard:** the current player's card. Every box you're allowed to use shows what your
  current dice would score there (zeros in grey). Tap one to score it, and the next turn
  starts back on the Dice tab. After your third roll the Scorecard opens by itself. Possible scores appear in dashed bubbles; scores already locked in show a ✓. The dice you're scoring are shown at the top. In multiplayer, a
  strip of everyone's totals lets you look at another player's card.

**Use my own dice** mode works the same way, except the Dice tab has face buttons (or keys
`1`–`6`) to enter what you rolled on real dice. Tap a die to change it; `Backspace` removes
the last one.

Totals, the upper bonus (+35 at 63), the Five of a Kind bonus (+100) and joker rules are all
handled for you. **Undo** takes back the last box scored. A game in progress is saved
automatically, so you can close the page and resume later.

### Scoring a turn

On the Scorecard tab, tap a box to **select** it. The total, subtotals and every player's total at the
top update live to show the result. Tap a different box to change your mind (or the same box
to clear it), then tap **Score** at the bottom to confirm.

### Single game or match

On the setup screen choose how many games to play (1–15) and, for more than one game, how the
match is decided:

- **Total points:** highest combined score across all games wins.
- **Most wins:** most games won wins ("best of"). The match ends early once nobody can catch
  the leader. A tied game counts as a win for each tied player; tied wins are broken by total points.
  Needs at least two players.

A different player starts each game. Between games a summary shows the game result and the match
standings, and during a match the score chips show each player's wins (`2W`) or running match total (`Σ410`).

### Profiles and stats

Pick a saved profile for each player when starting a game (or create one on the spot, or play
as a guest). Finished games are recorded, and the **Profiles** tab shows for each player:

- best, lowest and average score (overall and last 10 games)
- win–loss record in multiplayer games
- how often they earn the upper bonus, and their Five of a Kind count
- a score-trend sparkline of the last 20 games
- per-category averages and how often each box gets scratched (scored as 0)
- recent game history

### Hall of Fame

The **Hall of Fame** tab ranks every saved profile on four boards:

| Board | Ranked by | Shown with |
| --- | --- | --- |
| Best game | each player's highest single-game score | date of that game |
| Wins | total multiplayer games won | games played |
| Average | average score per game (needs 3+ games) | games played |
| Win % | share of multiplayer games won (needs 3+ multiplayer games) | win–loss record |

Equal values share a rank. Players below the minimum are listed under the board as not yet
ranked. Guest games don't count.

Profiles are stored in the browser (`localStorage`), so they stay on that device. Use
**Export** / **Import** on the Profiles tab to back them up or move them to another device.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout |
| `style.css` | Styles (light and dark mode, phone friendly) |
| `scoring.js` | Pure scoring rules, shared by the game and the tests |
| `profiles.js` | Profile storage, game history and stats |
| `match.js` | Match rules: points vs. wins, early finish, standings |
| `game.js` | Setup, turn flow, dice, scorecard and profile screens |
| `sw.js` | Service worker: offline copy and updates. **Bump `VERSION` on every release** |
| `manifest.webmanifest`, `icons/` | Home-screen name and icons (`icons/icon.svg` is the source) |
| `tests/` | Unit tests for scoring, profile stats and match rules |

## Tests

```
node --test tests/*.test.js
```
