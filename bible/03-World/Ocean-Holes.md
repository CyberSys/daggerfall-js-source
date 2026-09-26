# Ocean Holes - There's a Hole in the Bottom of the Ocean (OH-A to OH-F, 2026-09-26)

jet082's **There's a Hole in the Bottom of the Ocean 1.1.0** (Nexus 1313),
ported 1:1 off the compiled assembly - Mac, 2026-09-25: "All mods attached
are to be compatible and implemented 1:1." Provenance is
`vendor/ocean-holes/README.md` (its permission line is RECORD OPEN). It
REQUIRES Iliac Puddle No More 1.2.2 (`03-World/Deep-Waters.md`): the pits
are cut into that mod's carved seafloor, through that mod's own API.

"There's a hole in the bottom of the sea": on one open-ocean map pixel in
48 (at the slider's midpoint) a black hole opens in the seafloor under a
plume of purple miasma, and swimming down into it leads to a drowned
dungeon - a real Daggerfall dungeon, borrowed from a region, flooded to
its ceiling, stripped of its lights and filled with the deep's own foes.

## The slices

| slice | what | the port's modules | state |
|---|---|---|---|
| OH-A | THE REGISTRATION: the vendored assembly, manifest and settings; the seven sliders; Features, credits, the registry; the online lane | `vendor/ocean-holes/`, `systems/modSettings.js`, `systems/features.js`, `systems/onlineLane.js`, `ui/credits.js`, `ui/enhancedMenu.js` | landed |
| OH-B | THE PIT'S PLACE AND THE CUT: the hash, the pixels it picks, the placement, the tile queue and its gates, the bake's verification, the depth, the seafloor's cut through Iliac Puddle No More's API | `world/oceanHoles.js`, `scenes/oceanHolesHost.js`, `scenes/deepWatersHost.js` (the API), `scenes/world.js` | landed |
| OH-C | THE PIT'S LOOK AND ITS DOOR: the three discs, the miasma, the entrance a swimmer touches | `render/oceanHolesRender.js`, `world/oceanHolesMiasma.js`, `render/deepWatersRender.js` (`updateFloor`), `scenes/world.js` | landed |
| OH-D | THE ABYSS: the template, the clone, the entry, the flood, the exit to the pit, the recall, the save | `scenes/oceanHolesAbyss.js` (drafted), `scenes/worldModes.js` | next |
| OH-E | THE ABYSS'S CONTENTS: the flame foes gone, the replacements, the aquatic quota, the lights, the quest resources, the loot, the fog and the light | `scenes/dungeonContext.js` | after OH-D |
| OH-F | THE CLOSE: the audit pass, the docs, the patch notes | - | last |

## The settings (OH-A)

Seven sliders, each 0..1 and 0.5 by default, read as the C#'s
ApplySettings reads them (`scenes/oceanHolesHost.js` `oceanHolesSettings`):

| slider | what the midpoint means | law |
|---|---|---|
| PitSpawnRate | one open-ocean pixel in 48 | clamped; 0 is none, 1 is one in 24 |
| SurfaceHoleSize | the surface's opening 20 m across | GetScaledSliderValue about 20 |
| SeafloorHoleSize | the seafloor's pit at scale 1 (32 m, the black 9 m) | GetScaledSliderValue about 1 |
| MiasmaParticleCount | 72 puffs | GetScaledSliderValue about 72, rounded half-even |
| MiasmaHeight | a 300 m plume | GetScaledSliderValue about 300 |
| DungeonVisualIntensity | the abyss's fog at density 0.25 | clamped (OH-E) |
| DungeonVisualDarkness | the abyss's fog 85% of the way to its colour | clamped (OH-E) |

GetScaledSliderValue is Iliac Puddle No More's own member, the same
formula; the port has one home for it (`world/deepWaterLook.js`
`scaledSliderValue`, re-exported). A change to any of the first five
re-cuts every loaded floor (RefreshLoadedPits, forced); the two abyss dials
do not. Online, `Enabled`, `PitSpawnRate` and `SeafloorHoleSize` are the
room's (they decide where the ground is cut, so every player in a room
cuts the same holes); the rest are the player's own look.

## Where a pit is (OH-B)

- **StableHash(x, y, salt)** is Int32 arithmetic with LOGICAL shifts (the
  IL's `shr.un`, read off the assembly): `StableHash(17, 42, 1213156421)`
  is 1607323056, and the test restates it in BigInt so the pin is not the
  port's own arithmetic read back.
- **IsPitPixel(x, y, rate)** reshuffles the hash into 48 buckets of
  89,478,486 and takes the first `rate x 2` of them: none at 0, one pixel
  in 48 at 0.5, one in 24 at 1, and the pixels picked at a lower rate are
  always among those picked at a higher.
- **PlacementFraction(x, y, salt)** is `0.28 + (h & 0xffff) / 65535 x
  0.44` of the salted hash (`0x484F4C45 ^ salt`, 88 for x and 90 for z):
  the pit is never nearer a pixel's edge than 28%.

A pixel is queued when its terrain is promoted and one is processed a
frame (ProcessOneTerrain), in the C#'s order of gates, each rejection its
own diagnostic (`stateOf(entry).diagnostic`, the mod's
OceanHolesDiagnosticsRunner reads the same strings): the hash; a location
(never cut); Iliac Puddle No More's floor built and current (a missing or
stale floor waits, asking the sea to build it on a new wait and every
thirtieth try, for up to 600 frames); the bake's verification (loaded,
water in the pixel, no land in it, the point carved water and at least
256 m from the coast - the port's bake is always there, so the C#'s
unverified geometry fallback runs only if a bake query throws); and the
floor at least 70 m under the sea at the spot (RaycastFloor: a ray from
5 m over the sea, 1000 m down, onto the floor mesh itself - the mod's
MeshCollider is that mesh).

