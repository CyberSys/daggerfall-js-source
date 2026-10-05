# FIELD BUGS 2026-10-05b - the decorator's missing pieces, its low-poly trees, and the nude figures Show Nudity missed

The owner's two reports of the day:

> 1. There seems to be a lot of missing decor items with house decoration, plus elements should recieve the low poly overhaul style like trees got
> 2. Even with nudity turned off. Players can see and have access to nude vendors

Asked which pieces were missing (three gaps were traced in the catalogue) and which elements should take the low-poly
style, the owner chose all three gaps - the town mods' furnishings, the outdoor pieces for a yard, the dungeons'
furnishings - and, for the style, a placed tree or plant standing as Low Poly Trees' own 3D tree, as the world's do.
Each change below is pinned by tests that fail on the code before it, and its pins are mutation-checked. Nothing here
was seen in a browser: this container has no ARENA2, so every claim is the suites'.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "a lot of missing decor items with house decoration" - the dungeons' furnishings | the catalogue read the town blocks' rooms alone: nothing Daggerfall stands only in its dungeons - a throne, a cage, a coffin, a statue, chains - could be set in a house | DECOR-DUNGEON |
| 1 | "a lot of missing decor items with house decoration" - the outdoor pieces for a yard | a yard offered the rooms' furniture alone: none of what Daggerfall stands in its streets - a fence, a well, a fountain, a cart, a lamp - and none of its trees and plants | DECOR-OUTDOOR |
| 2 | "Even with nudity turned off. Players can see and have access to nude vendors" | HOME-VENDOR made every person Daggerfall stands in a room a catalogue piece a week after NUDE-FLATS, and no seam of the decorator asked NUDE-FLATS' table: the nude figures were offered, and one placed stood, flew and showed as itself; the Arena's tiers seat two of the table's figures, unasked too | NUDE-HOSTS |

## NUDE-HOSTS (2)

**Why.** NUDE-FLATS (2026-09-27, `Field-Bugs-2026-09-26b.md`) put Show Nudity over the world's people by asking its table
(`characters/nudeFlats.js` `drawnFlat`) at every host that stood a person ON THAT DAY, pinned by source. Two hosts came
after and never learned the rule:

