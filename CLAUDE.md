# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project

Parados is a collection of standalone web board games by Walter Prossnitz, served as static files from `/var/www/game.ywesee.com/parados/` at `game.ywesee.com/parados`. Each game is one self-contained `.html` file (markup + `<style>` + `<script>`). No build, no package manager, no test framework, no dependencies. To run: open the file in a browser.

`index.html` is the landing page.

## Architecture

- **Single-file pattern** per game.
- **Localization by duplication:** language variants are separate files (e.g. `kangaroo.html` DE, `kangaroo_en.html`, `_jp`, `_cn`, `_ua`). When changing game logic, propagate to all variants.
- **Common JS shape:** `gameState` string state machine, 2D `board[y][x]`, `renderBoard()` + `initGame()`, `historyStack` + `undoMove()`, `localStorage` for prefs.

## Games

### `kangaroo.html` (+ `_en`, `_jp`, `_cn`, `_ua`) — DUK (The Impatient Kangaroo)
Grid puzzle. Kangy jumps over green/blue dishes ("catapult" jumps, color alternation). Before each jump, the player may move one dish by one square. Modes: LEVEL, RANDOM, EDITOR, REPLAY.

- Dish move: 🖐️ button OR double-click a dish then click target (mobile-friendly shortcut).
- RANDOM has 3 zone sizes (6×6 / 8×8 / full); `isColorBalanced` enforces ≥30% of each color per half, with player escape hatch ("Neues Spiel" if a half has ≥3 excess of one color).
- `LEVEL_DATABASE` has 3 tiers (Anfänger / Mittelstufe / Fortgeschritten); A/B start toggles where defined.
- REPLAY loads exported CSV game logs (two-pass reconstruction).

**Don't touch:** dish-move shortcut wiring (`ondblclick` + `touch-action: manipulation`) — Walter playtested.

### `divided_loyalties.html` (+ `_en`) — Divided Loyalties
Connect-4 with 6 colors. Two-player tile + bridge building. Non-square grid (`GRID_W` × `GRID_H`, computed per position with +2 margin for off-board placements). `_en` is a UI-only translation — embedded CSV `position_name` values stay English (`Up the Stairs`, `Wind wheel`, …) so `slugifyName` yields the same hash anchors in both files and shared links travel across language variants.

