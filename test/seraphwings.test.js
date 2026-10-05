// SERAPH-WINGS — THE DEVELOPERS' AURA: THE SERAPH WINGS (2026-10-05).
//
// The owner, sending a painted angel whose wings are long ribbons of golden light: "So I want to build an aura for the
// developers. These are based off this image above. Golden Angel wings that flow". The developers are
// DEVELOPER_HANDLES (the developer title and glyph's list), so the wings are held while the handle is listed
// (titles.js DEVELOPER_AURA) and gone on the next token once it is not. They are the aura pass's fifth look
// (render/auraRing.js AURA_LOOK): wings of light ON THE BODY - plumes fanned from the upper back, each a broad strand
// of light and two fine ones, waves running out along them so they flow, motes of gold drifting off them, a faint
// pool of gold beneath - hung from the body's shoulders as the cape is and swung by its motion. Added whole: light,
// never a shadow. Their shader is RUN here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { AURA_TEXT, AURA_PAINT, TITLE_RGBA } from '../src/ui/playerBadge.js';
import { aurasHeld, auraWorn, auraRefusal, wardrobeOf, titlesHeld, isDeveloper, DEVELOPER_AURA } from '../server-account/src/titles.js';
import { RELAY_VERSION } from '../src/net/wire.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_STEPS, AURA_GROUND_R, AURA_LIFT_M, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS, AURA_CARDS, AuraRingRenderer,
  WING_PLUMES, WING_STRANDS, WING_SEGS, WING_ROOT, WING_SPREAD, WING_REACH, WING_W, WING_HZ, WING_FLOW, WING_MOTES,
  WING_MOTE_LIFE, WING_POOL_R, WING_RGB, WING_STRAND_COUNT, WING_VERTS, wingRatesWhole, auraWingsGrid,
  CLOAK_SHOULDER_Y, CLOAK_HOOD_Y, CLOAK_REST_POSE,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;
const LATER = AFTER + 30 * 86_400;
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const lum = (c) => c[0] + c[1] + c[2];
const DEVS = (v('DEVELOPER_HANDLES') ?? '').split(',').map((h) => h.trim()).filter(Boolean);

// ── THE VOCABULARY, THE GRANT, THE WIRE ─────────────────────────────

test('SERAPH-WINGS vocabulary: the wings join AURAS last, "Seraph Wings" in words, their button in the Founder\'s gold; a look of their own - the fifth kind, their own mesh and motes, added whole (no shade); gold, white-hot at the heart (mutants: the word, the paint, the kind)', () => {
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings'], 'the fire, the ward, the radiance, the cloak, then the wings');
  assert.equal(AURA_TEXT.seraphwings, 'Seraph Wings');
  assert.equal(AURA_PAINT.seraphwings, 'founder', 'the button in gold - the developer\'s own paint is a red');
  assert.ok(TITLES.includes(AURA_PAINT.seraphwings));
  assert.deepEqual({ ...AURA_LOOK.seraphwings }, { kind: 4, ringR: WING_POOL_R, flameH: WING_REACH[1], glyphs: WING_MOTES, mesh: 'wings' }, 'the fifth kind: its pool, its reach, its motes, its own mesh - and no shade');
  assert.equal(auraLookOf('seraphwings'), AURA_LOOK.seraphwings);
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  const [r, g, b] = WING_RGB.gold, f = TITLE_RGBA.founder;
  assert.ok(r >= g && g >= b && r === 1 && Math.abs(g - f[1]) < 0.05 && Math.abs(b - f[2]) < 0.05, 'the gold the button wears');
  assert.ok(lum(WING_RGB.core) > lum(WING_RGB.gold) && lum(WING_RGB.gold) > lum(WING_RGB.amber) && WING_RGB.core[2] > 0.8, 'white-hot at the heart, gold through it, amber at the edge');
});

