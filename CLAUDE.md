# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parados is a collection of standalone web-based board games by Walter Prossnitz, hosted at `game.ywesee.com/parados`. Each game is a single self-contained HTML file with embedded CSS and JavaScript — no build system, no dependencies, no framework.

## Development

There is no build step, no package manager, and no test framework. To run a game, open its `.html` file in a browser. The project is served as static files from `/var/www/game.ywesee.com/parados/`.

## Architecture

**Single-file pattern:** Each game is one `.html` file containing all markup, styles (in `<style>`), and logic (in `<script>`). There are no shared libraries or external dependencies.

**Landing page:** `index.html` is the main entry point listing all games with play buttons (links open in new tabs).

**Localization by duplication:** Language variants are separate files (e.g., `kangaroo.html` for German, `kangaroo_en.html` for English, `kangaroo_jp.html` for Japanese, `kangaroo_cn.html` for Chinese, `kangaroo_ua.html` for Ukrainian). When modifying game logic, changes must be propagated to all language variants.

**Games:**
- `kangaroo.html` (+ `_en`, `_jp`, `_cn`, `_ua`) — DUK (The Impatient Kangaroo): 21st century successor to Rushhour. Grid-based puzzle where Kangy the kangaroo collects food (green dishes) and water (blue dishes) for her family by jumping over them. Symmetric "catapult" jumps with color alternation. Before every jump, the player may move one dish by one square. Kangy rotates to face available jump directions; with multiple options she wobbles between them (800ms cycle, smooth CSS transitions). Supports LEVEL, RANDOM, and EDITOR modes. Has a `LEVEL_DATABASE` array for predefined puzzles across three difficulty tiers: Anfänger (3 levels, 2–3 dishes), Mittelstufe (3 levels, 6–8 dishes), and Fortgeschritten (1 level, 12 dishes).
- `divided_loyalties.html` — Divided Loyalties: connect 4 with 6 colours on an 11x11 grid. Two-player tile placement and bridge-building. Tiles can be loyal in one direction and disloyal in another.
- `democracy_remote.html` — Democracy in Space: area majority game based on the Electoral College concept, with remote multiplayer.
- `makalaina.html` / `makalaina_remote.html` — MAKA LAINA: 2-player disc collection strategy on a 12x12 grid. 54 discs total (36 primary in red/blue/yellow with numbers 1-6, 18 secondary in green/orange/purple). 6 hidden, 24 start on board, 24 drafted in. Draft system: after each collection, 3 discs drawn from bag, player picks 1 to place on any empty cell, other 2 return to bag. Sacrifice mechanic: give up a collected primary disc (score reduced), move collector freely up to that disc's value in squares (Chebyshev distance). Number 1 = extra turn, Number 6 = future discs of that color worthless. Game continues until all discs collected. Plan from the get go, stay flexible.
- `capovolto.html` — Capovolto: Othello on steroids! 2-player disc-flipping strategy game on a polyomino grid. Players place 18 polyominoes, then alternate placing numbered discs across 6 rounds. Core mechanic: flipping 4-disc lines (2 of each color) to change values. Opponent's last disc value determines your direction constraint (even=H/V, odd=diagonal). Scoring by value majority per polyomino.
- `rainbow_blackjack.html` (+ `_en`, `_remote`) — Rainbow Blackjack: "Colorful 21!" 2-player tower-building strategy game. 36 colored stones (1-6 in red/blue/yellow/green/orange/purple) plus 6 gray jokers (3 per player). Player 1 gets primary colors, Player 2 secondary. Program removes 3 random stones per player. Remaining 18 auto-arranged by program into two 3×3 grids (9 each). Grid stones hidden from opponent — players memorize positions from the look phase. Each round: both players pick a row in any direction (first row freely choosable, then one of the other two; direction locked per grid) and announce colors OR numbers, then alternate placing 1 stone at a time (3 turns per round) into 6 shared color towers aiming for 21. KEY MECHANIC: Each colored stone can be placed in its own tower or the two adjacent towers on the color wheel (Red→Purple/Orange, Orange→Red/Yellow, Yellow→Orange/Green, Green→Yellow/Blue, Blue→Green/Purple, Purple→Blue/Red). Gray jokers copy previous stone's value, can't be first or consecutive. Gray replacement mechanic: if joker is on top and adding your stone would exceed 21, you may remove the joker and place your stone (if it gets closer to 21). Round starters: P1,P2,P1,P1,P2,P1. SCORING: Each tower shows owner dot (red=P1, green=P2). First to own 3 towers at exactly 21 wins instantly; otherwise most towers wins. Local version uses pass-and-play; remote version (`_remote`) uses PeerJS for separate screens.
- `frankenstein.html` — Frankenstein: "Where's that green elbow?" A "frankly memorable" memory game for 1-4 players, ages 7+. Players flip face-down cards to find body parts and build a complete Frankenstein body from the middle outward. 32/48/64 cards for 2/3/4 players. Solo mode uses 2-player variant where one person controls both Frankies. No left/right distinction — any arm/leg/hand/foot card fits either side. All 4 torso parts are identical and interchangeable. Strict torso adjacency: each limb requires its specific adjacent torso part (right arm→torso_ul, left arm→torso_ur, left leg→torso_bl, right leg→torso_br); head needs any top torso. Body part colors: green, orange, purple, turquoise; torso is grey. Game continues until ALL Frankies are complete (first to finish wins). Terminology: "misses" = card you can't use (2 per turn), "mistakes" = miss on a previously-seen card (optional tracking). Features build-order constraints, toggleable color rule, toggleable mistake tracking, joker cards, and CSS-drawn SVG body part art.

**Common code patterns across games:**
- Global state variables with a `gameState` string for state machine flow
- 2D array `board[y][x]` for grid representation
- `renderBoard()` for DOM updates, `initGame()` for setup
- `historyStack` array with `undoMove()` for undo support
- `localStorage` for persisting user preferences (e.g., rules acceptance)
- CSV export via `downloadCSV()` for gameplay analytics logging
- Modal-based rules display with localStorage-gated auto-show

## Git Workflow

Single-branch development on `main`. Commits go directly to main. Repository remote: `https://github.com/zdavatz/parados.git`.
