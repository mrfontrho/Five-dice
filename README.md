# Five Dice

A browser dice game and scorekeeper with the classic five-dice, 13-category rules, plus
saved player profiles with performance stats. Plain HTML/CSS/JS: no build step, no dependencies.

## Play

Open `index.html` in any modern browser (double-click it, or serve the folder with
`python3 -m http.server` and visit http://localhost:8000).

### Dice tab and Scorecard tab

During a game you switch between two tabs (tap them, or press `D` / `S`):

- **Dice:** roll (button or `Space`) and watch the unheld dice tumble and land. Tap dice
  (or press `1`–`5`) to hold them between rolls; you get up to three rolls per turn. Once you've
  rolled, a dot appears on the Scorecard tab and a shortcut shows your best-scoring option.
- **Scorecard:** the current player's card. Every box you're allowed to use shows what your
  current dice would score there (zeros in orange). Tap one to score it, and the next turn
  starts back on the Dice tab. After your third roll the Scorecard opens by itself. Possible scores appear in dashed bubbles; scores already locked in show a ✓. The dice you're scoring are shown at the top. In multiplayer, a
  strip of everyone's totals lets you look at another player's card.

**Use my own dice** mode works the same way, except the Dice tab has face buttons (or keys
`1`–`6`) to enter what you rolled on real dice. Tap a die to change it; `Backspace` removes
the last one.

Totals, the upper bonus (+35 at 63), the Five of a Kind bonus (+100) and joker rules are all
handled for you. **Undo** takes back the last box scored. A game in progress is saved
automatically, so you can close the page and resume later.

### Profiles and stats

Pick a saved profile for each player when starting a game (or create one on the spot, or play
as a guest). Finished games are recorded, and the **Profiles** tab shows for each player:

- best, lowest and average score (overall and last 10 games)
- win–loss record in multiplayer games
- how often they earn the upper bonus, and their Five of a Kind count
- a score-trend sparkline of the last 20 games
- per-category averages and how often each box gets scratched (scored as 0)
- recent game history

Profiles are stored in the browser (`localStorage`), so they stay on that device. Use
**Export** / **Import** on the Profiles tab to back them up or move them to another device.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout |
| `style.css` | Styles (light and dark mode, phone friendly) |
| `scoring.js` | Pure scoring rules, shared by the game and the tests |
| `profiles.js` | Profile storage, game history and stats |
| `game.js` | Setup, turn flow, dice, scorecard and profile screens |
| `tests/` | Unit tests for scoring and profile stats |

## Tests

```
node --test tests/*.test.js
```
