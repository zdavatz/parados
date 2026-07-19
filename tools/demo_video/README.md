# Video recorders

Two of them, for two different jobs:

| script | output | what it is |
|---|---|---|
| `teach_voice.js` | `docs/video/divided_loyalties_teaching_en_voice.mp4` | **narrated by Walter himself** — audio cut from his voice memo |
| `teach.js` | `docs/video/divided_loyalties_teaching_<lang>.mp4` | **the teaching video** — Walter's dictated text is the script, the board illustrates it. 5 languages. |
| `record.js` | `docs/video/divided_loyalties_demo.mp4` | a free-running demo game, no narration |

Both are listed on `docs/video/index.html` (linked from the footer of
`index.html` and of `docs/rules/index.html`).

---

## teach_voice.js — narrated in Walter's own voice

No text-to-speech: the narration is cut straight out of
`docs/voice/Walter_Prossnitz_2026-07-19_alle-Sprachnachrichten.mp3`, so the
designer explains his own game.

This **inverts the usual order** — the audio is fixed and the board action is
paced to fit it, not the other way round.

The chapter boundaries in `docs/voice/*_transcript.md` were verified against the
recording with `silencedetect`: every one falls inside a real pause (e.g. the
3.7 s gap at 47.3–51.0 s = the transcript's 0:50 start of "The Dilemmas"), so the
cuts never clip a word. The five chapters, re-ordered for teaching:

| chapter | in the mp3 | length |
|---|---|---|
| opening | 263.92–268.42 | 4.5 s |
| introduction | 277.17–320.60 | 43.4 s |
| scoring | 95.49–152.74 | 57.3 s |
| the dilemmas | 50.97–91.25 | 40.3 s |
| continuation (diagonals, the 9/3/6 split) | 1.47–47.28 | 45.8 s |

Each is high-passed at 80 Hz and loudness-normalised to −16 LUFS. The opening is
cut short of Walter's "please also watch the video" — that sentence makes no
sense *inside* the video.

```sh
node teach_voice.js                    # writes out_voice/*.webm + marks.json
bash mux.sh out_voice/<file>.webm      # places each chapter at its logged offset
```

**Sync survives browser drift.** The script logs the wall-clock offset of every
section to `marks.json` while recording, and the mux places each audio chapter at
exactly that offset — so even if the headless browser runs slow, picture and
narration stay together. Measured drift on the committed take was under 0.1 s per
section (introduction: 43.44 s of video vs 43.42 s of audio).

---

## teach.js — the silent teaching video

```sh
node teach.js de | en | jp | cn | ua
```

All five language variants are recorded from their own game file
(`divided_loyalties_jp.html` etc.), so the *UI* is localized too, not just the
captions. The staging position is found by name — `2: Octopus` — which works in
every variant because DL position names stay English by invariant.

**Reading time is language-aware.** `MS_PER_CHAR` is 165 ms for JP/CN and 55 ms
otherwise: a CJK character carries far more meaning than a Latin one, so
counting characters alone flashed the JP/CN captions off in ~70 % of the time
the DE/EN ones got (75 s vs 107 s total). With the split, all five land at
105–117 s. If you add a language, set this deliberately.

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
