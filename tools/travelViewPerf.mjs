// PERF-TV (2026-09-28, Mac: "I also want to ensure performance is golden"; bible/06-Systems/Travel-View.md
// PERF-TV): THE OVERWORLD'S OWN FRAME COST, MEASURED IN A REAL BROWSER.
//
// What the view adds to a frame on top of the world it draws: the readout's DOM (the traveller's ring, the compass,
// the route line and every keyed mark - plates, far places, travellers), written each frame. Measured here as the
// frame measures it: the update's JavaScript, then the style and layout the browser owes for it (forced with a
// layout read, so the cost is paid inside the timer and not hidden in the next paint). Marks move every frame, as
// they do while the camera orbits; a second run holds them still, as they are while it rests - the steady state the
// readout must make nearly free.
//
// The mix is the view's own: 20 clickable places (the grid's plates and TV5's far places) and the rest travellers,
// a quarter of them off the picture and held at its edge - every one drawn on the readout's one canvas since PERF-TV.
//
// Budgets (the frame is 16.7 ms at 60 Hz; the view's own share must be a rounding error):
//   20 places + 64 travellers moving   <= 0.60 ms a frame
//   20 places + 256 travellers moving  <= 1.50 ms a frame
//   20 places + 64 travellers at rest  <= 0.15 ms a frame
//
// Measured before PERF-TV (2026-09-28, every mark a DOM node, the screen read per held mark): 64 moving marks 5.8 ms,
// 256 moving 35.7 ms - the screen's size read after each mark's writes forced a layout per held mark.
//
// Usage: node tools/travelViewPerf.mjs            (prints the table; exits 1 on a blown budget)
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5233, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch();
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5233/play/');
  const r = await page.evaluate(async () => {
    const hud = await import('/src/ui/travelViewHud.js');
    hud.showTravelViewHud({});
    const W = innerWidth, H = innerHeight;
    const route = Array.from({ length: 120 }, (_, i) => ({ x: 683 + i * 3, y: 384 - i * 2, front: true }));
    const frameOf = (n, t, moving) => {
      const marks = [];
      const all = n + 20;
      for (let i = 0; i < all; i++) {
        const a = (i / all) * Math.PI * 2 + (moving ? t * 0.01 : 0);
        const place = i < 20;
        const far = !place && i % 4 === 0;   // a quarter of the travellers off the picture: held at the edge
        const rr = far ? 2000 : 250;
        marks.push(place
          ? { key: `p${i}`, x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr * 0.6, front: true, label: `Place ${i}`, kind: 'place', pick: true }
          : { key: `t${i}`, x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr * 0.6, front: i % 8 !== 0, label: `Rider ${i}`, kind: i % 5 ? 'traveller' : 'party journey', edge: far });
      }
      return {
        feet: { x: 683 + (moving ? Math.sin(t * 0.05) * 2 : 0), y: 384, front: true }, heading: moving ? t % 360 : 30, yaw: moving ? t * 0.01 : 0.5,
        where: 'Near Daggerfall, Daggerfall', trip: 'To Ripwych, by the road', fade: 1, marks,
        route: moving ? route.map((p) => ({ x: p.x + Math.sin(t * 0.02) * 3, y: p.y, front: true })) : route,
      };
    };
    const run = (n, moving, frames = 400) => {
      const pre = Array.from({ length: frames }, (_, t) => frameOf(n, t, moving));
      for (let t = 0; t < 30; t++) { hud.updateTravelViewHud(pre[t]); document.body.getBoundingClientRect(); }   // warm
      const t0 = performance.now();
      for (let t = 0; t < frames; t++) { hud.updateTravelViewHud(pre[t]); void document.body.offsetHeight; }
      return (performance.now() - t0) / frames;
    };
    run(64, true, 200); run(256, true, 100);   // the JIT and the label images, warmed - the first run paid for both
    const out = { m64: run(64, true) };
    out.canvas = hud.travelViewHudState().marks.length;
    out.hits = hud.travelViewHudState().hits.length;
    out.p20 = run(0, true);
    out.nodes = document.querySelectorAll('.tview-mark').length;
    Object.assign(out, { m256: run(256, true), s64: run(64, false), s0: run(0, false) });
    hud.hideTravelViewHud();
    return out;
  });
  console.log(`readout, ms a frame (update + the style and layout it owes):`);
  console.log(`  20 places + 64 travellers moving   ${r.m64.toFixed(3)}`);
  console.log(`  20 places + 256 travellers moving  ${r.m256.toFixed(3)}`);
  console.log(`  20 places + 64 travellers at rest  ${r.s64.toFixed(3)}`);
  console.log(`  20 places alone, at rest           ${r.s0.toFixed(3)}`);
  console.log(`  20 places alone, moving            ${r.p20.toFixed(3)}`);
  check(r.m64 <= 0.6, `20 places + 64 moving travellers within 0.60 ms (${r.m64.toFixed(3)})`);
  check(r.m256 <= 1.5, `20 places + 256 moving travellers within 1.50 ms (${r.m256.toFixed(3)})`);
  check(r.s64 <= 0.15, `20 places + 64 travellers at rest within 0.15 ms (${r.s64.toFixed(3)})`);
  check(r.canvas === 84 && r.nodes === 0 && r.hits === 20, `every mark on the canvas (${r.canvas} handed, ${r.nodes} DOM nodes), the 20 places taking clicks (${r.hits} boxes)`);
  check(pageErrors.length === 0, `no page errors (${pageErrors.join('; ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nOK');
process.exit(failures.length ? 1 : 0);
