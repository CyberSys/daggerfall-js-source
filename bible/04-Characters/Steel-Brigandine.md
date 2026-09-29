# The Steel Brigandine — the port's own worn model

`tools/bakeBrigandine.mjs` + `src/characters/ownArmorModels.js` +
`src/formats/mwItemMap.js` (composeWornArmor) +
`src/formats/mwSkinTransfer.js` + `src/formats/mwFirstPerson.js` (bindSkinnedFromBody)
(MW-BRIG1, Mac, 2026-09-29)

> "This is for the morrowind model. The steel brigantine"

with a Blender export (`morrowind_27284_autosave.fbx`) and its texture
(`Steel.png`, 128x128).

**The second of the port's own Morrowind models, and the first one that
is WORN.** The Dwarven Thunderlock (`05-Combat/Dwarven-Thunderlock.md`)
proved the lane can ship a mesh no player's archives carry; this does it
for a garment, which is a different problem in two ways: where it sits
is part of the authoring, and it has to move with a body rather than a
hand.

## Which item

Nothing in the port was called a brigantine. Roleplay & Realism Items'
light set mints any plate material as **Brigandine** (`rriItems.js`
`lightWord`), so its Jerkin (template 520) in Steel is the "Brigandine
Jerkin" - and on the Morrowind body it wore retail's `steel_cuirass`
(MW-ASSIGN: the jerkin resolves by the cuirass row). Mac's answer,
asked: **the Steel Brigandine only**. Every other material of the jerkin
- Silver included, though it shares Steel's Morrowind token - and the
classic Steel Cuirass keep what they had.

## The file, read

One static mesh (`Plane.025`, 485 positions, 764 polygons: 668
triangles, 92 quads, 4 pentagons), no bones, no skin. Mirrored exactly
in X. In the scene it sat at translation (0, 0, 64) with Blender's
export turn (-90 about X) and unit (x100): 29.4 wide, 23 deep, 61 tall,
spanning z 33.9 to 94.8 - a knee-length brigandine on a Morrowind body,
1 Blender unit to 1 Morrowind unit. Mac's answer, asked: **fitted in
place** on the Morrowind body.

**Its front is the scene's -Y**: the buckle, the three clasps (three
small separate islands of twenty vertices) and the split in the skirt
are all on that side. Morrowind's actors face +Y, so the bake turns it
half round (`forward: '-y', up: '+z'`), which the suite checks on the
clasps.

