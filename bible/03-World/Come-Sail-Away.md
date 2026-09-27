# Come Sail Away - Come Sail Away 2.1 (CSA-A to CSA-J, from 2026-09-27)

RedRoryOTheGlen's **Come Sail Away 2.1** (Nexus 1131), ported 1:1 off the
compiled assembly - Mac, 2026-09-25: "All mods attached are to be
compatible and implemented 1:1." Provenance is
`vendor/come-sail-away/README.md` (its permission line is RECORD OPEN).
Mac held it on 2026-09-25 ("Let's hold off on sail away. Just finish up
and log future work") and handed the archive over again on 2026-09-26,
beside Ocean Holes'; the port read that as the hold lifted, said so, and
Mac answered "continue".

"Adds a usable boat and sailing mechanics": a boat bought as its parts
(item 1320) or its deed (1321), put in the water near a port, and sailed -
under oars, or under sails the wind fills and the player trims - with
waves around it, its cargo weighing it down, its sounds, and its position
read off the travel map at midday and midnight in clear weather.

## The slices

The line ranges are `ComeSailAway.cs` as the assembly reads back (6,808
lines, one MonoBehaviour).

| slice | what | state |
|---|---|---|
| CSA-A | THE REGISTRATION AND THE ASSETS: the vendored assembly, manifest, settings and item templates; the fifty keys; Features, credits, the registry, the online lane; the bundle's meshes, prefabs, animation, textures and audio out through the port's extraction tool (LoadSettings 787-897, Start 921-1095) | landed: registered; pictures, sounds and the boats as data carried |
| CSA-B | THE BOATS BUILT: SpawnBoat, the variants, the billboard crew and lights, the transforms a hull carries, the game textures, the skinned bake (1120-1811) | landed: built, textured, the sails baked, drawn by the streaming world (placing them is CSA-C's) |
| CSA-C | PLACING, PACKING AND THE SAVE: the placement ray, the nodes, the visibility, the saved boats (6112-6521, 3624-3820, 1923-2072) | landed: placed by the ray's five arms, kept by the nodes, the visibility and the origin, saved; four console commands (PackBoat and `giveboat` make items: CSA-H's) |
| CSA-D | SAILING: StartSailing, StopSailing, Update, FixedUpdate, the collision, the beaching, the turns (4186-5202, 5783-6071) | landed: the helm taken and left, rowed and turned, the collision and the beach, the cargo's weight, the riders, the seven activations raced (three answer: the rest are their slices'), the boat walkable; the sailing arms of death, the load and fast travel |
| CSA-E | THE SAILS AND THE WIND: UpdateWind, RotateWind, the sail power, raising and lowering, the Animator's parameters, the wind widget (3860-3941, 5216-5429) | |
| CSA-F | THE WAVES AND THE EFFECTS: the wave textures and mesh, LateUpdate, the wake, rudder, oar and flag particles, rain and snow blown by the wind (1811, 2145-3479, 4802-5053) | |
| CSA-G | AUDIO, TIME AND TRAVEL: the sounds and the oars' events, the time scale, fast travel, transitions, the hour, the weather, death (1904-2126, 6071-6112, 6527-6687) | |
| CSA-H | ITEMS, SHOPS AND CARGO: the two item classes, the shops' variants, the cargo, the ports (1095, 3820, 6521, 6687-6808) | |
| CSA-I | THE MAP AND THE WATER WALK: the position reading and its markers, OnGUI, WaterWalkingSilent (3941-4186, 5589-5778, 5966-6031) | |
| CSA-J | THE CLOSE: the message receiver, the compatibility arms (World of Daggerfall's terrain, Animated Water, Iliac Puddle No More, Travel Options), online, the audit, the patch notes | |

## The settings (CSA-A)

Ten sections, fifty keys, restated key for key in `systems/modSettings.js`
under `come-sail-away` (section and name joined with a dot), with the
port's own `Enabled` in front, on. The four unnamed spacer sections
("---", "----", "-", "--") carry no keys. The mod wrote six descriptions
(PortLocationSearchRange and five of Map's) and they are the pane's; the
port wrote the rest, each from what LoadSettings does with the key.

- **Three keys ship and do nothing** - `Handling.BadTack`,
  `Handling.BadTackMultiplier`, `SailingAssist.AutoStowGaffSails`.
  LoadSettings reads none of them, and no method can: the assembly's
  string heap (#US - every literal a method names is an `ldstr` of one of
  its entries) holds every other key's name and not these three
  (`tools/lib/clrUserStrings.mjs`, pinned in `test/csa_registration.test.js`).
  They are declared as shipped, so a player's file keeps them.
- **How LoadSettings reads the numbers**, which the slices restate:
  `Waves.Length` is halved into the waves' dither end, `Waves.Fade` is a
  fraction of that length (the dither start), `Waves.Speed` is read in
  whole hundreds - `(2 - Speed / 100) * 0.125` with an INTEGER division,
  so under 100 is half speed, 100 to 199 the mod's own and 200 a frame
  every frame (kept bug for bug, CSA-F) - and `Map.BackdropOpacity` is a
  percentage (`* 0.01`).
- **The nine Controls keys are Unity KeyCode names.** Each becomes a
  registry action (`systems/inputActions.js` MOD_ACTIONS, KB1) with the
  slice that reads it, and four of the shipped defaults are already taken
  in the port's one table (one key, one action): C is Crouch, Space is
  Jump, Period is Horse Cart and Cargo's summon, and the keypad's plus is
  Eye of the Beholder's automatic view. The mod reads its keys only at
  the helm (and Disembark answers the Transport action too, Actions 15);
  how the port shares those four is decided in CSA-D and CSA-G, and
  written here: CSA-D's two, Disembark and ToggleLight, are the
  registry's `BoatDisembark` on `'` and `BoatToggleLight` on `;`
  (bible Controls.md, for Mac's read). The brackets, the backslash and the keypad's minus and
  enter are free.
- **The tile shows four** (`systems/features.js` MOD_CURATED): whether
  the sails trim themselves (the mod's one real difficulty switch), the
  wind's widget, the waves and the boat's sounds. The handling, cargo and
  map dials stay in the mod's own pane.

## The bundle

`Mods/come sail away.dfmod`, UnityFS 7 built by Unity 2019.4.41f2, 13.5 MB:
a serialized file of 10,465 objects, a `.resS` of 836 KB (three hull
meshes stream from it) and a `.resource` of 4.15 MB (the eight audio
clips, FSB5 Vorbis). In it: 228 meshes (19 skinned, one bone each),
48 prefabs - the activation objects 112400-112406, the hulls
112410-112414, the crew's billboards, the lanterns, the wake, flag, oar
and rudder effects - 143 animation clips under five controllers and 26
override controllers, four materials of its own and three shaders, and 62
textures: Unity's two particle defaults, two Bayer dither tables, and 58
of the mod's own archive 112395 (record 0 one 52x41 picture, record 1
twenty-four 128x128 frames, record 2 thirty-two 640x640 frames, record 3
one 1000x500 picture). A material named `TEXTURE.AAA_R` is Daggerfall's
archive AAA record R, loaded from the player's own files (the mod's
`ApplyGameTextures`, and the port's) and never carried.

What each record is, and which the port may carry. `tools/comeSailAwayExtract.mjs`
measures every picture against every record of every TEXTURE file of the
ARENA2 it is given before it writes anything, and refuses what fails:

- **Record 3 is Daggerfall's own art, and is never carried.** It is the
  travel map: `TRAV0I00.IMG`'s 320x160 interior - from row 12, DFU's
  `regionPanelOffset`, the snip DFU's own map overlays are cut from - scaled
  to 1000x500, one texel a map pixel (sampled at the texel centres the two
  agree to 7.3 of 765 per pixel; the residual is the author's resampling).
  The mod draws the boat's position on it (`mapTexture`, CSA-I), so the
  port builds the same picture from the player's own `TRAV0I00.IMG` at run
  time, as Iliac Puddle No More's coastline is rebuilt (DW-A).
- **Records 0 and 1 are the author's.** No record covers record 0 (a
  52x41 splash) or any of record 1's twenty-four frames (the wind widget's
  arrow, `windDirectionWidgetTextures`, four blues on a clear canvas) by
  Detailed Ships' search (`findClassicSource`: a record within a pixel of
  the size, at every offset), neither whole nor cut to its visible box,
  and no square record matches more than 17% of the visible pixels of any
  block of them (`tools/lib/classicBlocks.mjs`). They are carried as
  indexed PNGs of the bundle's pixels.
- **Record 2, the waves, is Daggerfall's snow under the author's paint.**
  Every crest pixel of the thirty-two 640x640 frames is TEXTURE.303
  record 1 - the snow - repeated across the frame: 119,409 of each
  frame's 241,396 opaque pixels, exact. The block search first missed it
  (a crest fills only 42% of a block, and a flat TEXTURE.000 swatch
  "matches" a mostly-grey block to 59%), which is why that search now
  judges visible pixels only and never lays a flat swatch; laying the
  snow itself across the frame found it. What is left - the troughs, the
  wave shapes, the few odd colours - is no record's: 6% of its 4x4
  patches occur anywhere in the TEXTURE files, scattered over unrelated
  records, and no colour mapping of the snow at any phase explains more
  than 38% of it. And the 32 frames are TWO pictures, each scrolled down
  the same sixteen steps (0, 632, 624 ... 576, then 570, 562 ... 522
  rows): the even frames the first, the odd the second, exact. So the
  port carries the author's two paints - the crests as a key colour - and
  each frame's paint, scroll and the snow's phase (`Textures/derived.json`),
  and `formats/derivedTexture.js` `composeTiledPicture` rebuilds a frame
  from the player's own TEXTURE.303: the tool checks every rebuild exact
  against the bundle's frame, and each paint, the snow taken out, passes
  the block search (19% at most). The wave shader cuts out every texel
  under alpha 0.5 (`Daggerfall/Dither/Wave`: `discard` below `_Cutoff`),
  so a clear texel's colour is never seen and is not carried.
- **Unity's own** - `Default-Particle`, `Default-ParticleSystem` (the
  engine's built-in particle pictures) and the two Bayer tables (a matrix,
  not a picture) - are not the mod's to give: the port draws its own.

The mod's own pictures are all in exact `ART_PAL.COL` colours - the
waves' paints need 57 RGBA values between them - which is why they carry
as indexed PNGs (`tools/lib/indexedPng.mjs`): 240 KB for everything.

## The sounds (CSA-A)

Unity imports a clip as Vorbis and stores it as an FMOD sound bank
(FSB5) in the bundle's `.resource`. FMOD keeps the audio packets and drops
the three Vorbis headers: the identification header's numbers ride in the
bank's sample header, the comment header is gone, and the setup header
(the codebooks) is replaced by its CRC32. `tools/lib/fsb5Vorbis.mjs` puts
the stream back together - the bank read as vgmstream lays it out, the
setup header whose CRC32 the bank names (`vendor/vorbis-fsb-setups/`,
vgmstream's table; one is libvorbisenc 1.3.7's own output), that header
parsed to its mode table so each packet's block size gives its granule,
and Ogg pages around the packets, untouched. On 2026-09-27 the six clips
at hand decoded in Chromium to the same PCM, sample for sample, as
libvorbis's own remux of the same banks (python-fsb5).

Five clips are carried, the five `ComeSailAway.Start` loads:
SmallShipAmbience (32 kHz, 182 s) and ShipExteriorAmbience2 (44.1 kHz,
202 s), the boat's slow and fast loops, and Oars_In, Oars_Sweep and
Oars_Out (22.05 kHz), which the oar strokes' animation events play
(`OarEvent_In/Sweep/Out`, `PlayOneShot` on the rudder's audio source).
The mod ships three more and never plays them - All_Together, and
oars_cut_1 and oars_cut_2, the latter the rudder's own source's clip,
which only ever has the three oar clips played over it.

## The boats as data (CSA-A)

`tools/lib/unityScene.mjs` reads the bundle's objects through their type
trees into what the port can draw and animate without Unity, and the
extractor writes `vendor/come-sail-away/Models/`:

- **The prefabs** the assembly asks DFU's `MeshReplacement` for - the five
  hulls (`SpawnBoat`: 112410 + hull) and the seven trigger boxes, four
  of which `GetBoatTransforms` stands under the nodes that name them
  (112400 DriveTrigger, 112401 BoardTrigger, 112402 CargoTrigger, 112403
  DoorTrigger) - as the trees the C# walks BY NAME: `Variants`, `Crewed`,
  `Packable`, `Handling*`, `WakeObject`, `RudderObject`, `IdleObject`,
  `ActiveObject`, the `Sail` and `Boom` nodes... Every node keeps its name,
  active flag, layer, local transform, components and children in Unity's
  order; a pointer becomes the node it lands on (or `{ node, component }`
  for another component, a sub-emitter's particle system), the asset's
  key, or `{ builtin }` for one of Unity's own primitives. A particle
  system's switched-off modules keep only their switch. The trireme alone
  carries 108 oar effects, so identical components are stored once (1,147
  nodes, 482 distinct components). The one script in the prefabs is DFU's
  own `RuntimeMaterials` (a submesh's material by Daggerfall archive and
  record); the mod's four behaviours are added by its code at run time.
  Each hull root's helper `Plane` (Unity's built-in 10 x 10 plane at 10x
  scale) has its renderer and collider both off, and stays so.
- **The meshes**: Unity 2019's vertex data - channels in streams, each
  stream 16-byte aligned, a channel's dimension the low nibble of its byte
  - inline, or in the `.resS` for the six largest hulls; 209 meshes,
  38,238 vertices, 18,076 triangles. Position, normal, uv0 and the
  single-bone skin index are written; the tangents and extra UV sets the
  import carried are not (no shader the boats wear reads them).
- **The animation**: Unity keeps only a Mecanim clip's compiled MUSCLE
  CLIP in a build, so a clip is read the way AssetStudio reads one -
  streamed curves (Hermite segments), then dense, then constant, numbered
  in that order, and each generic binding (a transform's position,
  quaternion, scale or euler angles) takes the next curves its attribute
  needs, its transform named by the CRC32 of the path from the Animator.
  Every binding of every clip resolves under every Animator that plays it
  (3,464 checked) but six: three of the skiff's large staysail clips
  animate a bone its rig has not got - one path in six, its position,
  rotation and scale - which Unity animates nothing for, and so will the
  port. The controllers (sail, staysail, rudder, rudder wheel, door) come
  out as their compiled state machines with every name from their own id
  table: the sails' `Stowed` bool and a 1D blend tree on `Wind` (-1..1),
  the rudder's `Sailing`, `TurnAngle`, `RowZ`, `RowX` and `RowSpeed`, the
  door's `Opened` - and the 26 overrides swap in each boat's own clips.
  The rowing clips carry the three events the assembly answers
  (`OarEvent_Sweep`, `OarEvent_Out`, `OarEvent_In`).

## The boats built (CSA-B)

A boat is the tree the C# makes and walks, over `world/prefabNode.js`: a
GameObject and its Transform in one node, its components the extractor's
records (each instance its own copy), with the Transform rules the C#
leans on - T*R*S down the chain, `activeInHierarchy`, GetComponentInChildren
on ACTIVE objects only, depth first, this one first (a switched-off
component is still found - Unity asks the object, not the component),
SetParent(p, false) keeping the local transform and `transform.parent = p`
keeping the world one (the local scale re-derived as
Transform.SetWorldRotationAndScale does: the local scale set to one, the
node's world rotation-and-scale inverted, times the one it had, the
diagonal read off). A component's node pointer (a bone, a root bone)
resolves in its own instance by the prefab's path, so a renamed root still
answers; no pointer in the files names a path two nodes share (pinned).

`systems/comeSailAwayBoat.js` is `Boat` (Boat.cs, field for field) and
SpawnBoat, ApplyBoatVariant / ReinitializeBoat / SetBoatVariant,
SetupBillboardHelper / AddBillboardLight / SetupModelHelper / SetLights and
GetBoatTransforms in the C#'s order, with DFU's own doors restated as DFU
writes them:

- **MeshReplacement.ImportCustomGameobject** (MeshReplacement.cs:99-120):
  the prefab instanced, named `DaggerfallMesh [ID=n] [Replacement]`,
  `transform.parent = parent`, moved to the player's position and
  rotation, its scale times the player's (one). Each renderer's
  RuntimeMaterials is applied as the instance is made, where Unity applies
  it at each renderer's Awake - the same answer, because every one of the
  thirty-two has ApplyClimate and UseDungeonTextureTable off (pinned).
- **GameObjectHelper.CreateDaggerfallBillboardGameObject** (:313-334) and
  **CreateDaggerfallMeshGameObject** (:147-207), `transform.parent =`
  both; a flat's Summary.Size is the record's scaled size
  (`world/rmbFlats.js` billboardSize), a model's box its vertices'.
  DFU's trigger box for a flat with a custom activation is never added:
  every registration in the sources the port carries is a model's
  (Roleplay Realism's beds 41000-41002, Eye of the Beholder's cart 41239,
  this mod's seven). The boat's bed IS model 41000, so in DFU Roleplay
  Realism's BedActivation answers it - CSA-G's to settle.
- **InstantiatePrefab(DungeonLightPrefab)** for a lantern's light: DFU's
  scene asset is not in the sources, and the mod overwrites every Light
  field it has; the prefab's DaggerfallLight reads Animate and
  InteriorLight false.

What a hull's walk finds - the active tree only, never into an inactive
object, with the chosen variant switched on first (all seven of the
skiff's are off in the prefab), and the loop reading the child count
afresh each step, so the door trigger the walk imports under the node it
is walking is walked too:

| hull | sails | lanterns | crew and other flats | triggers | effects |
|---|---|---|---|---|---|
| 0 Rowboat (`Dingy`) | none | 1 | - | drive, board | wake, 2 oars |
| 1 Large Boat (`OldSkiffHull`) | its variant's (variant 3: the small square and the large lateen) | 2 | the bow's 253/15 | drive, cargo, variant, board | wake, flag, rudder |
| 2 Small Ship (`Galleon`) | two lateens (one under a node scaled 2.83) | 18 | officers, boatswain, coxswain, master-at-arms, quartermaster, cook | all seven kinds; the door's box sized to the door | wake, flag |
| 3 Large Galley (`Trireme`) | one square | 25 | its crew and twenty rowers | all but position | wake, flag, two rudders, 108 oars |
| 4 Carrack | five (square and lateen) | 0 | - | drive, cargo, two board, seven doors | wake |

The modifiers come off the `Modifiers` nodes as the C# reads them
(Handling's position x and y, scale x and y; Audio's y and z with the
volume one whatever the node says; Cargo's x - the carrack carries no
Cargo node, so its threshold stays 0, the author's data). The five nodes
stand off the hull collider's box: centre, fore and aft by the z extent,
starboard and port by the x.

### Which texture each face wears

A renderer with DFU's RuntimeMaterials takes
`MaterialReader.GetMaterial(Archive, Record)` into slot `Index`, entry by
entry and component by component (RuntimeMaterials.cs ApplyMaterials; an
index past the slots ends that component, the next still runs). The
carrack's third mast carries two, and the second's 067_8 and 000_76 are
what it wears. A sail - a SkinnedMeshRenderer - takes the mod's
ApplyGameTextures, which reads its children's names: slot i wears the
`AAA_RRR` child i spells (`Convert.ToInt32`, so the trailing space four of
the skiff's sails carry reads as nothing; a name that will not parse, or a
missing child, is an exception out of Awake - the slots stay as they
were). Every such material is opaque (alphaIndex -1, the pipeline's
`uploadRecord(..., { opaque: true })`). A slot neither touches keeps the
bundle's material - a Standard material named after a Daggerfall texture
but holding none (DFU's FinaliseMaterials swaps one only for a loose
texture file), Unity's Default-Material, the WaterMask - and every
renderer that keeps one is hidden and stays hidden (the flag's cube, the
carrack's two dock planks, the root's helper plane), but the two hulls'
water masks, which are CSA-F's (pinned). A renderer with fewer materials
than its mesh has submeshes draws only the first (the galleon's anchor,
four and two); one with more draws its last submesh again.

### The sails: FixDeformations

Each walked skinned renderer gets ApplyGameTextures and, as its last
child, a new object with FixDeformations: its Awake switches the skinned
renderer off and hangs a MeshFilter and a MeshRenderer on the holder
wearing the skinned renderer's materials, over an empty mesh; its
LateUpdate bakes when its timer passes 0.1f (Time.deltaTime, in Unity's
floats: eight frames apart at 60 fps, never while paused) - BakeMesh then
RecalculateNormals (`world/skinnedBake.js`):

- one bone per vertex (a bone index, no weights: a weight of one), its
  skinned position the bone's localToWorldMatrix times its bind pose. On
  the vendored sails this is checked against what Unity itself stored: in
  each root bone's frame the skinned mesh fills the renderer's `m_AABB`,
  the box Unity measured off this same pose, to 3.5 cm on every sail and
  exactly on most;
- the bake in the renderer's frame, its position and rotation undone and
  its SCALE KEPT - which is how the holder, parented with `transform.parent
  =` and so at a local scale of one over the renderer's, shows each sail
  exactly where the skinned renderer would have drawn it (pinned, the
  galleon's scaled lateen included);
- the normals Unity's way: each triangle's cross(b - a, c - a) - the
  outward normal for Unity's clockwise front, which the bundle's own
  imported normals agree with on 18,060 of 18,076 triangles - summed at
  its three vertex indices unnormalised, no vertex merged with another at
  its position, each sum normalised.

Until CSA-E's Animator plays them the sails stand in the prefab's pose:
SpawnBoat's CrossFade("Stowed", 2) and SetBool("Stowed", true) wait on
each sail's Animator record.

### The lanterns

A lantern is any archive-210 flat a BillboardHelper stands; its light is
Color32(255, 147, 41), intensity 1, range 20, a point light. SetLights
switches the Light and DFU's DaggerfallLight and DungeonLightHandler on
it together, and turns the flat's `_EmissionColor` white or black (the
renderer's `emissionOff`: an unlit lantern's flat binds no emission map,
and the bloom passes it by). SpawnBoat calls SetLights(LightOn = false), so
every boat stands dark; a boat with no lanterns never records the switch.
While they run, DFU's two behaviours decide the light frame by frame as
their code does: DaggerfallLight sets it to IsCityLightsOn on its first
frame and at each change of that flag, DungeonLightHandler every 0.4 s of
game time sets it to "within 51.5 m of the player on the ground plane".

### Drawn

`scenes/comeSailAwayPool.js` loads the five files once, loads what a hull
reads out of the ARENA2 before it is built (`boatAssetNeeds`: its flats,
its classic models), then lets SpawnBoat run straight through as the C#
does. Each frame the streaming world (`scenes/world.js`) ticks it after
the horse cart (the holders' LateUpdate, the lanterns' Updates), draws its
meshes in the world pass, its flats on the flats' pass (a flat's centre on
its object, sized by its record and its object's world scale) and hands
its lit lanterns to the light list. The `?shot` probe stands a boat
with `__csaSpawn(hull, variant, x, y, z, yaw)` (since CSA-C through the
runtime's own PlaceBoat); `__csaLights`, `__csaStat`, `__csaConsole`,
`__csaClear` (purgeboat, boat by boat), and CSA-C's `__csaReady`,
`__csaNodes`, `__csaShore` (a land tile three tiles off water, where to
stand) and `__csaRoundTrip` (the save's record out and straight back in)
beside it. Seen live (scratch renders, 2026-09-27): the rowboat and the
skiff drawn with their lanterns and stowed sails; `placeboat 1 3` from a
pond's edge in Daggerfall (the terrain arm) standing the skiff broadside
on the water, `printboats` naming it at 207, 213, and the record's round
trip standing it again where it stood. The single-location
dev scene (`scenes/exterior.js`) carries no boat, as it carries none of
Iliac Puddle No More, Ocean Holes or Warm Ashes: the mod is the streaming
world's and its modes'.

Not drawn yet, and whose: the water masks and the particle systems
(CSA-F). The colliders the ray answers are CSA-C's (below); standing on
them is CSA-D's (the boat in the world's collider, below).

**Kept bug for bug**: the doors' trigger boxes are filed under
BoardTriggers, and DoorTriggers stays empty; the variant, status and
position triggers keep the player's rotation relative to the boat at the
moment it was built (the C# never resets their local rotation); a model
helper's shift is a world-space difference added to a local position.

**Declared** (the Port-Ledger's Come Sail Away row): BakeMesh keeps the
renderer's scale (Unity 2019.4 has no `useScale`; the mod's own holder
agrees); RecalculateNormals weighs by area and merges nothing; a
collider's and a renderer's bounds are their local box's corners
transformed (the port's standing reading, `world/staticBuildings.js`); at
most the eight nearest lit lanterns reach the light list, their Hard
shadows are not cast, and the light a frame decides reaches the next
frame's list; DaggerfallLight's Update runs before DungeonLightHandler's
within a frame (Unity names no order).

## Placed, kept and saved (CSA-C)

`systems/comeSailAway.js` is the MonoBehaviour's placing half as one
runtime over the host's seams, statement for statement: StartPlacing /
StopPlacing, the three PlaceBoats and two RepositionBoats (the C#'s
overloads by name: the int one, the Terrain one, the DFPosition one),
both PlaceBoatAtRayHits, both SetBoatPositionAndDirections,
GetMapPixelFromTerrain, both UpdateBoatNodes, UpdateAllBoatsNodes, both
UpdateBoatVisibility, OnPositionUpdate / OnPositionUpdateBoat, OnLoad,
OnTransition, GetPlacedBoatWithUID, GetHitBoatIndex,
GetTileMapIndexAtPosition, the placing arm of LateUpdate (4957 - CSA-C
first called it Update's; CSA-D moved it where the C# has it) and
ComeSailAwaySaveData whole. What a later slice owns is named where the C#
calls it: the wake's Stop and the particles moved with the origin
(CSA-F), PlaySlow (CSA-G), the helm (CSA-D), the wind's event (CSA-E).
The runtime is made as the world mounts with the mod on, and only then
does its record ride the save (Ocean Holes' precedent: a mod DFU did not
load writes none).

### The ray and its five arms

`Physics.Raycast(camera ray, 100 m, every layer but Player and Ignore
Raycast)`, triggers taken (queriesHitTriggers, Unity's default), answered
by the host (`csaRaycast`, `scenes/world.js`) over the port's scene as its
colliders stand: the static world's meshes (the street's, the building's
or the dungeon's collider), outdoors the ground (a terrain, or Iliac
Puddle No More's carved floor - `DeepWaters_Seafloor` - where the sea is
carved: the ground walked in quarter-metre steps and the crossing halved
to the millimetre) and the mod's trigger slab over the sea
(`DeepWaters_Surface`, WaterSurfaceManager.EnsureVisibleSurface: a box
819.2 x 0.5 x 819.2 centred 0.03 over the ocean line), the foes' and the
watch's CharacterControllers, and every boat's own colliders
(`world/prefabColliders.js`: an active object's switched-on BoxCollider
from outside only, a MeshCollider from either face - the port's standing
reading of DFU's - a convex one as its mesh's hull, a trigger only when
the query takes them). Each hit carries its object's name and its Terrain
or none. The ray is the activation's own (`cam.pos` and the look), in
third person too.

1. **Iliac Puddle No More and a "DeepWaters" name** (the slab from above,
   and - kept - the carved floor, whose name carries it too): "Boat
   placed!", a second ray straight down with triggers ignored
   names the Terrain under the point (none over a carved floor, which is
   no Terrain), a deed repositions the boat of its UID, else a new boat
   at the point.
2. **A dungeon's water** (blockWaterLevel not 10000 - underground, or
   outdoors while Iliac Puddle No More's forge holds one): the plane at
   `blockWaterLevel x -0.025` (Unity's floats); no intersection, or one
   past 100 m, stops placing with the C#'s own log line; a hit farther
   than the plane places a boat on the plane, marked inside - never a
   deed's lookup (kept); a nearer hit falls through to the terrain test.
3. **A Terrain whose tile under the hit is water** (TileMap `.r / 4 ==
   0`, GetTileMapIndexAtPosition's float offsets truncated and clamped):
   placed there, the deed's boat repositioned. Anything else: "Boat can
   only be placed on water!".
4. **Nothing hit, Iliac Puddle No More on**: the plane at world y 34 -
   the scene's, not the sea's (kept: the plane knows no compensation) -
   and no reach limit.
5. **Nothing hit, the mod off**: "Placement aborted!" for 3 s.

The boat's forward is the player's right (broadside to where they
stand); its pixel is the player's, or the hit terrain's when that is not
the player's own. The item's half (dormant until CSA-H's items call
StartPlacing): the boat takes the item's UID, the cargo packed under it
comes aboard (TransferAll, the packed collection emptied and kept), and
the item is spent unless the boat is crewed. The placing click is
ActivateCenterObject's release, more than 0.2 s after StartPlacing,
behind LateUpdate's pause gate and never while sailing; the hull and variant
are the item's `message / 10 % 10` and `message % 10`, logged as the C#
logs them.

### The nodes and the visibility

A boat's five nodes read their water on a terrain: inside a dungeon with
water all five are water, a dry inside reads nothing; outdoors with Iliac
Puddle No More `SampleHeight(node) < 34` (the drawn ground over the
terrain's own y, DW-D's reading) is water and anything else land;
without it the tile map's record. The Terrain form reads the player's
terrain unless one is given; the pixel form reads its own pixel's, and
nothing where none is built. UpdateAllBoatsNodes is kept as the C# has
it: nothing calls it, and its `MapPixel == CurrentMapPixel` compares two
references, the second new each read. UpdateBoatVisibility: indoors only
a boat placed inside this pixel stands - so a building shows its
dungeon's boat (kept); outdoors a boat more than a pixel off hides, and
one placed inside hides and is destroyed unless Compatibility/
PersistentDungeonBoats keeps it; a near one stands and reads its nodes.
The one-boat form never destroys and reads the nodes whatever it
decided. It runs on OnTransition (the four doors, the Respawner's outside
arm too) and on OnLoad; on FloatingOrigin's recentre each boat active
before or after its own visibility check moves by the offset, and -
**kept bug for bug** - a boat out of sight before and after stays where
the old origin had it, one recentre behind for every one it missed.
Inside a dungeon a boat is drawn, lit and baked by the dungeon's own
frame (`host.drawModeMeshes`, `modeLights`, `extraBillboards`), and the
runtime's Update and LateUpdate and the pool's LateUpdate run in every mode.

### The console

Start's four boat commands (1082-1085), their strings verbatim:
`placeboat [hull] [variant]` (no argument: hull 0 and
`Random.Range(0, 7)`; `0` alone also rolls the variant; anything else
alone is variant 0; `Convert.ToInt32`'s exception leaves the command, as
it does in DFU), `printboats` (`i - hull at X, Y`), `identifyboat` (the
hit's root against each boat's) and `purgeboat [index]` (a negative index
is List's exception). `giveboat` makes a deed and waits for the items
(CSA-H).

### ComeSailAwaySaveData

The record is the C#'s, field for field (`worldCompensation`,
`placedBoats` with `UID`, `Hull`, `Variant`, `MapPixel`, `Position`,
`Direction`, `Items`, `lights`, `inside`; `placedMapMarkers`,
`currentBoat`, `TemporaryShip`, `sailPosition`, the two move vectors,
`windVector`, `packedCargoes`), vectors as `{x, y, z}` and items as the
port's save writes them. RestoreSaveData destroys what stands, stands
every boat again through the pixel overload with its height moved by the
vertical compensation's change since the save (the C#'s only
correction), deserialises its cargo and sets its lanterns; a field the
record lacks keeps the constructor's (FullSerializer fills a new
object). Start's first wind (`15 x Random.Range(-12, 12)` degrees off
forward) is rolled now, so the save's `windVector` is the mod's from the
first save on.

**Declared** (the Port-Ledger's Come Sail Away row): the placement ray is
the port's scene as its colliders stand - the flats', the loot's and the
fish's trigger boxes, the townsfolk and the other mods' bodies do not
answer it (dwFishRay's set, the player's own capsule masked out as the
Player layer is),
and the ground is walked, not a heightfield cast; SpawnBoat runs on what
the pool loaded for all five hulls at the world's mount, so a placement
asked before that is refused with a log line and a save loaded before it
is held - handed back whole by GetSaveData - until the first frame the
models are in, when its boats stand and OnLoad's visibility runs for
them; a convex collider is its mesh's exact hull.

## Sailing (CSA-D)

`systems/comeSailAway.js` takes the helm, statement for statement:
StartSailing, StopSailing and StopSailingDelayed's coroutine, Update's
sailing arm (4301-4768), LateUpdate's move (4936-4956), FixedUpdate's
riders (5053-5145), UpdateCurrentBoatNodes and CheckCollision
(3479-3622), UpdateBoatCargoMod (3820-3858), CanSail, IsBeached,
IsNodeOnWater and the two CanTurns, the properties (moveSpeed,
moveAccel, turnSpeed, turnAccel, wakeThreshold, HasInput, inputTarget),
ActivateRudder, BoardBoat and CheckBoatStatus, and the sailing arms of
OnStartLoad, OnPreFastTravel, OnPlayerDeath (the entity's OnDeath and
OnExhausted) and OnNewMagicRound. Unity's arithmetic is restated in its
floats: normalized under kEpsilon, `==` within kEpsilon squared,
ProjectOnPlane, the three MoveTowards, Clamp letting a NaN through,
Translate and Rotate in the boat's own space. What the C# runs in the
same methods and a later slice owns is named where it runs: the sails,
the wind, its widget, the trim and every Animator (the oars' RowZ, RowX
and RowSpeed, the rudder's TurnAngle, a door's Opened) are CSA-E's; the
wake, the bob, the flag and the current CSA-F's (FixedUpdate's current
is written only with the waves, so it is zero until then); the time
scale's keys and the sounds CSA-G's (ResetTimeScale is here - an index
nothing raises yet, or Unity's scale another mod set, back to one);
PackBoat, the cargo window, the variant picker and the ports CSA-H's;
the position reading and the water walk CSA-I's; OnUpdateSailing is
raised for the listeners CSA-J's message receiver hands it (Eye of the
Beholder's boat camera among them).

### The helm

The helm's box (112400) takes the boat - through PlayerActivate's one
ray (the race below): "You control the boat!", the transport set to
foot, a crewed ship lent as the player's small one when they own none
(TemporaryShip), the player parented at the DrivePosition facing the
bow (SetFacing(0, 0) in the boat's frame), the boat's pixel theirs, the
cargo weighed, the nodes and the collision read, the idle crew swapped
for the active, the footsteps off. Each frame Update then stops the run,
keeps the transport on foot, stops a beached boat dead, walks
inputCurrent, pins the player at the DrivePosition and freezes the
motor (FreezeMotor 1, so it never runs out while the helm is held). The
oars: MoveForwards (or the autorun) rows ahead, MoveBackwards astern,
MoveRight and MoveLeft turn (reversed while backing), Run with a side
key strafes at half; a crewless boat's oars cost 11 fatigue each time
oarModeTime (1 s) runs out. TurnCurrent walks toward TurnTarget x
turnSpeed at turnAccel, MoveVectorCurrent toward MoveVectorTarget x
moveSpeed at moveAccel - the constants 2, 2, 1, 0.2, 20, 10, 10, 5
times the Handling dials, the cargo's mod and the hull's own modifiers.
LateUpdate reads the nodes and the collision again whenever the boat
moved or turned, and, not beached, translates it by velocityCurrent x
dt and turns it by TurnCurrent x dt in its own space, the player and
every rider carried with it.

The Disembark key or Transport (Actions 15) or the helm's box again
leaves it: the head at once ("You stop controlling the boat!", the
borrowed ship's scenes removed and the ship taken back, the vectors
zeroed, the crew back at rest, the footsteps on), the un-parenting at
the frame's end (SetHorizontalFacing along the world forward), then the
player held at the helm each frame's end until the motor's freeze runs
out - a second - when OnUpdateSailing(false) is raised. A death, an
exhaustion, a load's start and a fast travel leave it at once
(StopSailing: set down at the helm, the freeze lifted). The lantern key
lights or douses the lanterns.

### The collision and the beach

CheckCollision sweeps the hull collider's half-beam (sharedMesh.bounds
.extents.x) from its world box's centre along the hull both ways, the
length between the ends' spheres; every collider met but the boat's
own, a Terrain and an entity gives the flat direction from it to the
boat. Their sum in the boat's frame, normalised, is the CollisionVector:
LateUpdate takes the bow's share of the motion off along it and adds it
back at one metre a second, so the boat backs off what it met, and a
turn that would swing it in is refused - TurnTarget flipped, and
TurnCurrent set to it at once. The nodes (CSA-C) decide the beach: more
than three off water is beached - stopped dead, no move - and CanSail
wants all five (the sails' arm, CSA-E's).

### The cargo

UpdateBoatCargoMod weighs the cargo, and (by the Cargo switches) the
player - 120 a woman, 175 a man - what they carry, their cart's load, a
horse's 800 and a cart's 400, against Cargo.CargoThreshold times the
hull's Cargo modifier: the mod is 2 - weight / threshold clamped to one,
said once per weight ("The boat draws a little lower than usual" under
one, "You're going to need a bigger boat" under a half), and it scales
every speed and acceleration. It is weighed at the helm and every magic
round while sailing (the world host's ticker - a round indoors is the
mode's own clock and does not weigh it, DECLARED below).

### The riders

FixedUpdate casts down each live enemy's own height from its centre; a
grounded one over a boat's hull collider (the MeshCollider itself - not
a trigger, a mast or a door) rides that hull (SetParent(MeshObject)),
anything else sets it back. The port's foes carry no transform tree, so
a rider is carried by its hull's move - its centre by the rigid step, its
yaw by the turn - and its own walk stays in the world; a destroyed one
rides nothing. A load's start drops them all (the port's load rebuilds
its foes).

### The seven activations

PlayerActivate's one ray, raced with every other family (the one race,
`player/activationRace.js`, a `boat` family after Horse Cart and
Cargo's): the nearest of the boats' colliders is the hit, triggers
taken, unless the static world stands nearer. A box's name cut after
its first ']' is RegisterCustomActivation's lookup (`DaggerfallMesh
[ID=1124xx]`), within 3.2 it runs and beyond it nothing is said; the
hull or a mast is met and answers nothing, as in DFU. ActivateRudder
(112400): Steal mode packs a packable boat ("You cannot pack a boat you
are driving!" while driven; PackBoat is CSA-H's), any other mode takes
the helm or, at this boat's, leaves it - and at another boat's takes
that one without leaving the first (kept). BoardBoat (112401) stands the
player at the trigger's previous sibling (the BoardPosition), facing
its forward, and sets them on the ground within 3 m (AlignController
ToGround). CheckBoatStatus (112405): "Nice Boat!". The cargo (112402,
CSA-H), the door (112403, CSA-E's Animator), the variant (112404, CSA-H's
ports) and the position (112406, CSA-I) are raced and answer nothing
yet. The street's plaque names a boat by its hull.

### The boat in the world's collider

Every active boat's switched-on, non-trigger colliders stand in the
mode's collider (the street's, a building's, a dungeon's) as buckets in
scene space: the player walks the deck and stands at the helm after
leaving it, a foe stands on it, and every ray and capsule meets it as it
meets a wall. A bucket stands again when its object's matrix moved past
half a millimetre - every frame the helm moves the boat, and on the
floating origin's shift; a hidden boat's are taken down. The placement
ray and the activation's skip them (they meet the boats' own colliders).

Seen live (scratch renders, 2026-09-27; `placeboat 1 0`, the Large Boat,
on the pond at Daggerfall's 207, 213, with Iliac Puddle No More off -
its height test reads a town pond as land): the helm taken through the
activation's own ray (box 112400 met at 1.5 m) - "You control the
boat!", the player at the DrivePosition facing the bow (north: the
placing ray's `transform.right`), frozen; D held turned the boat to 67
degrees in place, the player swung round its pivot and the view with
it, and let go TurnCurrent ran down from 20 while the boat coasted on
to 101; W rowed it 3.5 m along its heading, the player carried, until
the bow and three more nodes read land (tile 21) and the beach stopped
it dead (D held there builds TurnCurrent and turns nothing, a beached
boat does not move); the Disembark key left the helm - held there while
the freeze ran out, then stood on the boat's own collider 0.49 m up and
still there a second on; S walked them astern along the deck and off
the stern onto the pond's ground.

**Kept bug for bug** (the Port-Ledger's Come Sail Away row): the
Carrack's prefab has no Cargo modifier, so its threshold is nought - any
weight clamps its mod to 0 (it can neither row nor turn, and says it
needs a bigger boat) and no weight at all makes it NaN, which Unity's
transform refuses with its own complaint; the oars ask the node one
along - forward the centre's, back the bow's, the right strafe the
stern's, the left the starboard's, the port node never; a right turn
costs fatigue and a left one never; with no key held the oars coast at
the sails' 0.2; the first sweep keeps a start overlap's zero point, a
direction from the scene's origin; the borrowed ship is the small one
and the scenes taken back are the large one's (5, 5 and a building key
16777216); StopSailingDelayed's Update runs on after it, so the oars
pull again that frame and the vector is left behind until the next
helm.

**Declared**: the helm's two keys (above); the sweep is the port's scene
- the mode's buckets through `player/collider.js` sphereCastAll (the
nine-ray bundle `sphereCast` casts, one hit per bucket, so a pixel's
town counts once and the log names the bucket) and the ground asked
every half metre under the sphere's centre; the player under the boat is
carried by the boat's move (the port's player is no transform child),
the eye pinned with the body (both ends of the render span - MAC1's
step smoothing re-primed at the helm, the port's reading of
smoothFollowerLerpSpeed's 250), and the rendering path's switch has no
twin (one renderer); a rider is carried, not parented, and a foe's
isGrounded is its motor's resting read; FixedUpdate runs once a frame,
before Update, and WaitForEndOfFrame resumes at the next frame's pass
(the motor is frozen at the helm either way); a convex collider stands
in the walk as its mesh's own faces; a building's and a dungeon's ladder
take a boat's pick only when it is strictly nearer than their merged
list's, and their plaques name none; a save taken at the helm reloads
with its own look (the port lands the save's pose after the mod loop,
past StartSailing's SetFacing); a magic round indoors does not weigh
the cargo. Now ported beside it: SaveLoadManager's per-mod catch
(1524-1540) - a mod whose RestoreSaveData throws is said on the HUD
("Failed to load mod data for `<title>`. Check log for errors.") and
the load goes on.

## Online (CSA-A, and what CSA-J owes)

The player's own (`systems/onlineLane.js` ONLINE_PLAYERS_OWN_MODS): a boat
is a possession in the player's save, placed and sailed by them - Horse
Cart and Cargo's wagon's shape, whose boat stands where is the player's
own and a peer only SEES them move. Its wind is each machine's own roll
(`UpdateWind` draws from UnityEngine.Random), as it is for each DFU
player. What CSA-J owes: a peer seeing the boat under the player (a
sidecar on a frame the relay already carries, since a new pose field is a
relay deploy), and the time scale, which online must not spend the
room's clock (OL2).

## What was already waiting in the port

- Iliac Puddle No More's swim stands down on a boat
  (`world/deepWaterSwim.js` `isBoatEffectBundle`): the mod's effect bundle
  is "I'm On A Boat", and that literal is in the assembly's heap.
- Eye of the Beholder's boat camera (`CameraOverrideBoat.*`,
  `player/eotbCamera.js`) reads a `sailing` state, and its
  `OnUpdateSailing` hook is a row of `test/eotb_scope.test.js` waiting for
  this mod.
- Item templates 1320 and 1321 are free.

## Tests

`test/csa_registration.test.js` (5): the manifest and the assembly's
hash; every shipped key declared as shipped, in order, and nothing more;
the three unread keys off the assembly's string heap; the item templates
as DFU's parser reads them; the Features row, the credit and the lane.
`test/csa_audio.test.js` (4): the setup headers to their CRC32s and mode
tables, a cut or unframed one refused; an FSB5 bank read field by field;
the pages, flags and granules of a synthetic bank's remux (clamped and
not); the five vendored streams page by page. `test/csa_textures.test.js`
(7): what is carried and what is not, the own pictures, the waves'
specs and paints, the tiled rebuild and its scroll, the block search's
rules, the indexed PNG; with the ARENA2 the frames rebuilt from the
player's own snow (and with `CSA_BUNDLE` compared with the bundle's).
`test/csa_models.test.js` (9): the twelve prefabs and the names the C# walks;
every component index and pointer lands; every mesh reads back inside its
box; the animation's clips, overrides, curves and bindings, with the six
that resolve nowhere named; the path hash against the bundle's own; the
mesh and clip decoders and the prefab walk on hand-built input; with
`CSA_BUNDLE` the tool's models equal the vendored files byte for byte.
`tools/mutants/csa.json`: 34 mutants, all dead.

`test/csa_boats.test.js` (13): the Transform rules on hand-built trees
(the chain, active in hierarchy, the active-only depth-first search and
its plural, the two SetParents and the diagonal rule, the pointer by
path); an instance's own components; a mesh to the port's shape (the
baseVertex, the normal's fourth lane, the bind pose's columns); the
materials (the carrack mast's two RuntimeMaterials, an index past the
slots, the texture names, Unity's pairing, the galleon's anchor); every
shown renderer Daggerfall-textured but the water masks; SpawnBoat on all
five hulls against expectations worked out from the prefab tree alone
(the modifiers, the sails and their six lists, booms, lanterns,
triggers, effects, the nodes off the collider's box, the loops'
distances, the stow request); the variants and SetBoatVariant; the
helpers and SetLights; the trigger boxes (the door's, the board's scale,
the player's kept turn); the fresh child count; ApplyGameTextures and
FixDeformations on every walked sail; the ARENA2 each hull needs.
`test/csa_sails.test.js` (4): the timer; BakeMesh and RecalculateNormals
on hand-built input; the imported normals' orientation; every vendored
sail against Unity's own `m_AABB` and shown where its skinned renderer
would draw it. `test/csa_pool.test.js` (7): the active walk; the
lanterns' two behaviours; a spawned boat's draws over a recording
renderer (only the Daggerfall-textured renderers, their textures
uploaded opaque first); the sails' bakes on their timer; the flats and
the lights; files that will not load; and the renderer's two new doors
(`emissionOff`, `updateMeshVertices`) over a stub GL.
`tools/mutants/csa_boats.json`: 55 mutants, all dead.

`test/csa_placing.test.js` (14): a prefab's colliders (the active and
switched-on only, a box from outside, a mesh from both faces, a hull and
its refusals, a turned and scaled node's inverse) and a built skiff's
(the chosen variant, the switched-off Plane and flag cube, the two
convex doors' hulls round every vertex); Convert.ToInt32, Plane.Raycast,
the item message, GetTileMapIndexAtPosition's floats; the ray's five
arms one by one (the sea's slab and the downward ray, a deed's
reposition and its cargo, a dungeon's plane and its three refusals, the
terrain's water tile, the WaterLevel plane, the abort, the declared
refusal); the console; the visibility, the nodes and OnPositionUpdate's
kept bug; the save written, restored and held. `tools/mutants/csa_placing.json`:
59 mutants, 58 dead and one equivalent as recorded (a negative 128th floored
rather than truncated clamps to the same first column).

`test/csa_sailing.test.js` (24): Unity's arithmetic in its floats;
StartSailing and the borrowed ship; rowing (the pin, the freeze, the
climb to moveSpeed, the carry, the oars' fatigue, the coast); the turns,
the reversed helm, the strafe and the nodes asked one along; the two
sweeps and their filters and the zero point; the push off and the
refused turn; the beach; the cargo's weight and the Carrack's nought
and NaN; StopSailingDelayed's three phases and StopSailing's events; the
lantern key; the seven activations; the riders; the save at the helm;
the origin; the pause gates; and the shared pieces - the collider's
sphereCastAll, the motor's pin and autorun latch, the race's boat family;
and the finer laws each a mutant found (the galleon's own oars, the turn's
cap, the crewed ship's free oars and the left turn's, the helm's pin, the
walk of inputCurrent, the CanTurnRight quadrant behind, a three-node
float, the horse's and cart's switches, a negative MoveTowards).
`tools/mutants/csa_sailing.json`: 84 mutants, all dead.
