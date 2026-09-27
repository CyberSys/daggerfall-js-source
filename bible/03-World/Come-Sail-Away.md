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
| CSA-B | THE BOATS BUILT: SpawnBoat, the variants, the billboard crew and lights, the transforms a hull carries, the game textures, the skinned bake (1120-1811) | |
| CSA-C | PLACING, PACKING AND THE SAVE: the placement ray, the nodes, the visibility, the saved boats (6112-6521, 3624-3820, 1923-2072) | |
| CSA-D | SAILING: StartSailing, StopSailing, Update, FixedUpdate, the collision, the beaching, the turns (4186-5202, 5783-6071) | |
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
  written here. The brackets, the backslash and the keypad's minus and
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
