# Low Poly Trees 5 - SquidKamer (its geometry vendored; its atlases rebuilt from the player's own data)

**LowpolyTrees** version 5, by **SquidKamer** (Kamer; the manifest's ContactInfo is "DFU Discord", its
DFUnity_Version 0.14.4, GUID `71cd95b4-ffe5-4338-816e-2b7def737d4b`). The mod's own description: "Adds low poly trees
to the wilderness."

The owner handed the shipped archive (`LowPolyTrees_V5-380-v5-1669847452.rar`, sha256 `035672fa...e7b6f62`, one file:
`Mods/lowpolytrees.dfmod`, 10,352,684 bytes, sha256 `07df852a...f83f74b56`) over on 2026-10-05: "Next mod to integrate
is this. Its important we make this compatible with seasons of daggerfall, ensure performance doesnt take a hit and draw
distance can remain the same. A true visual overhaul with no performance loss."

**Permission: [Mac: record SquidKamer's permission, or the link to it, here - the earlier mod records carry theirs in
this line.]** The archive carries no readme and the manifest no licence.

## What the mod is

253 prefabs, `ARCHIVE_RECORD` each - every nature archive, 500 to 511, the winter sets among them - that Daggerfall
Unity's MeshReplacement stands in place of a nature flat: on the terrains within one map pixel of the player's
(`TerrainNature.LayoutNature` -> `ImportNatureGameObject`, a terrain tree with a random scale of 0.6 to 1.4, a tint
between white and grey and a random turn) and in every location (`ImportCustomFlatGameobject`, turned by
`Random.InitState((int)position.x)`). No script, no settings: 116 meshes (16 to 4,488 triangles - most of them a
handful of crossed cards, some true low-poly shells), 32 materials, 30 textures, and the manifest.

## What is here, and what deliberately is NOT

- `lowpolytrees.dfmod.json` - the manifest, byte for byte.
- `Trees/trees.json`, `Trees/trees.bin` - the author's geometry (every mesh's positions, normals and uv0, and its
  submeshes' indices), each prefab as its mesh, its root's scale and its materials, each material as its texture and
  its alpha cut - and each texture as an ATLAS SPEC.
- `Trees/atlases.bin` - the specs' erase lists, packed.
- **No picture.** Every texture in the bundle is Daggerfall's own art: the five small ones are classic records whole
  (TEXTURE.502 and 503), and each 1024x1024 atlas is classic records of TEXTURE.500-511 copied pixel for pixel - upright
  or mirrored, cut down in places, now and then turned - for 76-100% of its texels, with the author's top-down crowns
  folded out of the same records (capped with painted snow on the winter atlases), a few touch-ups and a few
  hand-written record numbers for the rest. A render of game data is game data (`bible/01-Overview/Port-Doctrine.md`),
  so the spec names what to copy - each record, its turn, where it lands, the rectangle it paints and the texels it must
  not - and the game paints the atlas from the player's own TEXTURE files (`src/world/lowPolyTrees.js` `composeAtlas`);
  every texel a copy claims comes back exact (the tool checks it). The regions no record copies are FILLS: the record
  they were cut from and a coarse map of where they lie (8-texel cells, never their picture), painted by the game with
  a crown folded out of the record or a tiled crop of it, whichever the tool found nearer the author's own.

`tools/lowPolyTreesExtract.mjs` rebuilds every file here from the archive and the player's ARENA2. The design and the
record: `bible/07-Rendering/Low-Poly-Trees.md`.
