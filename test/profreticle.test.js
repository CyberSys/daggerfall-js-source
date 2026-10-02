// PROF-SCENES (2026-10-01, Mac: "all minigames should be overhauled to be more detailed and use the enhanced plus UI
// look"; the minigame "plays inside that same framed panel" as the loot menu): THE ACT IN THE WORLD'S FACE. The panel
// built once an act and moved every frame (never rebuilt), the node named on it, each act's scene drawing the act's own
// numbers (the rock's cracks by the work, the ring's radius and its band, the hold, the glint's time left and the finds,
// the line drawn, the throw and the floats and the haul), the still forms under reduced motion, every cue a sound
// (systems/profSounds.js), and the panel standing where the loot plaque stood, in its frame.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfHud } from '../src/ui/profHud.js';
import { buildActPanel, actCues, sceneOf, ACT_WORDS } from '../src/ui/profScenes.js';
import { PROF_CUES, profCue, setProfCueSink } from '../src/systems/profSounds.js';
import { PROF_CSS } from '../src/ui/enhancedPlusStyle.js';
import { PROF_ACT_CSS } from '../src/ui/profActStyle.js';
import { SOUND } from '../src/systems/soundClips.js';
import { createMineAct } from '../src/systems/mineAct.js';
import { createChopAct } from '../src/systems/chopAct.js';
import { createHerbAct } from '../src/systems/herbAct.js';
import { createTraceAct } from '../src/systems/traceAct.js';
import { createFishAct } from '../src/systems/fishAct.js';
import { MINE_ACT, CHOP_ACT } from '../src/net/professionLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A roll that walks on - the glint's re-roll asks until it moves, so a constant roll would never end. */
const cycle = () => { let r = 0.05; return () => { r = (r + 0.37) % 1; return r; }; };
const all = (root, cls) => root.querySelectorAll(`.${cls}`);
/** An SVG element's class list, as the scene set it (by attribute). */
const svgClass = (n) => (n.getAttribute?.('class') ?? n.className ?? '');
const svgAll = (root, cls) => root.querySelectorAll('*').filter((n) => svgClass(n).split(/\s+/).includes(cls));

test('PROF-SCENES: the panel - the node named and its profession under it, the scene, the count and the hint; built ONCE an act and moved every frame (the old meter rebuilt itself sixty times a second); a new act builds anew (mutants: rebuilt each frame, the title lost)', () => {
  const hud = createProfHud({ doc: document });
  try {
    const meter = document.body.querySelector('.prof-meter');
    const a = createMineAct({ tier: 2, rng: cycle() });
    hud.setMeter(a, '', { title: 'Iron Vein' });
    assert.equal(meter.querySelector('.prof-acttitle').textContent, 'Iron Vein');
    assert.equal(meter.querySelector('.prof-actsub').textContent, 'Mining');
    const face = meter.querySelector('.prof-face');
    assert.ok(face.className.includes('prof-rockface'));
    a.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });
    hud.setMeter(a, '', { title: 'Iron Vein' });
    assert.equal(meter.querySelector('.prof-face'), face, 'the same face, moved - never rebuilt');
    hud.setMeter(createChopAct({ tier: 1 }), '', { title: 'Oak Tree' });
    assert.notEqual(meter.querySelector('.prof-face'), face, 'a new act: built anew');
    assert.equal(meter.querySelector('.prof-acttitle').textContent, 'Oak Tree');
    hud.setMeter(createChopAct({ tier: 1 }));
    assert.equal(meter.querySelector('.prof-acttitle').textContent, 'Logging', 'no node named: the profession its title');
    assert.equal(meter.querySelector('.prof-actsub'), null);
    hud.setMeter(null);
    assert.equal(meter.hidden, true);
  } finally { hud.dispose(); }
  assert.deepEqual(Object.keys(ACT_WORDS).sort(), ['basket', 'chop', 'fish', 'hand', 'mine', 'steady', 'trace']);
});

