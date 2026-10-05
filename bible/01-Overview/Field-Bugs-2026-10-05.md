# FIELD BUGS 2026-10-05 - the decorator's missing pieces, its low-poly trees, and the nude figures Show Nudity missed

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
isArchitecture). A few pieces Daggerfall keeps among the architecture's ids stand free all the same - its rocks, arches,
obelisk, pillars, slab, stone statues, pedestals, the anvil, the weapons and the knight's armour - and are named
(`DECOR_FREE_STANDING`), each one World of Daggerfall's own placement palette stands on its own (its ids alone are read
there: a piece is offered only where Daggerfall itself stands it, and named as the catalogue names every piece). A model
is a piece only where it stands doing nothing: one that acts (a lever, the throne that casts, a lid that swings) or is a
door (DFU's IsActionDoor, the exit door) never is - the same throne standing still elsewhere is. A flat is a piece but
an editor's marker (foes, treasure, quests), a flat that acts, or the climate's nature; a dungeon's people are people.

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

`test/decordungeon.test.js` (4); `tools/mutants/decordungeon.json` 13, 13 dead. Moved: `test/decor1d.test.js`'s host pin
(the measures are the constructor's), `decor1d.json`'s dungeon-block record re-aimed (still dead), `test/decor1.test.js`'s
kinds (15). `world/rdbLayout.js` exports its walk (`rdbObjects`), its action test (`rdbModelActs` - renamed: an input
binding's `hasAction` already held the name) and `EXIT_DOOR_MODEL_ID`.

