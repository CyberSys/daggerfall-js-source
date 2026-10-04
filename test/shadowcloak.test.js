// SHADOW-CLOAK — SIRMCMOBDON'S OWN AURA: THE HOLO SHADOW CLOAK (2026-10-04).
//
// The owner: "So for SirMcMobdon, I want to build a new unique AURA specifically for his account. A holo shadow cloak
// with red accents. Extremely detailed". SirMcMobdon already holds Shadow Fang (SHADOW-FANG: the black-and-crimson
// title, the wolf's-head glyph, the werewolf's skin), so the cloak rides the same handle list - the third list to grant
// an aura (TIER_AURA) - and wears the title's own black and crimson. It is the aura pass's fourth look
// (render/auraRing.js AURA_LOOK): not a mark on the ground nor light round the body but a CLOAK ON IT - a hooded mantle
// hung from the shoulders, parted at the wearer's front (the facing every host now hands the pass), drawn premultiplied
// so its shadow darkens what is behind it and its crimson light is added; the Shadow Fang's mark on its back; a ground of
// shadow and crimson rings under it; wisps of its shadow burning away. Its shader is RUN here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { AURA_TEXT, AURA_PAINT, TITLE_GRADIENT } from '../src/ui/playerBadge.js';
import { isStaff } from '../src/net/staffCommands.js';
import {
  titlesHeld, glyphsOf, titleWorn, aurasHeld, auraWorn, auraRefusal, wardrobeOf, TIER_LISTS, TIER_GLYPH, TIER_AURA,
} from '../server-account/src/titles.js';
import { RELAY_VERSION } from '../src/net/wire.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS, AURA_CARDS,
  CLOAK_H, CLOAK_SHOULDER_Y, CLOAK_NECK_Y, CLOAK_HEM_R, CLOAK_SHOULDER_R, CLOAK_HOOD_R, CLOAK_BACK_M, CLOAK_HOOD_BACK_M, CLOAK_SQUASH,
  CLOAK_ROUND, CLOAK_ROWS, CLOAK_OPEN, CLOAK_DASHES, CLOAK_POOL_R, CLOAK_EMITTER_R, CLOAK_SIGIL_Y, CLOAK_WISPS, CLOAK_WISP_LIFE,
  CLOAK_HZ, CLOAK_FLOW, CLOAK_RGB, cloakRatesWhole, auraCloakGrid, AuraRingRenderer, WARD_GLYPHS, RADIANCE_R, RADIANCE_H,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;
const LATER = AFTER + 30 * 86_400;
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
const lum = (c) => c[0] + c[1] + c[2];
const TAU = 2 * Math.PI;

// ── THE VOCABULARY, THE GRANT, THE WIRE ─────────────────────────────

test('SHADOW-CLOAK vocabulary: the cloak joins AURAS last, "Holo Shadow Cloak" in words, its button in the Shadow Fang\'s paint; a look of its own - the fourth kind, its own mesh, and it SHADES; its colours the title\'s own black and crimson (mutants: the word, the paint, the kind, the colour)', () => {
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak'], 'the Broker\'s fire, the ward, the radiance, then the cloak');
  assert.equal(AURA_TEXT.shadowcloak, 'Holo Shadow Cloak', 'the owner\'s words: "A holo shadow cloak"');
  assert.equal(AURA_PAINT.shadowcloak, 'shadowfang', 'its button in the Shadow Fang\'s black and crimson');
  assert.ok(TITLES.includes(AURA_PAINT.shadowcloak));
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.shadowcloak }, { kind: 3, ringR: CLOAK_HEM_R, flameH: CLOAK_H, glyphs: CLOAK_WISPS, mesh: 'cloak', shade: true }, 'the fourth kind: the hem\'s radius, the hood\'s height, its wisps, its own mesh, and a look that shades');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('shadowcloak'), AURA_LOOK.shadowcloak);
  for (const a of ['dagonfire', 'oblivionward', 'radiance']) assert.ok(!AURA_LOOK[a].shade && !AURA_LOOK[a].mesh, `${a} still adds its light whole, on the strip`);
  // the title's own gradient: the shadow its black end, the light its crimson end
  const [black, crimson] = TITLE_GRADIENT.shadowfang;
  assert.deepEqual(rgb(CLOAK_RGB.crimson), rgb(crimson), 'the light: the Shadow Fang\'s crimson');
  assert.deepEqual(rgb(CLOAK_RGB.shadow), rgb(black), 'the shadow: the Shadow Fang\'s black');
  assert.ok(CLOAK_RGB.crimson[0] > 3 * CLOAK_RGB.crimson[1] && CLOAK_RGB.crimson[0] > 3 * CLOAK_RGB.crimson[2], 'red accents: red over everything');
  assert.ok(CLOAK_RGB.hot[0] >= CLOAK_RGB.hot[1] && CLOAK_RGB.hot[0] >= CLOAK_RGB.hot[2] && lum(CLOAK_RGB.hot) > lum(CLOAK_RGB.crimson), 'its heart a hotter, paler red');
});

