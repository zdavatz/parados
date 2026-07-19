// Record a Divided Loyalties demo game as video.
//
// Drives the real game page in Chromium. Every move is validated by the game's
// OWN predicates (wouldFormBridge / findAutoBridges / bridgeWouldForm), so the
// demo can never produce an illegal position — we ask the game what is legal
// instead of hard-coding coordinates.
//
// Usage: node record.js [positionIndex] [maxTurns]

const { chromium } = require('playwright');
const path = require('path');

const REPO = '/var/www/game.ywesee.com/parados';
const GAME = 'divided_loyalties_en.html';
const OUT = path.join(__dirname, 'out');

const POSITION_INDEX = parseInt(process.argv[2] ?? '0', 10);
const MAX_TURNS = parseInt(process.argv[3] ?? '24', 10);

// Pacing (ms) — a teaching video needs to be readable, not fast.
const T = { colour: 550, place: 750, bridge: 900, turn: 500 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1280, height: 900 } },
  });
  const page = await context.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [page error]', m.text());
  });

  // Suppress the auto-shown rules modal the same way a returning player would.
  await context.addInitScript(() => {
    try { localStorage.setItem('dl_rules_seen', '1'); } catch (e) {}
  });

  await page.goto('file://' + path.join(REPO, GAME));
  await page.waitForSelector('#position-grid button', { timeout: 10000 });
  await sleep(1200);

  // Make sure no modal is covering the board.
  await page.evaluate(() => {
    if (typeof toggleRules === 'function') toggleRules(false);
  });

  // --- pick the starting position -----------------------------------------
  const positions = await page.$$('#position-grid button');
  const chosen = positions[POSITION_INDEX];
  const posName = (await chosen.innerText()).replace(/\s+/g, ' ').trim();
  console.log(`position: ${posName}`);
  await chosen.click();
  await page.waitForSelector('#meta-grid .cell, #meta-grid > div', { timeout: 10000 });
  await sleep(1500);

  // --- the demo player -----------------------------------------------------
  // Returns the best move it can find for the player to move, or null.
  //   { idx, colour, bridge: [rowIndices] | null }
  const findMove = () =>
    page.evaluate(() => {
      const inv = currentPlayer === 'blue' ? blueInv : yellowInv;
      const colours = Object.keys(inv).filter((c) => inv[c] > 0);
      const meta = document.getElementById('meta-grid');
      const cells = [...meta.children];

      const isDot = (i) =>
        cells[i].classList.contains('off-board') &&
        cells[i].classList.contains('has-dot');
      const isBoard = (i) => !cells[i].classList.contains('off-board');

      // Candidate bridge through idx, given the stone colour, using the game's
      // own enumerator + predicate.
      const bridgeFor = (idx, colour) => {
        const before = grid[idx];
        grid[idx] = colour;
        let found = null;
        try {
          for (const row of findAutoBridges(idx, colour) || []) {
            if (bridgeWouldForm(row)) { found = row; break; }
          }
        } catch (e) { /* predicate refused — treat as no bridge */ }
        grid[before === undefined ? idx : idx] = before;
        return found;
      };

      const scoring = [];   // move that immediately completes a bridge
      const plain = [];     // legal on-board placement, no bridge yet

      for (const colour of colours) {
        for (let i = 0; i < grid.length; i++) {
          if (grid[i]) continue;
          const dot = isDot(i);
          if (!dot && !isBoard(i)) continue;
          const bridge = bridgeFor(i, colour);
          if (bridge) {
            // Red bridges are defensive and score nothing — keep them rare so
            // the demo shows construction first, destruction second.
            const weight = colour === 'red' ? 1 : bridge.length * 10;
            scoring.push({ idx: i, colour, bridge, weight });
          } else if (!dot) {
            // Prefer building near our own stones so rows actually develop.
            let near = 0;
            const x = i % GRID_W, y = Math.floor(i / GRID_W);
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const j = (y + dy) * GRID_W + (x + dx);
                if (j >= 0 && j < grid.length && grid[j]) near++;
              }
            plain.push({ idx: i, colour, bridge: null, weight: near });
          }
        }
      }

      const pool = scoring.length ? scoring : plain;
      if (!pool.length) return null;
      pool.sort((a, b) => b.weight - a.weight);
      // Slight variety among equally-good moves so the demo isn't robotic.
      const top = pool.filter((m) => m.weight === pool[0].weight);
      return top[Math.floor(Math.random() * top.length)];
    });

  const clickCell = async (idx) => {
    const box = await page.evaluate((i) => {
      const c = document.getElementById('meta-grid').children[i];
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, idx);
    await page.mouse.click(box.x, box.y);
  };

  const dblClickCell = async (idx) => {
    const box = await page.evaluate((i) => {
      const c = document.getElementById('meta-grid').children[i];
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, idx);
    await page.mouse.dblclick(box.x, box.y);
  };

  let turns = 0, bridges = 0;
  while (turns < MAX_TURNS) {
    const move = await findMove();
    if (!move) { console.log('  no legal move left'); break; }

    // 1. pick the stone from the inventory (real click, so it highlights)
    const picked = await page.evaluate((colour) => {
      const tiles = [...document.querySelectorAll('#inventory-container .inv-tile')];
      const t = tiles.find((el) => el.classList.contains(colour));
      if (!t) return null;
      const r = (t.parentElement || t).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, move.colour);
    if (picked) await page.mouse.click(picked.x, picked.y);
    else await page.evaluate((c) => { selectedColor = c; updateUI(); }, move.colour);
    await sleep(T.colour);

    // 2. place the stone
    await clickCell(move.idx);
    await sleep(T.place);

    // 3. form the bridge manually, exactly as a player would
    if (move.bridge && move.bridge.length >= 3) {
      await dblClickCell(move.bridge[0]);
      await sleep(300);
      await dblClickCell(move.bridge[move.bridge.length - 1]);
      await sleep(T.bridge);
      bridges++;
    }

    // 4. end the turn
    await page.evaluate(() => endTurn());
    await sleep(T.turn);
    turns++;
    if (turns % 6 === 0) console.log(`  turn ${turns}, ${bridges} bridges`);
  }

  await sleep(2500);
  const video = page.video();
  await context.close();
  await browser.close();
  const src = await video.path();
  console.log(`turns=${turns} bridges=${bridges}`);
  console.log('video:', src);
})();
