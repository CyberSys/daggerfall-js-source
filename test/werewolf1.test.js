// WEREWOLF1 — BLOODMOON'S WEREWOLF, IMPORTED (2026-09-26).
//
// Mac, of SirMcMobdon's werewolf skin: "it's the 3d model", "Might need to grab OpenMW for this", "Well it needs to
// be imported if its not. It shouldnt be skipped". The Morrowind rig had scoped the werewolf out (fpArm.js, rule 6);
// this is the werewolf OpenMW draws, read off its source (apps/openmw/mwrender/npcanimation.cpp, actorutil.cpp,
// mwmechanics/mechanicsmanagerimp.cpp):
//
//   - the skeletons are [Models] wolfskin / wolfskin1st (meshes/wolf/skin.nif, skin.1st.nif), whatever the race or
//     sex, through rule 18's x-swap;
//   - ONE animation source, the wolf's own .kf - the base (xbase_anim) is never added for a werewolf;
//   - getBodyParts answers nothing, so the body is the CLOT "werewolfrobe" setWerewolf equips in the Robe slot - its
//     part references at the robe's priority, its reserves beside them - with WerewolfHead and WerewolfHair looked up
//     by id in third person; in first person the robe takes addPartGroup's ".1st" ladder;
//   - the wolf holds nothing (unequipAll): no weapon, no torch, no lantern, no holster;
//   - the body follows the curse: the rig rebuilds as the wolf, and back, the moment the form changes - for the
//     player and for a peer whose pose says `wb` 1. The wereboar has no Morrowind form.
//
// No Bloodmoon data is in this container: the fixtures stand in for its files, under its own paths, and the
// law under test is which files are asked for and how they are dressed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countingRenderer, werewolfBodyDeps as wolfDeps } from './fixtures/mw/bodyRig.mjs';
import { buildFpArm, createFpArm, fpSkeletonPath, tpSkeletonPath, WOLFSKIN, WOLFSKIN_1ST, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { fpAnimSources, tpAnimSources, werewolfHeadRows, bodyParts, clothingRecords } from '../src/formats/mwFirstPerson.js';
import { correctActorModelPath } from '../src/formats/mwTexture.js';
import { composeWornArmor, firstPersonPartGroup, werewolfRobeOf, WEREWOLF_ROBE_ID, RESERVES, ARMO_PART, mwClothingRecord, DF_CLOTHING_ROWS, DF_CLOTHING_DYE_RGB } from '../src/formats/mwItemMap.js';
import { isMwWerewolf, armBuildOptsOf, armIdentityOf, armsStandFor } from '../src/combat/weaponRig.js';
import { PeerBodies, peerBuildOpts, peerBodyKey, peerIsWolf, BODY_REBUILD_MS } from '../src/net/peerBodies.js';
import { lookKey } from '../src/net/remotePlayers.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { createPeerRiders } from '../src/net/peerRiders.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 40) => { for (let i = 0; i < n; i++) await flush(); };

const transformed = (type) => ({ race: 'Breton', gender: 'male', faceIndex: 0, items: [], activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: type }] });

// ── THE FILES ASKED FOR ─────────────────────────────────────────────