test('PROF-SCENES mine: the five points, the glinting one lit, the crosshair on the face; a crack opens with each fifth of the work; a blow\'s sparks (gold on the glint); the strikes as pips (mutants: cracks unread, pips frozen, the glint unmoved)', () => {
  const root = document.createElement('div');
  const a = createMineAct({ tier: 2, rng: cycle() });
  const p = buildActPanel(document, root, a);
  p.update(a, {});
  assert.equal(all(root, 'prof-glint').length + all(root, 'prof-point').length, 5);
  assert.equal(all(root, 'prof-glint').length, 1, 'one glints');
  assert.equal(all(root, 'prof-pip').length, a.state.need);
  a.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });   // a plain blow (the glint at 0.3's roll is not the middle)
  a.tick(0.6, { aim: { yaw: -5, pitch: 2.5 } });
  p.update(a, {});
  const cracks = svgAll(root, 'rock-crack');
  assert.equal(cracks.length, 5);
  assert.equal(cracks.filter((c) => svgClass(c).includes('on')).length, Math.round((a.state.points / a.state.need) * 5));
  assert.equal(all(root, 'prof-pip').filter((n) => n.className.includes('on')).length, a.state.points);
  assert.ok(root.querySelector('.prof-sparks').className.includes(' on '), 'the blow\'s sparks');
  assert.equal(root.querySelector('.prof-aim').style.display, '', 'the crosshair on the face');
  assert.equal(root.querySelector('.prof-face').style.aspectRatio, `${2 * MINE_ACT.spreadYawDeg} / ${2 * MINE_ACT.spreadPitchDeg}`);
});

test('PROF-SCENES chop: the ring\'s radius and the band a Clean Cut stands in, lit in the band; the notch deepens with the work; the still bar under reduced motion (mutants: the ring unmoved, the band unwidened, the still form lost)', () => {
  const root = document.createElement('div');
  const a = createChopAct({ tier: 2, rank: 50 });
  const p = buildActPanel(document, root, a);
  p.update(a, {});
  const ring = svgAll(root, 'ring-line')[0];
  const band = svgAll(root, 'ring-band')[0];
  const R = (30 / CHOP_ACT.ringFrom) * 0.94;
  assert.ok(Math.abs(Number(ring.getAttribute('r')) - a.ring * R) < 0.01, 'the ring at its radius');
  assert.ok(Math.abs(Number(band.getAttribute('stroke-width')) - 2 * a.state.band * R) < 1e-9, 'the band its width');
  a.tick(0.3, {});
  p.update(a, {});
  assert.ok(a.ring < CHOP_ACT.ringFrom && Math.abs(Number(ring.getAttribute('r')) - a.ring * R) < 0.01, 'the ring closing, moved with it');
  for (let i = 0; i < 200 && !a.inBand; i++) a.tick(0.01, {});
  p.update(a, {});
  assert.ok(svgClass(ring).includes('in-band'), 'lit in the band');
  const before = svgAll(root, 'wood-notch')[0].getAttribute('d');
  a.tick(0.01, { attack: true });
  p.update(a, {});
  assert.notEqual(svgAll(root, 'wood-notch')[0].getAttribute('d'), before, 'the notch deepens');
  p.update(a, { reduced: true });
  assert.deepEqual([root.querySelector('.prof-face').style.display, root.querySelector('.prof-ringbar').style.display], ['none', ''], 'the still bar');
  assert.ok(root.querySelector('.prof-ringmark').style.left.endsWith('%'));
});

