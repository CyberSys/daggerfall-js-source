# Vanilla Enhanced (VE1-VE3, 2026-10-05)

Asked 2026-10-05: "I want to implement the vanilla enhanced textures but the
file is way too large to post here."

The file never had to be posted. carademono's **Vanilla Enhanced** (Nexus
Mods, Daggerfall Unity mod 273, 3.5.0 there) keeps its whole source in a
public repository, github.com/drcarademono/vanilla-enhanced (its manifests
read 3.4.7), and the session read the mod's shapes off that tree. **None of
it ships**, and the reason is not the size.

## What the mod is, and why none of it ships

Five manifests stand in its tree:

| Manifest | Depends on | What it carries |
|---|---|---|
| Vanilla Enhanced - Base | World of Daggerfall - Biomes, World of Daggerfall, RMB Resource Pack (all optional) | the eleven terrain tile sets (002-004, 102-104, 302-304, 402-403) TWICE - each a `<archive>-TexArray` (BC7, GraphicsFormat 108, 256 px, 56 slices) and its 56 PNGs; the nature flats 500-511 and the flats of 005, 105, 106, 194, 195; the city walls 017/018 in four climates; twenty dungeon archives; ten Materials and their rock pictures, over World of Daggerfall's and the RMB Resource Pack's models - 1,268 files |
| Vanilla Enhanced - Masked Roads | Base (required), World of Daggerfall - Biomes (optional) | the eleven tile sets again, and records 46, 47 and 55 of 103/303/403 |
| Vanilla Enhanced - Snowless Swamps and Jungles | Base (required), Masked Roads and World of Daggerfall - Biomes (optional) | 402 and 403 again, array and records, and the winter records of twelve swamp architecture archives (408-470) |
| Vanilla Enhanced - Winter Tracks | Base (required) | thirty winter records of 103, 303 and 403 |
| Kokey's Temperate | nothing | TEXTURE.302's 56 records, no array |

