#!/usr/bin/env node
// REST3 PROBE (2026-10-03, bible/06-Systems/Rest-Arc.md section 4 and 13): where the dungeon's own campfires stand, on
// the real game files. The law is world/dungeonFires.js and its rays are colliderFireProbe - the ones the dungeon host
// casts - over the collider tools/climbDungeonProbe.mjs builds (the layout's placements and action doors in one
// 'dungeon' bucket; the host gives its doors buckets of their own, so a fire this probe refuses beside a door the host
// may stand, never the other way). Gated on the game data, as every real-data check is:
//
//   ARENA2_PATH=/path/to/arena2 node tools/dungeonFireProbe.mjs "Daggerfall" "Castle Kingwing"
//   ARENA2_PATH=/path/to/arena2 node tools/dungeonFireProbe.mjs --all          the record dungeons (climbDungeonProbe's list)
//
// Each line: the dungeon, its non-border blocks, the candidates, the valid ones, the fires placed (and the count the
// law wanted), and each fire's position. A dungeon that stands fewer than it wanted is said so - the candidates ran out
// of room 80 m apart, which is the law, not a fault.
import { isMain } from './lib/isMain.mjs';
import { loadData, dungeonCollider, RECORD_DUNGEONS } from './climbDungeonProbe.mjs';
import { fireCandidates, landCandidates, enemyMarks, colliderFireProbe, placeDungeonFires, dungeonFireCount, isBorderBlock } from '../src/world/dungeonFires.js';
import { isHearthFlat } from '../src/systems/survival/hearth.js';

/** One dungeon's report. */
export function probeFires(col, blocks, { elite = false, seed = 0 } = {}) {
  const probe = colliderFireProbe(col);
  const doors = blocks.flatMap((b) => [
    ...(b.layout.actionDoors ?? []).map((d) => [d.matrix[12] + b.originX, d.matrix[13], d.matrix[14] + b.originZ]),
    ...(b.layout.exitDoors ?? []).map((d) => [d.matrix[12] + b.originX, d.matrix[13], d.matrix[14] + b.originZ]),
  ]);
  const existing = blocks.flatMap((b) => (b.layout.flats ?? []).filter((f) => isHearthFlat(f.archive, f.record)).map((f) => [f.x + b.originX, f.y, f.z + b.originZ]));
  const inner = blocks.filter((b) => !isBorderBlock(b.name)).length;
  const cands = fireCandidates(blocks);
  const valid = landCandidates(cands, { probe, doors, enemies: enemyMarks(blocks) });
  const fires = placeDungeonFires({ blocks, probe, doors, existing, seed, elite });
  return { inner, candidates: cands.length, valid: valid.length, braziers: existing.length, wanted: dungeonFireCount(inner, elite), fires };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH is not set'); process.exit(2); }
  const data = loadData(arena2);
  const list = all ? RECORD_DUNGEONS : [[argv[0], argv[1]]];
  let short = 0;
  for (const [region, name] of list) {
    const loc = data.maps.getLocationByName(region, name);
    const { col, blocks } = dungeonCollider(data, region, name);
    const r = probeFires(col, blocks, { seed: loc?.dungeon?.recordElement?.header?.locationId ?? 0 });
    if (r.fires.length < r.wanted) short++;
    console.log(`${region} / ${name}: blocks ${r.inner}, candidates ${r.candidates}, valid ${r.valid}, braziers ${r.braziers}, fires ${r.fires.length} of ${r.wanted}${r.fires.length < r.wanted ? ' (short)' : ''}`);
    for (const p of r.fires) console.log(`  [${p.map((v) => v.toFixed(1)).join(', ')}]`);
  }
  if (list.length > 1) console.log(`${list.length} dungeons, ${short} short of the count`);
}
