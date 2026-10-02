// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S RITE IN THE WORLD - the circle and its smoke
// (scenes/riteHost.js, world/riteModel.js, render/riteSmoke.js), its faithful shared by the World of Daggerfall camps'
// law, the rite's word to its cell, the opening, the hub's broken word, the casket (systems/riteChest.js), the receipt's
// rite in the spoils and the claim, the session and the world host's seams - bible/11-Multiplayer/World-Bosses.md
// section 19 D.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRiteHost, RITE_TEXT, RITE_SPRING_M, RITE_SIGHT_M, RITE_ALERT_M, RITE_CHEST_SEED_M, RITE_SMOKE_IN_MS, RITE_SMOKE_OUT_MS } from '../src/scenes/riteHost.js';
import { riteLocalOf, riteFaithfulOf, RITE_REACH_M, RITE_WORD_MS, RITE_SUMMONER_CAREER } from '../src/net/gateRite.js';
import { gateTimes, gateSpotLocal, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { worldRoom } from '../src/net/wire.js';
import { riteLayout, buildRiteModel, RITE_BRAZIERS, RITE_BRAZIER_R, RITE_RING_R, RITE_TENT_R, RITE_SIGIL_LIFT, RITE_SIGIL_REACH } from '../src/world/riteModel.js';
import { GATE_PLINTH_RECORD } from '../src/world/gateModel.js';
import { RiteSmokeRenderer, SMOKE_FS, SMOKE_CLIMB_TILES, SMOKE_TILES_UP, SMOKE_SEGMENTS, SMOKE_ROWS, SMOKE_MAX, smokeVertices } from '../src/render/riteSmoke.js';
import { riteChestItems, riteChestOpened, markRiteChest, RITE_REAGENTS, RITE_HEART, RITE_BRAND_SET, RITE_CHEST_SAVE_VENDOR } from '../src/systems/riteChest.js';
import { restoreModSaveRecords, modSaveRecords } from '../src/systems/modSaveData.js';
import { spoilsList, createSpoilsPool, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { gateClaimVerdict, GATE_CLAIM_TEXT } from '../src/net/gateClaims.js';
import { riteOmenLine } from '../src/systems/gateOmen.js';
import { isSigilStone } from '../src/systems/gateSpoils.js';
import { seededRng } from '../src/systems/wind.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 700;
const T = gateTimes(DAY);
const PX = 300, PY = 200;
const SITE = { day: DAY, px: PX, py: PY, place: 'Copperham, Wrothgarian Mountains' };
const SITE_ID = `${PX},${PY}:rite`;
const [E, N] = riteLocalOf(DAY);
const settle = () => new Promise((r) => setImmediate(r));

function rig(over = {}) {
  let clock = T.omenAt + 60_000, feetAt = null;
  const r = { spawned: [], removed: [], words: [], said: [], near: [], sprung: [], foes: [], peer: new Set(), struck: new Map(), piles: [] };
  r.host = createRiteHost({
    now: () => clock, omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0],
    groundAt: () => 0, feet: () => feetAt, online: () => true,
    foes: {
      spawn: async (career, [x, z], { yaw, site }) => {
        const f = { mobileType: career, site, ai: { feet: [x, 0, z], target: null }, entity: { maxHealth: 50, health: 50, name: 'Mage' }, dead: false, corpse: false };
        r.foes.push(f); r.spawned.push({ career, x, z, yaw, site }); return f;
      },
      list: () => r.foes,
      removeSite: (s) => { r.removed.push(s); for (let i = r.foes.length - 1; i >= 0; i--) if (r.foes[i].site === s && !r.foes[i].puppet) r.foes.splice(i, 1); },
      campId: () => 7,
    },
    peerSprang: (s) => r.peer.has(s), sprang: (s) => r.sprung.push(s), struckAt: (f) => r.struck.get(f) ?? null,
    send: (w, cell) => { r.words.push({ w, cell }); return true; },
    say: (t) => r.said.push(t), sayNear: (t) => r.near.push(t),
    loot: { seed: (items, feet, key) => { const p = { id: r.piles.length + 1, items: [...items], feet, key, dead: false }; r.piles.push(p); return p; }, keyOf: (p) => `droppedLoot:${p.id}` },
    level: () => 10, rolls: seededRng(5), ...over,
  });
  r.set = (t) => { clock = t; };
  r.step = (ms) => { clock += ms; };
  r.at = (m) => { feetAt = [E + m, 0, N]; };   // m metres east of the circle's heart
  return r;
}

test('WB12d the circle stands from the omen until its breach collapses, its heart off the gate\'s spot; its smoke rises over 8 s from the omen and thins over 30 s after the opening (mutants: the circle before the omen; the smoke never rising; the smoke past the opening)', () => {
  const r = rig();
  r.set(T.omenAt - 1000);
  assert.equal(r.host.frame(), null, 'before the omen: nothing');
  assert.deepEqual(r.host.smokes(), []);
  r.set(T.omenAt + RITE_SMOKE_IN_MS / 2);
  r.host.frame();
  assert.deepEqual(r.host.state().heart, [E, 0, N]);
  assert.equal(r.host.state().site, SITE_ID);
  assert.ok(Math.abs(r.host.smokes()[0].fade - 0.5) < 1e-9, 'rising');
  r.set(T.omenAt + RITE_SMOKE_IN_MS + 1);
  r.host.frame();
  assert.equal(r.host.smokes()[0].fade, 1);
  r.set(T.openAt + RITE_SMOKE_OUT_MS / 2);
  r.host.frame();
  assert.ok(Math.abs(r.host.smokes()[0].fade - 0.5) < 1e-9, 'thinning after the opening');
  r.set(T.openAt + RITE_SMOKE_OUT_MS + 1);
  r.host.frame();
  assert.deepEqual(r.host.smokes(), [], 'gone - the circle still stands');
  assert.ok(r.host.state());
  r.set(T.wrathAt + GATE_COLLAPSE_MS);
  assert.equal(r.host.frame(), null, 'the breach collapsed: the circle goes');
  assert.ok(r.removed.includes(SITE_ID));
  const [gx, gz] = gateSpotLocal(DAY);
  assert.ok(Math.hypot(E - gx, N - gz) >= 90 && Math.hypot(E - gx, N - gz) <= 180);
});

test('WB12d the faithful: sprung by a player within 100 m of the circle while the rite holds - the Summoner behind the altar, the rest on its ring, one camp, chanting (their sight short), the Summoner thrice a caster\'s health; never twice, never a peer\'s again, never from far off (mutants: sprung from anywhere; sprung twice; a peer\'s sprung again; the Summoner a caster\'s; a camp of strangers)', async () => {
  const r = rig();
  r.at(RITE_SPRING_M + 20);
  r.host.frame();
  assert.equal(r.spawned.length, 0, 'far off');
  r.at(RITE_SPRING_M - 10);
  r.host.frame();
  await settle();
  const want = riteFaithfulOf(DAY);
  assert.equal(r.spawned.length, want.length);
  assert.deepEqual(r.spawned.map((s) => s.career), want.map((m) => m.career));
  assert.equal(r.spawned[0].career, RITE_SUMMONER_CAREER);
  assert.ok(r.spawned.every((s) => s.site === SITE_ID));
  assert.deepEqual(r.sprung, [SITE_ID], 'my spring said to the peers');
  const L = riteLayout(Math.atan2(gateSpotLocal(DAY)[0] - E, gateSpotLocal(DAY)[1] - N));
  assert.ok(Math.abs(r.spawned[0].x - (E + L.summoner[0])) < 1e-9 && Math.abs(r.spawned[0].z - (N + L.summoner[1])) < 1e-9, 'behind the altar');
  for (const f of r.foes) {
    assert.equal(f.campId, 7); assert.equal(f.entity.campId, 7); assert.equal(f.campAlertRadius, RITE_ALERT_M); assert.equal(f.ai.sightRadius, RITE_SIGHT_M);
  }
  assert.deepEqual([r.foes[0].entity.maxHealth, r.foes[0].entity.health], [150, 150], 'the Summoner: thrice');
  assert.equal(r.foes[1].entity.maxHealth, 50);
  r.host.frame(); await settle();
  assert.equal(r.spawned.length, want.length, 'once');
  const p = rig();
  p.peer.add(SITE_ID);
  p.at(10); p.host.frame(); await settle();
  assert.equal(p.spawned.length, 0, 'a peer sprang them: theirs stand');
});

test('WB12d every screen names the faithful - a peer\'s copies too, the Summoner by his kind - and one woken wakes them all, a blow on one that never saw its striker too (mutants: the copies unnamed; no wake)', async () => {
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  r.foes.push({ puppet: 'peer-2', mobileType: RITE_SUMMONER_CAREER, site: SITE_ID, entity: { name: 'Sorcerer' }, ai: {} }, { puppet: 'peer-2', mobileType: 130, site: SITE_ID, entity: { name: 'Battlemage' }, ai: {} });
  r.host.frame();
  assert.equal(r.foes[0].entity.name, RITE_TEXT.summoner);
  assert.ok(r.foes.slice(1, -2).every((f) => f.entity.name === RITE_TEXT.faithful));
  assert.deepEqual(r.foes.slice(-2).map((f) => f.entity.name), [RITE_TEXT.summoner, RITE_TEXT.faithful]);
  r.foes[2].ai.target = 'the-player';
  r.host.frame();
  assert.ok(r.foes.filter((f) => !f.puppet).every((f) => f.ai.target === 'the-player'), 'woken together');
  assert.ok(r.foes.filter((f) => f.puppet).every((f) => f.ai.target === undefined), 'a copy is its owner\'s to wake');
});

test('WB12d the word: said to the circle\'s cell every 5 s while the rite holds, and at once when it changes - one of the faithful struck, the Summoner fallen; never past its reach, never once the breach opens; a Summoner who walked away is no fall (mutants: said from anywhere; never at once; said after the opening; a fall without a body)', async () => {
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  assert.deepEqual(r.words, [{ w: { d: DAY, px: PX, py: PY, s: 0, f: 0 }, cell: worldRoom(PX, PY) }]);
  r.host.frame();
  assert.equal(r.words.length, 1, 'not every frame');
  r.step(RITE_WORD_MS);
  r.host.frame();
  assert.equal(r.words.length, 2, 'every RITE_WORD_MS');
  r.struck.set(r.foes[3], 123);
  r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 0 }, 'struck: at once');
  r.foes[0].dead = true;
  r.step(1); r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 0 }, 'gone without a body: walked away, no fall');
  r.foes[0].corpse = true;
  r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 1 }, 'the Summoner fallen: at once');
  const n = r.words.length;
  r.at(RITE_REACH_M + 5); r.step(RITE_WORD_MS); r.host.frame();
  assert.equal(r.words.length, n, 'past its reach');
  r.at(5); r.set(T.openAt); r.host.frame();
  assert.equal(r.words.length, n, 'the breach open: the rite is over');
});