test('WEREWOLF1 paths: the wolf\'s two skeletons whatever the race or the sex (getActorSkeleton tests the werewolf first), x-swapped when the wolf\'s .kf is there, and ONE animation source each - the wolf\'s own, never the base (mutants: the base kept; the beast column asked first)', () => {
  assert.equal(WOLFSKIN, 'meshes/wolf/skin.nif', '[Models] wolfskin');
  assert.equal(WOLFSKIN_1ST, 'meshes/wolf/skin.1st.nif', '[Models] wolfskin1st');
  for (const o of [{}, { female: true }, { beast: true }, { female: true, beast: true }]) {
    assert.equal(fpSkeletonPath({ ...o, werewolf: true }), WOLFSKIN_1ST, JSON.stringify(o));
    assert.equal(tpSkeletonPath({ ...o, werewolf: true }), WOLFSKIN, JSON.stringify(o));
  }
  assert.equal(fpSkeletonPath({}), 'meshes/xbase_anim.1st.nif', 'a person keeps the table');
  const has = new Set(['meshes/wolf/xskin.kf', 'meshes/wolf/xskin.1st.kf', 'meshes/xbase_anim.kf', 'meshes/xbase_anim.1st.kf']);
  const exists = (p) => has.has(p);
  assert.equal(correctActorModelPath(WOLFSKIN, exists), 'meshes/wolf/xskin.nif', 'rule 18: the x-form, its .kf being there');
  assert.equal(correctActorModelPath(WOLFSKIN_1ST, exists), 'meshes/wolf/xskin.1st.nif');
  assert.deepEqual(tpAnimSources('meshes/wolf/xskin.nif', exists, { werewolf: true }), ['meshes/wolf/xskin.kf'], 'the wolf\'s own .kf alone - xbase_anim.kf is there and is not taken');
  assert.deepEqual(fpAnimSources('meshes/wolf/xskin.1st.nif', exists, { werewolf: true }), ['meshes/wolf/xskin.1st.kf']);
  assert.deepEqual(tpAnimSources('meshes/xbase_anim.nif', exists), ['meshes/xbase_anim.kf'], 'a person: the base, as before');
  assert.deepEqual(fpAnimSources('meshes/wolf/xskin.1st.nif', exists), ['meshes/xbase_anim.1st.kf', 'meshes/wolf/xskin.1st.kf'], '(the base is exactly what the flag takes away)');
});

// ── THE BODY: THE ROBE, THE HEAD AND THE HAIR ───────────────────────

test('WEREWOLF1 the robe: "werewolfrobe" is found by id, the last .esm winning; composed as a garment handed in whole - its references at the robe\'s priority (24) and its eleven reserves - it IS the body; the head and hair are WerewolfHead and WerewolfHair by id alone (mutants: the robe\'s reserves dropped; the head filtered by race)', () => {
  const fx = wolfDeps();
  const parts = bodyParts(fx.esm);
  const clothes = clothingRecords(fx.esm);
  const robe = werewolfRobeOf(clothes);
  assert.equal(WEREWOLF_ROBE_ID, 'werewolfrobe');
  assert.equal(robe?.id, 'werewolfrobe', 'case-folded, as every record id');
  assert.deepEqual(robe.parts.map((p) => p.part), [6, 7, 13, 14, 3]);
  const later = { ...robe, parts: [] };
  assert.equal(werewolfRobeOf([robe, { id: 'other' }, later]), later, 'the last .esm to carry it wins');
  assert.equal(werewolfRobeOf([{ id: 'common_robe_01' }]), null);
  const worn = composeWornArmor({ pieces: [{ kind: 'record', record: robe, reserve: 'robe' }], armors: [], clothes: [], bodyPool: parts, female: false });
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.model]), [
    ['cuirass', 'fixture/wolfchest.nif'], ['right hand', 'fixture/wolfhand.nif'], ['left hand', 'fixture/wolfhand.nif'],
    ['right upper arm', 'fixture/wolfarm.nif'], ['left upper arm', 'fixture/wolfarm.nif'],
  ], 'the robe\'s references, in slot order, third person: the plain records');
  for (const part of RESERVES.robe) assert.ok(worn.shadows.includes(ARMO_PART[part].shadows ?? '') || !ARMO_PART[part].shadows, `reserve ${ARMO_PART[part].name} hides its skin`);
  assert.ok(worn.shadows.includes('groin') && worn.shadows.includes('knee:right'), 'the robe\'s reserves hide what it does not name');
  assert.ok(!worn.shadows.includes('head') && !worn.shadows.includes('hair'), 'the head and hair are the wolf\'s own');
  assert.deepEqual(werewolfHeadRows(parts).map((r) => [r.slot, r.record?.model ?? null]), [['head', 'fixture/wolfhead.nif'], ['hair', 'fixture/wolfhair.nif']],
    'by id (the record says race "werewolf" and the actor is anybody)');
  assert.deepEqual(werewolfHeadRows([]).map((r) => r.record), [null, null], 'no Bloodmoon, no head');
});

