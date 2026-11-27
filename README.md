# Five Dice

A browser dice game with the classic five-dice, 13-category rules. Plain HTML/CSS/JS:
no build step, no dependencies.

## Play

Open `index.html` in any modern browser (double-click it, or serve the folder with
`python3 -m http.server` and visit http://localhost:8000).

- 1–4 players on one device (pass and play)
- Up to 3 rolls per turn; tap dice (or press `1`–`5`) to hold them, `Space` to roll
- The scorecard previews what each open box would score. Tap one to lock it in.
- Upper bonus (+35 at 63), Five of a Kind bonus (+100) and joker rules
- Your best score is remembered in this browser

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page layout |
| `style.css` | Styles (light and dark mode, phone friendly) |
| `scoring.js` | Pure scoring rules, shared by the game and the tests |
| `game.js` | Turn flow, dice, scorecard UI |
| `tests/scoring.test.js` | Unit tests for scoring |

## Tests

```
node --test tests/scoring.test.js
```