test('WB12d the opening: the faithful still standing finish their rite and pass into the breach - gone from every screen, said to a player near an unbroken rite (mutants: they stay; the line over a broken rite)', async () => {
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  r.set(T.openAt + 100);
  r.host.frame();
  assert.ok(r.removed.includes(SITE_ID));
  assert.equal(r.foes.length, 0);
  assert.ok(r.near.includes(RITE_TEXT.pass));
  const b = rig();
  b.at(10); b.host.frame(); await settle();
  b.host.onBroken({ k: 'br', d: DAY, px: PX, py: PY, at: 1, by: [] });
  b.set(T.openAt + 100); b.host.frame();
  assert.ok(b.removed.includes(SITE_ID));
  assert.ok(!b.near.includes(RITE_TEXT.pass), 'the rite was broken: nothing finished');
});

test('WB12d the hub\'s word: a broken rite said once a day by its place; its casket opens - its pile seeded for a player within 40 m, the chest\'s contents, still named the chest; anything taken and the day is this character\'s, never seeded again; untouched and gone with its pixel, seeded again (mutants: said at every hello; the casket open before the word; seeded twice a day; the day kept untouched)', async () => {
  restoreModSaveRecords({});
  const r = rig();
  r.at(RITE_CHEST_SEED_M - 5);
  r.host.frame();
  assert.equal(r.piles.length, 0, 'sealed until the rite is broken');
  r.host.onBroken({ k: 'br', d: DAY, px: PX, py: PY, at: 1, by: ['Ann'] });
  r.host.onBroken({ k: 'br', d: DAY, px: PX, py: PY, at: 1, by: ['Ann'] });
  assert.deepEqual(r.said, [RITE_TEXT.broken(SITE.place)]);
  assert.equal(r.said[0], 'The faithful\'s rite near Copperham, Wrothgarian Mountains is broken.');
  r.host.frame();
  assert.equal(r.piles.length, 1);
  assert.equal(r.piles[0].key, `${PX},${PY}`, 'it dies with its pixel');
  assert.equal(r.piles[0].items[0].group, 'Currency');
  r.host.frame();
  assert.equal(r.piles.length, 1, 'one pile');
  assert.deepEqual(r.host.hoverName('droppedLoot:1'), { title: RITE_TEXT.chest }, 'open, it keeps its name');
  assert.equal(r.host.hoverName('droppedLoot:9'), null, 'another pile is not it');
  r.piles[0].dead = true;
  r.host.frame(); r.host.frame();
  assert.equal(r.piles.length, 2, 'gone with its pixel, untouched: seeded again');
  r.piles[1].items.pop();
  r.host.frame();
  assert.equal(riteChestOpened(DAY), true, 'taken from: the day is this character\'s');
  assert.deepEqual(modSaveRecords()[RITE_CHEST_SAVE_VENDOR], { day: DAY });
  r.host.frame(); r.host.frame();
  assert.equal(r.piles.length, 2, 'never again that day');
  restoreModSaveRecords({});
});