test('WEREWOLF1 first person: addPartGroup\'s own ladder - a part\'s ".1st" record first, else the plain one only for a hand, wrist, forearm or upper arm, else the slot reserved empty; a woman\'s CNAM before the BNAM (mutants: the plain record taken for a chest; the .1st ignored)', () => {
  const fx = wolfDeps();
  const parts = bodyParts(fx.esm);
  const robe = werewolfRobeOf(clothingRecords(fx.esm));
  const fp = firstPersonPartGroup(robe, parts, false);
  assert.deepEqual(fp.adds.map((a) => [a.partName, a.model]), [
    ['right hand', 'fixture/wolfhand1st.nif'], ['left hand', 'fixture/wolfhand1st.nif'],
    ['right upper arm', 'fixture/wolfarm.nif'], ['left upper arm', 'fixture/wolfarm.nif'],
  ], 'the hand\'s .1st record; the upper arm\'s plain one (an arm part may fall back)');
  assert.deepEqual(fp.reserved, [3], 'the chest has no .1st record and is not an arm part: held, with nothing in it');
  const her = { id: 'x', parts: [{ part: 6, male: 'wolf_upperarm', female: 'wolf_hand' }] };
  assert.equal(firstPersonPartGroup(her, parts, true).adds[0].model, 'fixture/wolfhand1st.nif', 'a woman: her CNAM, its .1st');
  assert.equal(firstPersonPartGroup(her, parts, false).adds[0].model, 'fixture/wolfarm.nif', 'a man: the BNAM');
  assert.deepEqual(firstPersonPartGroup(null, parts).adds, [], 'no robe, nothing');
});

// ── THE BUILD ───────────────────────────────────────────────────────

test('WEREWOLF1 the build: the wolf\'s skeletons and .kf in both views, the robe\'s parts (first person through the .1st ladder), the head and hair by id, and nothing of the person - no race parts, no weapon, no torch, no lantern, no holster, no base animation (mutants: the race rows kept; the weapon kept; the base .kf added)', async () => {
  const fx = wolfDeps();
  const res = await buildFpArm({ race: 'fprace', werewolf: true, torch: true, hipLight: true, sheathing: true, deps: fx.deps });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  assert.equal(res.werewolf, true);
  assert.equal(res.settingsSkeleton, WOLFSKIN_1ST);
  assert.equal(res.skeletonPath, 'meshes/wolf/xskin.1st.nif');
  assert.deepEqual(res.sources.map((s) => s.name), ['meshes/wolf/xskin.1st.kf'], 'one source, the wolf\'s');
  assert.equal(res.weapon, null, 'the wolf holds nothing');
  assert.equal(res.torch ?? null, null);
  const t = res.third;
  assert.equal(t?.ok, true, `the wolf in third person (${t?.stage}: ${t?.error})`);
  assert.equal(t.werewolf, true);
  assert.equal(t.skeletonPath, 'meshes/wolf/xskin.nif');
  assert.deepEqual(t.sourcePaths, ['meshes/wolf/xskin.kf']);
  assert.deepEqual(t.rows.map((r) => [r.slot, r.record?.id]), [['head', 'WerewolfHead'], ['hair', 'WerewolfHair']]);
  assert.equal(t.weapon, null); assert.equal(t.torch ?? null, null); assert.equal(t.hipLight ?? null, null); assert.equal(t.holster ?? null, null);
  assert.deepEqual(t.boneSources, [], 'no addons - the base model\'s are not the wolf\'s');
  assert.equal(t.hipLightTried, false, 'the lantern it was asked for was never asked of the wolf');
  assert.equal(t.sheathing, false, 'nor the holster');
  // what was READ says what was taken
  for (const p of ['meshes/wolf/xskin.1st.nif', 'meshes/wolf/xskin.nif', 'meshes/wolf/xskin.1st.kf', 'meshes/wolf/xskin.kf',
    'meshes/fixture/wolfhand1st.nif', 'meshes/fixture/wolfarm.nif', 'meshes/fixture/wolfhand.nif', 'meshes/fixture/wolfchest.nif']) {
    assert.ok(fx.reads.has(p), `${p} was read`);
  }
  for (const p of ['meshes/fixture/humanhand.nif', 'meshes/fixture/humanarm.nif', 'meshes/xbase_anim.kf', FP_CLIP_PATH, 'meshes/xbase_anim.1st.nif', 'meshes/xbase_anim.nif']) {
    assert.ok(!fx.reads.has(p), `${p} is the person's, and was not read`);
  }
  // the person, from the same data, is untouched
  const man = await buildFpArm({ race: 'fprace', deps: wolfDeps().deps });
  assert.equal(man.ok, true); assert.equal(man.werewolf, false);
  assert.equal(man.skeletonPath, 'meshes/xbase_anim.1st.nif');
});