test('SERAPH-WINGS grant: every developer holds the wings, case-folded, read off the config alone; worn while held; off the list they go; a guest, the other lists\' holders and everyone else hold none of them; a developer on another list holds that list\'s aura first (mutants: the grant, the list)', () => {
  assert.ok(DEVS.length >= 1, 'DEVELOPER_HANDLES names the developers');
  assert.equal(DEVELOPER_AURA, 'seraphwings');
  for (const h of DEVS) for (const hh of [h, h.toLowerCase(), h.toUpperCase()]) {
    const p = row(hh);
    assert.ok(isDeveloper(p, ENV), `${hh}: a developer`);
    assert.ok(aurasHeld(p, ENV).includes('seraphwings'), `${hh}: holds the wings`);
    assert.equal(auraRefusal('seraphwings', p, ENV), null);
  }
  const dev = row(DEVS[0], { aura: 'seraphwings' });
  assert.equal(auraWorn(dev, ENV), 'seraphwings');
  assert.equal(auraWorn(dev), undefined, 'without the config, the Broker\'s alone - the wings are the list\'s');
  assert.deepEqual(aurasHeld(row(DEVS[0], { insignia: 'aura:dagonfire' }), ENV), ['seraphwings', 'dagonfire'], 'the wings, then what the Broker sold');
  const w = wardrobeOf(dev, ENV, LATER);
  assert.ok(w.auras.includes('seraphwings') && w.aura === 'seraphwings' && titlesHeld(dev, ENV).includes('developer'), 'the account card\'s answer: the wings beside the developer title');
  const off = { ...ENV, DEVELOPER_HANDLES: '' };
  assert.deepEqual(aurasHeld(dev, off), [], 'off the list, the wings go');
  assert.equal(auraWorn(dev, off), undefined);
  assert.equal(auraRefusal('seraphwings', dev, off), 'not-held');
  assert.deepEqual(aurasHeld({ ...dev, handle: null }, ENV), [], 'a guest holds none');
  for (const [h, theirs] of [['Sureme', ['oblivionward']], ['GA00250', ['radiance']], ['SirMcMobdon', ['shadowcloak']], ['Asynian', []], ['SquidKamer', []], ['Stranger', []]]) {
    assert.deepEqual(aurasHeld(row(h), ENV), theirs, `${h}: their own and not the wings`);
    assert.equal(auraRefusal('seraphwings', row(h), ENV), 'not-held');
  }
  const both = { ...ENV, SHADOW_FANG_HANDLES: DEVS[0] };
  assert.deepEqual(aurasHeld(row(DEVS[0]), both), ['shadowcloak', 'seraphwings'], 'a developer on another list: that list\'s aura first, then the wings');
});

test('SERAPH-WINGS the service end to end: a developer registers and holds the wings; wears them through the aura door; the token signs them; a stranger is refused them; off the list the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ DEVELOPER_HANDLES: 'Lattymoy' });
  const me = await registered('Lattymoy');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.equal('au' in m.claims, false, 'held and not worn: none signed until they put them on');
  let r = await call('/v1/account/aura', { aura: 'seraphwings' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.aura, 'seraphwings', 'worn');
  m = await mint();
  assert.equal(m.claims.au, 'seraphwings', 'signed');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'seraphwings' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the wings');
  env.DEVELOPER_HANDLES = '';
  m = await mint();
  assert.equal('au' in m.claims, false, 'off the list: the next token carries no wings');
});

test('SERAPH-WINGS the account card: wearing the wings, the card says their name', async () => {
  const { AccountFlow } = await import('../src/ui/accountFlow.js');
  const { SESSION_KEY } = await import('../src/net/accountClient.js');
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-dev', name: 'Lattymoy', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, val) => m.set(k, String(val)), removeItem: (k) => m.delete(k) };
  const wardrobe = { titles: ['developer'], title: 'developer', glyphs: ['dev'], auras: ['seraphwings'], aura: null, insignia: [] };
  const answers = { '/v1/account': { account: { id: 'acct-dev', name: 'Lattymoy', kind: 'linked', handle: 'lattymoy' }, wardrobe, devices: [] }, '/v1/account/aura': { ok: true, ...wardrobe, aura: 'seraphwings' } };
  const fetch = async (url) => { const path = url.replace(/^https?:\/\/[^/]+/, ''); return { ok: true, status: 200, json: async () => answers[path] }; };
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  assert.equal(await flow.wearAura('seraphwings'), true);
  assert.equal(flow.note, 'Wearing Seraph Wings.');
});

