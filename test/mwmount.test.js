// MW-MOUNT (2026-09-26, Mac, over the house's hung weapons and displayed armour: "Morrowind models if activated should
// show"): A DISPLAYED ITEM HANGS AS ITS MORROWIND PICTURE while a build stands. The picture is the icon's own record
// (the one item map: a weapon's type and material, an armour's template and material - so a Daedric blade is
// Morrowind's daedric one), its ground mesh rendered FACE-ON at its own size (combat/fpArm.js mountFrame, mountPicture)
// rather than the icon's three-quarter view, since it hangs flat on a surface. The room and the decorator's ghost ask
// the same door (scenes/decorRoom.js loadMountPicture), the pack's dyed picture standing wherever there is none, and
// the room asks again when a build lands or goes (fpArm.js mountPictureStamp).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { createFpArm, mountFrame, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { CHAR_SPRITE_RT_SIZE } from '../src/render/renderer.js';
import { multiply, transformPoint } from '../src/world/mat4.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { createDecorRoom, loadMountPicture, loadMwMountArt, decorMountQuad, decorMountFloats } from '../src/scenes/decorRoom.js';
import { decorMountItem, decorMountDye, decorMountDyeTarget } from '../src/systems/decorItems.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { settle, all, one, rows, toolRig } from './decorFakes.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── the frame ────────────────────────────────────────────────────────

test('MW-MOUNT: mountFrame looks along the box\'s THINNEST extent with its LONGEST upright - orthographic, the whole box inside the picture with a little air, a texel square, the long side the asked pixels within the sprite target (mutants: the thin axis missed, the long axis sideways, the air lost, the cap ignored)', () => {
  const box = { minX: -0.05, maxX: 0.05, minY: -0.1, maxY: 1.1, minZ: 0.3, maxZ: 0.32 };   // a blade: 10 cm wide, 1.2 m long, 2 cm thick
  const fr = mountFrame(box, 256);
  assert.ok(near(fr.w, 0.1 * 1.04) && near(fr.h, 1.2 * 1.04), `the picture's extent in metres, the long one its height (${fr.w} x ${fr.h})`);
  assert.deepEqual([fr.ph, fr.pw], [256, Math.round((256 * 0.1) / 1.2)], 'the long side the asked pixels, the other in proportion');
  const clip = multiply(fr.proj, fr.view);
  const corners = [];
  for (const x of [box.minX, box.maxX]) for (const y of [box.minY, box.maxY]) for (const z of [box.minZ, box.maxZ]) corners.push(transformPoint(clip, x, y, z));
  assert.ok(corners.every((c) => Math.abs(c[0]) <= 1 / 1.04 + 1e-6 && Math.abs(c[1]) <= 1 / 1.04 + 1e-6), 'every corner inside, with air');
  assert.ok(near(Math.max(...corners.map((c) => c[1])), 1 / 1.04, 1e-5), 'the length fills the height');
  assert.ok(near(Math.max(...corners.map((c) => c[0])), 1 / 1.04, 1e-5), 'the width fills the width');
  const top = transformPoint(clip, 0, 1.1, 0.31), foot = transformPoint(clip, 0, -0.1, 0.31);
  assert.ok(top[1] > foot[1], 'upright: the box\'s top end up the picture');
  const front = transformPoint(clip, 0, 0.5, 0.32), back = transformPoint(clip, 0, 0.5, 0.3);
  assert.ok(near(front[0], back[0]) && near(front[1], back[1]), 'seen along its thickness - face-on, nothing of its edge');
  assert.equal(fr.proj[11], 0, 'orthographic');
  assert.ok(corners.every((c) => c[2] > -1 && c[2] < 1), 'and between the planes');
  // lying along X: the length still up the picture
  const lying = mountFrame({ minX: 0, maxX: 2, minY: 0, maxY: 0.02, minZ: 0, maxZ: 0.4 }, 300);
  assert.ok(near(lying.h, 2 * 1.04) && near(lying.w, 0.4 * 1.04));
  assert.deepEqual([mountFrame(box, 8000).ph, mountFrame(box, 1).ph, mountFrame(box, 1).pw], [CHAR_SPRITE_RT_SIZE, 8, 8], 'within the sprite target, and never under eight');
});

