// WB9g - DAGON'S FIRE, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the aura's law (test/wb9g_insignia.test.js: who is drawn, the clock's wrap, the pass over a fake GL); what
// node cannot answer is whether the GLSL COMPILES and LINKS in a real WebGL2 context, and whether what it draws is the
// fire it says: the ring burning at its radius and dim inside it, nothing past its edge, flames standing up out of it,
// no seam where the angle's noise closes behind the wearer, no jump where the clock wraps, and nothing at all before it
// has kindled. So: the repo's own module served as it is (no bundler), a grey floor drawn by a stand-in shader, the pass
// drawn by its own class over it, and the frame read back.
//
//     node tools/auraProbe.mjs [--shots <dir>]     (writes aura.png / aura_side.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { AuraRingRenderer, AURA_RING_R, AURA_CLOCK_PERIOD } from '/src/render/auraRing.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec2 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p.x, 0.0, p.y, 1.0); }\`;
const fs = \`#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.08, 0.075, 0.07, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-20, -20, 20, -20, 20, 20, -20, -20, 20, 20, -20, 20]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
let pass = null, err = null;
try { pass = new AuraRingRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.program, gl.LINK_STATUS) : false, ringR: AURA_RING_R, period: AURA_CLOCK_PERIOD };
/** Draw the floor and the aura at the origin from \`eye\` at \`t\` seconds, kindled \`kindle\`; read back \`pts\` (world). */
window.draw = (eye, t, kindle, pts) => {
  const proj = persp(0.9, 640 / 480, 0.05, 100), view = look(eye, [0, 0.2, 0]), vp = mul(proj, view);
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp); gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null);
  pass.draw([{ at: [0, 0, 0], seed: 0.37, kindle }], proj, view, new Float32Array(eye), t, null);
  const px = (w) => {
    const c = [0, 1, 2, 3].map((r) => vp[r] * w[0] + vp[4 + r] * w[1] + vp[8 + r] * w[2] + vp[12 + r]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
    const o = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return Array.from(o);
  };
  return { error: gl.getError(), drawn: pass.drawn, px: pts.map(px) };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }   // not the root: U60 keeps that the landing page's
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 });
  const p = await page.evaluate(() => window.probe);
  check('the pass builds', !p.err, p.err ?? '');
  check('its program links in a real WebGL2', p.linked === true);
  const lum = (c) => c[0] + c[1] + c[2];
  const R = p.ringR, above = [0, 3.2, 3.2];
  // round the ring at 24 bearings, the centre, and past the edge
  const ring = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * R, 0.05, Math.sin(a) * R]; });
  const top = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 1, pts), [above, [...ring, [0, 0.05, 0], [2.2, 0.05, 0], [0, 0.05, -2.2]]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'aura.png') });
  check('no GL error drawing it', top.error === 0 && top.drawn === 1, `error ${top.error}, drawn ${top.drawn}`);
  const ringLum = top.px.slice(0, 24).map(lum), mean = ringLum.reduce((a, b) => a + b, 0) / 24;
  check('the ring burns round the feet', mean > 180 && ringLum.filter((v) => v > 90).length >= 18, `mean ${mean.toFixed(0)}: ${ringLum.join(' ')}`);
  const reds = top.px.slice(0, 24).filter((c) => c[0] > c[2] * 1.4).length;
  check('in fire\'s colours - red over blue', reds >= 20, `${reds}/24`);
  check('dim within it, dark past its edge', lum(top.px[24]) < mean / 2 && lum(top.px[25]) < 60 && lum(top.px[26]) < 60, `${JSON.stringify(top.px.slice(24))}`);
  // the seam where the angle wraps (the -x axis): from straight above, on the ground inside the flames' wall, the fire
  // either side of it differs no more than the fire beside it does - at three moments, three rings in
  const over = [0, 3.4, 0.001], rr = [R - 0.06, R - 0.1, R - 0.14];
  let dSeam = 0, dNear = 0;
  for (const t of [2.5, 7.25, 31.75]) {
    const pts = rr.flatMap((r) => [[-r, 0.05, -0.02], [-r, 0.05, 0.02], [Math.cos(2.2) * r, 0.05, Math.sin(2.2) * r], [Math.cos(2.2 + 0.047) * r, 0.05, Math.sin(2.2 + 0.047) * r]]);
    const got = await page.evaluate(([eye, pts, tt]) => window.draw(eye, tt, 1, pts), [over, pts, t]);
    for (let k = 0; k < rr.length; k++) { dSeam += Math.abs(lum(got.px[k * 4]) - lum(got.px[k * 4 + 1])); dNear += Math.abs(lum(got.px[k * 4 + 2]) - lum(got.px[k * 4 + 3])); }
  }
  check('no seam behind the wearer where the ring closes', dSeam <= Math.max(90, dNear * 2), `across the seam ${dSeam}, beside it ${dNear} (summed over nine pairs)`);
  // the clock's wrap: a breath before it and a breath after, the same fire
  const wrapPts = ring.slice(0, 12);
  const before = await page.evaluate(([eye, pts, t]) => window.draw(eye, t, 1, pts), [above, wrapPts, p.period - 1 / 240]);
  const after = await page.evaluate(([eye, pts, t]) => window.draw(eye, t, 1, pts), [above, wrapPts, 1 / 240]);
  const jump = before.px.map((c, i) => Math.abs(lum(c) - lum(after.px[i])));
  check('no jump where the clock wraps', Math.max(...jump) <= 45, jump.join(' '));
  // the flames stand up out of the ring (from the side, a point a quarter up the flame at the near side)
  const side = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 1, pts), [[0, 0.9, 3.4], [[0, 0.14, R], [0, 0.14, R + 0.8], [0, 1.2, R]]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'aura_side.png') });
  check('flames stand up out of it', lum(side.px[0]) > lum(side.px[1]) + 60 && lum(side.px[2]) < 60, JSON.stringify(side.px));
  const cold = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 0, pts), [above, ring.slice(0, 6)]);
  check('unkindled, nothing burns', cold.px.every((c) => lum(c) < 70), JSON.stringify(cold.px));
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
