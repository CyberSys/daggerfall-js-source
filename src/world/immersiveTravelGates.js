// IT1 (2026-10-04): IMMERSIVE TRAVEL'S CARRIAGES, AT WHICHEVER GATE THE TOWN STANDS.
//
// The mod's whole world edit is four of Daggerfall's city-gate blocks, WALLAA08-11, each with records appended: a
// carriage (model 41214) and its team or a cart (41207, 41209, 41109), the horses (TEXTURE.201), a hay or a crate
// flat, and the driver - a person flat in faction 8642, Carriage Drivers, whose click is the "Fast Travel" service
// (systems/immersiveTravel.js). Its four files are carried as WD1 patches of the player's own classic blocks
// (vendor/immersive-travel/WorldDataPatches, tools/immersiveTravelPatches.mjs).
//
// THE DEPARTURE (the owner's choice, "Add carriages to either"): Beautiful Cities ships the same four names - its own
// redrawn gates - and 52 composites built on them (`WALLAA08.FARMAA00` and the rest, a wall and a farm made one), at a
// higher priority, and online the room owns it. DFU's rule is one mod's file a name, so there the gates would carry no
// driver. Here the mod's appended records are a LAYER (formats/worldDataReplacement.js registerWorldDataLayer): laid
// onto whichever of those files the door serves, in the block's own coordinates, under the same header counts the
// editor leaves (DFU lays a block out by its arrays). Where the mod's own patch is what is served it already carries
// them, and the layer stands aside.
//
// NOT SEEN: how the carriages sit among Beautiful Cities' own gate furniture - this container has no ARENA2 to lay a
// town out in. The bible's page names it for the owner's eyes.

import { registerWorldDataLayer } from '../formats/worldDataReplacement.js';

/** The four gate blocks the mod edits, and Beautiful Cities' composites on them: `WALLAA08.RMB.json`,
 *  `WALLAA08.FARMAA00.RMB.json` - the gate is the name's first part. */
export const IT_GATE_FILE = /^(WALLAA(?:08|09|10|11))(?:\.[A-Z0-9]+)?\.RMB\.json$/;
/** The two arrays the mod appends to. */
const ARRAYS = Object.freeze(['Misc3dObjectRecords', 'MiscFlatObjectRecords']);

/** A patch's appended records, per array, in the patch's order - its `i` ops into the block's two misc arrays
 *  (tools/immersiveTravelPatches.mjs writes nothing else; an op that is not one is refused, not guessed at). */
export function gateAppends(patch) {
  const out = { Misc3dObjectRecords: [], MiscFlatObjectRecords: [] };
  for (const op of patch?.ops ?? []) {
    const [kind, path, value] = op;
    if (kind !== 'i' || path?.length !== 3 || path[0] !== 'RmbBlock' || !ARRAYS.includes(path[1])) {
      throw new Error(`immersive travel: ${patch?.rebuilds} carries an op the gate layer cannot lay (${JSON.stringify(op).slice(0, 80)})`);
    }
    out[path[1]].push(value);
  }
  return out;
}

/** The served file with the mod's records appended - a new document; the served one is untouched. */
export function layGateRecords(json, appends) {
  const rmb = json?.RmbBlock;
  if (!rmb) return json;
  const next = { ...rmb };
  for (const k of ARRAYS) {
    if (!appends[k]?.length) continue;
    next[k] = [...(Array.isArray(rmb[k]) ? rmb[k] : []), ...appends[k].map((r) => ({ ...r }))];
  }
  return { ...json, RmbBlock: next };
}

/**
 * The layer, once the patches are read: `patches` the mod's four (by the gate block's name, 'WALLAA08.RMB'), `own`
 * the documents its patches rebuilt (the door serves those as the mod's own file), `isOn` the mod's switch. Answers
 * whether a layer was laid.
 */
export function installImmersiveTravelGates(patches, own, isOn) {
  const byGate = new Map();
  for (const p of patches ?? []) byGate.set(String(p.rebuilds ?? '').replace(/\.RMB\.json$/, ''), gateAppends(p));
  if (!byGate.size) return false;
  const mine = new WeakSet((own ?? []).filter((j) => j && typeof j === 'object'));
  return registerWorldDataLayer({
    vendor: 'immersive-travel',
    isOn: typeof isOn === 'function' ? isOn : () => true,
    match: (fileName) => byGate.has(IT_GATE_FILE.exec(fileName)?.[1]),
    owns: (json) => mine.has(json),
    apply: (json, fileName) => layGateRecords(json, byGate.get(IT_GATE_FILE.exec(fileName)?.[1])),
  });
}
