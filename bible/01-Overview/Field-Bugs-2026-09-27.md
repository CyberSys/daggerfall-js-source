# FIELD BUGS 2026-09-27 — FIELD-CONSOLE1, a player's console read line by line

The user handed over a browser console from a live session (online, a walk
south from Privateer's Hold, a building, a dungeon, back out). Every line
was read; each is either fixed here, recorded as expected, or open.

## Fixed

- **`[town] FACTION.TXT unavailable: Cannot access 'Ut' before initialization`**
  (reproduced in the production bundle - the minifier's name differs per
  build; in dev it reads `_questRegionIndex`). townTalk's load, built far up
  `bootWorld`, resumes after its FACTION.TXT fetch and reads the region
  through `_questRegionIndex` - a `const` declared thousands of lines below,
  after `await loadQuestPack()`. bootWorld is suspended at that await when the
  fetch lands, so the read hit the dead zone and the region's people never
  loaded: every town's talk ran without its people. It is a hoisted
  declaration now, and everything its body reads is declared before townTalk
  is built (`test/fieldconsole1.test.js`, `test/regionlive.test.js`).
- **`/assets/undefined` 404, twice at boot and twice at every door**
  (reproduced in the bundle, the initiator Handheld Torches' sprite loader).
  Both of that mod's loaders (the hand's sprite, the dropped torch's flats)
  probe frames until one is missing - the mod's own TryImportTexture loop -
  and in the bundle a frame past the last has no file, so Vite's dynamic URL
  answers `/assets/undefined` and each probe's miss went out as a request.
  The vendored set is known at build time (`vendoredTexture`,
  `systems/handheldTorches.js`); a frame not in it is a miss, never a fetch.
- **`Canvas2D: Multiple readback operations using getImageData are faster
  with the willReadFrequently attribute` (x24)**. Every 2D context the port
  makes to READ pixels back (the PNG decode every vendored texture goes
  through, the SDF font atlas, the held map's sheet and thumbs, the save
  window's shots, the paperdoll skin) asks for `willReadFrequently` now -
  CPU-backed, no GPU readback.

## Made to name its culprit

- **`PERF-2D: a foreign pass ran inside an open 2D run`**. Not reproduced
  offline: a single-player walk of the same route (109,158 to 109,162) with
  the renderer instrumented never raised it, and the static candidates in the
  world section (the sea's surfaces, the pits, the rain, the wisps, the bolts,
  the grass, the bodies, the peers' walkers) all close or never open a run.
  The session that raised it was online with other players. The warning now
  carries two stacks - the pass that found the open run and the draw that
  opened it (kept, as an Error, only until the warning has spoken) - so the
  next console that shows it names the draw.

## Expected, not faults

- `CURSOR.IMG` 404: that player's ARENA2 has no CURSOR.IMG; the OS cursor
  stands in, as the line says.
- `BOK00112.TXT` / `BOK00113.TXT` 404: DFU's book mapping names ids 112 and
  113 ("Bourn in Wood, Part I/II", `vendor/dfu-books/books.txt`), which the
  classic data does not carry and DFU does not ship either; the price preload
  asks for every mapped book and keeps the template price for a missing one.
- The Immersive Footsteps warning: it reads Better Ambience's live
  `Better Footsteps.enable`, which the port ships OFF - that player turned it
  on. The mod's warning is right, and says how to silence it.

## Open

- **`[enhanced-ai] navmesh bake looks degenerate (11 polys from 17592
  triangles)`**, in the dungeon of map id 1204685, on both entries. Mac's
  2026-09-20 guard keeps the bad bake out of the cache, but the bake is
  deterministic for that dungeon, so its enhanced-AI foes stay without a
  navmesh. Next: reproduce the bake on that dungeon's collider and find why
  the anchor's region is all that survives.
