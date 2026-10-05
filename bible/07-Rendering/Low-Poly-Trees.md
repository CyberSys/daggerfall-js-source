# Low Poly Trees - the mod, in 3D near and as its own picture far (LPT1, 2026-10-05)

**The owner's call (2026-10-05): "Next mod to integrate is this. Its
important we make this compatible with seasons of daggerfall, ensure
performance doesnt take a hit and draw distance can remain the same. A
true visual overhaul with no performance loss."** SquidKamer's (Kamer's)
**LowpolyTrees 5** for Daggerfall Unity: "Adds low poly trees to the
wilderness." Ledger row LPT1; the registry row and the permission line
(still to be recorded - `RECORD OPEN`) are `vendor/low-poly-trees/`'s.

## What the mod is

253 prefabs named `ARCHIVE_RECORD` - every nature archive, 500 to 511,
the winter sets among them - that DFU's `MeshReplacement` stands in
place of a nature flat, and nothing else: no script, no settings. 116
meshes (16 to 4,488 triangles: most a handful of crossed cards, some
true low-poly shells), 32 materials (an alpha cut, or opaque), 30
textures. DFU stands them in two places:

| DFU | what it does | the port |
|---|---|---|
| `TerrainNature.LayoutNature` -> `MeshReplacement.ImportNatureGameObject` | a terrain's nature flat, on the terrains within one map pixel of the player's: the prefab, turned at random, scaled 0.6-1.4 and tinted between white and `Color.grey`; past that the classic flat | every terrain flat the mod has a tree for, at every distance: the 3D tree within 140 m of the eye, the same tree's FAR PICTURE beyond (below) - `world/lowPolyTrees.js lptVariety` the scale, tint and turn |
| `RMBLayout` / World of Daggerfall's flats -> `ImportCustomFlatGameobject` | a location's nature flat: the prefab as it is, turned by `Random.InitState((int)position.x)` | the same, turned, never scaled or tinted (`lptVariety(.., location = true)`) |

## The textures are game data, so they are painted, never carried

Each of the mod's 30 textures is Daggerfall's own sprites: the five small
ones are TEXTURE.502/503 records whole, and each 1024x1024 atlas is
76-100% records of TEXTURE.500-511 copied pixel for pixel (upright or
mirrored, cut down in places, now and then turned) beside the author's
top-down crowns folded out of the same records. A render of game data IS
game data (`01-Overview/Port-Doctrine.md`), so `vendor/low-poly-trees/`
carries the geometry and a SPEC of each texture
(`tools/lowPolyTreesExtract.mjs` writes it from the shipped `.dfmod` and
an ARENA2, and checks every copied texel comes back exact):

- **blits** - a record, its orientation (one of eight), where it lands,
  the rectangle it may paint and the texels it must not (erase spans,
  LEB128-packed in `Trees/atlases.bin`); the first paint holds a texel.
- **fills** - the regions no record copies: the record they were cut from
  and a coarse map of where they lie (8-texel cells, never their
  picture), painted with a crown folded out of the record (`synthTop`,
  snow-capped on the winter atlases) or a mirrored tile of a crop of it,
  whichever the tool found nearer the author's own. Near his, not his:
  the one place the port's tree is not the author's to the texel.

