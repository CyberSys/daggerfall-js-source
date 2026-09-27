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
| CSA-E | THE SAILS AND THE WIND: UpdateWind, RotateWind, the sail power, raising and lowering, the Animator's parameters, the wind widget (3860-3941, 5216-5429) | landed: Unity's Animator restated (`world/unityAnimator.js`) and every boat's played - the sails stowed and raised, the rudder's oars and tiller, the doors; the wind rolled and turned; the sails' power, the square sails' assist, the trim (auto and by hand); the widget; the sails' and the trim's keys |
| CSA-F | THE WAVES AND THE EFFECTS: the wave textures and mesh, LateUpdate, the wake, rudder, oar and flag particles, rain and snow blown by the wind (1811, 2145-3479, 4802-5053) | landed: the coasts' breakers laid, their frames composed from the player's snow and stepped by day and night, their dithered shader; the current; Unity's particle system restated (`world/unityParticles.js`) and every boat's played - the wake and its two loops' play state, the rudder's drops and splashes, the flag; the bob; the rain's and snow's forces handed on |
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
  not a picture) - are not the mod's to give: the port draws its own
  particle picture, and carries the 8x8 table the waves' material names
  as the 64 thresholds it is (CSA-F).

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
carrack's two dock planks, the root's helper plane), and the two hulls'
water masks too (CSA-F: they write colour alone, before any opaque thing
and with no depth, and the sea or the hull always draws over them). A renderer with fewer materials
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

