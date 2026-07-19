# Demo video recorder

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