test('WEREWOLF1 without Bloodmoon: the wolf is refused at its skeleton, by name - the transformed player then stands as Eye Of The Beholder\'s lycanthrope and the classic claws, as before; a missing robe is a note, and the wolf\'s parts are its head alone (mutants: a person silently built in the wolf\'s place)', async () => {
  const none = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ wolf: false }).deps });
  assert.equal(none.ok, false);
  assert.equal(none.stage, 'skeleton');
  assert.match(none.error, /meshes\/wolf\/skin\.1st\.nif is not in your archives/);
  const bare = await buildFpArm({ race: 'fprace', werewolf: true, deps: wolfDeps({ robe: false }).deps });
  assert.equal(bare.ok, false, 'no robe: no first-person mesh at all');
  assert.equal(bare.stage, 'parts');
  assert.match(bare.error, /werewolf/);
  assert.ok(bare.notes.some((n) => /werewolfrobe: no CLOT record carries it - Bloodmoon\.esm does/.test(n)), bare.notes.join(' | '));
});

// ── THE RIG FOLLOWS THE CURSE ───────────────────────────────────────

test('WEREWOLF1 the rig: setWerewolf rebuilds as the wolf and back, once per change (a boolean compare otherwise); the wolf wears none of the worn table and holds no light - kept for the way back; a wolf refused can still turn back (mutants: the compare dropped; the table rebuilt on the wolf; the refusal a dead end)', async () => {
  const fx = wolfDeps();
  const arm = createFpArm();
  arm.attach(countingRenderer(), () => null);
  const first = await arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(first.ok, true, `${first.stage}: ${first.error}`);
  assert.equal(arm.builtFor().werewolf, false);
  const opened = fx.opened;
  assert.equal(arm.setWerewolf(false), false, 'no change, no build');
  const became = await arm.setWerewolf(true);
  assert.equal(became.ok, true, `${became.stage}: ${became.error}`);
  assert.equal(arm.builtFor().werewolf, true, 'the wolf stands');
  assert.equal(fx.opened, opened + 1, 'one build');
  assert.equal(arm.setWerewolf(true), false, 'the fast path');
  assert.equal(arm.setWorn([{ kind: 'clothing', templateIndex: 0 }]), false, 'the wolf wears none of it');
  assert.equal(fx.opened, opened + 1, 'and is not rebuilt for it');
  assert.equal(arm.setTorch(true), false, 'nor holds a torch');
  const back = await arm.setWerewolf(false);
  assert.equal(back.ok, true);
  assert.equal(arm.builtFor().werewolf, false, 'the person again');
  // refused: no Bloodmoon - and still the way back
  const none = wolfDeps({ wolf: false });
  const lone = createFpArm();
  lone.attach(countingRenderer(), () => null);
  assert.equal((await lone.build({ race: 'fprace', deps: none.deps })).ok, true);
  const refused = await lone.setWerewolf(true);
  assert.equal(refused.ok, false, 'the wolf refused');
  assert.equal(lone.active(), false, 'nothing of Morrowind stands - the sprite and the claws do');
  assert.equal(lone.setWerewolf(true), false, 'and it is not asked again every frame');
  assert.equal((await lone.setWerewolf(false)).ok, true, 'the person comes back');
});