Since CSA-E each sail's Animator plays (below): SpawnBoat's
CrossFade("Stowed", 2) and SetBool("Stowed", true) are taken at its first
update, and the bake follows its bones each tenth of a second.

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
Beholder's boat camera among them). CSA-E has since landed the sails,
the wind, its widget, the trim and every Animator, and CSA-F the waves,
the current, the wake, the bob and the flag (below).

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
ToGround). CheckBoatStatus (112405): "Nice Boat!". The door (112403) answers since
CSA-E (its Animator's Opened turned over). The cargo (112402, CSA-H), the
variant (112404, CSA-H's ports) and the position (112406, CSA-I) are
raced and answer nothing yet. The street's plaque names a boat by its hull.

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

## The sails and the wind (CSA-E)

### Unity's Animator

Every moving part of a boat is a Mecanim Animator the C# only asks -
CrossFade, SetBool, SetFloat, GetBool, GetFloat. `world/unityAnimator.js`
is that Animator over what the extraction tool carried (the five
compiled controllers, the 26 override controllers' clip swaps, the 141
clips' muscle curves), and each prefab instance gets one per Animator
component as it is instanced (`systems/comeSailAwayBoat.js`
importCustomGameobject - Unity's OnEnable). What it restates:

- a curve is a constant or streamed Hermite segments (at t the last
  segment starting at or before it: ((a dt + b) dt + c) dt + d), or dense
  samples; a clip is sampled at start + its normalized time times its
  length, wrapped when it loops and held at an end when not;
- a binding is the CRC32 of the transform's path from the Animator's node,
  one of position, rotation (a quaternion, or euler angles turned Z, then
  X, then Y) or scale; what no clip of the controller animates is left
  alone, and every state writes the default (the value at binding) of
  what it does not animate;
- the two blend trees the controllers use: Simple 1D by its parameter
  over its thresholds, and Simple Directional 2D by two (the rudder's
  RowX and RowZ over forward, back, centre, right and left) - the centre
  and the two directions bracketing the input, barycentric, the pair
  alone outside their triangle; the children on one normalized time, the
  tree as long as its children weighted;
- poses blend by weight, rotations summed on the first's hemisphere and
  normalised;
- one layer's state machine: the default state at nought when it first
  runs; each frame the time advanced by dt times the state's speed (and
  its speed parameter: the rudder's RowSpeed) over its length; the
  controller's transitions asked in order - every condition, and an exit
  time crossed that frame (below one, on every loop) - each fading over
  its duration (fixed seconds, or times the source's length);
- CrossFade: the named state faded to over its normalized duration times
  the current state's length, taken at the next update; a state already
  playing is left as it plays; a fade already running is frozen where it
  stood and the new state faded in over it;
- disabled (its node off, or the component) it stands still; enabled
  again it starts over (m_KeepAnimatorControllerStateOnDisable is false
  on every Animator here).

The Animators step once a frame at the head of the mod's LateUpdate
(after every Update, before every LateUpdate - where Unity steps them),
on Time.deltaTime. The sails' Animators blend their Stowed pose or their
Unstowed tree by Wind; the rudder's is Disembarked, Rowing (the oars) or
Sailing (the tiller or the wheel by TurnAngle), its Rowing and Sailing
joined by the controller's own transitions on its Sailing bool; a door's
is Closed or Opened. StartSailing fades the rudder to Rowing over one,
the two StopSailings to Disembarked; the oars' arm sets RowZ, RowX (the
input's walk) and RowSpeed (the speed over 20, held to 0.2-2), the sails'
arm TurnAngle; TriggerDoor (112403) turns the Opened of the door the
trigger hangs under.

### The wind

Start's wind stays (15 x Random.Range(-12, 12) degrees off forward, of
length one). UpdateWind rolls a new one - indoors none at all (both
vectors nought); outdoors a strength of Random.Range(1f, 2f), a tenth of
it in fog, half again in rain and twice in a storm, along right turned
toward the back by day and toward the front from 18:00 to 06:00, flipped
south of the map's row 250, then turned 15 x Random.Range(-4, 4)
degrees - on the hour (WorldTime.OnNewHour: the hour of the day asked
each frame), on a weather change (the weather coming) and on a
transition (which also puts the time scale back, without a word).
RotateWind walks the current toward it: at once and then at each frame's
end by a tenth of a radian a second (Vector3.RotateTowards, its length
by up to one a step), until the two are equal, and then raises
OnUpdateWind. The rain's and the snow's forces it sets on each step are
the particles' (CSA-F).

### The sails

GetSailPower sums each raised sail's pull by its kind and its angle to
the wind (the flat angle between the wind and the sail's forward): a
lateen from half along it to full at 135 and back to half at 165, nought
past, less a fifth-and-a-bit with the wind on its right; a gaff from
half to full at 135 and nought at 150, backing a quarter past; a
staysail from a fifth to four fifths at 135, nought at 150, backing a
quarter past; a square sail full before the wind, nought at 90, backing
twice past it; a small gaff a half, a small staysail three tenths and
any other small sail four tenths of that, a large one half again. The
sails' arm drives the boat forward by it times the wind's length (at
the sails' speed and acceleration) and turns it by the right and left
keys at the speed it makes times the rudder's modifier over ten (the
same refused turn as the oars').

The ToggleSail key raises them (refused while a node is off water:
"Unable to raise sail. Boat is obstructed.") or lowers them; with the
sails up, the square-sail assist off, the trim modifier held and a
lateen or a gaff aboard, it raises or lowers the square ones alone.
Raising leaves the square sails stowed with the wind more than 90 off the
bow when the assist is on; the rudder's Sailing follows the sails. Each
frame under sail: an obstructed boat lowers them and stops; each sail's
Wind walks toward its pull (by one a second: the wind's length signed by
the side it fills, a staysail's own pull) and a sail luffing head to wind
(past 150, or 165 for a lateen) flaps on a sine of the clock, each by its
place in the list; with the assist on the square sails stow and rise as
the wind goes more or less than 90 off the bow. Leaving the helm lowers
raised sails; a save taken with them up raises them as it loads.

### The trim

With the auto trim on (SailingAssist.AutoTrimming) each boom turns at 100
degrees a second toward the wind: a square one to the wind's angle off
the bow held to 45, a lateen and a gaff to the side it blows from (90 to
45 on a reach, easing to nought running), a boat with a large square
sail and a gaff held to 30, a stowed sail's boom home, a gaff swinging
out at 300. Off, the brackets turn the fore-and-aft booms 15 degrees a
second to 90 either way, and with the modifier (or on a boat with
neither lateen nor gaff) the square ones to 45, every boom set to its
angle each frame.

### The widget

At the helm, unpaused, the wind's direction off the player's forward is
drawn as one of the mod's 24 pictures (fifteen degrees apart, the
`112395_1-*` it imports at Start), centred at WindDirectionWidget.Position
of the screen, lifted by the large HUD's height when it rides above the
horse, sized by the picture, the screen's scale (none, the height's, or
both of a 320x200) and its own Scale, tinted its Color - over the HUD, as
GUI.depth -1 draws it over DFU's, in the street, a building and a
dungeon. The debug values OnGUI prints beside it are CSA-I's, with the
rest of OnGUI.

### The keys

The sails' key is End and the trim's the mod's own brackets and
backslash (registry actions BoatToggleSail, BoatTrimRight, BoatTrimLeft,
BoatTrimModifier; `10-UI/Controls.md`): the mod's Space is Jump's. The
time keys are CSA-G's.

Seen live (scratch renders, 2026-09-27; `?shot` probes with Iliac Puddle
No More off): on the town pond at Daggerfall's 207, 213 the sails' key was
refused as the C# refuses it - two of the skiff's five nodes read land
("Unable to raise sail. Boat is obstructed."); on open sea at 208, 215 (a
probe hook, `__csaOpenWater`, finds a water tile three tiles clear all
round) all five read water, and End raised the Large Boat's lateen (its
Animator faded Stowed to Unstowed, the rudder's Sailing set) - the wind,
rolled since the boot and turning toward its target, filled it from
abaft the beam, its Wind walked to the wind's length on the lee side,
and the boat made 1.96 m/s, 6.7 m in a few seconds with the player
carried; End again stowed it and the boat coasted down; the widget's
arrow stood on its ring round the crosshair, stepping frame by frame (4
to 9) as the wind came round, its 24 pictures loaded at the first draw.

**Kept bug for bug**: every UpdateWind starts one more RotateWind, so two
running turn the wind twice as fast; GetSailPower takes the hull's angle to each
sail and drops it, and a lateen's backing arm can never be reached; the
load raises the sails before it restores the wind (the wind it loads
into decides the square sails), and never restores the target; an
obstructed frame lowers the sails and still reads their power; the
manual trim sets every boom each frame whether the sails are up or not.

**Declared** (the Port-Ledger's Come Sail Away row): the sails' key (End:
the mod's Space is Jump's); the Animator's readings of an engine the
port cannot open (CrossFade's duration against the source's length, a
state already playing left alone, a running fade frozen, the directional
blend's triangle, the blend's hemisphere sum, the euler order, the reset
on enable keeping the first binding's defaults, no animation events -
the oars' sounds are CSA-G's); the Animators stepped at the head of the
mod's LateUpdate; RotateTowards and SlerpUnclamped restated from their
documented behaviour; OnNewHour the hour of the day asked each frame (not
on the first) and OnWeatherChange the host's word changing (the port's
eighth, the sandstorm, is none of UpdateWind's three); the widget through
the renderer's screen quad over the port's HUD, its pictures the vendored
ones loaded at its first draw.

## The waves and the effects (CSA-F)

### The waves

Not the open sea's swell: a strip of breakers laid on the water along
every coast within Waves.Distance map pixels of the player
(`systems/comeSailAwayWaves.js` buildWaveMesh, UpdateWaveMesh past its
gate, 2797-3477). A map pixel is WATER when WOODS.WLD's height there is
2 or less (6 under World of Daggerfall's terrain, which the port does
not carry) and none of four rays dropped from 500 m over the vertical
compensation, a thousand long, at its quarter points (204.8 and 614.4
into it) meets anything more than a metre over the sea (`(int)WaterLevel
+ 1`, 35). Each water pixel then asks the same of its eight neighbours,
and every neighbour that is LAND gets a fan from the water pixel's inner
quarter out to the land pixel's centre (a side: five vertices, three
triangles), or the corner pieces between two (a diagonal: one wide piece
when both sides are land too, two when one is not, one small one when
neither is) - the C#'s four sides and their corners, transliterated
block for block, every vertex, uv and index in its order. The mesh is in
map pixel units round the player's own pixel; the object that carries
it stands at that pixel's centre (409.6, 409.6), a tenth of a metre over
the water and the compensation, 819.2 to a unit; Mesh.RecalculateNormals
(the sails' own, `world/skinnedBake.js`) gives every triangle up.

THE FRAME OF REFERENCE is DFU's floating origin, which the port keeps
(`world/streamingWorld.js`): after every recentre the player's own map
pixel has its corner at x = z = 0, so the C#'s absolute 204.8 and 614.4
and its object's 409.6 are the port's as they stand, and the ocean the
mod calls 34 is the port's 27.2 x 1.25.

UpdateWaveMesh clears the mesh first, then stops with the waves off, the
player inside or on their ship (TransportManager.IsOnShip); Animated
Water's vertex waves are CSA-J's. It runs on OnLoad, OnTransition and
OnPositionUpdate at once, and on OnTeleportToCoordinates a tenth of a
second of Time.time later (UpdateWaveMeshDelayed: a WaitForSeconds
coroutine, resumed after Update as Unity resumes them - the runtime's
second coroutine queue beside the end-of-frame one).

THE MATERIAL is the bundle's CurrentMaterial, which the extractor now
carries beside the prefabs' (`NAMED_MATERIALS`: the one material Start
loads by name): Daggerfall/Dither/Wave, the frame tiled ten times each
way, tinted (0.5, 0.75, 1), cut out below half its alpha. Its shader is
restated from the bundle's compiled GLSL (`render/comeSailAwayRender.js`
WAVE_FS): the raw v (the tiled one over ten) folded about a half, `1 -
x^2(3 - 2x)` of its span from _DitherStart to _DitherEnd (LoadSettings:
the Fade's share of half the Length, and half the Length) against the
8x8 Bayer threshold at the screen pixel - the texture's 64 red values
carried as the table they are (`BAYER_8X8`; the bundle's own rounding,
its ranks the Bayer order, pinned) - the cut, the tint, the light and
the world's fog (its FOG_LINEAR/EXP/EXP2 variants), opaque, its depth
written, back faces culled. Drawn with the world's cut-outs, after the
ground and before the sea's transparent top.

THE FRAMES are rebuilt, never shipped (CSA-A): each of the 32 is one of
the author's two paints scrolled down its rows, its key colour standing
for Daggerfall's snow (TEXTURE.303 record 1) tiled under it. The shader
composes the one texel a fragment samples - Unity's point sample with
Repeat, `composeTiledPicture`'s own integer arithmetic (pinned texel for
texel) - so the port uploads the two paints and the player's snow, not
32 frames of 640x640.

Update's frame step (4769-4799): the timer climbs by Time.deltaTime
until it reaches the frame time and the frame after it steps, forward by
day and back by night (six to eighteen), round the ends; the frame time
is `(2 - Speed / 100) * 0.125` with the integer division.

THE CURRENT (FixedUpdate, 5147-5198), written only with the waves on:
once any wave mesh was laid, whichever quarter of the pixel the player
stands in faces a land neighbour pulls that axis to one (toward it), the
wind's own component elsewhere, normalized to half the wind's strength,
reversed where the pixel's own middle is land and again by night; before
any mesh, the wind at half strength (nought over a dungeon block's
water). OnUpdateCurrent when it changes (CSA-J's listeners). LateUpdate's
move carries the boat on it (CSA-D).

### Unity's particle system

`world/unityParticles.js` restates what the prefabs' Shuriken systems
switch on (their every module serialized in Models/prefabs.json): the
main module's duration, looping, lifetime, speed, size (per axis) and
rotation (per axis) at birth - a constant or a random between two - the
simulation space (Local: the particles ride the emitter; World: they
stay) and scaling mode Local (the object's own scale, not its parents',
scales what it emits: the wake's 10 and 20); emission over time and over
distance (the emitter's world movement from the step after Play), each
with its own accumulator, a frame's particles born at the fraction the
accumulator crossed a whole one, where the emitter then stood, and aged
the rest of the frame; bursts at their time in each loop; the Box (a
point in its volume, moving along the shape's +Z) and the Cone (a point
on its base disc, out along the cone) through the shape's own position,
rotation and scale - a direction the scale bends to nothing (a point
emitter's zero scale) keeps the shape's own axis; size over lifetime
(one curve or three, each an AnimationCurve evaluated by the port's one
home for it, `world/worldClock.js` evaluateCurve - the sun's curves' own;
the prefabs' 81 keys are unweighted, none stepped) and force over
lifetime (local or world); plane
collision (a transform's position and up, crossed within the particle's
radius - half its size - losing its lifetime by the loss fraction: all
of it here) firing the collision sub-emitters, whose bursts are born at
the point; Play and Stop reaching the children (withChildren) but never
a system that is a sub-emitter. The systems step at the head of the
mod's LateUpdate, after the Animators (PreLateUpdate's
ParticleSystemBeginUpdateAll); an inactive one stands still.

Drawn (`render/comeSailAwayRender.js`): the HorizontalBillboard quads
flat on the water, turned by each particle's rotation, no larger than
the renderer's maxParticleSize of the view's height; WakeMaterial
(Daggerfall/BillboardWaterMasked: the mod's splash, 112395_0-0, cut out
at half alpha, lit, depth written, back faces culled) with the waves;
Default-Particle (Legacy Particles/Alpha Blended Premultiply: `tex x
colour x colour.a` added over the frame, no depth, no fog, both faces)
after the sea's transparent top; the flag's Mesh particles - Unity's cube
sized per axis, turned by its system and its own 45 degrees -
FlagMaterial's orange, lit. A boat kept in a dungeon or a building
(CSA-C's) draws them in that mode's pass: the quads and the flag with its
hull (`drawModeMeshes`), the drops after the dungeon's water, or after
the room's last world draw (`csaDrawParticlesBlended`, before the first
screen quad).

### The effects

- **The wake** (Update 4737-4755): under way past the threshold with the
  fast loop silent, the wake plays and the loops crossfade to the fast
  one; slowed under it with the slow loop silent, the wake stops and the
  loops crossfade back. Every frame at the helm its particles' life is
  `speed x 0.2 / 2 x the wake's scale` (one to ten), their size `speed x
  0.2 / 2` (before the scale) and their drift a world force of a tenth of
  the current over the scale. StartSailing, both StopSailings and every
  SetBoatPositionAndDirection stop it.
- **The two loops' play state** (PlaySlow, PlayFast, FadeAudioSource,
  CrossfadeAudioSource and their coroutines, 6527-6600) land here because
  the wake reads them: each loop's AudioSource carries `isPlaying` and
  `volume`, set as the C# sets them; one `fading` coroutine for every
  boat, a crossfade dropped while one runs, a fade stopping the last. A
  placed boat plays its slow loop. What they sound is CSA-G's (the host's
  `audio` hook).
- **The rudder's drops** play at the helm and stop on leaving it: a Box
  of zero size shooting 100 m/s along the rudder effect's forward per
  metre it moves, each drop dying on the hull's helper Plane and firing a
  splash there. The oars' drops are built and carried; the oars' events
  that play them are CSA-G's.
- **OnPositionUpdateBoat** stops the wake, moves its living particles and
  every oar's splashes (its first sub-emitter's) by the offset, and at
  the helm under way plays the wake again.
- **The bob** (LateUpdate 4985-5031): every active boat, not beached, is
  rocked by the wind - Time.time plus its index over the time scale, the
  roll `sin(t x 0.5 x |wind|) x |wind|` plus the helm's lean into a turn
  (`-5 x` the turn's share, clamped to 30), the pitch `sin(t x |wind|) x
  |wind|` times modifierAnimation. Animated Water's arm is CSA-J's.
- **The flag**: its forward the wind less a tenth of the boat's way, its
  streamer's start speed half that vector's length - fifty cubes a
  second, half a second each, the pennant tapering as the size module's
  y falls from three to nought.
- **Rain and snow**: each RotateWind step sets the rain's
  ForceOverLifetime to a random between 10 and 50 times the wind (x and
  z) and the snow's between 5 and 25, handed to the host
  (`precipitationForce`).

Seen live (scratch renders, 2026-09-27; `?shot` probes with Iliac Puddle
No More off): at Daggerfall's 207, 213 no wave is laid - the city's
coastal pixels meet its slopes 48 to 220 m up at their quarter points,
so none of them is water to the rays; hopped a pixel at a time toward
the sea south-east, the world recentring on each hop, OnPositionUpdate
laid 84, 118, 152 and at 210, 218 236 vertices in 100 triangles, the
object over the player's pixel at (409.6, 34.1, 409.6) and the player's
feet on the sea at 34; looking down, the breakers lay on the water along
the coast, stippled out toward the land by the dither and tinted blue
over the snow, their frame stepping from one hop to the next. The
current read the last water pixel's neighbours (the kept bug). A skiff
spawned on open water there and rowed from the helm at its 2 m/s: each
second the runtime held the wake playing with two splashes alive (half
a particle a metre, each living two seconds at that speed), the loops
crossfaded to the fast one, the bow's spray and the rudder's drops and
splashes alive, the flag's 25 cubes, and the bob's turn changing; the
shots show the flag streaming orange at the masthead and the spray at
the waterline (the wake's own quads lie astern, under the hull from the
helm's eye).

**Kept bug for bug**: currentNeighbors is taken in every water pixel's
loop, so the current reads the LAST water pixel's neighbours (the
farthest east, then south), not the player's; the neighbour rays rise
from 500 over the world's origin while the first loop's rise from 500
over the compensation; an empty list returns before the loop, keeping
the last neighbours, and once any mesh was laid they are never cleared
(the current keeps reading them indoors); a boat's deck under a ray is
land to it; the fades set each volume before their clock steps, so they
end a step short of the volume they fade to; the bob's roll is not
scaled by modifierAnimation (the C#'s precedence); OnPositionUpdateBoat
carries the oars' splashes and not the rudder's.

**Declared** (the Port-Ledger's Come Sail Away row): Unity's particle
system restated from its documented behaviour - the draws the host's
(Math.random, as OH-C's miasma's), the curves sampled as the
AnimationCurves they are (Unity bakes them to polynomial segments), a
world force applied unscaled, the scale bending a direction and a zero
one keeping the shape's axis, rate over distance counted in any
simulation space; the waves and particles lit as the port lights its
flats (the ambient and the sun's Lambert term: no spherical harmonics,
vertex lights or screen-space shadow), the dither's phase the port's
screen pixel; the frames composed where the shader samples them; the
Bayer table carried as its 64 thresholds; the port's own soft dot for
Unity's Default-Particle picture; rain and snow keep the port's own
precipitation - its rain and snow are a shader volume
(`render/precipitation.js`), no particle system for a force to act on -
so the forces RotateWind sets are handed to a host hook the port leaves
unset; the hulls' water masks (WaterMask/Mask: colour alone, before any
opaque thing, no depth, back faces culled) are not drawn - flat outlines
at each hull's waterline, the sea or the hull always draws over them.

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

`test/csa_animator.test.js` (17): the binding hash; the curves (a
constant, a streamed segment - a linear one and a step at its own key
included - and dense samples); a clip's time; Quaternion.Euler's order;
the two blend trees' weights; the pose blend; the bindings and write
defaults; CrossFade (its next-update take, its duration against the
source, a playing state left, a running fade frozen); a controller
transition (its conditions, its exit time on every loop and across one
long frame, a fixed duration in seconds); a speed parameter; disable and
enable; an override's swap; and on the vendored data every hull's
Animators bound, every sail Stowed, a lateen raised and the rudder rowing
into Sailing. `test/csa_wind.test.js` (19): Unity's angles and
RotateTowards; UpdateWind and RotateWind; the three events; GetSailPower
for every kind; raising, lowering and the square sails' assist; the
sails' key and its modifier; the sail arm; the trim, auto and by hand;
the widget's frame and rect; the sails at the helm's edges and on load;
the rudder's and the door's Animators. `tools/mutants/csa_wind.json`:
127 mutants, all dead.

`test/csa_waves.test.js` (18): land at once, no ray cast, and the
object's stand; the first loop's rays (their origins, order and reach,
the metre over the sea); the neighbour rays from the origin's 500
(kept); a side's fan and the small corners, and the same pieces a pixel
off the player's; a corner's two pieces and its wide one; the current
off the last water pixel's neighbours (kept); the material as the tool
carried it, and the one the assembly loads by name; the 32 frames'
specs; LoadSettings' numbers; the frame step; the wave shader's
arithmetic; the Bayer table's ranks and values (and with `CSA_BUNDLE`
the bundle's own); the frame composed where it is sampled, texel for
texel against composeTiledPicture; UpdateWaveMesh's gate and the kept
neighbours of an empty rebuild; the four events (the teleport's
WaitForSeconds); Update's step; FixedUpdate's current with and without a
coast, its quarter lines at Unity's floats. `test/csa_particles.test.js`
(9): AnimationCurve.Evaluate and MinMaxCurve's modes; an instance's
systems and their links; Play and Stop with the children; rate over
distance; Local scaling (the size, and the Box's volume); the drops (the
zero-scale Box, the Plane, the splash); a burst and a duration; a world
force and a local system; the flag's Mesh particles.
`test/csa_effects.test.js` (10): a placed boat's slow loop; the wake arm
(StartSailing's stop, both loops played by the crossfade, the scaled
life, the threshold itself, PlaySlow stopping the fast loop); slowing,
and a crossfade dropped; StopSailing; OnPositionUpdate's stop and carry
(the rudder's splashes left, kept); the bob (the roll unscaled, kept);
the flag; RotateWind's rain and snow; the systems stepped at LateUpdate's
head and a paused frame; the particles' materials and the soft dot.
`tools/mutants/csa_waves.json`: 127 mutants, all dead.