test('SERAPH-WINGS token and relay: a token may carry the wings and verifies; the relay - world168, the one that knows the word - reads it out of the signature for everyone near; a token with every glyph and the wings inside the relay\'s bound (mutants: the vocabulary\'s word)', async () => {
  assert.equal(RELAY_VERSION, 'world168', 'SERAPH-WINGS moved it on (world168): the vocabulary rides the relay\'s bundle');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', t: 'developer', g: ['dev'], au: 'seraphwings' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.au, 'seraphwings');
  assert.equal(claimsValid({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS], au: 'seraphwings' }), true);
  const full = await mintToken({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', t: 'developer', g: [...GLYPHS], au: 'seraphwings' }, kp.privateKey, { subtle, nowS });
  assert.match(full, /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9_-]{1,640}\.[A-Za-z0-9_-]{1,128}$/, `inside the relay's own bound (${full.split('.')[1].length} of 640)`);
  assert.equal(claimsValid({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', i: nowS, e: nowS + 60, au: 'angelwings' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Lattymoy', title: 'developer', glyphs: ['dev'], au: 'seraphwings' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  assert.equal(b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001').au, 'seraphwings', 'everyone near sees the wings');
});

// ── THE WINGS' LAW AND SHAPE ────────────────────────────────────────

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BASE = { uSeed: 0.37, uRingR: WING_POOL_R, uGroundR: AURA_GROUND_R, uFlameH: WING_REACH[1], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: AURA_LIFT_M, uVP: I, uAura: 4, uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0], uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1], uCapeH: [0, CLOAK_HOOD_Y, 0, 0], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0] };
const FAR = [0, 1.5, -6];   // an eye well behind the wearer
/** Strand k's point at its length's share t, as the vertex half lays it (the middle of its ribbon). */
const strandAt = (k, t, { time = 13.2, yaw = 0, eye = FAR, pose = {} } = {}) => {
  const across = (side) => { const f = glslFunctions(AURA_VS, { ...BASE, ...pose, aP: [k * 2 + side, t], uKind: 1, uTime: time, uYaw: yaw, uAt: [0, 0, 0], uCamPos: eye }); f.main(); return f.globals.vWorld; };
  const a = across(0), b = across(1);
  return { mid: a.map((x, i) => (x + b[i]) / 2), width: Math.hypot(...a.map((x, i) => x - b[i])) };
};
const broad = (side, plume) => (side < 0 ? 0 : WING_PLUMES * WING_STRANDS) + plume * WING_STRANDS;

test('SERAPH-WINGS the law: every rate whole over the clock and every mote\'s life dividing it; the mesh every strand\'s ribbon, root to tip, two triangles a segment; the fan from below level to high over the head, the high plumes the long ones; the pool inside the ground\'s quad; cards enough for the motes (mutants: a rate off whole, the fan)', () => {
  assert.ok(wingRatesWhole(), 'every rate whole');
  for (const hz of [...Object.values(WING_HZ), WING_FLOW.rate, WING_FLOW.fray]) assert.ok(Number.isInteger(Math.round(hz * AURA_CLOCK_PERIOD * 1e6) / 1e6), `${hz} whole over ${AURA_CLOCK_PERIOD} s`);
  for (const l of WING_MOTE_LIFE) assert.equal(AURA_CLOCK_PERIOD % l, 0, `a mote's life of ${l} s divides the clock`);
  assert.equal(WING_STRAND_COUNT, 2 * WING_PLUMES * WING_STRANDS);
  assert.equal(WING_VERTS, WING_STRAND_COUNT * WING_SEGS * 6);
  const g = auraWingsGrid();
  assert.equal(g.length, WING_VERTS * 2, 'two numbers a vertex');
  for (let k = 0; k < WING_STRAND_COUNT; k++) {
    const own = [];
    for (let i = 0; i < g.length; i += 2) if (Math.floor(g[i] / 2) === k) own.push([g[i] - 2 * k, g[i + 1]]);
    assert.equal(own.length, WING_SEGS * 6, `strand ${k}: its segments`);
    assert.deepEqual([Math.min(...own.map((p) => p[1])), Math.max(...own.map((p) => p[1]))], [0, 1], `strand ${k}: root to tip`);
    assert.ok(own.every((p) => p[0] === 0 || p[0] === 1), `strand ${k}: its two edges`);
  }
  assert.ok(WING_SPREAD[0] < 0 && WING_SPREAD[1] > 1, 'from below level to high over the head');
  assert.ok(WING_REACH[1] > WING_REACH[0] * 1.5, 'the high plumes the long ones');
  assert.ok(WING_W.broad > 2 * WING_W.fine, 'a broad strand and fine ones');
  assert.ok(WING_POOL_R <= AURA_GROUND_R, 'its pool inside the ground quad');
  assert.ok(AURA_CARDS >= WING_MOTES, 'cards enough for its motes');
});

test('SERAPH-WINGS the vertex half, RUN: every strand grows out of the upper back, behind the shoulders\' middle; the left plumes out to the wearer\'s left, the right to their right; up the fan each tip higher, the highest over the head, the lowest below the shoulders and off the ground; none sweeping in front of the wearer; turned with the facing; a ribbon its width across, broad wider than fine, turned to the eye; flowing - the tips move, the roots stay; the same at the clock\'s wrap (mutants: the root, the side, the fan, the facing, the width, the flow)', () => {
  for (const k of [0, 5, broad(-1, 6), broad(1, 0), WING_STRAND_COUNT - 1]) {
    const r = strandAt(k, 0).mid;
    assert.ok(Math.abs(r[1] - (CLOAK_SHOULDER_Y - WING_ROOT.below)) < 1e-6 && Math.abs(r[2] + WING_ROOT.back) < 1e-6 && Math.abs(Math.abs(r[0]) - WING_ROOT.apart) < 1e-6, `strand ${k} grows from the upper back (${r.map((x) => x.toFixed(3))})`);
  }
  const tips = (side) => Array.from({ length: WING_PLUMES }, (_, p) => strandAt(broad(side, p), 1).mid);
  const L = tips(-1), R = tips(1);
  assert.ok(L.every((t) => t[0] < -0.3) && R.every((t) => t[0] > 0.3), 'the left out to the left (-x at yaw 0), the right to the right');
  for (const side of [L, R]) {
    for (let p = 1; p < WING_PLUMES; p++) assert.ok(side[p][1] > side[p - 1][1], `up the fan each tip higher (${p})`);
    assert.ok(side[WING_PLUMES - 1][1] > 2.4 && side[0][1] < 1.0 && side[0][1] > 0.2, `the highest over the head, the lowest below the shoulders and off the ground (${side[WING_PLUMES - 1][1].toFixed(2)}, ${side[0][1].toFixed(2)})`);
  }
  for (let k = 0; k < WING_STRAND_COUNT; k += 2) for (const t of [0.25, 0.5, 0.75, 1]) assert.ok(strandAt(k, t).mid[2] < 0.05, `strand ${k} at ${t}: never in front of the wearer`);
  const turned = strandAt(broad(1, 3), 1, { yaw: Math.PI / 2, eye: [-6, 1.5, 0] }).mid;
  assert.ok(turned[2] < -0.3 && Math.abs(turned[0]) < 0.8, `faced along +x, the right wing out along -z (${turned.map((x) => x.toFixed(2))})`);
  const wb = strandAt(broad(-1, 3), 0.4).width, wf = strandAt(broad(-1, 3) + 1, 0.4).width;
  assert.ok(Math.abs(wb - WING_W.broad * (0.3 + 0.7 * 1) * (1 - 0.55 * 0.16)) < 0.02 && wf < wb * 0.5, `a ribbon its width across, broad wider than fine (${wb.toFixed(3)}, ${wf.toFixed(3)})`);
  // turned to the eye: the ribbon's width square to the line to the eye
  for (const [kk, t, eye] of [[broad(1, 2), 0.5, FAR], [broad(-1, 5), 0.7, [4, 2, 1]], [broad(1, 6) + 2, 0.3, [-3, 0.5, -3]]]) {
    const ends = [0, 1].map((side) => { const f = glslFunctions(AURA_VS, { ...BASE, aP: [kk * 2 + side, t], uKind: 1, uTime: 13.2, uYaw: 0, uAt: [0, 0, 0], uCamPos: eye }); f.main(); return f.globals.vWorld; });
    const across = ends[1].map((x, i) => x - ends[0][i]), c = ends[0].map((x, i) => (x + ends[1][i]) / 2), to = eye.map((x, i) => x - c[i]);
    assert.ok(Math.abs(across.reduce((a, x, i) => a + x * to[i], 0)) / (Math.hypot(...across) * Math.hypot(...to)) < 1e-3, `strand ${kk} turned to the eye at ${eye}`);
  }
  // the waves are more than the fan's breath: a breath (6 s) apart the breath is where it was and the waves are not
  const breathApart = Math.max(...[broad(1, 2), broad(1, 4), broad(-1, 5), broad(-1, 1) + 1].map((kk) => { const a = strandAt(kk, 1, { time: 13.2 }).mid, b = strandAt(kk, 1, { time: 13.2 + 1 / WING_HZ.breathe }).mid; return Math.hypot(...a.map((x, i) => x - b[i])); }));
  assert.ok(breathApart > 0.03, `waves running along them (${breathApart.toFixed(3)} m a breath apart)`);
  // the fan breathes: over twelve seconds (whole periods of the breath and of every wave) the middle plumes' tips rise
  // and fall with the breath - the waves, at other rates, cancel out of it
  const mids = [broad(-1, 3), broad(1, 3), broad(-1, 4), broad(1, 4)];
  let corr = 0;
  for (let i = 0; i < 48; i++) { const time = 2 + i * 0.25; corr += mids.reduce((a, kk) => a + strandAt(kk, 1, { time }).mid[1], 0) / mids.length * Math.sin(2 * Math.PI * WING_HZ.breathe * time); }
  assert.ok(Math.abs(corr / 48) > 0.02, `the fan breathing open and closed (${(corr / 48).toFixed(3)})`);
  const k = broad(1, 4), now = strandAt(k, 1, { time: 13.2 }).mid, then = strandAt(k, 1, { time: 14.2 }).mid;
  assert.ok(Math.hypot(...now.map((x, i) => x - then[i])) > 0.03, 'flowing: the tip moves');
  const r0 = strandAt(k, 0, { time: 13.2 }).mid, r1 = strandAt(k, 0, { time: 14.2 }).mid;
  assert.ok(Math.hypot(...r0.map((x, i) => x - r1[i])) < 1e-9, 'and the root stays');
  const w0 = strandAt(k, 0.8, { time: 1 / 240 }).mid, w1 = strandAt(k, 0.8, { time: AURA_CLOCK_PERIOD + 1 / 240 }).mid;
  assert.ok(Math.hypot(...w0.map((x, i) => x - w1[i])) < 1e-5, 'the same at the clock\'s wrap');
});

test('SERAPH-WINGS on the body, RUN: hung from the shoulders where they are - a crouch lowers them, broad shoulders set them apart; a run\'s trail sweeps them back the more the further out, a fall lifts them - the roots where they were (mutants: the pose, the breadth, the trail, the lift)', () => {
  const k = broad(1, 3);
  const crouched = { uCapeS: [0, CLOAK_SHOULDER_Y * 0.6, 0, 1] }, broadS = { uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1.25] };
  assert.ok(Math.abs(strandAt(k, 0, { pose: crouched }).mid[1] - (CLOAK_SHOULDER_Y * 0.6 - WING_ROOT.below)) < 1e-6, 'crouched, the roots lower');
  assert.ok(Math.abs(strandAt(k, 0, { pose: broadS }).mid[0] - WING_ROOT.apart * 1.25) < 1e-6, 'broad shoulders, the roots apart');
  const rest = strandAt(k, 1).mid, run = strandAt(k, 1, { pose: { uSwing: [0, -0.4, 0, 0] } }).mid, half = strandAt(k, 0.5, { pose: { uSwing: [0, -0.4, 0, 0] } }).mid, halfRest = strandAt(k, 0.5).mid;
  assert.ok(run[2] < rest[2] - 0.4 && (rest[2] - run[2]) > (halfRest[2] - half[2]) * 1.5, `a run sweeps the tip back, more than the middle (${(rest[2] - run[2]).toFixed(2)} vs ${(halfRest[2] - half[2]).toFixed(2)})`);
  const sw0 = strandAt(k, 0, { pose: { uSwing: [0.3, -0.4, 0.2, 0] } }).mid, sw1 = strandAt(k, 0).mid;
  assert.ok(Math.hypot(...sw0.map((x, i) => x - sw1[i])) < 1e-9, 'the roots where they were');
  assert.ok(strandAt(k, 1, { pose: { uSwing: [0, 0, 0.25, 0] } }).mid[1] > rest[1] + 0.25, 'a fall lifts them');
});