test('WEREWOLF1 the weapon rig: the werewolf is a transformed lycanthrope whose curse is the wolf\'s (the wereboar has no Morrowind form); it rides the build options and the identity, and every frame hands the rig the form ahead of the worn table (mutants: the wereboar taken for a wolf; the per-frame door dropped)', () => {
  assert.equal(isMwWerewolf(transformed(1)), true);
  assert.equal(isMwWerewolf(transformed(2)), false, 'the wereboar');
  assert.equal(isMwWerewolf({ ...transformed(1), activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: false, infectionType: 1 }] }), false, 'cursed, not transformed');
  assert.equal(isMwWerewolf(null), false);
  assert.equal(armBuildOptsOf(transformed(1)).werewolf, true, 'a save loaded mid-transformation builds the wolf at the door');
  assert.equal(armIdentityOf(transformed(1)).werewolf, true);
  const want = armIdentityOf(transformed(1));
  assert.equal(armsStandFor(transformed(1), { ready: () => true, builtFor: () => ({ ...want, werewolf: false }) }), false, 'the person standing is not the wolf\'s arm');
  assert.equal(armsStandFor(transformed(1), { ready: () => true, builtFor: () => want }), true);
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /if \(entity\) \{ const wolf = isMwWerewolf\(entity\); fpArm\.setWerewolf\(wolf, \{ skin: wolf \? ownWerewolfSkin\(\) : null \}\); \}[^\n]*\n\s*if \(entity\) fpArm\.setWorn\(/, 'every frame, ahead of the worn table');
});

// ── THE PEERS ───────────────────────────────────────────────────────

const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [{ templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand }] };   // a sword in the person's hand
const pose = (over = {}) => ({ x: 0, y: 0, z: 0, yaw: 0, mv: 0, ...over });

test('WEREWOLF1 a peer: the pose\'s `wb` 1 builds the wolf (holding nothing), keyed apart from the person so the form change rebuilds AT ONCE and a wolf refused is waited out as a wolf; the wereboar is the person\'s key, and never a wolf (mutants: the form change held for BODY_REBUILD_MS; the wereboar built as a wolf)', async () => {
  assert.equal(peerIsWolf({ wb: 1 }), true); assert.equal(peerIsWolf({ wb: 2 }), false); assert.equal(peerIsWolf(null), false);
  const o = peerBuildOpts(LOOK, { wb: 1 });
  assert.equal(o.werewolf, true); assert.equal(o.weapon, null, 'the sword in the look is not the wolf\'s');
  assert.equal(peerBuildOpts(LOOK, { wb: 0 }).weapon?.templateIndex, 120, 'the person holds it');
  assert.equal('werewolf' in peerBuildOpts(LOOK, { wb: 2 }), false, 'the wereboar: the person\'s opts, unchanged');
  assert.equal(peerBodyKey(LOOK, { wb: 0 }), lookKey(LOOK), 'a person\'s key is the look\'s own');
  assert.notEqual(peerBodyKey(LOOK, { wb: 1 }), lookKey(LOOK));
  assert.equal(peerBodyKey(LOOK, { wb: 2 }), lookKey(LOOK));
  // the body layer, with a fake rig
  const built = [];
  let now = 1000;
  const rigs = [];
  const createRig = () => {
    const r = { opts: null, attach() {}, async build(opts) { r.opts = opts; built.push(opts); await flush(); return { ok: true }; },
      canThirdPerson: () => true, setViewMode: () => true, update() {}, thirdActive: () => true, drawThird: () => true, unload() { r.unloaded = true; },
      raceHeightScale: () => 1, setSheathed() {}, setWeapon(w) { r.weapon = w; return true; }, readySpell(s) { r.spell = s; }, setHipLight(l) { r.hip = l; }, release() {}, upperBodyReady: () => true };
    rigs.push(r); return r;
  };
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => now });
  const peer = (wb) => ({ id: 'wolf', name: 'SirMcMobdon', look: LOOK, shown: pose(wb ? { wb, wd: 1, lh: 0, sr: 1, hl: 1 } : {}), glyphs: ['shadowfang'] });
  pb.sync([peer(0)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  await settle();
  assert.equal(built.at(-1).werewolf, undefined, 'the person first');
  now += 50;   // well inside BODY_REBUILD_MS
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  await settle();
  assert.ok(50 < BODY_REBUILD_MS);
  assert.equal(built.at(-1).werewolf, true, 'the wolf, at once - not after BODY_REBUILD_MS');
  assert.equal(built.at(-1).weapon, null);
  const wolfRig = rigs.at(-1);
  pb.sync([peer(1)], (p) => [p.x, p.y, p.z], 0.016, [0, 0, 0]);
  assert.equal(wolfRig.weapon ?? null, null, 'the wolf\'s hands are claws');
  assert.equal(wolfRig.spell, false, 'it readies no spell');
  assert.equal(wolfRig.hip, false, 'and hangs no lantern');
});