// ── the rig's picture ────────────────────────────────────────────────

/** A Morrowind BSA v0x100 (mwload_fparm.test.js's writer): lazy when opened off a Blob, so a read before its load throws. */
function makeBsa(files) {
  const names = [...files.keys()];
  const enc = new TextEncoder();
  const nameBytes = names.map((n) => enc.encode(n.replace(/\//g, '\\')));
  let nameBufSize = 0;
  const nameOffsets = [];
  for (const nb of nameBytes) { nameOffsets.push(nameBufSize); nameBufSize += nb.length + 1; }
  const dirSize = 12 * names.length + nameBufSize;
  const dataSize = names.reduce((a, n) => a + files.get(n).length, 0);
  const out = new Uint8Array(12 + dirSize + 8 * names.length + dataSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x100, true); dv.setUint32(4, dirSize, true); dv.setUint32(8, names.length, true);
  let o = 12, off = 0;
  for (const n of names) { dv.setUint32(o, files.get(n).length, true); dv.setUint32(o + 4, off, true); o += 8; off += files.get(n).length; }
  for (const no of nameOffsets) { dv.setUint32(o, no, true); o += 4; }
  for (const nb of nameBytes) { out.set(nb, o); o += nb.length; out[o++] = 0; }
  o += 8 * names.length;
  for (const n of names) { out.set(files.get(n), o); o += files.get(n).length; }
  return out;
}
const weap = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
const STAFF = 115;   // Staff -> BluntTwoWide
const staff = (material) => ({ group: 'Weapons', templateIndex: STAFF, material, variant: 0, artifact: false });
const WEAP_ESM = Uint8Array.from([
  ...weap('iron staff', 'w/weapon.nif', MW_WEAPON_TYPE.BluntTwoWide),
  ...weap('daedric staff', 'w/daedric_staff.nif', MW_WEAPON_TYPE.BluntTwoWide),   // a mesh the build never loads
]);
const ARCHIVE = makeBsa(new Map([
  [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpweapon.kf')],
  ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ['meshes/w/weapon.nif', f('weapon.nif')], ['meshes/w/daedric_staff.nif', f('weapon.nif')],
  ['textures/tx_fixture.dds', f('fixture.dds')],
]));

async function rig() {
  const archive = await MwBsaFile.open(new Blob([ARCHIVE]));
  const renders = [];
  const renderer = {
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSpriteImage: (mesh, model, proj, view, w, h) => { renders.push({ proj, view, w, h }); return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
  };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  const deps = {
    loadMorrowindArchives: async () => [archive],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? WEAP_ESM : f('armfp.esm')),
  };
  return { arm, archive, renders, build: () => arm.build({ race: 'fprace', weapon: staff(WEAPON_MATERIALS.Iron), deps }) };
}

test('MW-MOUNT: fpArm.mountPicture is the item\'s own Morrowind record face-on - its material\'s record, its mesh LOADED before it is read (a lazy archive throws otherwise), `{ key, image, w, h }` with w/h in metres and the texel square; cached per record and size; null with no build or no record; the stamp is the build\'s (mutants: the material ignored, the load skipped, the cache per call, the three-quarter view)', async () => {
  const { arm, archive, renders, build } = await rig();
  assert.equal(await arm.mountPicture(staff(WEAPON_MATERIALS.Iron)), null, 'no build: the pack\'s picture stands');
  assert.equal(arm.mountPictureStamp(), null);
  const res = await build();
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  const stamp = arm.mountPictureStamp();
  assert.ok(stamp, 'a build stands');
  assert.equal(archive.loaded('meshes/w/daedric_staff.nif'), false, 'the Daedric staff\'s mesh is not in hand');
  const dae = await arm.mountPicture(staff(WEAPON_MATERIALS.Daedric));
  assert.ok(dae, 'the Daedric staff pictured - its mesh loaded first, or the lazy archive would have thrown');
  assert.equal(archive.loaded('meshes/w/daedric_staff.nif'), true);
  assert.match(dae.key, /^mount:.*:daedric staff:256$/, 'its material\'s own record');
  const r = renders.at(-1);
  assert.deepEqual([dae.image.width, dae.image.height], [r.w, r.h], 'the picture is the render');
  assert.equal(r.h, 256, 'the long side the asked pixels');
  assert.ok(Math.abs(r.w / r.h - dae.w / dae.h) < 8 / 256, 'a texel square');
  assert.ok(dae.w > 0 && dae.h >= dae.w && dae.h < 5, `its own size in metres (${dae.w.toFixed(3)} x ${dae.h.toFixed(3)})`);
  const look = [r.view[2], r.view[6], r.view[10]];   // the camera's own axis, in the pass frame
  assert.equal(look.filter((c) => Math.abs(c) > 1e-6).length, 1, `looking straight along one of the mesh's axes - face-on, never the icon's three-quarter view (${look.map((c) => c.toFixed(3))})`);
  assert.equal(r.proj[11], 0, 'orthographic');
  const iron = await arm.mountPicture(staff(WEAPON_MATERIALS.Iron));
  assert.match(iron.key, /:iron staff:256$/);
  assert.notEqual(iron.key, dae.key);
  const n = renders.length;
  assert.equal(await arm.mountPicture(staff(WEAPON_MATERIALS.Daedric)), dae, 'cached');
  assert.equal(renders.length, n, 'and not rendered again');
  const big = await arm.mountPicture(staff(WEAPON_MATERIALS.Daedric), { px: 512 });
  assert.deepEqual([big.image.height, big.key.endsWith(':512')], [512, true], 'another size is its own entry');
  assert.equal(await arm.mountPicture({ group: 'Armor', templateIndex: 102, material: 0 }), null, 'no record of it: none');
  assert.equal(await arm.mountPicture({ group: 'Books', templateIndex: 0 }), null, 'nothing the item map reads: none');
  assert.equal(arm.mountPictureStamp(), stamp, 'the same build, the same stamp');
  arm.unload();
  assert.equal(arm.mountPictureStamp(), null, 'the build gone: the room hangs the pack\'s pictures again');
  assert.equal(await arm.mountPicture(staff(WEAPON_MATERIALS.Daedric)), null);
});

// ── the room's door ──────────────────────────────────────────────────

const PIC = { key: 'mount:1:daedric staff:256', image: { width: 2, height: 3, data: new Uint8ClampedArray([...Array(24).keys()]) }, w: 0.4, h: 1.6 };

function uploads() {
  const log = [];
  const textures = new Map();
  return {
    log, textures,
    uploadTexture(a, r, c, o = {}) { log.push({ a, r, rows: [...c.colors], width: c.width, height: c.height, o }); const k = `${a}_${r}`; if (!textures.has(k)) textures.set(k, `tex:${k}`); return textures.get(k); },
  };
}

test('MW-MOUNT: loadMwMountArt uploads the picture once under its own key - rows bottom-up as every upload reads them, no mip chain, no UI variant - answering its size in metres; none for no door, no picture, or a door that throws (mutants: the rows unflipped, the size the pixels, a throw escaping)', async () => {
  const renderer = uploads();
  const art = await loadMwMountArt({ mwPicture: async () => PIC, renderer }, { group: 'Weapons' });
  assert.deepEqual(art, { tex: `tex:mw-mount_${PIC.key}`, w: 0.4, h: 1.6 });
  const [u] = renderer.log;
  assert.deepEqual([u.a, u.r, u.width, u.height, u.o], ['mw-mount', PIC.key, 2, 3, { mips: false, variant: '' }]);
  assert.deepEqual(u.rows.slice(0, 8), [16, 17, 18, 19, 20, 21, 22, 23], 'the picture\'s bottom row first');
  assert.equal(await loadMwMountArt({ mwPicture: null, renderer }, { group: 'Weapons' }), null, 'no Morrowind: none');
  assert.equal(await loadMwMountArt({ mwPicture: async () => null, renderer }, { group: 'Weapons' }), null, 'no picture: none');
  assert.equal(await loadMwMountArt({ mwPicture: () => { throw new Error('boom'); }, renderer }, { group: 'Weapons' }), null, 'a door that throws: none');
  assert.equal(await loadMwMountArt({ mwPicture: async () => PIC, renderer }, null), null, 'no item: none');
});

test('MW-MOUNT: loadMountPicture asks the Morrowind door with the item the numbers name, and hangs the pack\'s dyed picture where it answers none (mutants: the classic first, the item unnamed, no fallback)', async () => {
  const d = { t: STAFF, g: 3, m: WEAPON_MATERIALS.Daedric, v: null, a: null, p: null };
  const asked = [];
  const classic = [];
  const renderer = uploads();
  const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 48 }), getScale: () => ({ width: 0, height: 0 }) };
  const deps = (mw) => ({
    mwPicture: async (item) => { asked.push(item); return mw; }, renderer,
    getTexture: async () => tex,
    uploadRecord: (a, r, o) => { classic.push([a, r, o]); renderer.textures.set(`${a}_${r}#ui_x`, 'tex:classic'); return '#ui_x'; },
  });
  const mw = await loadMountPicture(deps(PIC), [234, 12], d);
  assert.deepEqual(asked, [decorMountItem(d)], 'the item as the one item map reads it');
  assert.deepEqual([mw.tex, mw.w, mw.h, classic.length], [`tex:mw-mount_${PIC.key}`, 0.4, 1.6, 0], 'the Morrowind picture, and no classic upload');
  const back = await loadMountPicture(deps(null), [234, 12], d);
  const size = billboardSize(tex, 12);
  assert.deepEqual([back.tex, back.w, back.h], ['tex:classic', size.w, size.h], 'none: the pack\'s picture');
  assert.deepEqual(classic, [[234, 12, { mips: false, removeMask: true, dye: decorMountDye(d), dyeTarget: decorMountDyeTarget(d) }]], 'dyed');
});

test('MW-MOUNT: the room hangs a mount as its Morrowind picture at its own size, scaled; refreshMounts asks every mount again and re-hangs it where it stood - a build landing turns the room Morrowind, one going turns it back (mutants: the refresh a no-op, the old picture cached, a non-mount re-put)', async () => {
  let pic = null;
  const asked = [];
  const decals = [];
  const boards = [];
  const renderer = uploads();
  Object.assign(renderer, {
    createDecalBatch: (cap) => { const b = { cap, writes: [], draws: [], destroyed: false }; decals.push(b); return b; },
    writeDecalSlot: (b, slot, floats) => { b.writes.push([slot, Array.from(floats)]); return true; },
    drawDecals: (b, t) => { b.draws.push(t); },
    destroyDecalBatch: (b) => { b.destroyed = true; },
    createBillboardBatch: (a, r) => { boards.push([a, r]); return {}; }, destroyBillboardBatch: () => {}, drawMesh: () => {},
  });
  const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 48 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const origin = [100, 10, -50];
  const room = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() }, renderer,
    getTexture: async () => tex,
    uploadRecord: (a, r) => { renderer.textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`); return '#ui'; },
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => origin, roomLights: () => [],
    mwPicture: async (item) => { asked.push(item); return pic; },
  });
  const piece = { id: 'm1', model: null, flat: [234, 12], item: { t: STAFF, g: 3, m: WEAPON_MATERIALS.Daedric, v: null, a: null, p: null }, pos: [1, 1.5, 2], rot: [180, 0, 15], scale: 2, light: null, storage: false, paid: 0 };
  room.put(piece);
  room.put({ ...piece, id: 'f1', flat: [210, 3], item: null, rot: [0, 0, 0] });   // a candle on the table: it stands, it never hangs
  await settle();
  assert.deepEqual(boards, [[210, 3]], 'the candle a billboard');
  assert.equal(room.drawMounts(), 1);
  assert.deepEqual(decals[0].draws, ['tex:234.12'], 'no build: the pack\'s picture');
  const classic = billboardSize(tex, 12);
  assert.deepEqual(decals[0].writes.at(-1), [0, Array.from(decorMountFloats(decorMountQuad(piece, origin, { w: classic.w * 2, h: classic.h * 2 })))]);
  pic = PIC;   // a build landed
  room.refreshMounts();
  await settle();
  assert.equal(decals[0].destroyed, true, 'the old quad goes');
  assert.equal(room.drawMounts(), 1, 'one mount still');
  assert.deepEqual(decals.at(-1).draws, [`tex:mw-mount_${PIC.key}`], 'the Morrowind picture now');
  assert.deepEqual(decals.at(-1).writes.at(-1), [0, Array.from(decorMountFloats(decorMountQuad(piece, origin, { w: 0.4 * 2, h: 1.6 * 2 })))], 'at its own size in metres, scaled, where it stood');
  assert.equal(asked.length, 2, 'asked once per hanging');
  assert.deepEqual(boards, [[210, 3]], 'the candle left standing - only the mounts are asked again');
  pic = null;   // the build went
  room.refreshMounts();
  await settle();
  room.drawMounts();
  assert.deepEqual(decals.at(-1).draws.at(-1), 'tex:234.12', 'the pack\'s picture again');
});

test('MW-MOUNT: the decorator\'s ghost is the picture the room will hang - the Morrowind one while a build stands (mutants: the ghost the classic picture)', async () => {
  const rig = toolRig({ gold: 0, mwPicture: async () => PIC });
  rig.pack.push({ templateIndex: 120, group: 'Weapons', material: 7, stackCount: 1 });
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  all(root, 'dfdecor-chip').find((c) => /^Your things/.test(c.textContent)).fire('click');
  rows(root).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith('Ebony Longsword')).fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame(); await settle(); rig.frame();
  rig.state.normal = [0, 0, -1];
  rig.frame();
  const ghost = rig.tool.ghost();
  assert.deepEqual(rig.decals.at(-1).writes.at(-1), [0, Array.from(decorMountFloats(decorMountQuad(ghost, [10, 0, 10], { w: 0.4, h: 1.6 })))], 'hung at the Morrowind picture\'s size');
  assert.deepEqual([rig.tool.drawMounts(rig.renderer), rig.draws.at(-1)?.tex], [true, `tex:mw-mount_${PIC.key}`], 'and drawn with it');
});

// ── the host ─────────────────────────────────────────────────────────

test('MW-MOUNT: the host (worldModes.js) by source - the room and the ghost are handed the rig\'s mountPicture, and the room is refreshed when the build\'s stamp changes, before the mounts are drawn (mutants: the ghost without it, the refresh never asked)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /const decorMwPicture = \(item\) => fpArm\.mountPicture\(item\);/);
  assert.equal((m.match(/mwPicture: decorMwPicture,/g) ?? []).length, 2, 'the room and the tool');
  const at = m.indexOf('const mwStamp = fpArm.mountPictureStamp();');
  assert.ok(at > 0 && m.indexOf('if (mwStamp !== _decorMwStamp) { _decorMwStamp = mwStamp; interiorDecor.refreshMounts(); }', at) > at);
  assert.ok(at < m.indexOf('interiorDecor.drawMounts(renderer);', at), 'before the mounts are drawn');
  const t = src('src/scenes/decorTool.js');
  assert.match(t, /loadMountPicture\(\{ getTexture: deps\.getTexture, uploadRecord: deps\.uploadRecord, renderer, mwPicture: deps\.mwPicture \}, entry\.flat, entry\.item\)/);
});
