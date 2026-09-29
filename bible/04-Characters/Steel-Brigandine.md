# The Steel Brigandine — the port's own worn model

`tools/bakeBrigandine.mjs` + `src/characters/ownArmorModels.js` +
`src/formats/mwItemMap.js` (composeWornArmor) +
`src/formats/mwFirstPerson.js` (bindPartsInto, restPoseInverse)
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

## Where it sits: the scene placement and the rest-pose attach

The Thunderlock's bake drops the object's placement and re-centres,
because a gun is placed by the hand that grips it. A cuirass is placed
by the body it was fitted to. `bakeMesh(..., { placement: 'scene' })`
keeps the object's whole T*R*S, reads the file's own axes and units out
of GlobalSettings (`sceneFrame`: scene Z = FBX up, X = coord, Y = up x
coord; a scene unit is 100 / UnitScaleFactor FBX units), and neither
normalises nor re-centres. A parented object, a pivot or offset, or a
rotation order other than XYZ is refused rather than half-read.

So the mesh arrives in the skeleton's **rest space** - the space a
skinned part's vertices are in. A rigid part's vertices are in its
BONE's space. Rather than write a NiSkinData whose bind would have to be
measured off a skeleton the port does not ship, the part carries
`restPose: true` and `bindPartsInto` takes the attach bone's rest
transform back out once, at bind, from the skeleton the player actually
has (`restPoseInverse`, the inverse of the bone's rest affine in graph
space). At rest the part lands exactly where it was fitted; every frame
after, it rides the bone. The suite proves both on a skeleton whose
bones are turned and lifted, and proves the inverse is load-bearing (a
plain rigid attach misplaces it by over 20 units).

## Two pieces, split at the belt

A garment riding Chest alone swings its hem with the ribs. Mac's answer,
asked: **split at the belt**. The body above rides **Chest** as a
Morrowind cuirass part does and hides the chest skin; the skirt rides
**Groin** as a Morrowind skirt part does and hides nothing (ARMO_PART's
own rows). The line is read off the mesh: the belt's own faces (brown
and the buckle, sampled off Steel.png through their UVs) run from a loop
at z 64.95-65.33 up to 67.4; the red cloth below starts at a loop at
z 62.96-63.19; no vertex lies between. A face goes to the skirt when any
corner is below z 64 (the gap's middle), so the belt stays on the chest
and the two pieces share the belt's lower loop as their seam, where the
leather already draws a line. Chest: 618 triangles, z 64.95-94.76.
Skirt: 246 triangles, z 33.89-65.33.

**What that costs, said plainly:** the skirt is rigid on the pelvis, so
a striding thigh can pass through it, and the seam can open a little
when the chest twists against the hips. A skinned skirt would need
weights painted in Blender and a skin writer in `nifWrite.mjs`; Mac
chose the split over that.

## How it reaches the body

`characters/ownArmorModels.js` is the worn counterpart of
`ownWeaponModels.js` and a leaf for the same reason. Per own piece:
template, material, `restPose`, and the parts it fills by ARMO_PART
name. `composeWornArmor` asks it before `mwArmorRecords` and claims each
part at an armour's priority exactly as `composeRefs` claims a record's
- so the priority law, the skin shadows, the loaders and the binder are
all the ordinary path. Both worn-add doors in `combat/fpArm.js` (the
third-person body and the first-person camera's) hand `restPose` on;
the first person keeps only arm bones, so the brigandine is a
third-person, peer and paperdoll garment, as a retail cuirass is.

The files ship through `systems/ownMwAssets.js` like the Thunderlock's:
`meshes/brigandine_steel_chest.nif`, `meshes/brigandine_steel_skirt.nif`,
`textures/brigandine_steel.dds`, ranked after the player's loose files
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
make; `node tools/bakeBrigandine.mjs` re-makes all three shipped files
and `test/mwbrig1.test.js` holds them to the bytes and the sources to
their SHA-256. The FBX records its texture's original location as a
`Downloads\brigandine\` folder; the doctrine rows call these files
SUPPLIED (Mac's, given for the port) rather than OURS, and whether the
mesh and painting are Mac's own work or a download with a licence of
its own is **Mac's to confirm**.

## Not done here

- **Nobody has looked at it on a real Morrowind body yet.** The fit is
  Mac's scene; the port places it exactly there relative to the real
  skeleton's rest pose, but a scene whose body was not at the skeleton's
  rest (a different race's height, a posed body) would show as an
  offset, and that is a look in the game, not a pin.
- **The ground and icon picture** of the jerkin still resolve to the
  retail cuirass's ground mesh (MW-ASSIGN's icon path). The worn body is
  what this changes.
- **Female bodies** wear the same mesh; it was fitted on one body.