test('SHADOW-CLOAK grant: SHADOW_FANG_HANDLES still names SirMcMobdon, and the list now grants the cloak with the title and the glyph, case-folded; worn while held, read off the config alone; off the list all three go, a guest holds none, the other lists\' holders hold their own and not it (mutants: the aura\'s grant, the list\'s key)', () => {
  assert.equal(v('SHADOW_FANG_HANDLES'), 'SirMcMobdon');
  assert.equal(TIER_LISTS.shadowfang, 'SHADOW_FANG_HANDLES');
  assert.equal(TIER_GLYPH.shadowfang, 'shadowfang');
  assert.equal(TIER_AURA.shadowfang, 'shadowcloak', 'the third list to grant an aura');
  for (const h of ['SirMcMobdon', 'sirmcmobdon', 'SIRMCMOBDON']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['shadowfang'], `${h}: the title, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['shadowfang'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['shadowcloak'], 'and the cloak');
    assert.equal(auraRefusal('shadowcloak', p, ENV), null, 'theirs to wear');
  }
  const sir = row('SirMcMobdon', { title: 'shadowfang', aura: 'shadowcloak' });
  assert.equal(titleWorn(sir, ENV), 'shadowfang');
  assert.equal(auraWorn(sir, ENV), 'shadowcloak');
  assert.equal(auraWorn(sir), undefined, 'without the config, the Broker\'s alone - the cloak is a list\'s');
  const both = row('SirMcMobdon', { insignia: 'aura:dagonfire', aura: 'dagonfire' });
  assert.deepEqual(aurasHeld(both, ENV), ['shadowcloak', 'dagonfire'], 'the list\'s first, then what the Broker sold');
  const w = wardrobeOf(sir, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['shadowfang'], 'shadowfang', ['shadowfang'], ['shadowcloak'], 'shadowcloak'], 'the account card\'s whole answer');
  const off = { ...ENV, SHADOW_FANG_HANDLES: '' };
  assert.deepEqual([titlesHeld(sir, off), glyphsOf(sir, off, LATER), aurasHeld(sir, off)], [[], [], []], 'off the list, all three go');
  assert.equal(auraWorn(sir, off), undefined, 'and the cloak is not worn by a row nobody cleared');
  assert.equal(auraRefusal('shadowcloak', sir, off), 'not-held');
  assert.deepEqual(aurasHeld({ ...sir, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld(row('Sureme'), ENV), ['oblivionward'], 'Sureme holds the ward and not the cloak');
  assert.deepEqual(aurasHeld(row('GA00250'), ENV), ['radiance'], 'GA00250 the radiance and not the cloak');
  for (const h of ['Diggleborf', 'Dutchess', 'SquidKamer', 'SirMcMobdo', 'SirMcMobdonn', 'Mobdon']) {
    assert.deepEqual(aurasHeld(row(h), ENV), [], `${h} holds no aura`);
    assert.equal(auraRefusal('shadowcloak', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['shadowfang']), true, 'the Shadow Fang\'s staff right is the glyph\'s, as before - the cloak adds none');
});

test('SHADOW-CLOAK the service end to end: SirMcMobdon registers, holds the cloak beside the title; wears it through the aura door; the token signs it and says it beside; a stranger is refused it; off the list the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ SHADOW_FANG_HANDLES: 'SirMcMobdon' });
  const me = await registered('SirMcMobdon');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed until they put it on');
  let r = await call('/v1/account/aura', { aura: 'shadowcloak' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura], [['shadowcloak'], 'shadowcloak'], 'the wardrobe answers it worn');
  m = await mint();
  assert.equal(m.claims.au, 'shadowcloak', 'signed');
  assert.equal(m.answer.aura, 'shadowcloak', 'and said beside the token, for their own back');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'shadowcloak' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the cloak');
  env.SHADOW_FANG_HANDLES = '';
  m = await mint();
  assert.equal('au' in m.claims, false, 'off the list: the next token carries no cloak');
});

test('SHADOW-CLOAK token and relay: a token may carry the cloak and verifies; the relay - world165, the one that knows the word - reads it out of the signature onto their row for everyone near (mutants: the vocabulary\'s aura)', async () => {
  assert.equal(RELAY_VERSION, 'world165', 'SHADOW-CLOAK moved it on (world165): the vocabulary rides the relay\'s bundle');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', t: 'shadowfang', g: ['shadowfang'], au: 'shadowcloak' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.au, 'shadowcloak');
  assert.equal(claimsValid({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS], au: 'shadowcloak' }), true, 'every glyph and the cloak at once still fit');
  assert.equal(claimsValid({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', i: nowS, e: nowS + 60, au: 'holoshadowcloak' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'SirMcMobdon', title: 'shadowfang', glyphs: ['shadowfang'], au: 'shadowcloak' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.au, 'shadowcloak', 'and everyone near sees their cloak');
});

// ── THE CLOAK'S SHAPE ───────────────────────────────────────────────

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BASE = { uSeed: 0.37, uRingR: CLOAK_HEM_R, uGroundR: AURA_GROUND_R, uFlameH: CLOAK_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: AURA_LIFT_M, uVP: I, uAura: 3 };
/** The vertex half's answer: where a mesh point (or a wisp's corner) stands. */
const vsAt = (kind, aP, { t = 13.5, yaw = 0, at = [0, 0, 0], eye = [0, 1.2, -5] } = {}) => {
  const f = glslFunctions(AURA_VS, { ...BASE, aP, uKind: kind, uTime: t, uYaw: yaw, uAt: at, uCamPos: eye });
  f.main();
  return { w: f.globals.vWorld, vP: f.globals.vP, vS: f.globals.vS };
};
/** The fragment half's answer, premultiplied: [light r, g, b, how much it covers] - or 'discard'. */
const fsAt = (kind, vP, { t = 13.5, yaw = 0, kindle = 1, world = null, eye = [0, 1.2, -5], s = [0, 0, 0], fog = null, at = [0, 0, 0] } = {}) => {
  const w = world ?? (kind === 1 ? vsAt(1, vP, { t, yaw, at }).w : [0, 0, 0]);
  const f = glslFunctions(AURA_FS, { ...BASE, vP, vWorld: w, vS: s, uKind: kind, uTime: t, uYaw: yaw, uKindle: kindle, uCamPos: eye, uAt: at, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0 });
  try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return 'discard'; throw e; }
  return f.globals.o;
};
/** A quiet moment: no glitch and no flicker falls in it (the shader's own hashes, run). */
const QUIET = 13.2;

test('SHADOW-CLOAK the law: a hood standing past the crown, shoulders clear of the body, the hem inside the fire\'s ring; broader across the shoulders than deep; parted at the front, wider toward the hem, a narrow throat, the hood\'s face open; the mesh whole; every rate whole over the clock; the wisps\' lives divide it (mutants: the hood, the parting, a rate off whole)', () => {
  assert.ok(CLOAK_H > CAPSULE_HEIGHT + 0.1, 'the hood\'s peak over the crown (the walking body 1.8 m)');
  assert.ok(CLOAK_SHOULDER_Y < CAPSULE_HEIGHT && CLOAK_NECK_Y > CLOAK_SHOULDER_Y && CLOAK_NECK_Y < CAPSULE_HEIGHT - 0.1, 'hung from the shoulders, the hood\'s base at the neck');
  assert.ok(CLOAK_SHOULDER_R >= 0.3 && CLOAK_SHOULDER_R < CLOAK_HEM_R, 'shoulders clear of the body, narrower than the hem');
  assert.ok(CLOAK_HEM_R + CLOAK_BACK_M < AURA_RING_R && CLOAK_EMITTER_R < CLOAK_POOL_R && CLOAK_POOL_R < AURA_GROUND_R, 'its hem and its ground inside the fire\'s ring and the ground quad');
  assert.ok(CLOAK_HOOD_R > 0.15 && CLOAK_HOOD_R < CLOAK_SHOULDER_R, 'a hood round the head');
  assert.ok(CLOAK_SQUASH.shoulder > CLOAK_SQUASH.hem, 'a body is broader than it is deep');
  assert.ok(CLOAK_OPEN.hem > CLOAK_OPEN.shoulder && CLOAK_OPEN.shoulder > CLOAK_OPEN.throat && CLOAK_OPEN.face > CLOAK_OPEN.hem, 'the parting: wider to the hem, narrow at the throat, the face open');
  assert.equal(auraCloakGrid().length, CLOAK_ROUND * CLOAK_ROWS * 12, 'two triangles a cell');
  const g = auraCloakGrid();
  assert.deepEqual([Math.min(...g), Math.max(...g)], [0, 1], 'u and v from 0 to 1');
  assert.ok(cloakRatesWhole(), 'every cloak rate whole over the clock');
  for (const r of [...Object.values(CLOAK_HZ), ...Object.values(CLOAK_FLOW)]) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6), `whole: ${r}`);
  for (const l of CLOAK_WISP_LIFE) assert.equal(AURA_CLOCK_PERIOD % l, 0, `a wisp's life divides the clock: ${l}`);
  assert.equal(AURA_CARDS, Math.max(WARD_GLYPHS, CLOAK_WISPS), 'the third draw has cards enough for the most any look floats');
});

test('SHADOW-CLOAK the vertex half, RUN: the cloth stands at the hem\'s radius at the feet and closes at the hood\'s peak, behind the head; its parting faces the wearer\'s facing - turned with them; its back hangs further than its front; broader across the shoulders than deep; the folds in the cloth; wisps peel off the back half and rise (mutants: the facing ignored, the back drape dropped, the squash dropped, the folds dropped, the wisps\' rise)', () => {
  const near = (p, q, e = 1e-6) => p.every((x, i) => Math.abs(x - q[i]) < e);
  // facing: with yaw 0 the front (u 0) is +z; a quarter turn later it is +x
  const front0 = vsAt(1, [0, 0.3], { t: QUIET }).w, front90 = vsAt(1, [0, 0.3], { t: QUIET, yaw: Math.PI / 2 }).w;
  assert.ok(front0[2] > 0.3 && Math.abs(front0[0]) < 1e-6, `yaw 0: the parting at +z (${front0.map((x) => x.toFixed(3))})`);
  assert.ok(front90[0] > 0.3 && Math.abs(front90[2]) < 1e-6, `yaw a quarter turn: at +x (${front90.map((x) => x.toFixed(3))})`);
  // the back hangs further than the front, at the knee
  const back = vsAt(1, [0.5, 0.25], { t: QUIET }).w, front = vsAt(1, [0, 0.25], { t: QUIET }).w;
  assert.ok(-back[2] > front[2] + 0.05, `the back hangs further out (${(-back[2]).toFixed(3)} behind, ${front[2].toFixed(3)} in front)`);
  // at the shoulders: broader across (u 0.25, the right) than deep (u 0.5, the back)
  const vS = (CLOAK_SHOULDER_Y - 0.02) / CLOAK_H;
  const side = vsAt(1, [0.25, vS], { t: QUIET }).w, behind = vsAt(1, [0.5, vS], { t: QUIET }).w;
  assert.ok(Math.abs(side[0]) > Math.abs(behind[2]) + 0.05, `broader than deep (${Math.abs(side[0]).toFixed(3)} across, ${Math.abs(behind[2]).toFixed(3)} deep)`);
  assert.ok(Math.abs(side[0]) >= 0.3, 'clear of the body\'s shoulders');
  // the foot and the peak
  const foot = vsAt(1, [0.3, 0], { t: QUIET }).w;
  assert.ok(Math.abs(foot[1] - AURA_LIFT_M) < 1e-9 && Math.hypot(foot[0], foot[2]) > CLOAK_HEM_R - 0.05, 'at the feet, out at the hem');
  const peak = vsAt(1, [0.37, 1], { t: QUIET }).w;
  assert.ok(near(peak, [0, AURA_LIFT_M + CLOAK_H, -CLOAK_HOOD_BACK_M], 1e-6), `the hood closes at its peak, fallen back behind the head (${peak.map((x) => x.toFixed(3))})`);
  // folds: round the knee the radius rises and falls, more than the billow alone
  const radii = Array.from({ length: 96 }, (_, i) => { const p = vsAt(1, [0.25 + (i / 96) * 0.5, 0.2], { t: QUIET }).w; return Math.hypot(p[0], p[2]); });
  let turns = 0;
  for (let i = 1; i < 95; i++) if ((radii[i] - radii[i - 1]) * (radii[i + 1] - radii[i]) < 0) turns++;
  assert.ok(turns >= 8, `folds in the cloth (${turns} turns round its back half)`);
  // the wisps: on the back half (behind the body), rising as they age
  let behindN = 0;
  for (let k = 0; k < CLOAK_WISPS; k++) {
    const life = CLOAK_WISP_LIFE[k % 3];
    const t0 = (Math.floor(QUIET / life) + 0.2) * life;   // a fifth of the way into some flight
    const a = vsAt(2, [k * 2 + 0.5, 0.5], { t: t0 }), b = vsAt(2, [k * 2 + 0.5, 0.5], { t: t0 + life * 0.5 });
    if (a.w[2] < 0.05) behindN++;
    if (Math.abs(b.vS[0] - a.vS[0] - 0.5) < 1e-6) assert.ok(b.w[1] > a.w[1] + 0.1, `wisp ${k} rises`);
  }
  assert.ok(behindN >= CLOAK_WISPS - 2, `off the back half (${behindN}/${CLOAK_WISPS} behind the body)`);
});

test('SHADOW-CLOAK the cloth, RUN: parted at the front at every height - the mesh\'s seam inside the parting; shadow behind and crimson light on it, premultiplied - neither nothing nor a solid wall; denser at its edges than across the body; the inside dimmer; the Shadow Fang\'s mark lit on its back; its trims hot along the parting; the hem torn; none of it from inside (the wearer\'s first person); built up from the feet as it kindles; the wrap whole (mutants: the parting dropped, the rim dropped, the mark dropped, the trim dropped, the inside fade dropped, the build dropped)', () => {
  const eyeBack = [0, 1.2, -5], eyeSide = [5, 1.2, 0], eyeFront = [0, 1.2, 5];
  for (let i = 0; i <= 20; i++) {
    const v = 0.03 + (i / 20) * 0.95;
    assert.equal(fsAt(1, [0.005, v], { t: QUIET }), 'discard', `the parting at the front, v ${v.toFixed(2)}`);
    assert.equal(fsAt(1, [0.995, v], { t: QUIET }), 'discard', `and either side of the seam, v ${v.toFixed(2)}`);
  }
  // the back, face on from behind: covered and lit, premultiplied
  const backMid = fsAt(1, [0.42, 0.4], { t: QUIET, eye: eyeBack });
  assert.ok(backMid[3] > 0.5 && backMid[3] < 0.95, `a shadow over what is behind it, not a wall (${backMid[3].toFixed(3)})`);
  assert.ok(backMid[0] > backMid[1] && backMid[0] > backMid[2], 'its light red');
  // the rim: from behind, the cloth at the sides (looked along) covers more than the cloth across the back (looked through)
  let edge = 0, across = 0;
  for (const t of [QUIET, 41.2, 77.7]) { edge += fsAt(1, [0.25, 0.35], { t, eye: eyeBack })[3] + fsAt(1, [0.75, 0.35], { t, eye: eyeBack })[3]; across += 2 * fsAt(1, [0.44, 0.35], { t, eye: eyeBack })[3]; }
  assert.ok(edge > across * 1.1, `denser at its edges (${(edge / 6).toFixed(3)} vs ${(across / 6).toFixed(3)})`);
  // the inside: the back seen from the front through the parting is lit less than the same cloth seen from behind
  const outsideLit = lum(fsAt(1, [0.42, 0.3], { t: QUIET, eye: eyeBack })), insideLit = lum(fsAt(1, [0.42, 0.3], { t: QUIET, eye: eyeFront }));
  assert.ok(insideLit < outsideLit * 0.7, `the inside dimmer (${insideLit.toFixed(3)} vs ${outsideLit.toFixed(3)})`);
  // the mark: its fang lit against the plain cloth beside it, on the back, at its height
  const r = (u, y) => { const p = vsAt(1, [u, y / CLOAK_H], { t: QUIET }).w; return Math.hypot(p[0], p[2] + 0); };
  const uFang = 0.5 + 0.053 / (TAU * r(0.5, CLOAK_SIGIL_Y));
  const onFang = lum(fsAt(1, [uFang, CLOAK_SIGIL_Y / CLOAK_H], { t: QUIET, eye: eyeBack }));
  const offMark = lum(fsAt(1, [0.5 + 0.3 / (TAU * r(0.5, CLOAK_SIGIL_Y)), (CLOAK_SIGIL_Y - 0.3) / CLOAK_H], { t: QUIET, eye: eyeBack }));
  assert.ok(onFang > offMark + 1.0, `the Shadow Fang's mark lit on the back (${onFang.toFixed(3)} on a fang vs ${offMark.toFixed(3)} on the cloth)`);
  // the trim: hot just inside the parting's edge, against the cloth a hand further in
  const y = 0.9, rr = r(0.2, y), open = CLOAK_OPEN.hem + (CLOAK_OPEN.shoulder - CLOAK_OPEN.hem) * (3 * (y / CLOAK_SHOULDER_Y) ** 2 - 2 * (y / CLOAK_SHOULDER_Y) ** 3);
  const uTrim = open + 0.012 / (TAU * rr);
  const trim = lum(fsAt(1, [uTrim, y / CLOAK_H], { t: QUIET, eye: eyeFront })), cloth = lum(fsAt(1, [uTrim + 0.1 / (TAU * rr), y / CLOAK_H], { t: QUIET, eye: eyeFront }));
  assert.ok(trim > cloth + 0.8, `a hot trim along the parting (${trim.toFixed(3)} vs ${cloth.toFixed(3)})`);
  // the hem: torn, so below the lowest tear nothing at any bearing, and the cloth whole a hand above the highest
  for (let i = 0; i < 24; i++) assert.equal(fsAt(1, [0.2 + (i / 24) * 0.6, 0.02 / CLOAK_H], { t: QUIET, eye: eyeBack }), 'discard', 'below the tear');
  assert.notEqual(fsAt(1, [0.4, 0.4 / CLOAK_H], { t: QUIET, eye: eyeBack }), 'discard', 'the cloth whole above it');
  // from inside it: the eye at the wearer's own - no shadow over the view and no light
  for (const [u, vv] of [[0.42, 0.85], [0.3, 0.6], [0.7, 0.75], [0.2, 0.9]]) {
    const c = fsAt(1, [u, vv], { t: QUIET, eye: [0, 1.65, 0.05] });
    if (c !== 'discard') assert.deepEqual(c.map((x) => +x.toFixed(6)), [0, 0, 0, 0], `nothing from inside it (${u}, ${vv})`);
  }
  // kindled up: at half, the knee drawn and the shoulders not
  assert.equal(fsAt(1, [0.4, 0.95], { t: QUIET, kindle: 0.5 }), 'discard', 'half kindled: not yet at the hood');
  assert.ok(fsAt(1, [0.4, 0.2], { t: QUIET, kindle: 0.5, eye: eyeBack })[3] > 0.2, 'and the knee built');
  assert.equal(fsAt(1, [0.4, 0.1], { t: QUIET, kindle: 0 }), 'discard', 'unkindled: nothing');
  // the wrap
  for (let i = 0; i < 10; i++) {
    const p = [0.2 + (i / 10) * 0.6, 0.15 + (i % 5) * 0.15];
    const a = fsAt(1, p, { t: 0, eye: eyeSide }), b = fsAt(1, p, { t: AURA_CLOCK_PERIOD, eye: eyeSide });
    if (a === 'discard' || b === 'discard') { assert.equal(a, b, 'the same cloth at the wrap'); continue; }
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-6), `the cloth at the wrap is the cloth at zero (${p})`);
  }
});

