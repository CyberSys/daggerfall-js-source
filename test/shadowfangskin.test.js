// SHADOW-FANG — THE WEREWOLF'S OWN SKIN (2026-09-26).
//
// Mac, for SirMcMobdon: "Wants a custom morrowind werewolf skin (skin base but blacker amd like crimson red thru out
// the edging in the fur, red eyes)". The werewolf is Bloodmoon's (WEREWOLF1, test/werewolf1.test.js), built from the
// player's own data, so the skin is a LAW over its textures' pixels (characters/werewolfSkin.js), painted on a copy on
// the way to the GPU - and worn by whoever holds the Shadow Fang glyph: a peer by the glyphs their signed token
// carries, the player by the account service's last word on this device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { werewolfSkinOf, shadowFangPixels, skinMips, isEyeTexture, looksLikeEye, SHADOW_FANG, WEREWOLF_SKINS, SKIN_GLYPH } from '../src/characters/werewolfSkin.js';
import { ownGlyphs, ownWerewolfSkin } from '../src/systems/ownGlyphs.js';
import { adoptIdentity, storedSession, SESSION_KEY } from '../src/net/accountClient.js';
import { createFpArm } from '../src/combat/fpArm.js';
import { werewolfBodyDeps } from './fixtures/mw/bodyRig.mjs';
import { peerBuildOpts, peerBodyKey } from '../src/net/peerBodies.js';
import { armBuildOptsOf } from '../src/combat/weaponRig.js';
import { GLYPHS } from '../src/net/identityToken.js';
import { GLYPH_DETAIL, cssRgba } from '../src/ui/playerBadge.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** A texture of one colour with one texel changed, 7x7, row-major RGBA. */
function tex(fill, at = null, px = null, w = 7, h = 7) {
  const t = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) t.set(fill, i * 4);
  if (at) t.set(px, (at[1] * w + at[0]) * 4);
  return t;
}
const px = (t, x, y, w = 7) => Array.from(t.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const FUR = [110, 82, 52, 255];   // a mid-brown fur

test('SHADOW-FANG who wears it: the Shadow Fang glyph names the skin, and nothing else does (mutants: any glyph a skin)', () => {
  assert.deepEqual([...WEREWOLF_SKINS], ['shadowfang']);
  assert.ok(GLYPHS.includes(SKIN_GLYPH.shadowfang), 'the skin rides a glyph the token can carry');
  assert.equal(werewolfSkinOf(['sprout', 'shadowfang']), 'shadowfang');
  assert.equal(werewolfSkinOf(['apostle', 'dev']), null);
  assert.equal(werewolfSkinOf(null), null);
  assert.equal(werewolfSkinOf('shadowfang'), null, 'a string is not a list of glyphs');
});

test('SHADOW-FANG the law: the base is its own colour blacker; a strand lighter than the fur around it, the lit tips and an alpha-cut fringe are crimson; the eyes burn red - a glow no fur takes, or every texel of an eye texture; a transparent texel and every alpha are kept, and the input is never written (mutants: the base left light; the edging dropped; the eye missed; the cache painted)', () => {
  const src = tex(FUR);
  const before = src.slice();
  const out = shadowFangPixels(src, 7, 7);
  assert.deepEqual(src, before, 'the shared texture is not written');
  // THE BASE: blacker, still its own colour
  const [r, g, b, a] = px(out, 3, 3);
  assert.equal(a, 255);
  assert.ok(r < FUR[0] * 0.45 && g < FUR[1] * 0.45 && b < FUR[2] * 0.45, `blacker (${r},${g},${b})`);
  assert.ok(r > b, 'still the skin\'s warm base, not a flat grey');
  assert.ok(r < 2 * g + 8, 'and not crimson');
  // THE EDGING: a strand, a tip, a fringe
  const strand = px(shadowFangPixels(tex(FUR, [3, 3], [168, 128, 84, 255]), 7, 7), 3, 3);
  assert.ok(strand[0] > 2.5 * strand[1] && strand[0] > 2.5 * strand[2] && strand[0] > 80, `a lighter strand goes crimson (${strand})`);
  const tip = px(shadowFangPixels(tex([230, 222, 210, 255]), 7, 7), 3, 3);
  assert.ok(tip[0] > 2.5 * tip[1] && tip[0] > 120, `a lit tip goes crimson (${tip})`);
  const card = tex(FUR, [3, 3], [0, 0, 0, 0]);
  const fringed = shadowFangPixels(card, 7, 7);
  const edge = px(fringed, 2, 3);
  assert.ok(edge[0] > 2.5 * edge[1], `a texel beside an alpha cut is crimson (${edge})`);
  assert.deepEqual(px(fringed, 3, 3), [0, 0, 0, 0], 'the cut itself is left alone');
  assert.ok(px(fringed, 0, 0)[0] < 50, 'and the fur away from it stays black');
  // THE EYES
  const glow = px(shadowFangPixels(tex(FUR, [3, 3], [245, 214, 40, 255]), 7, 7), 3, 3);
  assert.ok(glow[0] > 200 && glow[1] < 40 && glow[2] < 50, `a yellow glow burns red (${glow})`);
  assert.equal(looksLikeEye(...FUR.slice(0, 3)), false, 'fur is not an eye');
  assert.equal(looksLikeEye(150, 22, 0), false, 'nor a deep red-brown shadow');
  const eyes = shadowFangPixels(tex([60, 60, 60, 255]), 7, 7, { eyeTexture: true });
  assert.ok(px(eyes, 0, 0)[0] > 170 && px(eyes, 0, 0)[1] < 40, 'an eye texture is red whole');
  assert.ok(isEyeTexture('tx_werewolf_eyes.dds') && isEyeTexture('Eye_Yellow.TGA') && !isEyeTexture('tx_werewolf.dds'));
  assert.equal(cssRgba(SHADOW_FANG.eye.map((v) => v / 255)), cssRgba(GLYPH_DETAIL.shadowfang.rgba), 'the eye is the glyph\'s own red');
});

test('SHADOW-FANG every mip level, each its own copy; no skin (or another) is the mips as they are (mutants: the top level alone; the cache\'s array handed back painted)', () => {
  const mips = [{ width: 7, height: 7, rgba: tex(FUR) }, { width: 3, height: 3, rgba: tex(FUR, null, null, 3, 3) }];
  const keep = mips.map((m) => m.rgba.slice());
  const sk = skinMips(mips, 'shadowfang', 'tx_werewolf.dds');
  assert.equal(sk.length, 2);
  assert.notEqual(sk, mips); assert.notEqual(sk[0].rgba, mips[0].rgba); assert.notEqual(sk[1].rgba, mips[1].rgba);
  assert.deepEqual(sk[1].rgba, shadowFangPixels(mips[1].rgba, 3, 3), 'the small levels too');
  mips.forEach((m, i) => assert.deepEqual(m.rgba, keep[i], 'the decoded texture is untouched'));
  assert.equal(skinMips(mips, null), mips);
  assert.equal(skinMips(mips, 'emperor'), mips);
  assert.ok(skinMips(mips, 'shadowfang', 'tx_wolf_eye.dds')[0].rgba[0] > 170, 'an eye file, by its name');
});

test('SHADOW-FANG on the rig: the wolf built with a skin hangs skinned copies on its body - the shared decoded texture untouched - while the person and a skinless wolf hang the cache\'s own (mutants: the skin on the person; the cache painted in place)', async () => {
  const run = async (opts) => {
    const uploads = [];
    const renderer = {
      gl: null, createCharacterMesh: () => ({ vao: {}, buffers: [] }), updateCharacterMesh: () => {},
      renderCharacterSprite: () => ({ tex: {} }), drawScreenOverlayQuad: () => {}, drawCharacterSpriteQuad: () => {},
      createParticleEffect: () => ({}), createCharacterTexture: (mips) => { uploads.push(mips); return { mips }; },
    };
    const arm = createFpArm();
    arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0 }));
    const res = await arm.build({ race: 'fprace', deps: werewolfBodyDeps().deps, ...opts });
    assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
    const entry = res.textures.get('tx_fixture.tga');
    assert.ok(entry?.image?.mips?.length, 'the fixture texture decoded');
    const keep = entry.image.mips[0].rgba.slice();
    arm.update(1 / 60);
    assert.ok(uploads.length > 0, 'the first frame hung the textures');
    return { uploads, entry, keep };
  };
  const wolf = await run({ werewolf: true, skin: 'shadowfang' });
  assert.ok(wolf.uploads.every((m) => m !== wolf.entry.image.mips), 'a copy on the wolf');
  const m0 = wolf.entry.image.mips[0];
  assert.deepEqual(wolf.uploads[0][0].rgba, shadowFangPixels(m0.rgba, m0.width, m0.height), 'in Shadow Fang');
  assert.deepEqual(m0.rgba, wolf.keep, 'the cache\'s texture - every rig\'s - is untouched');
  const man = await run({ skin: 'shadowfang' });
  assert.ok(man.uploads.every((m) => m === man.entry.image.mips), 'the person wears the texture as it is, whatever skin the opts carry');
  const plain = await run({ werewolf: true });
  assert.ok(plain.uploads.every((m) => m === plain.entry.image.mips), 'a wolf with no skin is Bloodmoon\'s own');
  const f = rd('src/combat/fpArm.js');
  assert.match(f, /hangRangeTextures\(thirdMesh\.ranges, t\.textures, \{ skin: bodySkin\(\) \}\);/, 'the third-person body');
  assert.match(f, /hangRangeTextures\(mesh\.ranges, built\.textures, \{ skin: bodySkin\(\) \}\);/, 'the first-person arms');
  assert.match(f, /hangRangeTextures\(mesh\.ranges, collectArmTextures\(pieces, archives, gen\)\);/, 'an item\'s icon wears no skin');
});