test('WEREWOLF1 the host: a werewolf on foot goes to the bodies (so its wolf builds while the rider layer\'s lycanthrope stands for it), and the rider layer skips a beast on foot whose wolf stands; a mounted beast and the wereboar stay the rider layer\'s (mutants: the skip dropped; the wolf kept out of the bodies)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /peerRiders\.sync\(drawable, onlineToScene, \{ eye: cam\.pos, right: \[Math\.cos\(cam\.yaw\), 0, -Math\.sin\(cam\.yaw\)\], dt, skip: \(id\) => peerBodies\.heightOf\(id\) > 0 \}\);/);
  assert.match(w, /const afoot = drawable\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\) && !d\.shown\?\.wb \|\| \(peerIsWolf\(d\.shown\) && !d\.shown\.rd\)\);/);
  // the rider layer's own door
  const placed = [];
  const riders = createPeerRiders({ renderer: {}, urlFor: () => null, decode: async () => null, art: null });
  const peers = [
    { id: 'wolf', shown: pose({ wb: 1 }) }, { id: 'boar', shown: pose({ wb: 2 }) }, { id: 'rider', shown: pose({ wb: 1, rd: 1 }) },
  ];
  riders.sync(peers, (p) => { placed.push(p); return [p.x, p.y, p.z]; }, { skip: (id) => id === 'wolf' || id === 'rider' });
  assert.equal(riders.riders.has('wolf'), false, 'the wolf standing in a body is not the rider layer\'s');
  assert.equal(riders.riders.has('rider'), true, 'a mounted beast is - the skip is for a beast on foot');
  assert.equal(riders.riders.has('boar'), true, 'and the wereboar, whose body never stands, stays the layer\'s');
});

test('WEREWOLF1 the robe is not a garment: a Daggerfall robe never resolves to "werewolfrobe", whatever its dye measures - its parts are the wolf\'s body (mutant: the pool left open)', () => {
  const robe = { id: 'werewolfrobe', type: 4, enchanted: false, parts: [] };
  const common = { id: 'common_robe_01', type: 4, enchanted: false, parts: [] };
  const name = Object.keys(DF_CLOTHING_ROWS).find((n) => DF_CLOTHING_ROWS[n].reserve === 'robe' && DF_CLOTHING_ROWS[n].type === 4);
  assert.ok(name, 'a Daggerfall robe row');
  assert.equal(mwClothingRecord([robe], name).record, null, 'the wolf\'s robe alone: no garment');
  assert.equal(mwClothingRecord([robe, common], name, { dye: 0, colourOf: (c) => (c.id === 'werewolfrobe' ? DF_CLOTHING_DYE_RGB[0] : [255, 255, 255]) }).record, common, 'even measured exactly the dye\'s colour');
});