test('SHADOW-CLOAK the ground, RUN: a pool of shadow at the feet, none past it; the emitter just outside the hem whole round the feet in crimson dashes; the bezel and the brackets about it; no seam where the angle closes; the wrap whole; unkindled nothing; the quad\'s corners round (mutants: the pool dropped, the dashes\' count, a seam)', () => {
  const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  const feet = fsAt(0, at(0.12, 0.7), { t: QUIET });
  assert.ok(feet[3] > 0.4, `the shadow pooled at the feet (${feet[3].toFixed(3)})`);
  for (let i = 0; i < 12; i++) assert.ok(fsAt(0, at(CLOAK_POOL_R + 0.03, (i / 12) * TAU), { t: QUIET })[3] < 0.02, 'none past the pool');
  // the dashes: round the emitter, CLOAK_DASHES bright runs and their gaps, in crimson
  const ring = Array.from({ length: 480 }, (_, i) => fsAt(0, at(CLOAK_EMITTER_R, (i / 480) * TAU), { t: QUIET }));
  const l = ring.map(lum), mid = (Math.max(...l) + Math.min(...l)) / 2;
  let crossings = 0;
  for (let i = 0; i < 480; i++) if ((l[i] - mid) * (l[(i + 1) % 480] - mid) < 0) crossings++;
  assert.equal(crossings, 2 * CLOAK_DASHES, `${CLOAK_DASHES} dashes round the feet`);
  for (const c of ring.filter((x) => lum(x) > mid)) assert.ok(c[0] > c[1] * 1.3 && c[0] > c[2] * 1.2, `in crimson: ${c.slice(0, 3).map((x) => x.toFixed(2))}`);
  // the angle closes at +x (atan's u 0 = 1): either side of it, the same ground
  for (const t of [QUIET, 2.5, 7.25, 31.75]) for (const r of [0.12, 0.4, CLOAK_EMITTER_R, 0.75, 0.86, 1.0]) {
    const a = fsAt(0, [r, 1e-7], { t }), b = fsAt(0, [r, -1e-7], { t });
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-3), `no seam at ${r}, ${t} s`);
  }
  for (let i = 0; i < 12; i++) {
    const p = at([0.2, CLOAK_EMITTER_R, 0.86, 1.0][i % 4], i * 0.61);
    const a = fsAt(0, p, { t: 0 }), b = fsAt(0, p, { t: AURA_CLOCK_PERIOD });
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-6), `the ground at the wrap is the ground at zero (${p.map((x) => x.toFixed(2))})`);
  }
  assert.deepEqual(fsAt(0, at(CLOAK_EMITTER_R, 1.0), { t: QUIET, kindle: 0 }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], 'unkindled: nothing');
  assert.equal(fsAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8], { t: QUIET }), 'discard', 'the quad\'s corners are round');
  const fogged = fsAt(0, at(CLOAK_EMITTER_R, 1.0), { t: QUIET, world: [0, 0, 400], fog: { density: 0.01 } });
  assert.ok(lum(fogged) + fogged[3] < (lum(ring[76]) + ring[76][3]) * 0.1, 'the fog thins its light and its shadow alike');
});

