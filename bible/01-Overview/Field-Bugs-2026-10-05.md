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
