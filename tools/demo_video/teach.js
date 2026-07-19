// Divided Loyalties — scripted TEACHING video ("Weg B").
//
// Walter's dictated text is the script; the board illustrates it. Each scene
// sets up a position, states the lesson as a caption, then plays the decisive
// move live through the game's own code path (handleClick + handleStoneDblClick
// → tryFormBridge), so what you see is a genuinely legal game, not a mock-up.
//
// The three lessons come straight out of the colour sets:
//   Blue +   = blue, purple, green
//   Yellow + = yellow, orange, green    <- green belongs to BOTH  (the dilemma)
//   Red +    = red, purple, orange      <- purple/orange also serve red (the danger)
//
// Usage: node teach.js [lang]     lang = en (default) | de

const { chromium } = require('playwright');
const path = require('path');

const REPO = '/var/www/game.ywesee.com/parados';
const LANG = process.argv[2] === 'de' ? 'de' : 'en';
const GAME = LANG === 'de' ? 'divided_loyalties.html' : 'divided_loyalties_en.html';
const OUT = path.join(__dirname, 'out_teach');
const POSITION = LANG === 'de' ? '2: Octopus' : '2: Octopus';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const READ = (text) => Math.max(2600, Math.min(9000, text.length * 55)); // reading time

// --- the script ------------------------------------------------------------
// Wording is Walter's, trimmed to caption length.
const TEXT = {
  en: {
    title: 'Divided Loyalties',
    subtitle: 'Perhaps the craziest Connect Four game ever',
    intro:
      'Six colours on a colour wheel. Neighbouring colours form a "Colour +".\n' +
      'Blue + = blue, purple, green   ·   Yellow + = yellow, orange, green   ·   Red + = red, purple, orange',
    s1a: 'A row of three stones, all from your Colour +, can be bridged. A 3-bridge scores 1 point, a 4-bridge 2.',
    s1b: 'Blue completes the row and draws the bridge — one point. Note the colours alternate: two identical colours may never sit next to each other.',
    s2a: 'Now the dilemma. Green belongs to Blue + AND to Yellow + — it is loyal to both players at once.',
    s2b:
      'Whenever you place a green tile ostensibly to create a bridge for yourself, ' +
      'you are simultaneously assisting your opponent, who can use that tile to create a bridge in a different direction.',
    s2c: 'Yellow builds on Blue\'s own green stone — and scores from it. That is a divided loyalty.',
    s3a: 'Purple belongs to Blue + — but also to Red +. Red bridges score nothing; they exist to cut.',
    s3b:
      'Placing a Red + tile within your row is hazardous. Any row that has a Red + tile ' +
      'on the inside is vulnerable to being cut by a red bridge in another direction.',
    s3c: 'The red bridge crosses at the purple stone — Blue\'s bridge is cut. It stays on the board, greyed out, and scores nothing.',
    outro: 'Nine of your twelve stones build your rows, three help your opponent, six can menace either side.\nEach colour\'s loyalty is divided in a different way.',
  },
  de: {
    title: 'Divided Loyalties',
    subtitle: 'Vielleicht das verrückteste Vier-gewinnt-Spiel aller Zeiten',
    intro:
      'Sechs Farben auf einem Farbkreis. Benachbarte Farben bilden ein „Colour +".\n' +
      'Blue + = Blau, Violett, Grün   ·   Yellow + = Gelb, Orange, Grün   ·   Red + = Rot, Violett, Orange',
    s1a: 'Eine Reihe aus drei Steinen derselben Colour + kann überbrückt werden. Eine 3er-Brücke zählt 1 Punkt, eine 4er 2.',
    s1b: 'Blau vervollständigt die Reihe und zieht die Brücke — ein Punkt. Die Farben wechseln: zwei gleiche Farben dürfen nie nebeneinander liegen.',
    s2a: 'Jetzt das Dilemma. Grün gehört zu Blue + UND zu Yellow + — es ist beiden Spielern zugleich treu.',
    s2b:
      'Wenn du einen grünen Stein setzt, vorgeblich um dir selbst eine Brücke zu bauen, ' +
      'hilfst du gleichzeitig deinem Gegner, der ihn für eine eigene Brücke in einer anderen Richtung nutzen kann.',
    s2c: 'Gelb baut auf Blaus eigenem grünen Stein — und punktet damit. Das ist geteilte Loyalität.',
    s3a: 'Violett gehört zu Blue + — aber auch zu Red +. Rote Brücken zählen nichts; sie sind zum Schneiden da.',
    s3b:
      'Einen Red-+-Stein innerhalb der eigenen Reihe zu setzen, ist gefährlich. Jede Reihe, die innen ' +
      'einen Red-+-Stein hat, kann von einer roten Brücke aus einer anderen Richtung geschnitten werden.',
    s3c: 'Die rote Brücke kreuzt am violetten Stein — Blaus Brücke ist geschnitten. Sie bleibt liegen, ausgegraut, und zählt nicht mehr.',
    outro: 'Neun deiner zwölf Steine bauen deine Reihen, drei helfen dem Gegner, sechs können beide Seiten bedrohen.\nDie Loyalität jeder Farbe ist auf andere Weise geteilt.',
  },
}[LANG];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1280, height: 900 } },
  });
  const page = await context.newPage();
  await context.addInitScript(() => {
    try { localStorage.setItem('dl_rules_seen', '1'); } catch (e) {}
  });

  await page.goto('file://' + path.join(REPO, GAME));
  await page.waitForSelector('#position-grid button');
  await page.evaluate(() => { if (typeof toggleRules === 'function') toggleRules(false); });

  // --- caption + title overlay --------------------------------------------
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = `
      #vo-caption { position:fixed; left:0; right:0; bottom:0; z-index:9000;
        background:linear-gradient(to top, rgba(20,28,24,.97) 72%, rgba(20,28,24,0));
        color:#f3f1e7; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        padding:34px 60px 30px; font-size:21px; line-height:1.5; text-align:center;
        white-space:pre-line; opacity:0; transition:opacity .45s ease; pointer-events:none; }
      #vo-caption.on { opacity:1; }
      #vo-title { position:fixed; inset:0; z-index:9500; display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:16px; background:#37474f;
        color:#fff; font-family:system-ui,sans-serif; opacity:0;
        transition:opacity .6s ease; pointer-events:none; }
      #vo-title.on { opacity:1; }
      #vo-title h1 { font-size:58px; margin:0; letter-spacing:.5px; }
      #vo-title p { font-size:25px; margin:0; color:#ffd700; }
      .vo-flash { animation: voflash 1.1s ease-in-out 2; }
      @keyframes voflash { 0%,100%{filter:none} 50%{filter:brightness(1.75)} }`;
    document.head.appendChild(s);
    const c = document.createElement('div'); c.id = 'vo-caption'; document.body.appendChild(c);
    const t = document.createElement('div'); t.id = 'vo-title';
    t.innerHTML = '<h1></h1><p></p>'; document.body.appendChild(t);
  });

  const say = async (text, hold) => {
    await page.evaluate((t) => {
      const c = document.getElementById('vo-caption');
      c.textContent = t; c.classList.add('on');
    }, text);
    await sleep(hold ?? READ(text));
  };
  const hush = async () => {
    await page.evaluate(() => document.getElementById('vo-caption').classList.remove('on'));
    await sleep(500);
  };
  const titleCard = async (h, p, hold) => {
    await page.evaluate(([h, p]) => {
      const t = document.getElementById('vo-title');
      t.querySelector('h1').textContent = h;
      t.querySelector('p').textContent = p;
      t.classList.add('on');
    }, [h, p]);
    await sleep(hold);
    await page.evaluate(() => document.getElementById('vo-title').classList.remove('on'));
    await sleep(700);
  };

  // --- scene helpers -------------------------------------------------------
  const openPosition = async () => {
    await page.evaluate(() => showSetup());
    await page.waitForSelector('#position-grid button');
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('#position-grid button')]
        .find((el) => el.innerText.includes(label));
      b.click();
    }, POSITION);
    await sleep(700);
    // locate the 3x3 all-on-board block we stage every scene in
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

  // Place a stone silently (scene setup — the "given" position).
  const given = (blk, x, y, colour) =>
    page.evaluate(([blk, x, y, colour]) => {
      const idx = (blk.y + y) * blk.W + (blk.x + x);
      grid[idx] = colour;
      renderTile(idx, colour);
      updateUI();
    }, [blk, x, y, colour]);

  // Whose turn it is, with a guaranteed stock of the colour we are about to play.
  const turnOf = (player, colour) =>
    page.evaluate(([player, colour]) => {
      currentPlayer = player;
      const inv = player === 'blue' ? blueInv : yellowInv;
      inv[colour] = Math.max(inv[colour] || 0, 3);
      selectedColor = null; moveState = 'tile'; bridgeSelection = [];
      updateUI();
    }, [player, colour]);

  const cellPoint = (blk, x, y) =>
    page.evaluate(([blk, x, y]) => {
      const idx = (blk.y + y) * blk.W + (blk.x + x);
      const r = document.getElementById('meta-grid').children[idx].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, [blk, x, y]);

  // Play the decisive stone live, through the real click path.
  const play = async (blk, x, y, colour) => {
    const tile = await page.evaluate((colour) => {
      const t = [...document.querySelectorAll('#inventory-container .inv-tile')]
        .find((el) => el.classList.contains(colour));
      if (!t) return null;
      const r = (t.parentElement || t).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, colour);
    if (tile) await page.mouse.click(tile.x, tile.y);
    else await page.evaluate((c) => { selectedColor = c; updateUI(); }, colour);
    await sleep(700);
    const p = await cellPoint(blk, x, y);
    await page.mouse.click(p.x, p.y);
    await sleep(900);
  };

  // Draw the bridge the way a player does: double-click both ends.
  const bridge = async (blk, a, b) => {
    const p1 = await cellPoint(blk, a[0], a[1]);
    const p2 = await cellPoint(blk, b[0], b[1]);
    await page.mouse.dblclick(p1.x, p1.y);
    await sleep(600);
    await page.mouse.dblclick(p2.x, p2.y);
    await sleep(1200);
  };

  const scores = () =>
    page.evaluate(() => ({
      blue: bridgeScore.blue + '/' + regionScore.blue,
      yellow: bridgeScore.yellow + '/' + regionScore.yellow,
      bridges: activeBridges.length,
      cut: activeBridges.filter((b) => b.cut).length,
    }));

  // ========================================================================
  await titleCard(TEXT.title, TEXT.subtitle, 3400);

  let blk = await openPosition();
  if (!blk) throw new Error('no 3x3 block found in ' + POSITION);
  console.log('staging block at', blk);

  await say(TEXT.intro, 8200);
  await hush();

  // --- Scene 1: a bridge scores -------------------------------------------
  await say(TEXT.s1a);
  await given(blk, 0, 0, 'blue');
  await sleep(600);
  await given(blk, 1, 0, 'purple');
  await sleep(900);
  await turnOf('blue', 'blue');
  await play(blk, 2, 0, 'blue');
  await bridge(blk, [0, 0], [2, 0]);
  await hush();
  await say(TEXT.s1b);
  console.log('  after scene 1:', await scores());
  await hush();

  // --- Scene 2: the green dilemma -----------------------------------------
  blk = await openPosition();
  await say(TEXT.s2a);
  await given(blk, 0, 0, 'blue');
  await given(blk, 1, 0, 'purple');
  await sleep(700);
  await hush();
  await say(TEXT.s2b);
  await turnOf('blue', 'green');
  await play(blk, 2, 0, 'green');          // blue completes its row WITH green
  await bridge(blk, [0, 0], [2, 0]);
  await hush();
  // now yellow turns that very green stone into its own bridge
  await given(blk, 2, 1, 'orange');
  await sleep(700);
  await turnOf('yellow', 'yellow');
  await play(blk, 2, 2, 'yellow');
  await bridge(blk, [2, 0], [2, 2]);       // green is the shared ENDPOINT — a legal junction
  await say(TEXT.s2c);
  console.log('  after scene 2:', await scores());
  await hush();

  // --- Scene 3: Red + inside your row gets cut ----------------------------
  blk = await openPosition();
  await say(TEXT.s3a);
  await given(blk, 0, 1, 'blue');
  await given(blk, 1, 1, 'purple');        // the Red + stone, sitting INSIDE the row
  await sleep(700);
  await turnOf('blue', 'blue');
  await play(blk, 2, 1, 'blue');
  await bridge(blk, [0, 1], [2, 1]);       // blue scores first
  await hush();
  await say(TEXT.s3b);
  await page.evaluate(([blk]) => {         // highlight the culprit
    const idx = (blk.y + 1) * blk.W + (blk.x + 1);
    const t = document.getElementById('meta-grid').children[idx].querySelector('.tile');
    if (t) t.classList.add('vo-flash');
  }, [blk]);
  await sleep(2400);
  await hush();
  await given(blk, 1, 0, 'red');
  await sleep(700);
  await turnOf('yellow', 'orange');
  await play(blk, 1, 2, 'orange');
  await bridge(blk, [1, 0], [1, 2]);       // red crosses at the purple -> cut
  await say(TEXT.s3c);
  const s3 = await scores();
  console.log('  after scene 3:', s3);
  if (s3.cut === 0) console.log('  !! WARNING: nothing was cut — the lesson did not land');
  await hush();

  await say(TEXT.outro, 8500);
  await hush();
  await sleep(1200);

  const video = page.video();
  await context.close();
  await browser.close();
  console.log('video:', await video.path());
})();