/** The fragment half's answer for the wings - light (rgb), or 'discard'. */
const fsW = (kind, vP, { s = [0, 0, 0], world = [0, 1.6, -0.6], eye = FAR, time = 13.2, kindle = 1 } = {}) => {
  const f = glslFunctions(AURA_FS, { ...BASE, vP, vWorld: world, vS: s, uKind: kind, uTime: time, uYaw: 0, uKindle: kindle, uCamPos: eye, uAt: [0, 0, 0] });
  try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return 'discard'; throw e; }
  return f.globals.o;
};
const QUIET = 13.2;

test('SERAPH-WINGS the light, RUN: gold - white-hot at a strand\'s heart, gold to amber toward its edge, gone past it; out of the back and frayed away at the tip; alive along it and over time, and the same at the wrap; unfurled from the root as it kindles; nothing laid over an eye among them; a fine strand fainter than the broad (mutants: the heart, the edge, the tip, the root, the kindle, the eye)', () => {
  const k = broad(1, 3), mid = (a, t, o = {}) => fsW(1, [a, t], { s: [k, 0, 0], ...o });
  const heart = mid(0.5, 0.5), edge = mid(0.12, 0.5);
  assert.ok(heart[0] >= heart[1] && heart[1] >= heart[2] && heart[0] > 0.3, `gold (${heart.slice(0, 3).map((x) => x.toFixed(2))})`);
  assert.ok(lum(heart) > lum(edge) * 1.8 && heart[2] / heart[0] > 0.45 && heart[2] / heart[0] > edge[2] / Math.max(edge[0], 1e-6), `white-hot at the heart, golder toward the edge (${(heart[2] / heart[0]).toFixed(2)})`);
  assert.equal(lum(mid(0.0, 0.5)), 0, 'gone past the edge - frayed to nothing');
  assert.ok(lum(mid(0.5, 0.995)) < lum(heart) * 0.1 && lum(mid(0.5, 0.02)) < lum(heart) * 0.1, 'faint out of the back, frayed away at the tip');
  const along = Array.from({ length: 30 }, (_, i) => lum(mid(0.5, 0.2 + i * 0.02)));
  assert.ok(Math.max(...along) > Math.min(...along) * 1.3, 'alive along it - not one flat light');
  assert.ok(Math.abs(lum(mid(0.5, 0.5, { time: QUIET })) - lum(mid(0.5, 0.5, { time: QUIET + 0.7 }))) > 0.01, 'and over time');
  // the light runs along it: a pulse's period (3 s) apart the pulse is where it was and the breath only scales the
  // whole, so what is left to differ is the light's own flow
  const shape = (time) => { const p = Array.from({ length: 30 }, (_, i) => lum(mid(0.5, 0.25 + i * 0.015, { time }))); const m = p.reduce((a, x) => a + x, 0) / p.length; return p.map((x) => x / m); };
  const sa = shape(QUIET), sb = shape(QUIET + 1 / WING_HZ.flow);
  assert.ok(Math.max(...sa.map((x, i) => Math.abs(x - sb[i]))) > 0.05, 'the light flowing along it');
  assert.ok(Math.abs(lum(mid(0.5, 0.5, { time: 1 / 240 })) - lum(mid(0.5, 0.5, { time: AURA_CLOCK_PERIOD + 1 / 240 }))) < 1e-4, 'the same at the clock\'s wrap');
  assert.equal(lum(mid(0.5, 0.5, { kindle: 0 })), 0, 'unkindled, nothing');
  assert.ok(lum(mid(0.5, 0.2, { kindle: 0.5 })) > 0.05 && lum(mid(0.5, 0.85, { kindle: 0.5 })) === 0, 'half kindled: lit near the root, not yet at the tip');
  assert.equal(lum(mid(0.5, 0.5, { eye: [0, 1.62, -0.55] })), 0, 'an eye among them: nothing laid over it');
  assert.ok(lum(fsW(1, [0.5, 0.5], { s: [k + 1, 1, 0] })) < lum(heart), 'a fine strand fainter than the broad');
});