test('WB12d the casket before the rite is broken: named, sealed, and a press says so; the gate\'s keys are not its (mutants: the casket unnamed; a press unsaid)', () => {
  restoreModSaveRecords({});
  const r = rig();
  r.at(5); r.host.frame();
  const tg = r.host.targets();
  assert.equal(tg.length, 1);
  assert.equal(tg[0].key, `rite:${DAY}`);
  assert.deepEqual(r.host.hoverName(tg[0].key), { title: 'The Faithful\'s Chest', subs: ['Sealed'] });
  assert.equal(r.host.activate(tg[0].key), true);
  assert.deepEqual(r.near.slice(-1), [RITE_TEXT.sealed]);
  assert.equal(r.host.activate(`gate:${DAY}`), false);
  assert.equal(r.host.hoverName(`gate:${DAY}`), null);
});

test('WB12d what a frame pays for (AUDIT WB C7, the gate\'s law): no circle, the one frozen empty list and no smoke to build for; the casket\'s target and the stone\'s matrices made once a heart, again when it moves (mutants: a new list a frame; the target made every frame; the matrices every draw; the smoke\'s arguments built with none)', () => {
  let t0 = [0, 0, 0];
  const drawn = [];
  const r = rig({ pixelTranslation: () => t0, renderer: { createMesh: () => ({}), drawMesh: (m, mat) => drawn.push(mat) } });
  r.set(T.omenAt - 1000); r.host.frame();
  const none = r.host.lights();
  assert.ok(Object.isFrozen(none) && none.length === 0);
  for (const l of [r.host.targets(), r.host.batches(), r.host.smokes()]) assert.equal(l, none);
  assert.equal(r.host.smoking(), false);
  r.set(T.omenAt + 60_000); r.at(5); r.host.frame();
  assert.equal(r.host.smoking(), true);
  const tg = r.host.targets();
  assert.equal(r.host.lights().length, 3);
  r.host.frame(); r.host.draw(); r.host.frame(); r.host.draw();
  assert.equal(r.host.targets(), tg, 'one target while the heart stands still');
  assert.equal(drawn.length, 2);
  assert.equal(drawn[0], drawn[1], 'one matrix');
  t0 = [512, 0, 0]; r.host.frame(); r.host.draw();
  assert.notEqual(r.host.targets(), tg, 'moved: made again');
  assert.notEqual(drawn[2], drawn[1]);
  assert.ok(Math.abs(drawn[2][12] - drawn[1][12] - 512) < 1e-3, 'with the heart');
});

