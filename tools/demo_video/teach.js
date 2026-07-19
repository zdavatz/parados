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
const GAMES = {
  de: 'divided_loyalties.html',
  en: 'divided_loyalties_en.html',
  jp: 'divided_loyalties_jp.html',
  cn: 'divided_loyalties_cn.html',
  ua: 'divided_loyalties_ua.html',
};
const LANG = GAMES[process.argv[2]] ? process.argv[2] : 'en';
const GAME = GAMES[LANG];
const OUT = path.join(__dirname, 'out_teach');
// Position NAMES stay English in every language variant (the slug invariant),
// so this one label matches in all five files.
const POSITION = '2: Octopus';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reading time. A CJK character carries far more meaning than a Latin one, so
// counting characters alone would flash the JP/CN captions off in half the time
// the DE/EN ones get. Roughly: Latin ~18 chars/s, CJK ~6 chars/s.
const MS_PER_CHAR = (LANG === 'jp' || LANG === 'cn') ? 165 : 55;
const READ = (text) => Math.max(2600, Math.min(9000, text.length * MS_PER_CHAR));

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
  jp: {
    title: 'Divided Loyalties',
    subtitle: 'おそらく史上もっとも風変わりなコネクトフォー',
    intro:
      'カラーホイール上の6色。隣り合う色がまとまって「カラー +」になります。\n' +
      '青 + = 青・紫・緑   ·   黄 + = 黄・オレンジ・緑   ·   赤 + = 赤・紫・オレンジ',
    s1a: '自分のカラー + だけでできた石3個の列には橋を架けられます。3橋は1点、4橋は2点。',
    s1b: '青が列を完成させ、橋を架けて1点。色が交互になっている点に注目 — 同じ色が2つ隣り合ってはいけません。',
    s2a: 'ここでジレンマ。緑は青 + にも黄 + にも属します — 両プレイヤーに同時に忠誠を誓う色です。',
    s2b: '自分の橋を作るつもりで緑の石を置いても、それは同時に相手を助けます。相手はその石を使って別の方向に橋を架けられるからです。',
    s2c: '黄が青の置いた緑の石を利用して得点しました。これが「分かれた忠誠」です。',
    s3a: '紫は青 + に属しますが、赤 + にも属します。赤い橋は得点しません — 切断するために存在します。',
    s3b: '自分の列の内側に赤 + の石を置くのは危険です。内側に赤 + の石がある列は、別の方向から赤い橋に切断される恐れがあります。',
    s3c: '赤い橋が紫の石で交差 — 青の橋は切断されました。盤上には灰色で残りますが、得点にはなりません。',
    outro: '12個の石のうち9個は自分の列を作り、3個は相手を助け、6個はどちらの側も脅かせます。\nそして色ごとに、忠誠の分かれ方が違うのです。',
  },
  cn: {
    title: 'Divided Loyalties',
    subtitle: '也许是有史以来最疯狂的四子连珠游戏',
    intro:
      '色环上的六种颜色。相邻的颜色组成一个“颜色 +”。\n' +
      '蓝 + = 蓝、紫、绿   ·   黄 + = 黄、橙、绿   ·   红 + = 红、紫、橙',
    s1a: '一排三颗棋子，若全部属于你的颜色 +，就可以建桥。3 桥得 1 分，4 桥得 2 分。',
    s1b: '蓝方补齐这一排并画出桥——得 1 分。注意颜色是交替的：两颗相同颜色绝不能相邻。',
    s2a: '两难困境来了。绿色既属于蓝 +，也属于黄 +——它同时忠于双方玩家。',
    s2b: '每当你放下一颗绿色棋子、表面上是为自己建桥时，你同时也在帮助对手——他可以用这颗棋子朝另一个方向建桥。',
    s2c: '黄方借用蓝方自己的绿色棋子建桥，并因此得分。这就是分裂的忠诚。',
    s3a: '紫色属于蓝 +——但也属于红 +。红桥不计分，它们的存在只为切断。',
    s3b: '在自己的一排中放入红 + 棋子很危险。任何在内部带有红 + 棋子的排，都可能被另一个方向的红桥切断。',
    s3c: '红桥在紫色棋子处穿过——蓝方的桥被切断。它仍留在盘上，变成灰色，不再计分。',
    outro: '你的 12 颗棋子中，9 颗用来连成自己的排，3 颗帮助对手，6 颗能威胁双方。\n每种颜色分裂忠诚的方式各不相同。',
  },
  ua: {
    title: 'Divided Loyalties',
    subtitle: 'Мабуть, найбожевільніша гра «чотири в ряд» з усіх, що коли-небудь існували',
    intro:
      'Шість кольорів на колірному колі. Сусідні кольори утворюють «Колір +».\n' +
      'Синій + = синій, фіолетовий, зелений   ·   Жовтий + = жовтий, помаранчевий, зелений   ·   Червоний + = червоний, фіолетовий, помаранчевий',
    s1a: 'Ряд із трьох каменів, усі з вашого Кольору +, можна з\'єднати мостом. Міст-3 дає 1 очко, міст-4 — 2.',
    s1b: 'Синій завершує ряд і малює міст — одне очко. Зверніть увагу: кольори чергуються, два однакові кольори ніколи не можуть лежати поруч.',
    s2a: 'А тепер дилема. Зелений належить і до Синього +, І до Жовтого + — він лояльний до обох гравців водночас.',
    s2b: 'Щоразу, коли ви ставите зелений елемент нібито для того, щоб створити міст собі, ви водночас допомагаєте суперникові, який може використати цей елемент, щоб створити міст в іншому напрямку.',
    s2c: 'Жовтий будує на власному зеленому камені Синього — і заробляє на ньому очки. Ось вона, роздвоєна лояльність.',
    s3a: 'Фіолетовий належить до Синього + — але й до Червоного +. Червоні мости не дають очок; вони існують, щоб розрізати.',
    s3b: 'Ставити елемент Червоного + усередині свого ряду небезпечно. Будь-який ряд, що має елемент Червоного + усередині, вразливий до розрізання червоним мостом в іншому напрямку.',
    s3c: 'Червоний міст перетинає на фіолетовому камені — міст Синього розрізано. Він залишається на дошці, сірим, і не дає очок.',
    outro: 'Дев\'ять із ваших дванадцяти каменів будують ваші ряди, три допомагають супернику, шість можуть загрожувати будь-якій зі сторін.\nЛояльність кожного кольору розділена по-різному.',
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