test('SERAPH-WINGS the ground and the motes, RUN: a faint pool of gold at the feet, none past it, none unkindled; a mote a small round light, nothing past its disc, nothing as it begins and as it ends, none till the wings have unfurled (mutants: the pool, the mote\'s fade, its kindle gate)', () => {
  const g0 = fsW(0, [0, 0]), gEdge = fsW(0, [WING_POOL_R - 0.05, 0]);
  assert.ok(lum(g0) > 0.2 && lum(g0) < 1.2 && g0[0] > g0[2], `a faint pool of gold (${lum(g0).toFixed(2)})`);
  assert.ok(lum(gEdge) < lum(g0) * 0.1, 'fading to its edge');
  assert.equal(fsW(0, [WING_POOL_R + 0.02, 0]), 'discard', 'none past it');
  assert.equal(lum(fsW(0, [0.2, 0.1], { kindle: 0 })), 0, 'none unkindled');
  const mote = (uv, age, o = {}) => fsW(2, uv, { s: [age, 0, 3], ...o });
  assert.ok(lum(mote([0.5, 0.5], 0.4)) > 1, 'a small round light');
  assert.equal(mote([0.03, 0.03], 0.4), 'discard', 'nothing past its disc');
  assert.ok(lum(mote([0.5, 0.5], 0.0)) === 0 && lum(mote([0.5, 0.5], 1.0)) < 1e-6, 'nothing as it begins and as it ends');
  assert.equal(lum(mote([0.5, 0.5], 0.4, { kindle: 0.6 })), 0, 'none till the wings have unfurled');
});

