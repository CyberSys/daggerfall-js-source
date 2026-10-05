// AUDIT VE (2026-10-05, Mac: "Audit this. Ensure this is on by default. And performance isn't affected") - the audit of
// Vanilla Enhanced, VE1-VE4 (`01-Overview/Audit-VE.md`). Every pin here fails on the code as it stood before its fix:
//   D1 - THE DEFAULT: the shipped Base is on until the player chooses otherwise, its add-ons off; a choice either way is
//        kept, through a boot and under a copy the player attaches.
//   P1 - THE DECODE OFF THE MAIN THREAD: the shipped pack's fetch, decode and texture-detail fit run in a worker
//        (systems/vanillaEnhancedDecodeWorker.js); a browser that cannot falls back to this thread, and a worker that
//        dies is never asked again - an ask must not wait for ever.
//   P2 - THE GROUND CACHE IS BOUNDED: three decoded tile sets, the least recently asked let go.
// The mutants are tools/mutants/auditve.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, dfmodEnabled, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF, GROUND_CACHE_SETS,
  dfmodGroundLayers, _resetDfmodForTests,
} from '../src/systems/dfmodTextures.js';
import { VE_PACK_MODS, ON_BY_DEFAULT, vePackClient, vePackUrl, installVanillaEnhancedPack, _setVePackIoForTests } from '../src/systems/vanillaEnhancedPack.js';
import { mipFitSize } from '../src/formats/resample.js';
import { clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { wearVanillaEnhanced, wearClassicTextures, veWorn, VE_ADDONS_PREF } from '../src/systems/vanillaEnhanced.js';
import { setValue } from '../src/systems/settings.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';

const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const enc = (t) => new TextEncoder().encode(t);

function fresh() {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  setPref(VE_ADDONS_PREF, []);
  clearTextureReplacements();
  _setVePackIoForTests({ fetch: async (u) => enc(u), decode: async () => ({ width: 1, height: 1, data: new Uint8Array(4) }) });
}
const states = () => attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]);

// ---- D1 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE D1: the shipped Base is ON by default and its add-ons OFF - no choice on the shelf, the default answers; a choice either way is the player\'s and outlives a boot; Classic\'s choice holds (mutants: the Base off by default; the default ignored; a choice ignored; an off not kept)', async () => {
  fresh();
  assert.deepEqual([...ON_BY_DEFAULT], ['base'], 'Mac: "Ensure this is on by default" - the Base; its add-ons are picked on the card');
  installVanillaEnhancedPack();
  assert.deepEqual(states(), [[BASE, true, true], [MASKED, true, false], [SNOWLESS, true, false]]);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), {}, 'a default writes nothing');
  assert.ok(veWorn(), 'a fresh game wears it: Replace Game Artwork is on by default (DFU\'s own)');
  setDfmodEnabled([BASE, MASKED], false);
  setDfmodEnabled(SNOWLESS, true);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: false, [MASKED]: false, [SNOWLESS]: true });
  await setDfmodSources([], async () => null);   // a boot
  assert.deepEqual(states(), [[BASE, true, false], [MASKED, true, false], [SNOWLESS, true, true]], 'the choices, through a boot');
  wearVanillaEnhanced();
  assert.equal(dfmodEnabled(BASE), true);
  wearClassicTextures();
  assert.deepEqual(states().map((s) => s[2]), [false, false, false], 'Classic switches the shipped off');
  _resetDfmodForTests();
  installVanillaEnhancedPack();
  assert.deepEqual(states().map((s) => s[2]), [false, false, false], 'and a new page keeps Classic - the off is a choice, not the default');
});

