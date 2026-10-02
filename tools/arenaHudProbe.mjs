// ARENA2, MEASURED (2026-10-02, Mac: "All UI elements and text must be enhanced UI plus"): the bout's HUD (ui/arenaHud.js)
// and the Herald's choice (ui/enhancedDialog.js drawEnhancedChoice, systems/arenaHerald.js) drawn over the real sheets in
// Chromium - the Enhanced Plus sheet and the classic skin's bare page - at a desktop's width, a narrow window's and a
// phone's, with the widest names a bout can carry, a two-against-one, a Grand Melee's three and the yield hint up. Each
// must stand inside the viewport, its words in the pixel face, nothing spilling sideways. test/arena2_hud.test.js holds
// the law on a fake document; this photographs what a fake cannot. Photographs to SHOT_DIR (default tools/shots/).
//
//     node tools/arenaHudProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5243, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];

for (const [W, H, width] of [[1440, 900, 'desktop'], [800, 600, 'narrow'], [390, 700, 'phone']]) for (const sheet of ['enhanced', 'bare']) for (const shape of ['duel', 'melee']) {
  const tag = `${width}-${sheet}-${shape}`;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto('http://localhost:5243/play/?skin=enhanced&touch=off');
  const r = await page.evaluate(async ([sheet, shape]) => {
    const { arenaHudModel, drawArenaHud } = await import('/src/ui/arenaHud.js');
    const B = await import('/src/systems/arenaBout.js');
    const { newCrowd } = await import('/src/systems/arenaCrowd.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    if (sheet === 'enhanced') (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    const fighters = shape === 'duel'
      ? [{ id: 'you', name: 'Aldric Wyndbrooke-Varnell', side: 0, maxHealth: 100, ai: false }, { id: 'f0', name: 'Gorlak gro-Mazgulbarz', side: 1, maxHealth: 80, home: 'Daggerfall' }, { id: 'f1', name: 'Trististyr Hearthsly', side: 1, maxHealth: 70 }]
      : [{ id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false }, ...[1, 2, 3].map((i) => ({ id: `f${i}`, name: ['Peristair Kingfield', 'The Sabretooth Tiger', 'Tozca of Totambu'][i - 1], side: i, maxHealth: 60 }))];
    const b = B.newBout({ id: 'p', fighters, ring: { centre: [0, 0], radius: 14 }, now: 0 });
    B.boutTick(b, B.callMs(b));
    for (const f of b.fighters) B.boutAtMarks(b, f.id, B.callMs(b));
    B.boutTick(b, B.callMs(b) + B.COUNT_MS);
    const t = B.callMs(b) + B.COUNT_MS;
    B.boutHealth(b, 'you', 14);
    B.boutHealth(b, 'f1', shape === 'duel' ? 40 : 1);
    if (shape === 'melee') b.fighters[2].out = 'yield';
    const crowd = newCrowd({ fighters: b.fighters });
    crowd.mood = shape === 'duel' ? 0.72 : -0.4;
    crowd.favour.f1 = -0.6;
    drawArenaHud(arenaHudModel(b, crowd, t + 47000, { you: 'you', stamina: 0.63, bark: shape === 'duel' ? 'Blood! Blood on the sand!' : 'Is that a sword or a spoon?' }), { doc: document });
    await new Promise((res) => setTimeout(res, 150));
    const hud = document.querySelector('.arena-hud');
    const rect = hud.getBoundingClientRect();
    const overflow = [...hud.querySelectorAll('*')].filter((n) => { const q = n.getBoundingClientRect(); return q.right > innerWidth + 1 || q.left < -1; }).length;
    const font = getComputedStyle(hud).fontFamily;
    return { left: rect.left, right: rect.right, bottom: rect.bottom, overflow, font, words: hud.textContent.length };
  }, [sheet, shape]);
  check(`${tag} HUD inside the viewport`, r.left >= 0 && r.right <= W + 0.5 && r.overflow === 0, `${Math.round(r.left)}-${Math.round(r.right)} of ${W}, ${r.overflow} spilling`);
  check(`${tag} HUD in the pixel face`, /Pixelify/.test(r.font), r.font);
  await page.screenshot({ path: `${OUT}/arena-hud-${tag}.png` });
  // the Herald's choice (the enhanced dialog - the Plus face of ChoiceWindow)
  if (shape === 'duel') {
    const d = await page.evaluate(async () => {
      const { drawEnhancedChoice } = await import('/src/ui/enhancedDialog.js');
      const { heraldChoice } = await import('/src/systems/arenaHerald.js');
      const ch = heraldChoice({ gameMinutes: 400 * 1440 + 12 * 60 + 5, cityBout: { a: 'Gorlak gro-Mazgul', b: 'Peristair Kingfield' }, ladder: { tier: 1, won: 3, champs: [true] } });
      const owner = { input: () => {} };
      const draw = () => drawEnhancedChoice(owner, ch.lines, ch.options.filter((o) => o.label).map((o) => ({ code: o.code, label: o.label })));
      draw();
      window.__heraldDraw = setInterval(draw, 50);   // the dialog lives while it is drawn (DIALOG_WATCHDOG_MS) - a frame's redraw
      await new Promise((res) => setTimeout(res, 300));
      const win = document.querySelector('.dlg-choice .dlg-win');
      if (!win) return null;
      const q = win.getBoundingClientRect();
      const btns = [...document.querySelectorAll('.dlg-choice .dlg-btn')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, label: b.textContent }; });
      return { left: q.left, right: q.right, top: q.top, bottom: q.bottom, btns };
    });
    if (sheet === 'enhanced') {
      check(`${tag} Herald's choice drawn`, !!d, d ? `${d.btns.length} buttons: ${d.btns.map((b) => b.label).join(' | ')}` : 'none');
      if (d) check(`${tag} Herald's choice inside the viewport`, d.left >= 0 && d.right <= W + 0.5 && d.top >= 0 && d.bottom <= H + 0.5, JSON.stringify([d.left, d.right, d.top, d.bottom].map(Math.round)));
      await page.screenshot({ path: `${OUT}/arena-herald-${tag}.png` });
    }
  }
  await page.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