- Positions: external `divided_loyalties_starting_positions.csv` + embedded copy in HTML (app WebViews can't `fetch()` over `file://`, so the embedded copy is what ships). **Sync both when editing.** CSV format: `position_id,position_name,row,c0..cN`; cell value `'.'` = empty, `'o'` = placement dot, anything else = board token. Each unique token = one separately scored board.
- Bridges: manual via double-click two endpoints (on-board placements). **Exception:** dot placements auto-form the justifying bridge, since the rule already requires one.
- No 3→4 extension: once an active 3-bridge exists, can't add a 4th over the same row.
- Cut bridges stay in `activeBridges` with `cut:true` — score deducted, but still block new bridges (`checkCollision` walks them).
- Score split: `bridgeScore` (3=1pt, 4=2pts) + `regionScore` (first scoring bridge per player×board whose *inner* cells touch a region = +1).
- Undo + save: `undoStack` snapshots before each user-input mutation; `localStorage["dl_savegame"]` auto-saves; `▶ Letztes Spiel fortsetzen` in setup; manual JSON export/import + WhatsApp share.
- Editor: custom positions with independent W×H, brush bar of board tokens + Punkt + eraser, persisted to `localStorage["dl_custom_positions"]`. CSV export + WhatsApp share use shared `buildPositionCSV()`.
- Stones nearly fill the cell (`--tile-size: calc(var(--cs) - 4px)`). Bridge endpoints offset by `0.50·cellSize` (don't graze stones). Bridges over stones (`#bridge-layer z-index:20`, `.tile z-index:15`).

**Don't touch:**
- **No `wa.me` redirect** in any share-fallback path (`shareCSVViaWhatsApp`, `shareGameJSONViaWhatsApp`, `shareOnWhatsApp`). Android WebView can't dispatch `whatsapp://` → `ERR_UNKNOWN_URL_SCHEME`. Fallback = download + alert.
- **No `text:` field** on `navigator.share` calls that pass `files:` — Android WhatsApp drops the file when both are present.
- **Don't "rebalance" `BLUE_BATCH` / `YELLOW_BATCH`** — Walter confirmed the per-batch asymmetry (yellow gets 1 purple vs blue's 3) is intentional role-symmetry.
- **Color brightness hierarchy:** blue/yellow may be bright; red/violet/orange stay darker (red = "evil" defensive color); green darkest. Bridges always one Material step darker than their stone.
- **Board grays:** `S→#3a3a3a` (darkest), `W→#6a6a6a` (middle), `G→#9a9a9a` (lightest) — not monotonic by cell count, per Walter's order.
- **Don't reintroduce auto-dots** in the editor — Walter places them explicitly with the Punkt brush.

### `democracy.html` (+ `_en`) / `democracy_remote.html` — Democracy in Space
Area-majority game (Electoral College concept). Local = pass-and-play; remote uses PeerJS. HTML canvas for connection lines. `_en` is a UI-only translation of the local variant (no hash anchors here — setup is randomized).

### `makalaina.html` / `makalaina_remote.html` — MAKA LAINA
2-player disc collection on 12×12. 54 discs (36 primary numbered 1–6 in R/B/Y, 18 secondary in G/O/P). Draft system: after each collection, draw 1 from bag and place in your LOS. Sacrifice/relinquish mechanic when stuck (relinquish capped at 2/player). Winner = most colors won (tiebreak: highest single-color score). Remote uses PeerJS with full state sync.

- **Opening flow (Walter's rule — fair under any disc layout):** 24 random discs are dropped onto the empty board first. Then **Player 1 places both collectors** (one click → Black, second → White). Once both are down, **Player 2 picks which colour they want** — Player 1 plays the other and goes first. State machine: `SETUP → PLACEMENT → P2_CHOOSE → PLAY`. In the remote variant, host = P1 (the only one allowed to click during PLACEMENT); the joiner = P2 picks via `p2PicksColor()` which sends a `p2_pick_color` PeerJS message + a follow-up `state_sync`. **No curated starting positions** — Walter removed them; opening fairness comes from P2's colour pick, not from balanced disc layouts.
- **Undo:** `↶ Undo move` button in `#game-actions`. Every `saveSnapshot(desc)` captures full state (`cells`, `bag` contents, `gameState`, `scores`, `playerFlags`, `collectors`, `collectedDiscs`, `relinquished`/`relinquishCount`, `draftChosen`, `pendingExtraTurn`, `selectedIdx`, `sacrificeRange`, `sacrificingPlayer`, `isFirstMove`). `undoMove()` pops the last snapshot and restores live state from the new head, hides draft/sacrifice panels, exits review mode. Disabled when `moveHistory.length <= 1` or `gameState === 'END'`. `applyPositionData()` and `startRandom()` both call `resetGameState()` so test-playing from the editor after a prior game starts fresh.
- **Custom-position editor (local only):** `mlOpenEditor(null)` opens the 12×12 painter. Brush tokens — `R1..R6`/`B1..B6`/`Y1..Y6` for primary discs, `G`/`O`/`P` for secondaries; paint keyed by `y*12+x`. Save → `localStorage["ml_custom_positions"]` as `{customId, name, d:[[x,y,color,num],...]}`. **Collectors are NOT part of the position** — P1 places them live at game start. Legacy customs with `b`/`w` fields still load (the fields are ignored). CSV export emits the long format (`position_id,element,x,y,color,number`) with `disc` rows only (no `collector_black`/`collector_white`). Share via `navigator.share({files:[csv]})` with no `text:` (Android WhatsApp file-drop bug); fallback = download only — never `wa.me` (`ERR_UNKNOWN_URL_SCHEME`).

### `capovolto.html` — Capovolto
Othello on a polyomino grid. Place 18 polyominoes, then alternate numbered discs across 6 rounds. Flip 4-disc lines (2 of each color); opponent's last value sets your direction (even=H/V, odd=diagonal). Scored by value majority per polyomino.

### `rainbow_blackjack.html` (+ `_en`, `_remote`) — Rainbow Blackjack
2-player tower-building to 21. 36 colored stones + 6 gray jokers. Each colored stone can go in its own tower or the two color-wheel neighbors. Jokers copy previous value; can't be first or consecutive. First to own 3 towers at exactly 21 wins instantly; else most towers. Remote uses PeerJS. Three Share-on-WhatsApp button instances (setup/game/scoring `<h1>`s).

### `frankenstein.html` — Frankenstein
Memory game, 1–4 players. Flip cards to build a complete body from torso outward (or reversed). 32/48/64 cards for 2/3/4 players. Strict torso adjacency per limb; head needs a top torso. Build modes: Classic (torso→out), Reverse (extremities→in), Mixed (alternate per player). Color-specific head designs (green/orange/purple/blue) with mix-and-match ear halves. Heads span 2 grid columns. "View Frankies" at game end before new game.

## Share on WhatsApp button

Every game has a Share-on-WhatsApp button right of the `<h1>` (green `#25D366`, `gap:14px`).

`shareOnWhatsApp()` flow:
1. If `window.location.protocol === "file:"`, rewrite to `https://game.ywesee.com/parados/<filename>` (WebView container paths are useless to recipients). **Keep this guard for any new game.**
2. Try `navigator.share({ text: msg })` first.
3. Only if `navigator.share` is missing, fall back to `wa.me/?text=` (iOS: `window.location.href`; else `window.open`).

The `navigator.share` short-circuit prevents Android WebView from following `wa.me`'s redirect to `whatsapp://` and hitting `ERR_UNKNOWN_URL_SCHEME`. Do NOT reorder.

For file shares (CSV / saved game JSON), use `navigator.share({ files:[file], title:'…' })` — no `text:`, no `wa.me` fallback. See divided_loyalties guardrails.

## Hash deep-links per position

`divided_loyalties.html` (+ `_en`) and `kangaroo.html` (+ 4 language variants) accept a URL hash that auto-launches a specific starting position on load and on `hashchange`. The pattern: `findPositionByHash(hash)` resolves either a slug or a numeric index, and `setPositionTitle(label)` updates an inline `<span id="position-title">` in the H1 plus `document.title`. `shareOnWhatsApp` appends the active position's slug to `shareUrl` and includes the position name in the message body.

**Cross-language slugs:** kangaroo levels use English mnemonic slugs (`first-steps`, `the-block`, `shifting`, `staircase`, `scattered`, `slant`, `the-cross`) stored in `LEVEL_DATABASE[*].id` — identical across all 5 language variants, so `kangaroo_jp.html#the-cross` and `kangaroo_en.html#the-cross` resolve to the same level. Numeric `#1`-`#7` works as shorthand by `LEVEL_DATABASE` index. Trailing `b` selects start variant B (`#the-crossb`). The `findLevelByHash` regex `[a-z0-9-]+?` allows dashes inside the slug. **Don't switch slugs to localized names** — that would break cross-variant link sharing.

**makalaina has no hash deep-links** — curated positions were removed (Walter's fairness rule lives in the opening sequence, not in disc layouts). `currentPosition` is still passed in the PeerJS `state_sync` payload but no longer drives any title or URL state.

**Localized share messages:** kangaroo's `shareOnWhatsApp` message is localized per variant. DE uses "Spiele DUK — Das ungeduldige Känguru — Stufe X: …" + "Hol dir die Parados-App:"; EN uses "Play TIK — The Impatient Kangaroo — Level X: …" + "Get the Parados app:" (note: EN H1 is rebranded `TIK 🦘`, not DUK); JP, CN, UA each have their own localized verb and full game name. `setPositionTitle`'s `document.title` prefix is localized too (e.g. `せっかちなカンガルー — …` in JP).

**Anchor links reference:** `docs/parados_anchor_links.pdf` lists every direct-entry URL across all games with clickable hyperlinks (60 anchors total: 12 DL-DE + 12 DL-EN + 7×5 DUK + repo link — DL has 12 starting positions as of 2026-05-16: a 4-round set (ids 1–6) + a 3-round set (ids 7–12); regenerate the PDF after adding/removing positions). Regenerate via LibreOffice from the source HTML — URLs must be wrapped in explicit `<a href>` tags or the `writer_pdf` filter won't emit `/URI` annotations and the links render as plain text.

## Server-side

`cgi-bin/save_csv.py` (Python 3 CGI): accepts POST `{game, csv}`, saves to `csv/` as `gamename_HHMM_dd.mm.yyyy.csv` (collision-avoidance suffix). `csv/` owned by `www-data`. Apache: `cgid` module with `ExecCGI` on `cgi-bin/`.

Game CSV exports (`downloadCSV()`) POST to this endpoint and also trigger a local browser download.

## UI conventions

- Rules button at the very top, above the title.
- Rules modal is `localStorage`-gated auto-show with a close button at the bottom ("Verstanden!" / "Got it!" / "Schließen").
- Share-on-WhatsApp button right of `<h1>`.

## Git

Single-branch on `main`; commit direct. Remote: `https://github.com/zdavatz/parados.git`.
