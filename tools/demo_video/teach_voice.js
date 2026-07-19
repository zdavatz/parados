// Divided Loyalties — teaching video narrated by WALTER'S OWN VOICE.
//
// The audio is cut from docs/voice/Walter_Prossnitz_2026-07-19_*.mp3, so this
// is the author explaining his own game. That inverts the usual order: the
// AUDIO is fixed and the board action is paced to fit it, not the other way
// round. Every caption is Walter's actual wording, transcribed.
//
// Section start offsets are logged to marks.json while recording, and the audio
// segments are placed at exactly those offsets afterwards — so the mux stays in
// sync even if the browser drifts from wall-clock during recording.
//
// Usage: node teach_voice.js   ->  out_voice/*.webm + marks.json

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = '/var/www/game.ywesee.com/parados';
const GAME = 'divided_loyalties_en.html';
const OUT = path.join(__dirname, 'out_voice');
const POSITION = '2: Octopus';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1280, height: 900 } },
  });
  const page = await context.newPage();
  const t0 = Date.now();                       // ~ when recording starts
  const marks = {};

  await context.addInitScript(() => {
    try { localStorage.setItem('dl_rules_seen', '1'); } catch (e) {}
  });
  await page.goto('file://' + path.join(REPO, GAME));
  await page.waitForSelector('#position-grid button');
  await page.evaluate(() => { if (typeof toggleRules === 'function') toggleRules(false); });

  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = `
      #vo-caption { position:fixed; left:0; right:0; bottom:0; z-index:9000;
        background:linear-gradient(to top, rgba(20,28,24,.97) 72%, rgba(20,28,24,0));
        color:#f3f1e7; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        padding:34px 60px 30px; font-size:21px; line-height:1.5; text-align:center;
        white-space:pre-line; opacity:0; transition:opacity .4s ease; pointer-events:none; }
      #vo-caption.on { opacity:1; }
      #vo-title { position:fixed; inset:0; z-index:9500; display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:16px; background:#37474f;
        color:#fff; font-family:system-ui,sans-serif; opacity:0;
        transition:opacity .5s ease; pointer-events:none; }
      #vo-title.on { opacity:1; }
      #vo-title h1 { font-size:58px; margin:0; letter-spacing:.5px; }
      #vo-title p { font-size:25px; margin:0; color:#ffd700; }
      #vo-by { position:fixed; right:26px; bottom:196px; z-index:9000; color:#90a4ae;
        font-family:system-ui,sans-serif; font-size:15px; opacity:0; transition:opacity .5s; }
      #vo-by.on { opacity:1; }
      .vo-flash { animation: voflash 1.1s ease-in-out 2; }
      @keyframes voflash { 0%,100%{filter:none} 50%{filter:brightness(1.75)} }`;
    document.head.appendChild(s);
    const c = document.createElement('div'); c.id = 'vo-caption'; document.body.appendChild(c);
    const t = document.createElement('div'); t.id = 'vo-title';
    t.innerHTML = '<h1></h1><p></p>'; document.body.appendChild(t);
    const b = document.createElement('div'); b.id = 'vo-by';
    b.textContent = 'narrated by Walter Prossnitz'; document.body.appendChild(b);
  });

  const caption = (t) => page.evaluate((t) => {
    const c = document.getElementById('vo-caption');
    c.textContent = t; c.classList.add('on');
  }, t);
  const hush = () => page.evaluate(() => document.getElementById('vo-caption').classList.remove('on'));

  // --- board helpers (same approach as teach.js) ---------------------------
  const openPosition = async () => {
    await page.evaluate(() => showSetup());
    await page.waitForSelector('#position-grid button');
    await page.evaluate((label) => {
      [...document.querySelectorAll('#position-grid button')]
        .find((el) => el.innerText.includes(label)).click();
    }, POSITION);
    await sleep(500);
    return page.evaluate(() => {
      const cells = [...document.getElementById('meta-grid').children];
      const on = (x, y) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H &&
        cells[y * GRID_W + x] && !cells[y * GRID_W + x].classList.contains('off-board');
      for (let y = 0; y < GRID_H; y++)
        for (let x = 0; x < GRID_W; x++) {
          let ok = true;
          for (let dy = 0; dy < 3 && ok; dy++)
            for (let dx = 0; dx < 3 && ok; dx++) if (!on(x + dx, y + dy)) ok = false;
          if (ok) return { x, y, W: GRID_W };
        }
      return null;
    });
  };
  const given = (blk, x, y, colour) => page.evaluate(([blk, x, y, colour]) => {
    const i = (blk.y + y) * blk.W + (blk.x + x);
    grid[i] = colour; renderTile(i, colour); updateUI();
  }, [blk, x, y, colour]);
  const turnOf = (player, colour) => page.evaluate(([player, colour]) => {
    currentPlayer = player;
    const inv = player === 'blue' ? blueInv : yellowInv;
    inv[colour] = Math.max(inv[colour] || 0, 3);
    selectedColor = null; moveState = 'tile'; bridgeSelection = []; updateUI();
  }, [player, colour]);
  const pt = (blk, x, y) => page.evaluate(([blk, x, y]) => {
    const i = (blk.y + y) * blk.W + (blk.x + x);
    const r = document.getElementById('meta-grid').children[i].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [blk, x, y]);
  const play = async (blk, x, y, colour) => {
    const tile = await page.evaluate((c) => {
      const t = [...document.querySelectorAll('#inventory-container .inv-tile')]
        .find((el) => el.classList.contains(c));
      if (!t) return null;
      const r = (t.parentElement || t).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, colour);
    if (tile) await page.mouse.click(tile.x, tile.y);
    else await page.evaluate((c) => { selectedColor = c; updateUI(); }, colour);
    await sleep(600);
    const p = await pt(blk, x, y);
    await page.mouse.click(p.x, p.y);
    await sleep(700);
  };
  const bridge = async (blk, a, b) => {
    const p1 = await pt(blk, a[0], a[1]), p2 = await pt(blk, b[0], b[1]);
    await page.mouse.dblclick(p1.x, p1.y); await sleep(500);
    await page.mouse.dblclick(p2.x, p2.y); await sleep(900);
  };
  const scores = () => page.evaluate(() => ({
    blue: bridgeScore.blue + '/' + regionScore.blue,
    yellow: bridgeScore.yellow + '/' + regionScore.yellow,
    cut: activeBridges.filter((b) => b.cut).length,
  }));

  // A beat = one caption held for `ms`, with an optional board action inside it.
  const beat = async (text, ms, act) => {
    const start = Date.now();
    if (text === null) await hush(); else await caption(text);
    if (act) await act();
    const left = ms - (Date.now() - start);
    if (left > 0) await sleep(left);
    else console.log(`    beat overran by ${-left}ms: ${String(text).slice(0, 45)}…`);
  };
  const section = (id) => { marks[id] = Date.now() - t0; console.log(`  [${(marks[id] / 1000).toFixed(2)}s] ${id}`); };

  let blk;

  // === 1. opening (4.50s) =================================================
  section('opening');
  await page.evaluate(() => {
    const t = document.getElementById('vo-title');
    t.querySelector('h1').textContent = 'Divided Loyalties';
    t.querySelector('p').textContent = 'Perhaps the craziest Connect Four game ever';
    t.classList.add('on');
  });
  await sleep(4500);
  await page.evaluate(() => document.getElementById('vo-title').classList.remove('on'));
  blk = await openPosition();
  if (!blk) throw new Error('no 3x3 block');
  await page.evaluate(() => document.getElementById('vo-by').classList.add('on'));

  // === 2. introduction (43.42s) ===========================================
  section('introduction');
  await beat('Before starting to play, it is important to internalize how the six colours of the colour wheel are interrelated.\nNeighbouring colours will be referred to as "Colour Plus".', 14000);
  await beat('For instance, Red Plus refers to red, orange, and purple.\nGreen Plus refers to green, blue, and yellow.', 10000);
  await beat('One player is blue, the other is yellow. Divided Loyalties is played over three or four rounds.', 8000);
  await beat('In each round, the blue player receives four blue, three purple, two green, two red, and one orange stone.\nThe yellow player receives four yellow, three orange, two green, two red, and one purple stone.', 11420);

  // === 3. scoring (57.25s) — scene: a bridge scores =======================
  section('scoring');
  await beat('Blue and yellow bridges placed over three tiles are worth one point.\nBridges placed over four tiles are worth two points.', 11000, async () => {
    await given(blk, 0, 0, 'blue');
    await sleep(500);
    await given(blk, 1, 0, 'purple');
    await sleep(500);
    await turnOf('blue', 'blue');
    await play(blk, 2, 0, 'blue');
    await bridge(blk, [0, 0], [2, 0]);
  });
  await beat('Red tiles cannot be used by either player for making their own rows — but red and Red Plus tiles play an extremely important role, because red bridges can be placed by either player.', 13000);
  await beat('These are not worth any points. But when placed across blue or yellow bridges, those become worthless — they are said to be "cut".', 10000);
  await beat('Red bridges can only cut other bridges on their inside tiles; the tiles on the ends of the bridge are immune.', 9000);
  await beat('Red bridges cannot be placed over each other. Blue and yellow bridges cannot be placed over each other. And blue and yellow bridges cannot be placed over red bridges.', 8000);
  await beat('Players also receive a point for each region in which they have placed at least one bridge. A stone on the inside of the row must be in that region.', 6250);
  console.log('    scoring scene:', await scores());

  // === 4. dilemmas (40.28s) — scene: the green dilemma ====================
  section('dilemmas');
  blk = await openPosition();
  await beat('The dilemmas occur on virtually every move. Principally, they arise from the divided loyalties of the secondary colours.', 9000, async () => {
    await given(blk, 0, 0, 'blue');
    await given(blk, 1, 0, 'purple');
  });
  await beat('For instance, whenever you place a green tile ostensibly to create a bridge for yourself, you are simultaneously assisting your opponent…', 9000, async () => {
    await turnOf('blue', 'green');
    await play(blk, 2, 0, 'green');
    await bridge(blk, [0, 0], [2, 0]);
  });
  await beat('…who can use that tile to create a bridge for themselves in a different direction — possibly even placing that bridge before yours, and in a worst case, blocking the row you were intending to create.', 13000, async () => {
    await given(blk, 2, 1, 'orange');
    await sleep(400);
    await turnOf('yellow', 'yellow');
    await play(blk, 2, 2, 'yellow');
    await bridge(blk, [2, 0], [2, 2]);
  });
  await beat('Placing a Red Plus tile within your row is even more hazardous. Any row that has a Red Plus tile on the inside is vulnerable to being cut by a red bridge in another direction.', 9280);
  console.log('    dilemma scene:', await scores());

  // === 5. continuation (45.81s) — scene: the cut ==========================
  section('continuation');
  blk = await openPosition();
  await beat('All diagonal rows are particularly in danger, as a Red Plus diagonal row can cut them without even having any common squares.', 10000, async () => {
    await given(blk, 0, 1, 'blue');
    await given(blk, 1, 1, 'purple');
    await sleep(400);
    await turnOf('blue', 'blue');
    await play(blk, 2, 1, 'blue');
    await bridge(blk, [0, 1], [2, 1]);
  });
  await beat('These bridges must immediately be defended, otherwise they will inevitably be cut.', 7000, async () => {
    await given(blk, 1, 0, 'red');
    await sleep(400);
    await turnOf('yellow', 'orange');
    await play(blk, 1, 2, 'orange');
    await bridge(blk, [1, 0], [1, 2]);
  });
  const s = await scores();
  console.log('    cut scene:', s);
  if (s.cut === 0) console.log('    !! WARNING: nothing was cut');
  await beat('Another way to explain this: in your supply of 12 stones, there are 9 which you can use to create your rows, 3 which your opponent can use to create theirs…', 13000);
  await beat('…and 6 which either of you can use to create Red Plus rows to menace each other.', 8000);
  await beat('All of this because a majority of the colours have divided loyalties — and each colour\'s loyalty is divided in a different way.', 7810);

  await hush();
  await sleep(1500);
  marks.end = Date.now() - t0;

  const video = page.video();
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'marks.json'), JSON.stringify(marks, null, 2));
  console.log('marks:', marks);
  console.log('video:', await video.path());
})();