test('PROF-SCENES plant, basket, trace: the hand\'s hold fills round the plant and a bruise browns it; the Basket\'s glint and its time left, its finds in the basket; the knife\'s line drawn behind it, the points passed lit (mutants: the hold unfilled, the finds uncounted, the line undrawn)', () => {
  const root = document.createElement('div');
  const h = createHerbAct({ kind: 'steady' });
  let p = buildActPanel(document, root, h);
  for (let i = 0; i < 10; i++) h.tick(0.1, { held: true });
  p.update(h, { label: 'E' });
  assert.equal(svgAll(root, 'hold-fill')[0].getAttribute('stroke-dasharray'), '40 100');
  assert.equal(root.querySelector('.prof-bar').children[0].style.width, '40%');
  h.tick(0.1, { held: true, view: { yaw: 9, pitch: 0 } });
  p.update(h, { label: 'E' });
  assert.ok(svgClass(svgAll(root, 'herb-plant')[0]).includes('bruised'));
  // the Basket
  let r = 0;
  const b = createHerbAct({ kind: 'basket', rng: () => ((r += 0.37) % 1) });
  p = buildActPanel(document, root, b);
  for (let i = 0; i < 5; i++) b.tick(0.1, {});
  p.update(b, {});
  assert.equal(root.querySelector('.prof-glint').style.display, '');
  b.tick(0.3, {});
  p.update(b, {});
  assert.ok(Number(svgAll(root, 'clock-left')[0].getAttribute('stroke-dasharray').split(' ')[0]) < 100, 'its time running out');
  b.tick(0.01, { attack: true });
  p.update(b, {});
  assert.deepEqual(all(root, 'prof-slot').map((n) => n.className), ['prof-slot found', 'prof-slot next', 'prof-slot']);
  // the knife's line
  const t = createTraceAct({ tier: 1, rng: () => 0.5 });
  p = buildActPanel(document, root, t);
  const pts = t.state.points;
  t.tick(0.05, { held: true, aim: { yaw: pts[0][0], pitch: pts[0][1] } });
  t.tick(0.05, { held: true, aim: { yaw: pts[1][0], pitch: pts[1][1] } });
  p.update(t, {});
  const lines = root.querySelectorAll('POLYLINE');
  assert.equal(lines[0].getAttribute('points').split(' ').length, pts.length, 'the scored line first, through every point');
  assert.ok(lines[1].getAttribute('points').length > 0, 'the line drawn behind the knife');
  assert.equal(all(root, 'prof-glint').length, t.state.reached + 1);
  assert.equal(sceneOf(createTraceAct({ tier: 1, gentle: true })), 'hold', 'Gentle acts: a hold');
});