test('SERAPH-WINGS no pow of a negative, no NaN: every pow the wings\' shader takes has a base of zero or more, and every point it lays is a number - at rest, under the strongest swing and pose, and from an eye on a strand (mutants: a pow of a negative)', () => {
  const guard = (src) => src.replace(/\bpow\(/g, 'wingPowChk(').replace('const float TAU', 'float powNeg = 0.0;\nfloat wingPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }\nconst float TAU');
  const VS = src => src.replace(/\bpow\(/g, 'wingPowChk(').replace('float wingHash', 'float powNeg = 0.0;\nfloat wingPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }\nfloat wingHash');
  const vsSrc = VS(AURA_VS), fsSrc = guard(AURA_FS);
  const poses = [{}, { uSwing: [0.42, -0.42, 0.25, 0.6] }, { uSwing: [-0.42, 0.42, -0.05, -0.6] }, { uCapeS: [0, CLOAK_SHOULDER_Y * 0.4, 0.1, 1.25] }];
  for (const pose of poses) for (let i = 0; i < 30; i++) {
    const k = (i * 7) % WING_STRAND_COUNT, t = (i % 11) / 10;
    for (const [kind, aP] of [[1, [k * 2 + (i % 2), t]], [2, [((i * 3) % WING_MOTES) * 2 + 0.5, 0.5]]]) {
      const eye = i % 5 === 0 ? [0.1, 1.5, -0.3] : [3, 1.5, -2];
      const vs = glslFunctions(vsSrc, { ...BASE, ...pose, aP, uKind: kind, uTime: 3.7 * i, uYaw: 0.3 * i, uAt: [0, 0, 0], uCamPos: eye });
      vs.main();
      assert.equal(vs.globals.powNeg, 0, `the vertex half, kind ${kind} at ${aP}`);
      assert.ok(vs.globals.vWorld.every(Number.isFinite), `a number, kind ${kind} at ${aP}`);
      const fs = glslFunctions(fsSrc, { ...BASE, ...pose, vP: vs.globals.vP, vWorld: vs.globals.vWorld, vS: vs.globals.vS, uKind: kind, uTime: 3.7 * i, uYaw: 0.3 * i, uKindle: i % 4 === 0 ? 0.5 : 1, uCamPos: eye, uAt: [0, 0, 0] });
      try { fs.main(); } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
      assert.equal(fs.globals.powNeg, 0, `the fragment half, kind ${kind} at ${aP}`);
      assert.ok(fs.globals.o.every(Number.isFinite), `its light a number, kind ${kind}`);
    }
  }
});

// ── THE DRAW AND THE HOSTS ──────────────────────────────────────────

test('SERAPH-WINGS the draw: the wings\' mesh uploaded; a wearer of them drawn in the fifth look - its pool, its strands, its motes - added whole (never the cloak\'s premultiplied blend), none of the strands or motes with the ground\'s depth offset, the offset handed back for the next wearer\'s ground; beside the fire as before (mutants: the strands, the motes, the blend, the offset)', () => {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const r = new AuraRingRenderer(gl);
  assert.ok(calls.filter((c) => c[0] === 'bufferData').map((c) => c[2].length).includes(WING_VERTS * 2), 'the wings\' mesh uploaded');
  calls.length = 0;
  r.draw([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0 }, { at: [3, 0, 3], aura: 'dagonfire' }], new Float32Array(I), new Float32Array(I), [0, 1.5, -5], 10);
  assert.equal(r.drawn, 2);
  const seq = calls.filter((c) => c[0] === 'drawArrays' || (c[0] === 'uniform1i' && c[1] === 'uAura') || ((c[0] === 'enable' || c[0] === 'disable') && c[1] === 12)).map((c) => c[0] === 'drawArrays' ? c[3] : c[0] === 'uniform1i' ? `aura ${c[2]}` : `${c[0]} offset`);
  assert.deepEqual(seq, ['enable offset', 'aura 0', 6, AURA_STEPS * 6, 'aura 4', 6, 'disable offset', WING_VERTS, WING_MOTES * 6, 'enable offset', 'disable offset'], 'farthest first: the fire, then the wings - their pool with the offset, their strands and motes without it, the offset back');
  assert.ok(!calls.some((c) => c[0] === 'blendFunc' && c[2] === 13), 'added whole - never premultiplied');
  const at = calls.findIndex((c) => c[0] === 'drawArrays' && c[3] === WING_VERTS), bound = calls.slice(0, at).filter((c) => c[0] === 'bindVertexArray').pop();
  assert.equal(bound[1], r.wingsVao, 'the strands off the wings\' own mesh');
});

test('SERAPH-WINGS the hosts: the draw hangs and swings every look with a mesh of its own - the cloak and the wings alike - on its wearer\'s body, read as code', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ AuraRingRenderer, auraWearers, auraLookOf, auraBeastStep, auraMotionStep, auraCapeStep, CLOAK_BONES, AURA_KINDLE_S \} from '\.\.\/render\/auraRing\.js';/);
  const line = w.split('\n').find((l) => l.includes('for (const w of _auraDraw) if (auraLookOf(w.aura).mesh)'));
  assert.ok(line, 'the draw\'s line');
  const code = line.slice(0, line.indexOf('   //'));
  assert.ok(!code.trim().startsWith('//') && /for \(const w of _auraDraw\) if \(auraLookOf\(w\.aura\)\.mesh\) \{ auraCapeStep\(w, [^;]*\); auraMotionStep\(w, auraNow\); \}/.test(code), 'every meshed look hung on its body and swung');
  assert.equal(auraLookOf('seraphwings').mesh, 'wings');
  assert.ok(Math.abs(CLOAK_REST_POSE.shoulders[1] - CLOAK_SHOULDER_Y) < 1e-6, 'without bones, the wings hang from the rest pose\'s shoulders as the cape does');
});