## The cut (OH-B)

DeformSeafloor walks EVERY vertex of the floor mesh, the walls' with the
grid's, as the C# walks `mesh.vertices`. Where the bake verified the spot
and the floor strays more than 5 m from the pit's mean height within
twice the pit's radius, the ring out to the pit's radius plus the stray's
(up to 256 m from the pixel's edge) is smoothstepped toward that mean
first (`built:flattened`). Every vertex within the outer radius (32 m x
the seafloor scale) then falls by GetFloorPitDepth: 14 m inside the black
radius (9 m x scale), smoothstepped to nothing at the outer. A floor is
cut once per build version: a pit lost on the same floor is stood again
without a second cut.

The cut is committed through Iliac Puddle No More's own API, which the
port's Deep Waters host now carries (`scenes/deepWatersHost.js`):
`isSeafloorCurrent`, `seafloorBuildVersion`, `tryGetSeafloor`,
`commitSeafloorChanges` (CommitExternalMeshChanges: the vertices taken,
the 65 x 65 height grid read back off the first 4,225 of them, the walls'
colliders stood again, the drawn floor's positions uploaded again - no
normals recalculated, as the C# recalculates only the bounds),
`refreshLoadedTile` (off while the terrain may not be mutated; a current
floor left standing unless forced) and `onSeafloorBuilt` (raised right
after a floor is built, before `onFloorRefreshed`, so a pixel is cut the
moment its floor lands). The decorations ask ShouldSuppressDecoration of
every placement: nothing grows within 32 m x scale of the pit.

## The pit (OH-C)

BuildPit finds the opening (FindPitOpeningY: the highest of the floor
under the centre and sixteen rays round a 12 m x scale ring) and stands:

| part | where | size | look |
|---|---|---|---|
| Blue Hole Core | the sea + 0.07 m | the surface radius | Unlit/Color (2, 15, 46) / 255, queue 3001 |
| Blue Hole Underside | the sea - 0.01 m | the surface radius | the same colour, queue 2001 |
| Abyss Miasma | the sea + 0.12 m | a disc of the surface radius - 1 | Standard (Fade) with emission, queue 3002 |
| Pit Black | the opening + 0.08 m | 12 m x scale | Unlit/Color black, queue 2000 |
| Ocean Hole Entrance | the opening + 0.22 m | a box 18 m x scale by 0.35 m | a trigger |

The discs are the one 48-segment mesh CreateDiscMesh builds (each wedge
wound both ways), drawn with the world's fog, then the water column's
share and the sea's distance fog as every pass over the carved sea takes
them. The miasma is a simulated ParticleSystem (`world/oceanHolesMiasma.js`):
2 x count / 72 puffs a second up to the count, a 5 s prewarm, 30 s lives,
3-6 m puffs rising at 0.85..1 of the plume's height over a life, the size
over the life a four-key curve of flat-ended spans; billboards no larger
than 0.08 of the view's height.

The entrance fires once a second at most, and only for a swimmer outside
(OceanPitCollision.OnCharacterCollided): the capsule touching the box
(`scenes/world.js` `ohFrame`) hands the pit's pixel to TryEnterPit (OH-D).

## The port's own (Port-Ledger, the Ocean Holes row)

1. **The marker rides the recentre.** The C#'s OceanPitMarker holds the
   world X and Z it was built at, and DFU's FloatingOrigin moves the world
   under it, so after a recentre the decorations' exclusion and the pit's
   lookups point where the world was. The port keeps the marker
   pixel-local and reads it through the pixel's live translation.
2. **RefreshLoadedTile builds in its turn, at the front.** The mod's call
   builds the floor synchronously; the port's floors are the worker's, so
   the pixel goes to the front of the deferred queue and its
   OnSeafloorBuilt comes when the build lands.
3. **The miasma's light.** Standard's physically based lighting of a
   camera-facing quad is taken as the port's billboards take the day's
   light - ambient plus the sun's Lambert term toward the camera; with an
   albedo this dark (0.04, 0.005, 0.08) the emission (0.25, 0.02, 0.38) is
   nearly all of it. Unity's particle RNG is its own and unseeded; the
   puffs are Math.random's.

## Tests

`test/oh_placement.test.js` (the pure law against the assembly: the hash,
the buckets, the placement, the fall, the cut's vertex pass, the grid, the
rays, the names and ids, the roster, the fixtures, the armour ladder, the
template, the flood, the disc, the puff, the miasma's particle system, the
midpoint colour) and `test/oh_host.test.js` (the tile host: the gates in
order, the waits, the bake's rejections, the depth, the state machine, the
suppression, the settings' re-cut, the entrance's once-a-second, the
dependency's half of the API, RefreshLoadedTile through the sea's own
host, the pit's programs taking their inputs where the buffers put them).
Mutants: `tools/mutants/oh.json`, 34, all dead.

Seen in the world (a probe at Sentinel, three pixels north of Pallaton,
pixel 392,338): the pit built and flattened, the blue-black core on the
sea with the miasma rising over it, the same disc from under the surface,
and the black at the opening 186 m down. The first pass at the probe
drew nothing - its vertex inputs had no `layout(location)` and the
linker is free to order them; they are bound now, as the sea's own
programs bind theirs. (The probe's own lesson, for the next one: in `?shot`
fly mode the third-person lane's camera follows the unspawned player, not
`cam.pos`, so a fly-mode probe switches Eye of the Beholder off.)