The game paints each atlas from the player's own TEXTURE files the first
time a tree needs it (`paintAtlas`, a step between the stream's breaths),
with an alpha-weighted mip chain (a clear texel never darkens a leaf's
edge at a distance), uploaded bottom-up like every picture of the port.

## Seasons of the Iliac Bay

While SIB stands a season (`systems/seasonsIliacBay.js`), the atlases
are painted from **its** seasonal picture of each record - resampled to
the classic record's size, since the spec addresses classic texels - so
the 3D trees and their far pictures take autumn, spring and winter
exactly where the flats would have. Each atlas and far picture is keyed
by its SOURCE (`s<season>`, or the classic records), so a season's
change paints anew rather than reading the last one's; SIB's own
re-skin (`_reskin.markStale`) rebuilds the pixels, whose far-picture
batches stand on the archive the mod manages. Two sources are kept (the
standing season and the one the re-skin is still replacing); a third
frees the oldest's atlases and far pictures. Without SIB, the climate's
winter swap (505/507/509/511) brings the mod's own winter prototypes,
snow-capped crowns and all.

## How it meets the port

**Near: the mod's own 3D trees.** `systems/lowPolyTreesAssets.js` is the
host's one door. Each frame the trees within `LPT_NEAR_M` (140 m) plus
the band `LPT_BAND_M` (20 m) of the eye - gathered again only when the
eye moves `LPT_REGATHER_M` (3 m), a pixel moves (a recentre) or a tree
is felled (`scenes/treeHost.js FOREST_STAMP`) - go to the renderer as
one instanced draw per prototype's submesh
(`render/lowPolyTreesRender.js`: every mesh in one vertex and one index
buffer, the instances `[x, y, z, turn, scale, tint]`). They are drawn by
the **billboard program itself** in its mesh mode (`renderer.js BB_VS
uMesh`), after the opaque flats: lit, fogged, cloud-shadowed and swayed
by the same code under either lane, their faces shaded by the sun's
direction by day and their tint laid on.

**Far: the same tree's own picture, at a flat's cost.** Each prototype is
drawn once from the side with its own painted atlases
(`renderImpostor`, `LPT_IMPOSTOR_PER_M` texels a metre, under the same
light law the 3D tree's faces take) and uploaded as a flat of its
archive, `${record}#lpt${source}`. It stands where the classic flat
stood, in the pixel's billboard batch, out to the land view's whole
reach - **the draw distance is the flats', unchanged** - each flat's own
scale and tint carried on its corner (`renderer.js bbCornerX`, read back
by BB_VS: a classic flat's corner is its own, so every other flat is
drawn as it was).

**The handover.** Inside the radius the far picture gives way (its quad
leaves the clip volume); across the band the picture and the tree are
complementary screen-door shares over the port's one `bayer4`
(`render/lowPolyTreesGlsl.js`) - every pixel one of the two, never both,
never neither - and a prototype whose atlases are still painting keeps
its far picture whole (`frame.cut` names only the prototypes drawn).

**What the flat still is.** The flat's cover (TACT1), its sway share
(WIND3), its Logging node and its forest (PROF4) are the flat's own -
read off the classic (or the season's) size, never the tree's - so
gameplay is the same with the mod off. A felled tree's batch sinks as
before and its 3D tree goes with it (`FELLED`); it falls as its own far
picture at its own size and tint. The impostors cast the shadows at
every distance (the shadow pass never cuts); the 3D trees cast none of
their own.

**The four hosts.** `scenes/world.js` and `scenes/exterior.js` are WIRED
(every flat of the `?exterior` host is a location's). `scenes/worldModes.js`
(interiors) and `scenes/dungeonContext.js` are FLAGGED: they stand no
terrain nature, and a dungeon block's rare nature flat stays the flat.

**Online.** The player's own (`systems/onlineLane.js
ONLINE_PLAYERS_OWN_MODS`): how a tree is drawn, where the same flat
stands.

**The switch.** Mods, `low-poly-trees` Enabled (on by default), read
when the world loads; `?trees=off` the kill door.

## Performance

What the trees add, by construction: the near set is **one instanced
draw a prototype's submesh** (a climate stands ~20 prototypes, most one
or two submeshes: some 45 draws), its instances re-gathered only when
the eye moves 3 m (a pixel's 3x3 neighbourhood walked, the instances
re-uploaded - 24 bytes a tree), and a frame between gathers hands the
renderer the same object (nothing allocated). The trees average 84-385
triangles a prototype by climate (16 to 4,488), so a few hundred trees
inside 160 m are a few hundred thousand triangles at most. Everything
past the radius is the flats' own cost: one quad a tree in the pixel's
batch, as before. The atlases are painted once a source, a step between
the stream's breaths (a record a step, 64 mip rows a step, 256 triangles
of a far picture a step), so a pixel's first trees never take a frame
whole; each 1024 atlas is ~5.6 MB of GPU memory with its chain, a
climate using four to seven.

Measured (2026-10-05) in the headless game on SwiftShader (software GL,
so frame time is not a measurement - only the counts and the script are),
Daggerfall at land view 1, `?trees=off` against the trees: draws 583 ->
628, script 15.2 -> 16.8 ms a frame over eight one-second samples (noisy
at one frame a second). The GPU's frame time is the owner's machine's to
measure: `HEADED=1 SCENES=road TREES=off npm run perf` and again without
`TREES=off` (`tools/perfProbe.mjs`).

## Translations recorded (not departures)

- DFU stands the classic flat past one terrain; the port stands the
  model's own far picture, so the wood is one look to the horizon and
  the view's reach is the flats'.
- The far picture is drawn once a prototype, side-on: it faces the eye
  as a flat does, so it does not turn with the tree's random yaw.
- The crossfade band is the port's; DFU's models simply appear at the
  terrain's edge.
- The fills (above) are near the author's crowns, not his.

## Verification

`test/lpt1_lowpolytrees.test.js` (the pure module, the vendored data,
the shader's mesh mode and handover run in the GLSL evaluator, the draw
on a recording GL, the door with its seasons, the hosts' wiring);
`tools/mutants/lpt1.json`.