test('WB12d the circle\'s stone: the sigil faces up and rides the land - over the ground everywhere, a fold of it too; the altar, the casket and the braziers sunk at their lowest corner on a slope; six braziers ring it, the faithful\'s ring leaves its gap toward the gate and their camp stands behind (mutants: the sigil flat on a slope; the fold through the sigil; a box on air; the ring closed on the gate; the camp before the circle)', () => {
  const facing = 0.9;
  const sigilOf = (m) => m.subMeshes.find((s) => s.textureRecord === GATE_PLINTH_RECORD);
  const tris = (m, sm) => Array.from({ length: sm.primitiveCount }, (_, t) => [0, 1, 2].map((k) => { const i = (sm.startIndex + t * 3 + k) * 3; return [m.positions[i], m.positions[i + 1], m.positions[i + 2]]; }));
  const slope = (x, z) => 0.1 * x - 0.05 * z;
  const m = buildRiteModel(facing, slope);
  const sig = sigilOf(m);
  for (const [t, tri] of tris(m, sig).entries()) {
    for (const [x, y, z] of tri) assert.ok(y >= slope(x, z) + RITE_SIGIL_LIFT - 1e-5 && y <= slope(x, z) + RITE_SIGIL_LIFT + RITE_SIGIL_REACH * Math.hypot(0.1, 0.05) + 1e-5, 'on the ground');
    assert.ok(m.normals[(sig.startIndex + t * 3) * 3 + 1] > 0, 'facing up');
  }
  // a fold of the land across it, steep and on the slant: no point of the sigil under the ground
  const fold = (x, z) => 2 - 0.45 * Math.abs(0.6 * x + 0.8 * z - 0.37);
  const fm = buildRiteModel(facing, fold);
  let worst = Infinity;
  for (const [a, b, c] of tris(fm, sigilOf(fm))) {
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8 - i; j++) {
      const u = i / 8, v = j / 8, w = 1 - u - v;
      const x = a[0] * w + b[0] * u + c[0] * v, y = a[1] * w + b[1] * u + c[1] * v, z = a[2] * w + b[2] * u + c[2] * v;
      worst = Math.min(worst, y - fold(x, z));
    }
  }
  assert.ok(worst > 0, `the land shows through the sigil by ${-worst} m`);
  // a steep slope: the altar, the casket and every brazier stand sunk at their lowest corner
  const steep = (x, z) => 0.8 * x + 0.5 * z;   // a mountain's side
  const sm = buildRiteModel(facing, steep);
  const L = riteLayout(facing);
  const parts = [[L.altar.x, L.altar.z, 1.1], [L.casket.x, L.casket.z, 0.6], ...L.braziers.map(([x, z]) => [x, z, 0.4])];
  const footed = (model, ground, list) => {
    const st = model.subMeshes.find((s) => s.textureRecord !== GATE_PLINTH_RECORD);
    for (const [px, pz, r] of list) {
      const vs = tris(model, st).flat().filter(([x, , z]) => Math.hypot(x - px, z - pz) <= r);
      const low = Math.min(...vs.map(([, y]) => y));
      for (const [x, y, z] of vs) if (y === low) assert.ok(y < ground(x, z), `standing on air at ${x.toFixed(2)},${z.toFixed(2)}`);
    }
  };
  footed(sm, steep, parts);
  const cliff = (x, z) => 1.3 * x - 0.4 * z;   // a crag the braziers still stand on
  footed(buildRiteModel(facing, cliff), cliff, parts.slice(2));
  assert.equal(L.braziers.length, RITE_BRAZIERS);
  assert.ok(L.braziers.every(([x, z]) => Math.abs(Math.hypot(x, z) - RITE_BRAZIER_R) < 1e-9));
  const off = (x, z) => { const d = Math.abs(((Math.atan2(x, z) - facing) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d; };
  for (const n of [6, 7, 8]) for (const [x, z] of L.ring(n)) { assert.ok(Math.abs(Math.hypot(x, z) - RITE_RING_R) < 1e-9); assert.ok(off(x, z) >= Math.PI / 9, 'the gap toward the gate'); }
  for (const t of L.tents) { assert.ok(Math.abs(Math.hypot(t.x, t.z) - RITE_TENT_R) < 1e-9); assert.ok(off(t.x, t.z) > Math.PI / 2, 'behind the circle'); }
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('WB12d the smoke: a plume of rows, its noise climbing whole tiles over the clock\'s period at every octave (the wrap never shows), blended premultiplied; at most two drawn, the faded skipped (mutants: a cone of two rows; a climb that wraps mid-tile; drawn faded)', () => {
  assert.equal(smokeVertices().length, SMOKE_SEGMENTS * SMOKE_ROWS * 12);
  assert.ok(SMOKE_ROWS >= 16, 'a swell needs rows');
  for (const k of [1, 2, 4]) assert.equal((SMOKE_CLIMB_TILES * k) % (SMOKE_TILES_UP * k), 0, `octave ${k}`);
  assert.match(SMOKE_FS, /o = vec4\(col \* a, a\);/);
  const { gl, calls } = fakeGl();
  const pass = new RiteSmokeRenderer(gl);
  pass.draw([{ origin: [0, 0, 0], fade: 1 }, { origin: [1, 0, 0], fade: 0 }, { origin: [2, 0, 0], fade: 0.5 }, { origin: [3, 0, 0], fade: 1 }], I, I, [0, 0, 0], 5);
  assert.equal(pass.drawn, SMOKE_MAX);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uOrigin').map((c) => c[2]), [0, 2], 'the faded skipped');
  assert.ok(calls.some((c) => c[0] === 'blendFunc' && c[1] === 10 && c[2] === 12), 'premultiplied');
});

test('WB12d the chest: gold for the opener\'s level, two to four of the rite\'s reagents - a Daedra\'s Heart rarely - and one chest in twenty a piece of Dagon\'s Brand, Magic and bearing the set\'s sigil at Faint; the day the character\'s own (mutants: no gold; the brand never; the brand with no sigil)', () => {
  let brands = 0, hearts = 0;
  for (let s = 1; s <= 600; s++) {
    const it = riteChestItems(10, seededRng(s));
    assert.equal(it[0].group, 'Currency');
    assert.ok(it[0].stackCount >= 200 && it[0].stackCount <= 400, `${it[0].stackCount}`);
    const reagents = it.filter((x) => [...RITE_REAGENTS, RITE_HEART].some((r) => r.templateIndex === x.templateIndex));
    assert.ok(reagents.length >= 2 && reagents.length <= 4);
    hearts += reagents.filter((x) => x.templateIndex === RITE_HEART.templateIndex).length;
    const brand = it.find((x) => x.sigil);
    if (brand) { brands++; assert.equal(brand.sigil.set, RITE_BRAND_SET); assert.equal(brand.sigil.xp, 0); assert.equal(brand.rarity, 'magic'); assert.equal(brand.group, 'Armor'); }
  }
  assert.ok(brands > 15 && brands < 50, `${brands} brands in 600`);
  assert.ok(hearts > 50 && hearts < 250, `${hearts} hearts`);
  restoreModSaveRecords({});
  assert.equal(riteChestOpened(DAY), false);
  markRiteChest(DAY);
  assert.equal(riteChestOpened(DAY), true);
  assert.equal(riteChestOpened(DAY + 1), false, 'a new day, a new chest');
  restoreModSaveRecords({});
});

test('WB12d the spoils: a receipt of the rite alone pays its ember and nothing else; a fighter\'s `r` an ember more after the first, the gold still last; a receipt with neither is what it was, piece for piece; the court\'s burst and the grant outside it pay the same (mutants: the rite alone paid full spoils; r unpaid; the gold\'s dress moved by r; the receipt dropped on the way)', () => {
  const sig = (l) => l.map((p) => (p.kind === 'gold' ? `gold:${p.gold}:${p.record}` : `${p.item.name}:${p.tier}:${p.record}`));
  const plain = spoilsList(4242, 20), dealt = spoilsList(4242, 20, { x: 'dealt' });
  assert.deepEqual(sig(dealt), sig(plain));
  const helped = spoilsList(4242, 20, { x: 'stood', r: 1 });
  assert.equal(helped.length, plain.length + 1);
  const embers = helped.map((p, i) => (p.kind === 'item' && isSigilStone(p.item) ? i : -1)).filter((i) => i >= 0);
  assert.equal(embers.length, 2);
  assert.equal(embers[1], embers[0] + 1, 'together');
  assert.equal(helped.at(-1).kind, 'gold');
  assert.deepEqual(sig(helped.filter((_, i) => i !== embers[1])), sig(plain), 'the rest as it was, each in its dress');
  const rite = spoilsList(4242, 20, { x: 'rite' });
  assert.equal(rite.length, 1);
  assert.ok(isSigilStone(rite[0].item));
  assert.equal(SPOILS_TEXT.rite, 'An ember from the broken rite is in your pack.');
  const mem = new Map(), took = [], said = [];
  const pool = createSpoilsPool({ ray: () => null, now: () => 0, take: (p) => took.push(p), say: (t) => said.push(t), store: { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) }, who: () => 'c' });
  assert.equal(pool.grant({ day: DAY, seed: 4242, level: 20, acct: 'a', claims: { x: 'rite' }, text: SPOILS_TEXT.rite }), true);
  assert.equal(took.length, 1, 'granted: the ember alone');
  assert.deepEqual(said, [SPOILS_TEXT.rite]);
  assert.equal(pool.spew({ day: DAY + 1, seed: 4242, level: 20, acct: 'a', at: [0, 0, 0], bearing: 0, claims: { x: 'stood', r: 1 } }), true);
  assert.equal(pool.state().pieces.length, plain.length + 1, 'spewed: an ember more');
  assert.match(read('src/scenes/gateCourt.js'), /spoils\.spew\(\{ day: s\.day, seed: claims\.c, level: spoilsLevel\(player\(\)\?\.level \?\? 1, claims\.l\), at, bearing, acct: claims\.s, keep, claims \}\)/);
  assert.match(read('src/scenes/world.js'), /spoilsPool\.grant\(\{ day: c\.d, seed: c\.c, level: spoilsLevel\(playerEntity\.level \?\? 1, c\.l\), acct: c\.s, claims: c, text: c\.x === 'rite' \? SPOILS_TEXT\.rite : SPOILS_TEXT\.granted \}\)/);
});

test('WB12d the claim: a rite\'s own receipt is "Rite recorded." and closes no breach; refused its claims by a service from before acct46, it is kept for its week (mutants: let go; said a breach)', () => {
  assert.equal(GATE_CLAIM_TEXT.rite, 'Rite recorded.');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'claims' }, { x: 'rite' }), 'keep');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'claims' }, { x: 'dealt' }), 'done', 'a fighter\'s bad claims are bad');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: true, rite: true } }, { x: 'rite' }), 'done');
  assert.match(read('src/net/gateClaims.js'), /say\(answer\.data\.rite === true \? GATE_CLAIM_TEXT\.rite : GATE_CLAIM_TEXT\.recorded\(n\)\)/);
  assert.match(read('src/net/gateClaims.js'), /if \(gateClaimVerdict\(answer, live\(r\)\) === 'done'\)/);
});