test('PROF-SCENES fish: the throw a wind will make on its gauge, the net in flight, the floats afloat and dipping at the tug, the school beneath, the haul\'s band and weight on their bar and the net\'s fill (mutants: the gauge frozen, the dip lost, the haul unshown)', () => {
  const root = document.createElement('div');
  const a = createFishAct({ rng: () => 0.2, schoolAt: () => 0 });
  const p = buildActPanel(document, root, a);
  p.update(a, { label: 'E' });
  const mark0 = root.querySelector('.prof-throwmark').style.left;
  for (let i = 0; i < 9; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E' });
  assert.notEqual(root.querySelector('.prof-throwmark').style.left, mark0, 'the gauge winds');
  assert.equal(root.querySelector('.prof-throwbar').style.display, '');
  a.tick(0.05, { held: false });
  p.update(a, { label: 'E' });
  assert.ok(svgClass(svgAll(root, 'water-net')[0]).includes('on'), 'the net in flight');
  for (let i = 0; i < 2000 && a.state.phase !== 'tug'; i++) a.tick(0.05, {});
  p.update(a, { label: 'E' });
  assert.ok(svgClass(svgAll(root, 'water-floats')[0]).includes('dip'), 'the floats dip');
  assert.ok(svgClass(svgAll(root, 'water-school')[0]).includes('on'), 'over a school');
  a.tick(0.05, { attack: true });
  for (let i = 0; i < 10; i++) a.tick(0.1, { held: true });
  p.update(a, { label: 'E' });
  assert.equal(root.querySelector('.prof-haulbar').style.display, '');
  assert.equal(root.querySelector('.prof-throwbar').style.display, 'none');
  assert.ok(root.querySelector('.prof-haulweight').style.left.endsWith('%'));
});

test('PROF-SCENES cues: every change a sound - a blow on the glint rings, a plain one strikes; a Clean Cut rings; a find ticks, a miss slips; a bruise slips once; a point passed ticks, a slip slips; the net swings, splashes, tugs and hauls; the panel says them as it draws, and a clean finish rings (mutants: a cue lost or crossed)', () => {
  const prev = {};
  assert.deepEqual(actCues(prev, { kind: 'mine', strikes: 0 }), []);
  assert.deepEqual(actCues(prev, { kind: 'mine', strikes: 1, last: 'glint' }), ['glint']);
  assert.deepEqual(actCues(prev, { kind: 'mine', strikes: 2, last: 'plain' }), ['strike']);
  assert.deepEqual(actCues({}, { kind: 'chop', chops: 1, last: 'clean' }), ['glint']);
  assert.deepEqual(actCues({ hits: 0 }, { kind: 'basket', hits: [true] }), ['tick']);
  assert.deepEqual(actCues({ hits: 1 }, { kind: 'basket', hits: [true, false] }), ['slip']);
  const st = {};
  assert.deepEqual(actCues(st, { kind: 'steady', bruised: true }), ['slip']);
  assert.deepEqual(actCues(st, { kind: 'steady', bruised: true }), [], 'once');
  assert.deepEqual(actCues({ reached: 0, slips: 0 }, { kind: 'trace', tracing: true, reached: 1, slips: 0 }), ['tick']);
  assert.deepEqual(actCues({ reached: 2, slips: 0 }, { kind: 'trace', tracing: false, reached: 0, slips: 1 }), ['slip']);
  const f = {};
  assert.deepEqual(actCues(f, { kind: 'fish', phase: 'wind' }), []);
  assert.deepEqual(['fly', 'wait', 'tug', 'haul'].map((phase) => actCues(f, { kind: 'fish', phase })), [['swing'], ['splash'], ['tug'], ['tick']]);
  // through the HUD: said as it draws
  const heard = [];
  setProfCueSink((clip, vol) => heard.push([clip, vol]), () => 0);
  const hud = createProfHud({ doc: document });
  try {
    const a = createMineAct({ tier: 2, rng: cycle() });
    hud.setMeter(a);
    assert.deepEqual(heard, [], 'nothing yet');
    a.tick(0.1, { attack: true, aim: { yaw: 0, pitch: 0 } });
    hud.setMeter(a);
    assert.deepEqual(heard, [[PROF_CUES.strike.clips[0], PROF_CUES.strike.volume]]);
    hud.cue('clean');
    assert.deepEqual(heard.at(-1), [SOUND.ActivateLockUnlock, PROF_CUES.clean.volume]);
  } finally { hud.dispose(); setProfCueSink(null, null); }
  assert.equal(profCue('nothing'), false);
  assert.deepEqual(PROF_CUES.strike.clips, [SOUND.Hit1, SOUND.Hit1 + 1, SOUND.Hit1 + 2, SOUND.Hit1 + 3, SOUND.Hit1 + 4], 'DFU\'s five hit clips');
});

test('PROF-SCENES host: the panel stands where the loot plaque stood (its anchor), the node\'s name carried from the menu, the last frame drawn before the act ends, a clean finish rung; the sheet appended after the rules it supersedes, the plaque\'s frame, still forms under reduced motion (mutants: each wire cut)', () => {
  const props = {};
  const hud = createProfHud({ doc: document, anchor: () => ({ x: 412.5, top: 300 }) });
  try {
    const meter = document.body.querySelector('.prof-meter');
    meter.style.setProperty = (k, v) => { props[k] = v; };
    hud.setMeter(createChopAct({ tier: 1 }));
    assert.deepEqual(props, { '--wp-x': '412.5px', '--wp-top': '300.0px' });
  } finally { hud.dispose(); }
  const w = src('src/scenes/world.js');
  assert.match(w, /const hud = createProfHud\(\{ anchor: \(\) => plaqueAnchor\(canvas\) \}\);/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /title: k\.nodeName\?\.\(t\.node\) \|\| '' \};/);
  assert.match(g, /else if \(act\.act\.state\.done\) \{ hud\.setMeter\(act\.act, act\.label \?\? '', \{ byUse: act\.heldByUse === true, title: act\.title \}\); finish\(act\); \}/);
  assert.match(g, /if \(a\.clean\) hud\.cue\?\.\('clean'\);/);
  assert.ok(PROF_CSS.endsWith(`${PROF_ACT_CSS}\n/* ── PROF-SCENES: the stations' acts ── */\n/* font: ${PROF_CSS.match(/\/\* font: (.*?) \*\/\s*$/)?.[1] ?? ''} */`) || PROF_CSS.indexOf(PROF_ACT_CSS) > PROF_CSS.indexOf('.prof-meter { position: fixed; left: 50%; top: 50%;'), 'after the old meter\'s rules');
  assert.match(PROF_ACT_CSS, /\.prof-meter \{ position: fixed; left: var\(--wp-x, 50%\); top: var\(--wp-top, 55%\); transform: translateX\(-50%\);/);
  assert.match(PROF_ACT_CSS, /background: rgba\(10,12,17,0\.9\); border: 2px solid #7d7460;/, 'the plaque\'s ground and border');
  assert.match(PROF_ACT_CSS, /@media \(prefers-reduced-motion: reduce\) \{\n\s*\.prof-meter \.prof-glint, \.wood-trunk\.creaked, \.water-waves/);
});
