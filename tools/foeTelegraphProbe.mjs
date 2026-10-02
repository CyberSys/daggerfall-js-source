// TACT4 - A FOE'S TELEGRAPH, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the law (test/tact4.test.js: the shader's reading held to inBlow point for point); what node cannot
// answer is whether the GLSL compiles and links in a real WebGL2 context and whether the shape lands on the ground -
// lit inside, dark outside, dim through its wind-up, bright at the landing. So: the repo's own modules served as they
// are, a grey ground drawn by a stand-in shader, the pass drawn by its own class, and the frame read back.
//
//     node tools/foeTelegraphProbe.mjs [--shots <dir>]     (writes lunge.png / sweep.png / slam.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=512 height=512></canvas><script type=module>
import { FoeTelegraphPass } from '/src/render/foeTelegraph.js';
import { makeBlow, blowPhase } from '/src/ai/foeBlows.js';
import { perspective, lookAt } from '/src/world/mat4.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram();
gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\\nlayout(location=0) in vec2 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p.x, 0.0, p.y, 1.0); }'));
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; out vec4 o; void main(){ o = vec4(0.18, 0.18, 0.18, 1.0); }'));
gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-20,-20, 20,-20, 20,20, -20,-20, 20,20, -20,20]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
const proj = perspective(1.0, 1, 0.1, 100);
const view = lookAt([0, 14, 0.001], [0, 0, 0], [0, 1, 0]);
const vp = new Float32Array(16);
for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) vp[c*4+r] = proj[r]*view[c*4] + proj[4+r]*view[c*4+1] + proj[8+r]*view[c*4+2] + proj[12+r]*view[c*4+3];
const pass = new FoeTelegraphPass(gl);
window.err = gl.getError();
window.draw = (kind, when, fog = null, slope = null) => {
  gl.viewport(0, 0, 512, 512);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
  gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null);
  const blow = makeBlow(kind, [0, 0, 0], 0, 10);   // at the origin, facing +z
  const at = when === 'land' ? blow.land + 0.02 : 10 + (blow.land - 10) * 0.4;   // the landing's flash, or 40% through the wind-up
  if (slope) blow.slope = slope;
  const n = pass.draw([{ blow, phase: blowPhase(blow, at) }], proj, view, fog);
  // read the ground at a world point
  const px = (x, z) => { const v = [x, 0, z, 1]; const c = [0,0,0,0]; for (let r = 0; r < 4; r++) c[r] = vp[r]*v[0] + vp[4+r]*v[1] + vp[8+r]*v[2] + vp[12+r]*v[3];
    const sx = Math.round((c[0]/c[3]*0.5+0.5)*511), sy = Math.round((c[1]/c[3]*0.5+0.5)*511); const o = new Uint8Array(4); gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return o[0]; };
  return { n, err: gl.getError(), probes: { ahead: px(0, 1.8), beside: px(3.5, 1.8), behind: px(0, -2.5), far: px(0, 4.0), wide: px(1.5, 1.5) }, png: document.getElementById('c').toDataURL() };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready || window.err === undefined, null, { timeout: 15000 }).catch(() => {});
  check('the page and the pass build (the GLSL compiles and links)', await page.evaluate(() => window.ready === true), errs.join(' | '));
  const shot = (name, png) => { if (shotsAt) writeFileSync(join(shotsAt, `${name}.png`), Buffer.from(png.split(',')[1], 'base64')); };
  const GROUND = 46;   // 0.18 grey
  for (const kind of ['lunge', 'sweep', 'slam']) {
    const wind = await page.evaluate((k) => window.draw(k, 'wind'), kind);
    const land = await page.evaluate((k) => window.draw(k, 'land'), kind);   // past every wind-up, inside the flash
    shot(kind, land.png);
    check(`${kind}: drawn, no GL error`, wind.n === 1 && wind.err === 0 && land.err === 0, JSON.stringify({ n: wind.n, err: wind.err }));
    check(`${kind}: lit ahead, dark beside and behind`, land.probes.ahead > GROUND + 60 && Math.abs(land.probes.beside - GROUND) < 6 && Math.abs(land.probes.behind - GROUND) < 6, JSON.stringify(land.probes));
    check(`${kind}: dimmer in the wind-up than at the landing`, wind.probes.ahead > GROUND && wind.probes.ahead < land.probes.ahead, `${wind.probes.ahead} < ${land.probes.ahead}`);
  }
  const lunge = await page.evaluate(() => window.draw('lunge', 'land'));
  check('the lunge reaches past the slam\'s disc and stays in its lane', lunge.probes.far > GROUND + 60 && Math.abs(lunge.probes.wide - GROUND) < 6, JSON.stringify(lunge.probes));
  const sweep = await page.evaluate(() => window.draw('sweep', 'land'));
  const fogged = await page.evaluate(() => window.draw('lunge', 'land', { mode: 1, range: new Float32Array([2, 16]), density: 0, camPos: new Float32Array([0, 14, 0]) }));
  check('fogged: the mark dims in the frame\'s fog (AUDIT TACT D9)', fogged.probes.ahead < 255 && fogged.probes.ahead > 46, JSON.stringify(fogged.probes));
  const down = await page.evaluate(() => window.draw('lunge', 'land', null, [0, -0.5]));   // told the ground falls away ahead: over this flat ground its lane sinks under it, hidden
  const up = await page.evaluate(() => window.draw('lunge', 'land', null, [0, 0.5]));   // told it rises: the lane stands over the flat ground, seen to its end
  check('tilted: the mark follows the slope it is given (AUDIT TACT D8)', Math.abs(down.probes.ahead - 46) < 6 && Math.abs(down.probes.far - 46) < 6 && up.probes.ahead > 46 + 60 && up.probes.far > 46 + 60, JSON.stringify({ down: down.probes, up: up.probes }));
  check('the sweep\'s cone holds the diagonal ahead', sweep.probes.wide > GROUND + 60, JSON.stringify(sweep.probes));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((x) => !x).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${out.length} held`);
process.exit(failed ? 1 : 0);