test('SHADOW-FANG whose skin: my own is the account service\'s last word on this device, kept on the stored session (a token\'s glyphs, a wardrobe\'s) and read offline; a peer\'s is the glyphs the relay read off their token, and the skin is part of which body they are (mutants: the glyphs not kept; a list rewritten unchanged; the peer\'s skin left off the key)', () => {
  const store = new Map();
  let writes = 0;
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { writes++; store.set(k, v); }, removeItem: (k) => store.delete(k) };
  storage.setItem(SESSION_KEY, JSON.stringify({ id: 'acct-sf', name: 'SirMcMobdon', kind: 'linked', sessionId: 's', secret: 'x' }));
  assert.deepEqual(ownGlyphs(storage), [], 'none stated yet');
  assert.equal(ownWerewolfSkin(storage), null);
  writes = 0;
  assert.equal(adoptIdentity(storage, { name: 'SirMcMobdon', kind: 'linked', glyphs: ['shadowfang', 42] }), true);
  assert.equal(writes, 1);
  assert.deepEqual(storedSession(storage).glyphs, ['shadowfang'], 'strings only');
  assert.equal(storedSession(storage).secret, 'x', 'the credential untouched');
  assert.equal(ownWerewolfSkin(storage), 'shadowfang', 'and read back - offline');
  assert.equal(adoptIdentity(storage, { name: 'SirMcMobdon', kind: 'linked', glyphs: ['shadowfang'] }), false, 'nothing new, nothing written');
  assert.equal(writes, 1);
  adoptIdentity(storage, { glyphs: [] });
  assert.equal(ownWerewolfSkin(storage), null, 'a grant taken off is gone here too');
  assert.match(rd('src/ui/accountFlow.js'), /adoptIdentity\(storage, \{ name: r\.data\.account\?\.name, kind: r\.data\.account\?\.kind, glyphs: r\.data\.wardrobe\?\.glyphs \}\);/, 'the wardrobe states them');
  // my own werewolf, at the door
  const me = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: 1 }] };
  assert.equal('skin' in armBuildOptsOf(me), true);
  assert.equal(armBuildOptsOf({ ...me, activeEffects: [] }).skin, null, 'a person wears none');
  // a peer's
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  assert.equal(peerBuildOpts(LOOK, { wb: 1 }, ['shadowfang']).skin, 'shadowfang');
  assert.equal('skin' in peerBuildOpts(LOOK, { wb: 1 }, ['dev']), false, 'a wolf with no skin carries no key');
  assert.equal('skin' in peerBuildOpts(LOOK, { wb: 0 }, ['shadowfang']), false, 'the person wears none');
  assert.notEqual(peerBodyKey(LOOK, { wb: 1 }, ['shadowfang']), peerBodyKey(LOOK, { wb: 1 }, []), 'the skin is part of which body');
  assert.equal(peerBodyKey(LOOK, { wb: 0 }, ['shadowfang']), peerBodyKey(LOOK, { wb: 0 }, []), 'and nothing of the person\'s');
});