test('AUDIT VE D1: under a copy the player attaches, the shipped choice waits - the copy is an attached mod (on when attached); removed, the shipped Base returns as its own choice left it', async () => {
  fresh();
  installVanillaEnhancedPack();
  setDfmodEnabled(BASE, false);
  const store = new Map();
  const copy = {
    textAssets: [{ name: 'Vanilla Enhanced - Base.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Base', ModVersion: '3.5.0' }); } }],
    textures: [{ name: '302_0-0', width: 2, height: 2 }], arrays: [], rgba: async () => null, close() {},
  };
  const load = async (k) => store.get(k) ?? (k === BASE ? new Uint8Array([1]) : null);
  const opts = { open: async () => copy, saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false };
  await setDfmodSources([BASE], load, opts);
  assert.deepEqual(states()[0], [BASE, false, true], 'the attached copy, on');
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: false }, 'the shipped choice untouched');
  await setDfmodSources([], load, opts);
  assert.deepEqual(states()[0], [BASE, true, false], 'the shipped Base again, off as it was chosen');
});

// ---- P1 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE P1: the decode worker fetches, decodes, fits the picture to the texture detail as a mip chain would, and MOVES the pixels back; a browser without OffscreenCanvas there says so; a failed fetch is an error, not "unsupported" (mutants: no fit; the pixels copied, not moved; unsupported unsaid)', async () => {
  const saved = { onmessage: globalThis.onmessage, postMessage: globalThis.postMessage, fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  const posted = [];
  try {
    globalThis.postMessage = (msg, transfer) => posted.push({ msg, transfer });
    globalThis.fetch = async (url) => (/missing/.test(url) ? { ok: false, status: 404 } : { ok: true, blob: async () => new Blob([url.split('#')[1]]) });
    globalThis.createImageBitmap = async (blob) => { const [w, h] = (await blob.text()).split('x').map(Number); return { width: w, height: h, close() {} }; };
    globalThis.OffscreenCanvas = class {
      constructor(w, h) { this.w = w; this.h = h; }
      getContext() { return { drawImage() {}, getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) }) }; }
    };
    await import('../src/systems/vanillaEnhancedDecodeWorker.js');
    const ask = async (data) => { posted.length = 0; await globalThis.onmessage({ data }); return posted[0]; };
    let r = await ask({ id: 1, url: 'x#726x941', maxSize: 256 });
    assert.deepEqual([r.msg.id, r.msg.width, r.msg.height], [1, ...mipFitSize(726, 941, 256)], 'the tree at the texture detail');
    assert.equal(r.msg.data.length, r.msg.width * r.msg.height * 4);
    assert.deepEqual(r.transfer, [r.msg.data.buffer], 'moved, not copied');
    r = await ask({ id: 2, url: 'x#256x256', maxSize: Infinity });
    assert.deepEqual([r.msg.width, r.msg.height], [256, 256], 'whole when no detail is asked');
    r = await ask({ id: 3, url: 'missing#1x1' });
    assert.deepEqual([r.msg.id, r.msg.unsupported, /404/.test(r.msg.error)], [3, false, true]);
    globalThis.OffscreenCanvas = undefined;
    r = await ask({ id: 4, url: 'x#1x1' });
    assert.deepEqual([r.msg.id, r.msg.unsupported], [4, true], 'no OffscreenCanvas in a worker: the page decodes instead');
  } finally { Object.assign(globalThis, saved); }
});

/** A fake decode worker: answers each ask with a 1x1 picture whose red is `red`, or as `mode` says. */
function fakeWorkers(mode = 'ok') {
  const made = [];
  const factory = () => {
    const w = {
      asks: [], dead: false,
      postMessage(msg) {
        w.asks.push(msg);
        if (w.dead) return;   // a dead worker never answers
        setTimeout(() => w.onmessage({ data: mode === 'unsupported' ? { id: msg.id, error: 'no OffscreenCanvas in a worker', unsupported: true } : { id: msg.id, width: 1, height: 1, data: Uint8Array.of(77, 0, 0, 255) } }), 0);
      },
      terminate() { w.dead = true; },
    };
    made.push(w);
    return w;
  };
  return { factory, made };
}
const within = (p, ms = 500) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`still waiting after ${ms} ms`)), ms))]);