Its pictures are Daggerfall's own, repainted - the manifest's own words are
"Remastered vanilla textures", its flats' readme "repainted by me, keeping
as close to the original art as possible". That is Port-Doctrine's own case
(A RENDER OF GAME DATA IS GAME DATA; `test/doctrine.test.js` holds `public/`
to it), and no permission an author gives can answer it, because the art
underneath is not the author's to give. Nor can the port BUILD them, the way
DS1 and LPT1 rebuilt their borrowed pictures from the player's own records
(`formats/derivedTexture.js`): a spec paints a copy, a crop or an edit laid
on a record, and a repaint is none of those. So it goes the way Seasons of
the Iliac Bay's re-shaded flats and DREAM went: **the player attaches their
own `.dfmod` files**, through the texture-mod door DFMOD1 built
(`systems/dfmodTextures.js`, PR #437), and the Texture Overhaul card wears
them.

Reading the mod against that door found it two laws short of DFU. Both are
the door's, not the mod's - every texture mod rides them.

## VE1 - DFU's load order

**THE DEFECT.** Where two attached mods carried one name, the door kept the
FIRST by file name, and it read no dependency at all. DFU answers with the
mod loaded LAST: `ModManager.TryGetAsset` walks `EnumerateEnabledModsReverse`
(ModManager.cs:404-415, :1146-1153), and `AutoSortMods` (:1059-1082) loads
every mod after the mods it depends on. Vanilla Enhanced's add-ons are BUILT
on that law: Masked Roads and Snowless Swamps carry the Base's own names -
all eleven arrays, 402 and 403, records 46/47/55 - to replace them. Under
the old door the Base won every one, and both add-ons did nothing.

**THE LAW, PORTED** (`dfmodLoadOrder`):

- the base order is the Mods folder's listing - `Directory.GetFiles` gives
  the initial `LoadPriority` (:563-592) - by file name;
- `AutoSortMods` is `TopologicalSort` (:1261-1288) over each mod's
  dependencies `where !dependency.IsPeer`, resolved by `GetModFromName`
  (`Mod.FileName`, the `.dfmod`'s name without its extension -
  `GetModNameFromPath` :1236-1241) with the missing dropped. An OPTIONAL
  dependency that is attached orders too - only peers are free. The visit
  is depth-first in the base order, a mod's dependencies first;
- a cycle throws in `TopologicalSort`, `AutoSortMods` catches it and keeps
  the order it had - here the base order, with a warning;
- the lookup is TryGetAsset's: every door is filled walking the mods
  switched on LAST-LOADED FIRST, and the first to carry a name keeps it -
  the textures, the billboard xml (XMLManager seeks it by its OWN name,
  whichever mod drew the picture), the IMG and CIF/RCI pictures, and the
  ground's names (VE2).

The stored name index (`dfmod-index/<file>`) carries the manifest's
`Dependencies` as `[name, isOptional, isPeer]` (`manifestDeps`), at index
version 3; a version-2 index is refused and rebuilt in the background, as
GROUND1's version 2 was. The packs card lists the mods in load order, and
says so when more than one is attached.

**VE3's Mod.Enabled rides the same walk.** DFU's mod window switches a mod
off without removing it, and TryGetAsset reads only the mods switched on.
`setDfmodEnabled` switches attached mods on or off and puts every door back
at once; a mod switched off keeps its place in the order and has its bundle
closed (DFU unloads it). The keys switched off live on the port's prefs
shelf (`dfmodOff`); a fresh attach is on (`forgetDfmodOff`, at the attach
and at both removals), and the boot's warm opens only what is on. A set
with every mod switched off puts nothing on the doors and is STILL a
registration: the door's idempotency read its count's truthiness, so the
Classic look would have registered again at every host's boot, bumping
the generation every cache of mod pictures keys on (`_registered !== null`
now).

## VE2 - the ground's tile set, 1:1

GROUND1 read a mod's terrain only as a `<archive>-TexArray`, and kept the
first mod by name. DFU's law is `TextureReader.GetTerrainTextureArray`
(TextureReader.cs:757-803) over `TextureReplacement.TryImportTextureArray`
(TextureReplacement.cs:325-352):

1. **A LOOSE RECORD 0 GOES FIRST.** `!TextureExistsAmongLooseFiles(archive,
   0, 0)` (:847-851) is what lets the mods be asked at all; a folder pick
   that carries `<archive>_0-0.png` sends the archive straight to its
   records.
2. **THE FIRST MOD TO CARRY EITHER NAME DECIDES.** The mods are asked for
   `<archive>-TexArray` and `<archive>_0-0` at once, in load order
   (`TryGetAsset(string[] names)`, :429-442): the first mod carrying either
   decides, its array before its record. Its array at the archive's depth
   EXACTLY (`textureArray.depth == depth`) is the set; an array of another
   depth is logged and refused - GROUND1 cut a deeper one down.
3. **OTHERWISE THE RECORDS.** Each record is sought loose-then-mods
   (`TryImportTexture`, :984-1005), the set made at record 0's size
   (TryMakeTextureArrayCopyTexture :1085-1149) or, when no record 0 is
   replaced, at the classic size (GetTerrainTextureArray's own loop
   :776-795).

`groundSource` answers the decision, `dfmodGroundLayers(archive, tex)` the
set - the hosts hand it the classic TEXTURE file, whose records size the
set when no record 0 is replaced and stand for the records nothing
replaces. The records decode `PRELOAD_CONCURRENCY` (8) at once, as an
archive's preload does - an HD pack's 56 decoded together would all be
held at once. The set is cached per archive and keyed on the loose pick's
generation (`looseTextureGeneration`), so a new folder pick builds it again;
a new mod set empties it.

**WHAT VANILLA ENHANCED DOES WITH IT, ACCORDING TO DFU'S OWN LOOKUP.** The
Base's arrays decide all eleven archives; Masked Roads' arrays decide over
the Base's when it is attached, and Snowless Swamps' 402/403 over both.
Winter Tracks carries neither `103-TexArray` nor `103_0-0` (its records
start at 10), so TryGetAsset passes it and meets the Base's array: over
this Base its records are never asked - in DFU as here. Kokey's Temperate
lists BEFORE the Base by file name, so the Base's 302 array decides over it
in DFU's default order, as it does here.

**THE FOUR HOSTS.** `scenes/world.js` and `scenes/exterior.js` - the two
that draw ground - hand `groundTex` and upload what comes back (the grass's
colours are taken off the same cached set, GRASS-LIT2's law).
`scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` are
FLAGGED here and need nothing: they draw no ground, and every other picture
reaches them through the texture door whose order VE1 set.

## VE3 - the Texture Overhaul card

OVH1b left the card standing empty "until the first texture pack". Vanilla
Enhanced is that pack, beside **Classic** (`systems/vanillaEnhanced.js`,
`systems/overhauls.js`):

- **Classic** is in use when Replace Game Artwork is off, or when no texture
  mod is on and no loose texture pack is attached. Wearing it switches
  every texture mod off and keeps it attached - never the lighting mod,
  which rides the same store and is no texture mod (the packs card's own
  split). A loose pack has no switch; while one is attached the card reads
  Custom and says where the packs are.
- **Vanilla Enhanced** is in use when its Base is attached and on and
  Replace Game Artwork is on. Its family is the Base (`vanilla enhanced -
  base`, or its GUID `1f124f8c-dd01-48ad-a5b9-0b4a0e4702d2`) and every mod
  that depends on it. Wearing it switches the family on and Replace Game
  Artwork (`Enhancements/AssetInjection`) with it - the switch every pack
  stands behind; other texture mods are left as they are. While no copy is
  attached the card's button reads **Add Vanilla Enhanced...** and opens the
  `.dfmod` pick in the pack's own words (`pickDfmodFiles(o.attach)`); a pick
  closed with no Base in it wears nothing. The card names the attached
  copy's version.
- The effect line is the card's own: it takes effect when the world next
  loads - what is drawn keeps its pictures until its area loads again, and
  a tile set already uploaded stays until PLACE-LRU lets it go (true of
  every texture mod since DFMOD1).
- The packs card carries a **Switch off / Switch on** beside every texture
  mod's Remove.

Online it is the player's own: a texture mod is a picture on one machine,
and nothing of it reaches the wire.

## The departures (Ledger A, the VANILLA ENHANCED row)

1. **The order is always AutoSortMods'.** DFU asks the player to sort when a
   dependency stands below its dependent (`ModLoaderInterfaceWindow
   .CheckDependencies`), and its mod window moves a mod by hand; the port
   has no mod window, so its order is the listing's under AutoSortMods,
   always.
2. **A dependency's name is matched lower case.** DFU's match is Ordinal;
   the store keeps every key lower case (`dfmodStoreKey`), so case cannot be
   told - a mod builder writes the names lower case either way.
3. **A record a records-built set does not replace, or carries at another
   size, is the classic record at the set's size.** DFU leaves that slice
   unset (TryMakeTextureArrayCopyTexture logs it) or throws (SetPixels32 of
   another size) - a hole in the ground either way.
4. **A mod's ground record is decoded at the texture detail** (DFMOD2), with
   no deadline, as the arrays are - the ground is uploaded once.
5. **Mod.Enabled lives on the prefs shelf** (`dfmodOff`), not in a
   Mods.json; a fresh attach is on.
6. **Wearing Vanilla Enhanced turns Replace Game Artwork on.**

## Not done

- **The mod's ten Materials** (`2003_4-0`, `2005_2-0`, `2006_0-0`..`2006_7-0`
  - its rocks over World of Daggerfall's and the RMB Resource Pack's
  models). TryImportMaterial seeks a Material by name before any texture;
  the port has no Material reader and indexes none. Ledger C, A MOD'S
  MATERIALS.
- **The 3.5.0 bundles themselves were not read in this session**: Nexus
  refuses this session's network, and the GitHub tree is the Unity project,
  not the built bundles. The formats are DREAM's - the arrays' GraphicsFormat
  108 is the one GROUND1 decodes, read off the tree's own `.asset` headers -
  so the shapes are known; a probe over a player's real copy is owed.

## Pins

`test/ve1_vanillaEnhanced.test.js` (9) - the load order against DFU's laws
and Vanilla Enhanced's own manifests, the index, the walk on every door, the
switch, the ground's decision and its records' set, the hosts, the card and
the menu. Re-aimed: DFMOD1's door pin (it pinned the first mod by name),
its wiring pin, GROUND1's door pin (the classic file handed in, the depth
law), GRASS-LIT2's host pin and OVH1's panel pin. Mutants:
`tools/mutants/ve1.json` (38, all dead), and `tools/mutants/overhauls.json`'s
texture-panel record re-aimed by content. The browser half,
`tools/overhaulsProbe.mjs`: 23 checks, the card in Chromium - Classic in
use with nothing attached, Vanilla Enhanced's button opening the pick in its
own words, a closed pick wearing nothing; it also corrects one check that
had read plain Enhanced on the UI card since PLUS-ONLY named it Enhanced
Plus, and failed on every run since.
