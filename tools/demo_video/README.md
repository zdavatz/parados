# Video recorders

Two of them, for two different jobs:

| script | output | what it is |
|---|---|---|
| `teach.js` | `docs/video/divided_loyalties_teaching_en.mp4` | **the teaching video** — Walter's dictated text is the script, the board illustrates it |
| `record.js` | `docs/video/divided_loyalties_demo.mp4` | a free-running demo game, no narration |

---

## teach.js — the teaching video

```sh
node teach.js en      # or: node teach.js de
```

Three scenes, one per lesson, each built directly out of the colour sets:

```
Blue +   = blue, purple, green
Yellow + = yellow, orange, green    <- green belongs to BOTH   (the dilemma)
Red +    = red, purple, orange      <- purple/orange also serve red (the danger)
```

1. **A bridge scores.** Blue plays `blue · purple · blue` and bridges it — 1 point,
   plus the region point. Also shows why the colours alternate.
2. **The green dilemma.** Blue completes its row *with a green stone*, then Yellow
   builds its own bridge off that very stone and scores from it. The shared green
   is an **endpoint** of both bridges — a legal junction, not a crossing.
3. **Red + inside your row.** Blue's row has purple on the inside. Red bridges
   `red · purple · orange` straight through it — Blue's bridge is cut, greys out
   and stops scoring.

The scenes are verified by the run itself, not by eye — it prints the score after
each one, and warns if scene 3 failed to cut anything:

```
  after scene 1: { blue: '1/1', yellow: '0/0', bridges: 1, cut: 0 }
  after scene 2: { blue: '1/1', yellow: '1/1', bridges: 2, cut: 0 }   <- green scored for BOTH
  after scene 3: { blue: '0/0', yellow: '0/0', bridges: 2, cut: 1 }   <- blue lost its point
```

Setup stones are placed silently; the **decisive move of every scene is played
live** through the real click path (inventory → cell → two double-clicks →
`tryFormBridge`), so each lesson is a legal game position, not a mock-up.

Captions are an HTML overlay injected into the page, so they stay in the Parados
look and are swappable per language — `TEXT.en` / `TEXT.de` at the top of the
script. The wording is Walter's, trimmed to caption length.

### What it does not show

`Up the Stairs` and friends have no 4×4 of contiguous on-board cells (largest
anywhere is 3×3), so the video cannot stage Walter's *"a Red + diagonal can cut a
diagonal row without even having any common squares"* — that needs two diagonals
crossing in the gap between cells. Scene 3 shows the cut *through a shared stone*
instead. Staging the gap-crossing would need a custom position from the editor.

---

## record.js — free-running demo

Records a Divided Loyalties game as video by driving the **real game page** in
Chromium — no changes to the game itself, no separate simulation.

Output: `docs/video/divided_loyalties_demo.mp4`.

## Run

```sh
cd tools/demo_video
npm init -y && npm i playwright        # once
npx playwright install chromium        # once (~115 MB, lands in ~/.cache/ms-playwright)
node record.js 0 30                    # positionIndex, maxTurns
```

Then convert the WebM Playwright produces:

```sh
ffmpeg -i out/*.webm -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
       -movflags +faststart ../../docs/video/divided_loyalties_demo.mp4
```

`node_modules/` and `out/` are gitignored.

## How the moves are chosen

The demo player does **not** hard-code coordinates and does not re-implement the
rules. For every empty cell it asks the game's own predicates — `findAutoBridges`
+ `bridgeWouldForm`, and `wouldFormBridge` for dot cells — whether a legal bridge
would exist there, then prefers moves that immediately complete one. So every
position shown is guaranteed rule-legal: if the rules change, the demo follows.

Interaction is real DOM clicking (inventory tile → cell → two double-clicks for
the bridge → END TURN), so the video shows the same highlights a player sees.

Red is deliberately down-weighted (`weight = 1` vs `length * 10`) so the demo
shows construction before destruction — otherwise cutting dominates.

## Known limits

- **The player is greedy, not didactic.** It maximises points, so Walter's
  teaching moments (the green stone that also helps the opponent; a row with a
  Red + stone on the inside) appear by chance rather than on cue. A real
  teaching video wants a hand-authored move sequence instead.
- **No audio, no captions.**
- `Up the Stairs` (index 0) is a diagonal staircase and leaves a lot of empty
  canvas. A denser position, e.g. `Octopus`, frames better.
- The `file://` console error about `divided_loyalties_starting_positions.csv`
  is expected — the page falls back to its embedded CSV copy, exactly as it does
  inside the app WebView.