test('AUDIT VE P1: the shipped client asks its worker, not this thread; a worker that cannot (no OffscreenCanvas there) hands the decode back to this thread for good; a worker that died while idle is never asked again - the next ask is this thread\'s, never a wait for ever (mutants: the worker never asked; unsupported not falling back; a dead worker asked)', async () => {
  fresh();
  const mainThread = [];
  const io = { fetch: async (u) => { mainThread.push(u); return enc(u); }, decode: async () => ({ width: 1, height: 1, data: Uint8Array.of(9, 0, 0, 255) }) };
  const base = VE_PACK_MODS.find((m) => m.dir === 'base');
  const name = base.index.textures[0][0];
  // a worker that answers
  let w = fakeWorkers();
  _setVePackIoForTests({ ...io, worker: w.factory });
  let img = await vePackClient(base).rgba(name, { maxSize: 256 });
  assert.equal(img.data[0], 77, 'the worker\'s pixels');
  assert.deepEqual(mainThread, [], 'nothing fetched on this thread');
  assert.deepEqual(w.made.flatMap((x) => x.asks).map((a) => [a.url, a.maxSize]), [[vePackUrl(`base/${name}.png`), 256]], 'the URL and the detail, to the worker');
  // a worker that cannot
  w = fakeWorkers('unsupported');
  _setVePackIoForTests({ ...io, worker: w.factory });
  img = await vePackClient(base).rgba(name);
  assert.equal(img.data[0], 9, 'this thread decoded it');
  const asked = w.made.flatMap((x) => x.asks).length;
  await vePackClient(base).rgba(name);
  assert.equal(w.made.flatMap((x) => x.asks).length, asked, 'and the worker is not asked again');
  assert.equal(mainThread.length, 2);
  // a worker that died between asks
  w = fakeWorkers();
  _setVePackIoForTests({ ...io, worker: w.factory });
  mainThread.length = 0;
  assert.equal((await vePackClient(base).rgba(name)).data[0], 77);
  for (const x of w.made) { x.dead = true; x.onerror?.({ message: 'the worker script would not load' }); }
  img = await within(vePackClient(base).rgba(name));
  assert.equal(img.data[0], 9, 'this thread, at once');
  _setVePackIoForTests();
});

// ---- P2 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE P2: the ground cache keeps the three most recently asked tile sets - a fourth lets the least recent go, which is decoded again when it is asked; asking one again makes it the most recent (mutants: the cache unbounded; the oldest asked let go, not the least recent)', async () => {
  fresh();
  assert.equal(GROUND_CACHE_SETS, 3);
  const decoded = [];
  const arrays = Object.fromEntries([302, 303, 304, 402].map((a) => [`${a}-TexArray`, a]));
  const mod = {
    textAssets: [{ name: 'Ground.dfmod', get text() { return JSON.stringify({ ModTitle: 'Ground' }); } }],
    textures: [], arrays: Object.keys(arrays).map((name) => ({ name, width: 1, height: 1, depth: 2 })),
    rgba: async () => null,
    layers: async (name) => { decoded.push(arrays[name]); return [0, 1].map(() => ({ width: 1, height: 1, data: Uint8Array.of(1, 2, 3, 255) })); },
    close() {},
  };
  const store = new Map();
  await setDfmodSources(['dfmod/ground.dfmod'], async (k) => store.get(k) ?? (k === 'dfmod/ground.dfmod' ? new Uint8Array([1]) : null),
    { open: async () => mod, saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false });
  const tex = { recordCount: 2, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: new Uint8Array(4) }) };
  const ask = (a) => dfmodGroundLayers(a, tex);
  for (const a of [302, 303, 304]) await ask(a);
  await ask(302);   // the most recent now
  await ask(402);   // the fourth: 303, the least recently asked, goes
  assert.deepEqual(decoded, [302, 303, 304, 402]);
  await ask(302); await ask(304); await ask(402);
  assert.deepEqual(decoded, [302, 303, 304, 402], 'the three kept answer without a decode');
  await ask(303);
  assert.deepEqual(decoded, [302, 303, 304, 402, 303], 'the one let go is decoded again');
});