test('WB12d the omen\'s line: the rite and its order, beside the omen\'s (mutants: the line unsaid)', () => {
  assert.equal(riteOmenLine({ place: SITE.place }), 'Dagon\'s faithful work their rite near Copperham, Wrothgarian Mountains. Kill their Summoner before the breach opens for an ember more.');
  assert.match(read('src/systems/gateOmen.js'), /if \(\(line === 'omen' \|\| line === 'rise'\) && riteDay !== t\.day\) \{ riteDay = t\.day; say\(riteOmenLine\(words\)\); \}/);
});

test('WB12d the session and the world host by source: a word down the circle\'s cell socket only to a relay that keeps the rite, the hub\'s word from the hub alone; the host made beside the gate on the camps\' law and stood at every seam (mutants: each seam removed)', () => {
  const on = read('src/net/online.js');
  assert.match(on, /if \(!\(cell === this\.room \? this\.riteOk : halo\?\.riteOk\)\) return false;/);
  assert.match(on, /if \(primary\) this\.riteOk = relaySupportsRite\(relayV\);/);
  assert.match(on, /if \(r && isSocialRoom\(room\)\) this\._deliver\('rite', \(\) => this\.onRite\?\.\(r, room\)\);/);
  const w = read('src/scenes/world.js');
  const at = w.indexOf('const riteHost = gateOmen ? createRiteHost(');
  const deps = w.slice(at, w.indexOf('}) : null;', at));
  assert.match(deps, /omen: \(\) => gateOmen\.current\(\),/);
  assert.match(deps, /return exteriorFoes\.spawnFoe\(career, \[x, y, z\], \{ yaw, placed: true, groundAlign: \{ hitDist: hitDistance\(hit\) \}, site \}\);/);
  assert.match(deps, /peerSprang: \(site\) => _wodPeerSprung\.has\(site\),/);
  assert.match(deps, /sprang: \(site\) => wodSprang\(site\),/);
  assert.match(deps, /struckAt: \(f\) => renownStruckAt\(f\),/);
  assert.match(deps, /send: \(w, cell\) => !!online\?\.sendRite\?\.\(w, cell\),/);
  assert.match(deps, /droppedLoot\.seedPile\(items, feet, \{ archive: RANDOM_TREASURE_ARCHIVE, record: 0 \}, null, pixelKey, \{ unsaved: true, drawn: false \}\), keyOf: \(p\) => `droppedLoot:\$\{p\.id\}` \}/);
  assert.match(w, /try \{ riteHost\?\.frame\(\); \}/);
  assert.equal(w.split('...(riteHost?.lights() ?? [])').length - 1, 2, 'both light lists');
  assert.match(w, /riteHost\?\.draw\(renderer\);/);
  assert.match(w, /riteHost\.tick\(dt\); livePersonBatches\.push\(\.\.\.riteHost\.batches\(\)\);/);
  assert.match(w, /if \(riteHost\?\.smoking\(\) && riteHost\.drawSmoke\(proj, view, new Float32Array\(mwv\.eye\), now \/ 1000,/);
  assert.match(w, /\(key\) => sigilBroker\?\.hoverName\(key\) \?\? null,[^\n]*\n\s*\(key\) => riteHost\?\.hoverName\(key\) \?\? null,/, 'named after the gate and the Broker');
  assert.ok(w.indexOf('(key) => riteHost?.hoverName(key) ?? null,') < w.indexOf("(key) => (typeof key === 'string' && key.startsWith('droppedLoot:')"), 'its pile named before the piles\' word');
  assert.match(w, /if \(riteHost\?\.smoking\(\) && riteHost\.drawSmoke\([^\n]*\n[^\n]*camPos: renderer\._camPos, focus: renderer\._focus \}\)\) renderer\.markForeignPass\(\);/, 'the smoke handed the travel view\'s focus');
  assert.equal(w.split('[...gatePool.targets(), ...(riteHost?.targets() ?? [])]').length - 1, 2, 'the press and the hover');
  assert.match(w, /else if \(!riteHost\?\.activate\(_gatePick\.key\)\) gatePool\.activate\(_gatePick\.key\);/);
  assert.match(w, /online\.onRite = \(w\) => riteHost\?\.onBroken\(w\);/);
  assert.match(w, /link\.onRite = \(w\) => riteHost\?\.onBroken\(w\);/);
  assert.match(w, /riteHost\?\.destroyAll\(\);/);
});