test('SHADOW-CLOAK the wisps, RUN: a tongue of shadow burning crimson at its edge, gone as it peels off and gone at its end, and none while the cloak is still building (mutants: the burn dropped, the fade dropped, the kindle gate dropped)', () => {
  let burning = 0, shadow = 0;
  for (let k = 0; k < 6; k++) for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const c = fsAt(2, [0.1 + i * 0.1, 0.05 + j * 0.1], { t: QUIET, s: [0.35, 0, k] });
    if (c[0] > 0.1 && c[0] > 2 * c[1]) burning++;
    if (c[3] > 0.1) shadow++;
  }
  assert.ok(burning >= 10, `crimson where it burns (${burning} points)`);
  assert.ok(shadow >= 10, `shadow inside it (${shadow} points)`);
  for (const age of [0, 1]) for (const p of [[0.5, 0.2], [0.5, 0.4], [0.4, 0.3]]) assert.deepEqual(fsAt(2, p, { t: QUIET, s: [age, 0, 2] }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], `nothing at age ${age}`);
  for (const p of [[0.5, 0.2], [0.5, 0.4], [0.4, 0.3]]) assert.deepEqual(fsAt(2, p, { t: QUIET, s: [0.35, 0, 2], kindle: 0.6 }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], 'none while the cloak builds');
});

