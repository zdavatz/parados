# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parados is a collection of standalone web-based board games by Walter Prossnitz, hosted at `game.ywesee.com/parados`. Each game is a single self-contained HTML file with embedded CSS and JavaScript — no build system, no dependencies, no framework.

## Development

There is no build step, no package manager, and no test framework. To run a game, open its `.html` file in a browser. The project is served as static files from `/var/www/game.ywesee.com/parados/`.

## Architecture

**Single-file pattern:** Each game is one `.html` file containing all markup, styles (in `<style>`), and logic (in `<script>`). There are no shared libraries or external dependencies.

**Localization by duplication:** Language variants are separate files (e.g., `kangaroo.html` for German, `kangaroo_en.html` for English, `kangaroo_jp.html` for Japanese, `kangaroo_cn.html` for Chinese, `kangaroo_ua.html` for Ukrainian). When modifying game logic, changes must be propagated to all language variants.

**Games:**
- `kangaroo.html` (+ `_en`, `_jp`, `_cn`, `_ua`) — DUK (Das Ungeduldige Känguru): grid-based puzzle with kangaroo jumping over colored dishes. Supports LEVEL, RANDOM, and EDITOR modes. Has a `LEVEL_DATABASE` array for predefined puzzles.
- `divided_loyalties.html` — Two-player tile placement and bridge-building on an 11x11 grid.
- `democracy_remote.html` — Democracy in Space strategy game with remote multiplayer.
- `makalaina.html` / `makalaina_remote.html` — MAKA LAINA disc collection game on a 12x12 grid.

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