**Six faces are concave** - three mirrored pairs round the clasps, a
quad and a pentagon each, real notches (turns of -0.018 to -0.54
against areas of 1.5 to 4.7). The FIELD-GUN-MW1 bake REFUSED a concave
face ("triangulate it in Blender"). That was the wrong fix to ask for:
Blender draws those faces ear-clipped, so an ear clip IS the
triangulation the modeller saw. `tools/fbxMesh.mjs` ear-clips them now
(`earClip`, projected on the face's Newell plane, winding kept), and a
convex face still fans corner for corner - the Thunderlock re-bakes to
the same bytes. A face that crosses itself has no triangulation and is
still refused by name.

## MW-BRIG2: skinned from the body under it (the fix)

MW-BRIG1 moved the torso in game ("The texture was great, you just somehow
moved the geometry in the process") and was reverted (#451). What it did:
hung the brigandine RIGID on the skeleton's `Chest` and `Groin` nodes, split
at the belt, and took each node's rest transform back out
(`restPoseInverse`). That agrees with the body in one pose at most. A retail
body part is SKINNED (MW-D21: authored part-local, "a torso on the ground"),
and the reference places each of its vertices by the part's OWN NiSkinData on
the spine, pelvis and leg bones (rule 20) - never by the Chest node, which is
a clothing bone that stands its own way at rest and is keyed its own way by
the idle. So once anything animated, the torso moved by its bones and the
brigandine by a node the body does not use. `test/mwbrig2.test.js` builds
exactly that case and measures the MW-BRIG1 attach dragged over 10 units off
the body.

Now there is ONE transform. `formats/mwSkinTransfer.js`: every brigandine
vertex copies the skin of the nearest vertex of the player's own body parts
(`skinFrom: chest, groin, upperleg, knee` in `characters/ownArmorModels.js`) -
the same bones, weights, inverse binds and skin transform - and its position
is solved, through `skinBatch` itself (four probe vertices per body vertex),
so that in the skeleton's rest pose it lands exactly where Mac fitted it.
From then on it is drawn by `skinBatch`, the body's own door, so it moves by
precisely the transform the skin under it moves by: the torso cannot come
away from it, and the skirt bends with the legs. One piece, worn as a
cuirass (it still hides the chest skin), no belt split. A triangle keeps to
one body part's skin; a rigid body part (a mod's) is a skin of its one attach
bone with rule 13's mirror and rule 14's offset folded into the bind. With no
body under it, it is a note and is not drawn.

`combat/fpArm.js` loads the body parts it names from the player's own rows,
shadowed or not (the cuirass hides the very chest it copies), and hands them
to `bindPartsInto` with the part; `bindSkinnedFromBody` binds them as the body
binds them and pushes skinned pieces. The rigid path and every other part are
byte-for-byte what they were.

## How it reaches the body

`characters/ownArmorModels.js` is the worn counterpart of
`ownWeaponModels.js` and a leaf for the same reason. Per own piece:
template, material, `skinFrom` (the body slots it is skinned from), and the parts it fills by ARMO_PART
name. `composeWornArmor` asks it before `mwArmorRecords` and claims each
part at an armour's priority exactly as `composeRefs` claims a record's
- so the priority law and the skin shadows are the ordinary path. The
first person keeps only arm bones, so the brigandine is a third-person,
peer and paperdoll garment, as a retail cuirass is.

The files ship through `systems/ownMwAssets.js` like the Thunderlock's:
`meshes/brigandine_steel.nif`, `textures/brigandine_steel.dds`, ranked after the player's loose files
(so a player's own file of the same name wins) and before every BSA.
`itemMapCoverage` answers the Steel jerkin as `own`, inside the mod's
armour space.

## The texture is painted, not baked

The Thunderlock's DDS was grown from its geometry because its export
had no texture. This one carries `Steel.png` and UVs laid out for it,
so the DDS is that PNG, mip-chained (`mipChain`/`writeDds`,
uncompressed), and the NIFs name it as a bare `brigandine_steel.dds`
that `correctTexturePath` re-roots under `textures/`. The suite decodes
it back through `collectArmTextures` to the PNG pixel for pixel.

## Reproducible, and where the sources are from

`src/assets/mw/source/Brigandine_Steel.fbx` and `Brigandine_Steel.png`
are Mac's two files, renamed for the asset, committed beside what they
make; `node tools/bakeBrigandine.mjs` re-makes both shipped files
and `test/mwbrig2.test.js` holds them to the bytes and the sources to
their SHA-256. The FBX records its texture's original location as a
`Downloads\brigandine\` folder; the doctrine rows call these files
SUPPLIED (Mac's, given for the port) rather than OURS, and whether the
mesh and painting are Mac's own work or a download with a licence of
its own is **Mac's to confirm**.

## Not done here

- **MW-BRIG1's break was the integration, not the model.** The bake and
  its previews were right; the code that hung the brigandine on the Chest
  and Groin nodes is what moved it in game (MW-BRIG2, above). MW-BRIG2
  keeps the bake exactly as the previews showed it and replaces only that
  attach. It has not been seen in game yet.
- **The ground and icon picture** of the jerkin still resolve to the
  retail cuirass's ground mesh (MW-ASSIGN's icon path). The worn body is
  what this changes.
- **Female bodies** wear the same mesh, skinned from their own body parts;
  its shape is the one it was fitted with.
