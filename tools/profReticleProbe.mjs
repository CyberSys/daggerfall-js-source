// PROF-SCENES (2026-10-01): THE ACTS' PANELS, PHOTOGRAPHED - each act's scene (ui/profScenes.js) in its plaque-framed
// panel (ui/profHud.js, PROF_CSS), at the moments a player sees: a vein mid-work with the glint and a blow's sparks, a
// tree with the ring in the band, the steady hand held and bruised, the Basket's glint and its finds, the knife's line
// half drawn and the Gentle hold, the net winding, waiting over a school, at the tug and in the haul; the still forms
// under reduced motion; a phone's width. Driven headless through Vite over the real modules - no ARENA2, no world.
//
//   node tools/profScenesProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'probe-out/prof-scenes';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const shots = [];
try {
  for (const [vw, vh, tag, reduced] of [[1280, 800, 'desk', false], [390, 844, 'phone', false], [1280, 800, 'still', true]]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto('http://localhost:5241/', { waitUntil: 'domcontentloaded' }); console.error('loaded', tag);
    await page.evaluate(() => { document.head.querySelectorAll('style, link[rel=stylesheet]').forEach((n) => n.remove()); document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#3b4a33'; });
    const scenes = await page.evaluate(async () => {
      const { createProfHud } = await import('/src/ui/profHud.js');
      const { createMineAct } = await import('/src/systems/mineAct.js');
      const { createChopAct } = await import('/src/systems/chopAct.js');
      const { createHerbAct } = await import('/src/systems/herbAct.js');
      const { createTraceAct } = await import('/src/systems/traceAct.js');
      const { createFishAct } = await import('/src/systems/fishAct.js');
      const { setProfCueSink } = await import('/src/systems/profSounds.js');
      setProfCueSink(() => {});
      window.__hud = createProfHud({ anchor: () => ({ x: window.innerWidth / 2, top: 24 }) });
      const run = (n, f) => { for (let i = 0; i < n; i++) f(i); };
      const cycle = () => { let r = 0.05; return () => { r = (r + 0.37) % 1; return r; }; };   // the glint's re-roll asks until it moves
      const acts = {
        mine: () => { const a = createMineAct({ tier: 2, rng: cycle() }); a.tick(0.1, { aim: { yaw: -4.6, pitch: 2.2 } }); a.tick(0.1, { attack: true, aim: { yaw: -4.6, pitch: 2.2 } }); a.tick(0.6, { aim: { yaw: 1, pitch: -1 } }); a.tick(0.05, { attack: true, aim: { yaw: 1, pitch: -1 } }); return [a, '', { title: 'Iron Vein' }]; },
        chop: () => { const a = createChopAct({ tier: 2, rank: 40 }); a.tick(0.9, {}); a.tick(0.01, { attack: true }); a.tick(0.5, {}); return [a, '', { title: 'Oak Tree' }]; },
        steady: () => { const a = createHerbAct({ kind: 'steady' }); run(10, () => a.tick(0.1, { held: true })); return [a, 'E', { title: 'Red Rose' }]; },
        bruised: () => { const a = createHerbAct({ kind: 'steady' }); a.tick(0.1, { held: true }); run(8, () => a.tick(0.1, { held: true, view: { yaw: 9, pitch: 0 } })); return [a, 'E', { title: 'Red Rose' }]; },
        basket: () => { let r = 0; const a = createHerbAct({ kind: 'basket', rng: () => ((r += 0.37) % 1) }); run(5, () => a.tick(0.1, {})); a.tick(0.05, { attack: true }); run(6, () => a.tick(0.1, {})); a.tick(0.3, {}); return [a, 'tap the glint', { title: 'Bramble' }]; },
        trace: () => { const a = createTraceAct({ tier: 4, rng: () => 0.5 }); const p = a.state.points; a.tick(0.05, { held: true, aim: { yaw: p[0][0], pitch: p[0][1] } }); for (let i = 1; i <= 30; i++) { const u = (i / 30) * 3; const k = Math.floor(u), t = u - k; a.tick(0.05, { held: true, aim: { yaw: p[k][0] + (p[k + 1][0] - p[k][0]) * t, pitch: p[k][1] + (p[k + 1][1] - p[k][1]) * t + 0.3 } }); } return [a, 'E', { title: 'Grizzly Bear' }]; },
        gentle: () => { const a = createTraceAct({ tier: 2, gentle: true }); run(3, () => a.tick(0.2, { held: true })); return [a, 'E', { title: 'Wolf' }]; },
        wind: () => { const a = createFishAct({ rng: () => 0.5 }); run(9, () => a.tick(0.1, { held: true })); return [a, 'E', { title: 'Open Water' }]; },
        wait: () => { const a = createFishAct({ rng: () => 0.5, schoolAt: () => 0 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); run(14, () => a.tick(0.05, {})); return [a, 'E', { title: 'Open Water' }]; },
        tug: () => { const a = createFishAct({ rng: () => 0.2, schoolAt: () => 0 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {}); return [a, 'E', { title: 'Open Water' }]; },
        haul: () => { const a = createFishAct({ rng: () => 0.2 }); run(6, () => a.tick(0.1, { held: true })); a.tick(0.05, { held: false }); for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {}); a.tick(0.05, { attack: true }); run(30, (i) => a.tick(0.1, { held: i % 3 !== 0 })); return [a, 'E', { title: 'Open Water' }]; },
      };
      window.__acts = acts;
      return Object.keys(acts);
    });
    for (const name of scenes) {
      await page.evaluate((n) => { const [a, label, o] = window.__acts[n](); window.__hud.setMeter(a, label, o); }, name);
      await page.waitForTimeout(140);
      const el = await page.$('.prof-meter');
      const file = `${out}/${tag}-${name}.png`;
      await el.screenshot({ path: file });
      shots.push(file); console.error('shot', file);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(shots.join('\n'));