- **The decorator** (HOME-VENDOR, 2026-10-03). The catalogue's Vendors are every person Daggerfall stands in a room
  (`systems/decorCatalogue.js` collectDecor reads the rooms' `blockPeopleRecords`) - the Temple of Kynareth's pair, the
  houses' and taverns' nude figures among them. The catalogue OFFERED them whatever the setting said, a placed one stood
  in the room as itself (`scenes/decorRoom.js` put), flew as itself when moved (`scenes/decorTool.js` the ghost) and
  showed as itself in the panel's lists (its thumbnails) - in every house, ship, online home, yard and hall, and to
  every visitor of a home whose owner placed one.
- **The Arena's tiers** (ARENA2). The crowd's own table (`systems/arenaCrowd.js` CROWD_PEOPLE) seats 182.48 ("blond
  whore", among the entertainers) and 184.6 ("bare-breasted wench", among the commoners), drawn as themselves.

**The fix.**

- **What is offered** (`decorRoomEntries`): while Show Nudity is off, no nude figure (`nudeFlats.js` `isNudeFlat` - the
  table's own keys) is offered in any room. Its clothed stand-in is a person of its own and stays offered, as itself.
  A figure chosen would stand as itself to every visitor whose setting is on - a piece its owner never saw.
- **What is drawn**: a placed figure stands as its stand-in while the setting is off - the stand-in's picture at its
  own size, on the piece's own base (`decorRoom.js` put); the ghost flies it so (`decorTool.js` beginPlacing); the
  panel's picture of it is the stand-in's (`thumbOf`), kept under its own key (`thumbKeyOf`, `ui/decorPanel.js`): the
  panel keeps its pictures for the session, so a setting turned off after the figure's own picture was drawn went on
  showing it in "In this room". The piece itself is unchanged - its key, name, price and station: a trader is still a
  trader, as NUDE-FLATS keeps a person's identity.
- **The crowd** (`scenes/arenaBouts.js` buildCrowd): a seat draws its picture through `drawnFlat`.
- **The sweep** (`test/nudedecor.test.js`). A rule each new host must remember is the rule the next one forgets (THE ONE
  CONSTRUCTION SEAM's lesson), so every file of `src/` that batches a billboard is NAMED in the test: a person host
  imports `nudeFlats.js` and asks `drawnFlat`; any other says what it draws instead (blood, loot, torches, foes and
  peers as mobile units, ...). A new file that batches a billboard fails there the day it lands until someone answers
  "does it draw a person?". Come Sail Away draws its vendored prefabs' people exactly as the mod lays them; the test
  holds those prefabs to the table (none of its figures).

Read when a scene is built, as NUDE-FLATS reads it: a room, a yard or a crowd stood before the setting turned is
redrawn by the next one; the decorator's own lists follow the setting at once.

`test/nudedecor.test.js` (5); `tools/mutants/nudedecor.json` 9, 9 dead. The decor pins' fakes (`test/decorFakes.mjs`)
take a room's people and per-record sizes.

## DECOR-DUNGEON (1)

**Why.** "Everything Daggerfall furnishes" (DECOR1) was read as the furniture of its houses: the scan read BLOCKS.BSA's
town blocks (RMB) and their rooms alone (`systems/decorScan.js`, `systems/decorCatalogue.js` collectDecor). Whatever
Daggerfall stands only in its 187 dungeon blocks (RDB) was no piece.

**The fix.** The scan reads the dungeon blocks too, where its host says which they are (`isDungeonBlock`). A dungeon
block has no PROP type of its own (a room's furniture is its type-3 models; an RDB model is just a model), so a
dungeon's furnishing is told from the dungeon itself by its FAMILY: the furniture and props, ARCH3D 41000-43999, where the
dungeon's corridors, rooms, stairs and vaults are 50000-98999 (the seam census's own split, `tools/seamCensus.mjs`
isArchitecture). Some things Daggerfall keeps outside the families stand free all the same, and are named
(`DECOR_FREE_STANDING`, 37) - MEASURED, not borrowed (below). A model is a piece only where it stands doing nothing: one
that acts (a lever, the throne that casts, a lid that swings) or is a door (DFU's IsActionDoor, the exit door) never is -
the same throne standing still elsewhere is. A flat is a piece but an editor's marker (foes, treasure, quests), a flat
that acts, or the climate's nature; a dungeon's people are people.

**The things outside the families, measured.** The list first shipped as World of Daggerfall's outdoor placement palette
(`LocationHelper.cs`'s `models` table, its ids among the architecture's): measured over the 187 dungeon blocks of
BLOCKS.BSA, 20 of its 34 ids no dungeon stands doing nothing (eleven rocks, two arches, the obelisk, a pillar, the slab,
the anvil, the sickle - and the claymore and the spike, which stand only acting), so they offered nothing and said what
was not so; and of the things the dungeons do stand it named 14 and missed 23 - four of the eight statues (the
commonest, 62323, stands 26 times), a second sword, a crossbow, a pedestal, a column, the casket and the coffins, the
hangings, the beams, the boulders, the arcane cage and an arrow. The dungeons stand 731 models doing nothing
outside the families: 536 under a corridor's or a room's code (C0K, R01, L5W - the corridors and rooms themselves), and
195 under a name of their own (a statue's ST1, a sword's SWD, a wall's W01), each of those looked at one by one -
rendered from the player's own ARCH3D in the scratchpad (a render of game data is game data, and never leaves it) - and
the THINGS kept: a statue, a sword, a pedestal, a hanging, a coffin - never the dungeon itself,
its structure (a wall, a stair, a floor, a platform, a pit, a cave's cone of rock), its passages (a door, a trapdoor, a
portcullis, a ramp, a bridge) or its mechanisms (a lever and its housing). 37 are: the boulders (60512, 60520), the
marble arch (62317), the wooden beams (62318, 62319, 62321), the eight statues (62323-62330: a figure standing and one
seated, small and large, in pale stone and in dark), the marble columns (74009, 74201), the stone casket (74069), the
marble coffins and their lid (74071-74073), the pedestals (74082, 74086, 74091, 74237), the domed pavilion (74094), the
arms and armour (74221 the great crossbow, 74224-74228), the arcane cage (74229), the hangings (74800, 74804, 74806,
75800) and an arrow (99800). Each is named in the source by the tag Daggerfall's own dungeon editor gave its reference
(BLOCKS.BSA's model list: ST0-ST3, SWD, PED, LRG...) and how many times it stands still; `test/decordungeon.test.js`
measures both again over the player's own blocks where ARENA2 is at hand.

A piece found only in a dungeon is **Dungeon furniture** - unless the game files it already (a bed, a chest, a shelf, a
light, a treasure). A piece a house's room stands too is the room's reading, every placement counted.

**No name moves.** A shared name is numbered in id order; numbered all together, a dungeon's pieces renamed the rooms'
(a room's lone "Vendor" became "Vendor 1" the day a dungeon's prisoner joined it, and a dungeon's light of a lower
record renumbered every "Light" above it). Each place's pieces are now numbered among themselves and after the earlier
places' (a room's first, `DECOR_FROM`): the rooms' names are exactly as they were, the dungeons' continue them.

**One constructor.** The interior host and the yards each built the scan's deps by hand; they now call one
(`systems/decorScan.js` decorScanDeps), so what the scan grows is never remembered in one host and forgotten in the
other (THE ONE CONSTRUCTION SEAM). THE FOUR HOSTS: `worldModes.js` (rooms) and `world.js` (yards) WIRED, both through the
constructor; `exterior.js` stands no decorator; `dungeonContext.js` stands no decorator - the dungeons are only read.

A dungeon's piece draws in a house as its own model, in its base textures: the room's climate table carries only the
room's own models' swaps, and a dungeon's texture table is its dungeon's.

`test/decordungeon.test.js` (5, one over the player's own ARENA2); `tools/mutants/decordungeon.json` 14, 14 dead (one
puts back the palette's four statues). Moved: `test/decor1d.test.js`'s host pin
(the measures are the constructor's), `decor1d.json`'s dungeon-block record re-aimed (still dead), `test/decor1.test.js`'s
kinds (15). `world/rdbLayout.js` exports its walk (`rdbObjects`), its action test (`rdbModelActs` - renamed: an input
binding's `hasAction` already held the name) and `EXIT_DOOR_MODEL_ID`.

## DECOR-OUTDOOR (1)

**Why.** HOME-YARD (2026-09-30) put the decorator outdoors on the same catalogue as the rooms - Daggerfall's indoor
furniture, doors aside. Nothing Daggerfall stands in its streets was a piece: no fence, well, fountain, statue, bench,
cart or lamp post, and none of the trees, bushes, flowers and rocks of the climate.

**The catalogue** (`systems/decorCatalogue.js`):

- **The street.** Each town block's own models (`misc3dObjectRecords`) - all but a mill (its sails turn), a city's gate,
  the town's board (GUILD1e: the hall's own piece) and the ladder (`isStreetPiece`) - and its flats, the block's own
  (`miscFlatObjectRecords`) and each building's outside (`exterior.blockFlatObjectRecords`), but an editor's marker or
  the climate's nature. A street's person is a person (Vendors, under Show Nudity). Found only in a street, a piece is
  "Outdoors" - but a light, a crate, a person, as the game files them.
- **The nature.** Every climate's set (its SUMMER archive - `formats/mapsFile.js` CLIMATE_NATURE, now exported once) and
  every record Daggerfall stands of it, 1 to 31 (the wilderness lays them all, `world/terrainNature.js` layoutNature;
  record 0 is a marker), joined whole (`addDecorNature`, the scan's `nature` - its hosts' constructor says so). "Trees
  and plants": a tree of its set's TREE_RECORDS is a "Tree", any other a "Plant", each numbered among its own set.
- **Where they stand.** The street's and the nature's pieces are a yard's alone; a yard is offered the nature of its own
  climate (`room.natureBase`, the set its pixel names) - none where it knows none. The names of every earlier place
  stand as they were (DECOR_FROM: the rooms, the dungeons, then the street, then the nature).

**The yard** (`scenes/homeYards.js`, `scenes/yardNature.js`, `scenes/decorRoom.js`'s two new doors):

- **Its town's climate.** A yard's models were drawn with the pixel's climate table, which holds only the swaps of the
  models the town itself stood: a fence the town never stood drew in another climate's wood. A yard's model now writes
  its own swaps into that table - its town's climate and season, as the town's models do (`world/texRemap.js`
  remapSubMeshes under `applyClimate`) - before it stands (`prepareModel`); the pixel publishes its town's climate
  (`townClimate`).
- **Its town's animals.** A street's cow or a flame moves with the pixel's own animator, ticked with it (`flatAnims`).
- **Its town's nature, drawn as the pixel draws its own** (`standFlat` -> `yardNature.js`): the season's archive of its
  set (the woodlands' winter twins), Seasons of the Iliac Bay's picture of the record where the mod re-skins it now
  (uploaded under the install's key, without mips, as the pixel does), else the classic record - at the piece's own
  scale, mirrored when turned half round, leaning with the wind (WIND3).
- **Stood again with its pixel.** A pixel built again (a season's turn, an install, a painted home leaving the merge)
  stands its yards again in the new table, animator and season - that very frame, as a recentre is.
- **The decorator** shows a tree in its season: the ghost, and the panel's pictures (kept under their own key while the
  season makes them another picture).

THE FOUR HOSTS: `world.js` WIRED (the yards, and the pixel's `townClimate`, the seasons' helper); `worldModes.js`'s rooms
offer neither (the catalogue's offer, `decorRoomEntries`); `exterior.js` and `dungeonContext.js` stand no yard.

`test/decoroutdoor.test.js` (8); `tools/mutants/decoroutdoor.json` 21, 21 dead. Re-aimed by content: `guild1e.json`'s
scan record, `survtiers3.json`'s two world.js cites (moved by the cite shift), and `fb1001_yard.json`'s YARD-RECENTRE
record now names one site (the room's solid model, `solid`, stands once for both paths); `test/decor1.test.js`'s kinds
(17) and `test/decordungeon.test.js`'s DECOR_FROM moved with the table; `test/nudedecor.test.js` names `yardNature.js`.

