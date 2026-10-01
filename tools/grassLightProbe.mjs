// GRASS-LIT: THE GRASS AGAINST THE GROUND IT STANDS ON, IN NUMBERS - no GPU, no game data.
//
// The ground is drawn by the terrain programs (render/renderer.js TERRAIN_FS on the classic lane,
// render/enhancedLighting.js EL_TERRAIN_FS under Enhanced Lighting) and the grass by its own
// (render/labGrass.js GAME_GRASS_FS). This walks the day's real light (world/worldClock.js, the
// weather's own scales) through both, term for term in JS, for a grass tile of every climate
// (their measured means, below), and prints what the eye gets: the ground's displayed colour and the
// grass's at its root, its middle and its tip. `node tools/grassLightProbe.mjs`.
import { exteriorAmbient, sunScale, sunDirection, SUN_RIG_COLOR } from '../src/world/worldClock.js';
import { weatherSunlightScale } from '../src/world/weather.js';
import { elDecode, elEncode, elTonemapRGB, EL_EXPOSURE } from '../src/render/enhancedLighting.js';
import { LAB_DIM, grassLit, GRASS_TILE_MEANS } from '../src/render/labGrass.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const minute = (h, m = 0) => h * 60 + m;
const CASES = [
  ['noon, sunny', minute(12), 'sunny'], ['9:00, sunny', minute(9), 'sunny'], ['18:30, sunny', minute(18, 30), 'sunny'],
  ['noon, overcast', minute(12), 'overcast'], ['noon, rain', minute(12), 'rain'], ['noon, thunder', minute(12), 'thunder'],
];
/** the terrain's displayed colour for an albedo on flat ground (n = up) */
function ground(tex, light, lane) {
  const diff = Math.max(light.sunDir[1], 0);
  if (!lane) return tex.map((t, i) => t * (light.amb[i] + light.sunCol[i] * light.sunScale * diff));
  const lit = tex.map((t, i) => elDecode(t) * (elDecode(light.amb[i]) + elDecode(light.sunCol[i]) * light.sunScale * diff) * EL_EXPOSURE);
  return elTonemapRGB(lit).map(elEncode);
}
const old = (ground, t, light) => {   // the shipped law (GAME_GRASS_FS before GRASS-LIT), smooth style, sun on a leaning blade ~ the flat's lambert
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  let c = mix(ground.map((v) => v * 0.62), [0.13, 0.20, 0.07], ss(0, 0.55, t));
  c = mix(c, [0.24, 0.32, 0.12], ss(0.5, 1, t));
  const lam = Math.max(light.sunDir[1], 0) * 0.9;
  return c.map((v, i) => v * (light.amb[i] * 1.25 * (0.42 + 0.58 * t) + light.sunCol[i] * light.sunScale * 1.15 * lam) * light.dim);
};
for (const lane of [false, true]) {
  console.log(`\n== ${lane ? 'ENHANCED LIGHTING' : 'CLASSIC'} lane ==`);
  for (const [name, m, wx] of CASES) {
    const ws = weatherSunlightScale(wx, false);
    const light = { amb: [...exteriorAmbient(m, 1, ws)], sunScale: sunScale(m) * ws, sunCol: [...SUN_RIG_COLOR], sunDir: [...sunDirection(m)], dim: LAB_DIM[wx] ?? 1 };
    const rows = [];
    for (const [climate, mean] of Object.entries(GRASS_TILE_MEANS)) {
      const g = ground(mean, light, lane);
      const o = [0.15, 0.5, 0.9].map((t) => old(mean, t, light));
      const n = [0.15, 0.5, 0.9].map((t) => grassLit(mean, t, light, lane));
      rows.push(`${climate.padEnd(9)} ground ${hex(g)} L${lum(g).toFixed(3)} | was ${o.map(hex).join(' ')} (${(lum(o[1]) / lum(g)).toFixed(2)}x) | now ${n.map(hex).join(' ')} (${(lum(n[1]) / lum(g)).toFixed(2)}x)`);
    }
    console.log(`-- ${name}`); for (const r of rows) console.log('  ' + r);
  }
}