test('SHADOW-CLOAK the draw: the cloak drawn PREMULTIPLIED on its own mesh with its wisps, the blend handed back whole for the next wearer; each wearer\'s facing set beside its place; the fire, the ward and the radiance drawn as before - one program for the four (mutants: the blend not set, the blend not restored, the mesh, the facing)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1, 'one program for the four auras');
  const meshData = calls.filter((c) => c[0] === 'bufferData').map((c) => c[2].length);
  assert.ok(meshData.includes(CLOAK_ROUND * CLOAK_ROWS * 12), 'the cloak\'s mesh uploaded');
  assert.ok(meshData.includes(AURA_CARDS * 12), 'cards enough for the wisps');
  const M = new Float32Array(I);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', yaw: 0.75 }, { at: [5, 0, 5], aura: 'radiance', yaw: 2 }, { at: [9, 0, 9], aura: 'dagonfire' }], M, M, [0, 0, 0], 10);
  assert.equal(r.drawn, 3);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(per('uAura', 'uniform1i'), [3, 2, 0]);
  assert.deepEqual(per('uYaw', 'uniform1f'), [0.75, 2, 0], 'each wearer\'s facing - none given, none turned');
  assert.deepEqual(per('uRingR', 'uniform1f'), [CLOAK_HEM_R, RADIANCE_R, AURA_RING_R]);
  assert.deepEqual(per('uFlameH', 'uniform1f'), [CLOAK_H, RADIANCE_H, 0.62]);
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, CLOAK_ROUND * CLOAK_ROWS * 6, CLOAK_WISPS * 6, 6, AURA_STEPS * 6, 6, AURA_STEPS * 6], 'the cloak\'s ground, its cloth and its wisps; the radiance\'s two; the fire\'s two');
  // the blend: premultiplied around the cloak's three draws and added again before the radiance's
  const seq = calls.filter((c) => c[0] === 'blendFunc' || c[0] === 'drawArrays').map((c) => (c[0] === 'blendFunc' ? `blend ${c[1]},${c[2]}` : 'draw'));
  assert.deepEqual(seq, ['blend 10,10', 'blend 10,13', 'draw', 'draw', 'draw', 'blend 10,10', 'draw', 'draw', 'draw', 'draw'], 'added; premultiplied for the cloak; added again for the others');
  assert.equal(calls.filter((c) => c[0] === 'useProgram').length, 1, 'the program bound once for the frame');
});

test('SHADOW-CLOAK the hosts: the one gather every host draws through hands each wearer\'s facing - mine my body\'s own, as its third person is drawn, a peer\'s off their pose (to the wall on a climb) - on the aura\'s own import line, so no cite below it moved', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ AuraRingRenderer, auraWearers, AURA_KINDLE_S \} from '\.\.\/render\/auraRing\.js'; import \{ peerBodyYaw \} from '\.\.\/net\/peerClimb\.js';/);
  assert.match(w, /_auraSelf\.aura = mine; _auraSelf\.yaw = player\.bodyYawFor\(cam\.yaw\);/, 'mine: the body\'s facing');
  assert.match(w, /w\.at\[2\] = p\[2\]; w\.yaw = peerBodyYaw\(d\.shown\) \?\? 0;/, 'a peer\'s: their pose\'s');
  assert.match(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\);/, 'drawn through the hook the street, the building and the dungeon all call');
});
