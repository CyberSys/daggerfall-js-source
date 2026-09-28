// TV1 - THE TRAVEL VIEW, IN A REAL BROWSER (bible/06-Systems/Travel-View.md).
//
// The node pins drive the camera's law and the host's machine against fakes. What only a real GL and a real DOM can
// say, this says - on a SYNTHETIC valley (CI has no ARENA2 and never will), through the real renderer:
//
//   1. THE FOG IS THE TRAVELLER'S. From 260 m up in a rain fog (exp 0.003), the ground at the traveller's feet is
//      drawn as the traveller sees it - nearly clear - with the focus set, and fogged as the camera's 330 m of air
//      would fog it without. Read off the pixel under the projected feet against the fog colour.
//   2. THE SUN'S SHADOWS FALL ABOUT THE TRAVELLER. A block beside the feet casts onto the ground under the raised
//      eye with the focus set; without it every cascade stands about a point in the sky and the ground is lit.
//   3. THE FLATS LEAN. A standing sprite seen from 52 degrees down covers more screen rows leaned (the view's up)
//      than upright - and still stands on its own foot.
//   4. THE INPUT IS THE VIEW'S. scenes/travelView.js on a real canvas, real pointer events from the browser: a click
//      is a pick, a drag turns the view and picks nothing, the wheel zooms, and a listener the "host" put on the
//      window's bubble phase hears none of it; the readout's Return button brings the view down. Two screenshots.
//
// Usage: node tools/travelViewProbe.mjs [outDir]   (PNGs land in outDir, default scratch/tv1/)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const OUT = process.argv[2] || 'scratch/tv1';
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(Uint8Array.from(rgba.slice(src, src + w * 4))).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const W = 640, H = 400;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5231/play/');

  // ── 1-3: THE RENDER ─────────────────────────────────────────────────────────────────────────────────────────────
  const r = await page.evaluate(async ({ W, H }) => {
    const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
    const { eyeFor, leanedUp, rightOf, TV_TILT_DEFAULT } = await import('/src/player/travelCamera.js');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    document.body.appendChild(canvas);
    const rr = new Renderer(canvas);
    const gl = rr.gl;
    const tex = (w, h, f) => { const colors = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const [a, b, c, d] = f(x, y); colors[i] = a; colors[i + 1] = b; colors[i + 2] = c; colors[i + 3] = d; } return { width: w, height: h, colors }; };
    rr.uploadTexture(1, 1, tex(16, 16, () => [200, 200, 200, 255]));          // the ground: flat light grey, so fog and shadow read clean
    rr.uploadTexture(1, 2, tex(16, 16, () => [150, 120, 90, 255]));           // the block
    rr.uploadTexture(210, 1, tex(16, 32, (x, y) => [40, 140, 50, (x > 3 && x < 12) ? 255 : 0]));   // a "tree": a green bar
    const P = [], N = [], UV = [], IDX = [], subs = [];
    const quad = (a, b, c, d, n, s = 1) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, s, 0, s, s, 0, s); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    const box = (x0, y0, z0, x1, y1, z1) => {
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    };
    const sub = (rec, build) => { const start = IDX.length; build(); subs.push({ textureArchive: 1, textureRecord: rec, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
    sub(1, () => quad([-1500, 0, 1500], [1500, 0, 1500], [1500, 0, -1500], [-1500, 0, -1500], [0, 1, 0], 100));
    sub(2, () => box(6, 0, -4, 14, 12, 4));   // a block 10 m east of the feet: its shadow falls on the ground about them
    const mesh = rr.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    const tree = rr.createBillboardBatch(210, 1, { w: 6, h: 18 }, [[-20, 9, 20]]);   // centres stand at half height, as the world's flats do
    const feet = [0, 0, 0], head = [0, 1.7, 0];
    const yaw = 0, tilt = TV_TILT_DEFAULT, height = 260;
    const { eye, fwd } = eyeFor(feet, yaw, tilt, height);
    const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.2, 6000));
    const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
    const I = identity();
    const project = (p) => { const v = [view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12], view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13], view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14], 1];
      const c = [proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], 0, proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15]];
      return [Math.round((c[0] / c[3] * 0.5 + 0.5) * W), Math.round((c[1] / c[3] * 0.5 + 0.5) * H)]; };
    const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const at = (px, [x, y]) => { const i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const FOG = new Float32Array([0.35, 0.4, 0.5]);
    const frame = ({ focus, lane, fog, up = [0, 1, 0], sun = 0.9 }) => {
      rr.setLightingLane(lane ? EL_LANE : null);
      rr.setAir(false);
      rr.setClearColor([0.35, 0.4, 0.5, 1]);
      rr.setLighting(new Float32Array([0.35, 0.35, 0.4]), sun, new Float32Array([1, 0.95, 0.85]));
      if (fog) rr.setFog('exp', 0.003, 0, 0, FOG); else rr.setFog('off', 0, 0, 0, FOG);
      rr.setPointLights(new Float32Array(0), new Float32Array(0));
      let px = null;
      for (let f = 0; f < 4; f++) {   // the shadow maps draw from the last frame's records
        rr.setFocus(focus);
        rr.beginFrame(proj, view, new Float32Array([0.6, 0.55, 0.2]), WORLD_FRAME);
        rr.drawMesh(mesh, I, null);
        rr.drawBillboards([tree], new Float32Array(rightOf(yaw)), new Float32Array(up));
        rr.resolveFrame();
        px = read();
      }
      return px;
    };
    const feetPx = project(feet);
    // 2. the shadow: the ground just by the block, where the sun throws its shadow; 1. is read off open ground clear of it
    const shadowPt = project([2, 0, -2]);
    const litPt = project([-12, 0, -12]);
    // 1. the fog - read on open ground a few metres from the feet, clear of the block's shadow
    const fogOff = frame({ focus: null, lane: true, fog: true });
    const fogOn = frame({ focus: head, lane: true, fog: true });
    const clear = frame({ focus: head, lane: true, fog: false });
    const shOff = frame({ focus: null, lane: true, fog: false });
    const shOn = frame({ focus: head, lane: true, fog: false });
    // 3. the flats: count the tree's green rows upright and leaned
    const green = (px) => { let rows = 0; let foot = -1; for (let y = 0; y < H; y++) { let hit = false; for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (px[i + 1] - px[i] > 35 && px[i + 1] - px[i + 2] > 35) { hit = true; break; } } if (hit) { rows++; if (foot < 0) foot = y; } } return { rows, foot }; };
    const upright = frame({ focus: head, lane: true, fog: false, up: [0, 1, 0] });
    const leaned = frame({ focus: head, lane: true, fog: false, up: leanedUp(yaw, tilt) });
    return {
      feetPx, shadowPt, litPt,
      fog: { off: at(fogOff, litPt), on: at(fogOn, litPt), clear: at(clear, litPt), fog: [...FOG].map((v) => Math.round(v * 255)) },
      shadow: { offShadow: at(shOff, shadowPt), offLit: at(shOff, litPt), onShadow: at(shOn, shadowPt), onLit: at(shOn, litPt) },
      tree: { upright: green(upright), leaned: green(leaned) },
      shots: { fogOff: Array.from(fogOff), fogOn: Array.from(fogOn), shadowOn: Array.from(shOn), leaned: Array.from(leaned) },
      glError: gl.getError(),
    };
  }, { W, H });
  for (const [k, px] of Object.entries(r.shots)) writeFileSync(join(OUT, `tv1-${k}.png`), png(W, H, px));
  const lum = (c) => (c[0] + c[1] + c[2]) / 3;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  console.log('feet at', r.feetPx, 'fog', JSON.stringify(r.fog));
  check(r.glError === 0, `no GL error (${r.glError})`);
  check(dist(r.fog.on, r.fog.clear) < dist(r.fog.off, r.fog.clear) / 3, `the ground by the feet is the traveller's clear ground with the focus (${r.fog.on} vs clear ${r.fog.clear}), and fogged by the camera's air without it (${r.fog.off})`);
  check(dist(r.fog.off, r.fog.fog) < dist(r.fog.clear, r.fog.fog), 'without the focus the feet sit deep in the fog - the case the focus exists for');
  console.log('shadow', JSON.stringify(r.shadow));
  check(lum(r.shadow.onShadow) < lum(r.shadow.onLit) - 12, `with the focus the block's shadow lies on the ground by the feet (${lum(r.shadow.onShadow).toFixed(0)} vs lit ${lum(r.shadow.onLit).toFixed(0)})`);
  check(Math.abs(lum(r.shadow.offShadow) - lum(r.shadow.offLit)) < 8, `without it no cascade reaches the ground from 330 m (${lum(r.shadow.offShadow).toFixed(0)} vs ${lum(r.shadow.offLit).toFixed(0)})`);
  console.log('tree', JSON.stringify(r.tree));
  check(r.tree.leaned.rows > r.tree.upright.rows * 1.25, `the leaned flat stands taller on screen (${r.tree.leaned.rows} rows against ${r.tree.upright.rows})`);
  check(r.tree.upright.rows > 0 && Math.abs(r.tree.leaned.foot - r.tree.upright.foot) <= 2, `and keeps its foot where it stood (row ${r.tree.leaned.foot} against ${r.tree.upright.foot})`);

  // ── 4: THE INPUT ────────────────────────────────────────────────────────────────────────────────────────────────
  const page2 = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page2.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page2.goto('http://localhost:5231/play/');
  await page2.evaluate(async () => {
    const { createTravelView } = await import('/src/scenes/travelView.js');
    const hud = await import('/src/ui/travelViewHud.js');
    const { forwardOf } = await import('/src/player/travelCamera.js');
    document.body.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#223';
    document.body.append(canvas);
    const log = window.__tv = { picks: [], hostHeard: [], cursor: [] };
    for (const t of ['pointerdown', 'mousedown', 'wheel', 'contextmenu']) window.addEventListener(t, (e) => { if (e.target === canvas) log.hostHeard.push(t); });   // the host's own ladders: the bubble phase
    let yaw = 0;
    const tv = createTravelView({
      canvas, feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(yaw, 0) }), yaw: () => yaw, setYaw: (y) => { yaw = y; },
      allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: (e) => (e.code === 'Escape' ? ['Escape'] : []),
      freeCursor: (f) => log.cursor.push(f), where: () => 'Near Daggerfall, Daggerfall',
      project: () => ({ x: innerWidth / 2, y: innerHeight / 2, front: true }), onPick: (x, y) => log.picks.push([Math.round(x), Math.round(y)]),
      hud: { show: hud.showTravelViewHud, hide: hud.hideTravelViewHud, update: hud.updateTravelViewHud },
    });
    window.__tvObj = tv;
    tv.enter();
    let last = performance.now();
    const loop = (now) => { tv.frame(Math.min(0.1, (now - last) / 1000)); tv.drawHud(); last = now; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page2.waitForFunction(() => window.__tvObj.state === 'up', null, { timeout: 10000 });
  await page2.mouse.click(700, 400);
  await page2.mouse.move(300, 300); await page2.mouse.down(); await page2.mouse.move(420, 320, { steps: 6 }); await page2.mouse.up();
  const yawAfterDrag = await page2.evaluate(() => window.__tvObj.camera.yaw);
  const h0 = await page2.evaluate(() => window.__tvObj.camera.heightTarget);
  await page2.mouse.move(600, 400); await page2.mouse.wheel(0, -200);
  await page2.mouse.click(600, 400, { button: 'right' });
  const st = await page2.evaluate(() => ({ ...window.__tv, h: window.__tvObj.camera.heightTarget }));
  await page2.screenshot({ path: join(OUT, 'tv1-hud-1366.png') });
  check(st.picks.length === 1 && Math.abs(st.picks[0][0] - 700) <= 1 && Math.abs(st.picks[0][1] - 400) <= 1, `a click is one pick where it landed (${JSON.stringify(st.picks)})`);
  check(Math.abs(yawAfterDrag) > 0.3, `a drag turned the view (yaw ${yawAfterDrag.toFixed(3)})`);
  check(st.h < h0, `the wheel zoomed in (${h0.toFixed(0)} -> ${st.h.toFixed(0)})`);
  check(st.hostHeard.length === 0, `the host's own listeners heard nothing (${JSON.stringify(st.hostHeard)})`);
  check(JSON.stringify(st.cursor) === '[true]', 'the cursor freed once');
  const barBox = await page2.locator('.tview-bar').boundingBox();
  check(!!barBox && barBox.x >= 0 && barBox.x + barBox.width <= 1366 && barBox.y + barBox.height <= 768, `the readout's bar is on screen (${JSON.stringify(barBox)})`);
  const you = await page2.locator('.tview-you').boundingBox();
  check(!!you, 'the traveller\'s mark is drawn');
  await page2.locator('.tview-back').click();
  await page2.waitForFunction(() => window.__tvObj.state === 'off', null, { timeout: 5000 });
  const end = await page2.evaluate(() => ({ cursor: window.__tv.cursor, shown: getComputedStyle(document.getElementById('travel-view')).display }));
  check(JSON.stringify(end.cursor) === '[true,false]' && end.shown === 'none', `Return brought it down and put everything back (${JSON.stringify(end)})`);
  // the phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:5231/play/');
  await phone.evaluate(async () => {
    const hud = await import('/src/ui/travelViewHud.js');
    document.body.innerHTML = '';
    hud.showTravelViewHud({});
    hud.updateTravelViewHud({ feet: { x: 195, y: 420, front: true }, heading: 30, yaw: 0.5, where: 'The wilds of the Wrothgarian Mountains', touch: true });
  });
  const pb = await phone.locator('.tview-bar').boundingBox();
  check(!!pb && pb.x >= 0 && pb.x + pb.width <= 390, `the bar fits a phone (${JSON.stringify(pb)})`);
  await phone.screenshot({ path: join(OUT, 'tv1-hud-phone.png') });
  check(pageErrors.length === 0, `no page errors (${pageErrors.slice(0, 3).join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nOK');
process.exit(failures.length ? 1 : 0);
