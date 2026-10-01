# Beautiful Villages and Beautiful Cities (WD3, 2026-10-01)

carademono's two town mods, ported 1:1: **Beautiful Villages of Daggerfall
1.4.2** (7,317 villages, hamlets, farms, manors and temples, and every
roadside tavern through its blocks) and **Beautiful Cities of Daggerfall
0.5.0** (the 410 cities). Mac handed both over on 2026-10-01: "These are
the next mods I'd like to implement (We have permission) and ensure this
doesn't conflict or regress anything (For example housing customization).
For anything missing I need you to curate, like textures. I want you to be
as detailed as possible and take your time".

Provenance and what is carried: `vendor/beautiful-villages/README.md`,
`vendor/beautiful-cities/README.md`, `01-Overview/Mod-Registry.md`. The
format they ship in - one pack of the authors' edits over the player's own
`MAPS.BSA` and `BLOCKS.BSA` - is WD3, `02-Formats/World-Data-Patches.md`.

## What the player sees

| | Beautiful Villages | Beautiful Cities |
|---|---|---|
| locations | 7,317: villages 1,834, hamlets 1,200, farms 1,841, wealthy homes 1,399, temples 1,043 | 410: every `TownCity` |
| through blocks alone | 1,646 roadside taverns (their blocks rebuilt by name) | - |
| RMB blocks | 209 (156 of Daggerfall's own names rebuilt, 53 new) | 611 (178 of Daggerfall's names, 433 new - 388 composites like `WALLAA04.FARMBA01`, a wall and a farm made one) |
| untouched | dungeons, graveyards, poor homes, covens, cults, the two ship pixels | everything that is not a city |

Each is one switch in the Mods pane (Features, "Takes effect when the game
next loads"). The switch is read ONCE, when the world-data loader runs at the
game's load, and latched (`scenes/modWorldData.js`, `latchModLoaded`): a town
never moves under the player's feet. Both default on.

Both mods ship `FIGHBM00.RMB` and the two differ: Daggerfall Unity serves the
file of the mod loaded later, Beautiful Cities, and so does the port
(`WORLD_DATA_PRIORITY`, the door's per-name list - `formats/worldDataReplacement.js`
keeps every mod's entry of a name, highest load priority first, and the first
whose switch is on answers; a mod switched off never hides the one under it).

## The housing promise - a town keeps the layout a save's things were made in

The two mods do not edit Daggerfall's towns, they REPLACE them, and a building
is known to the game by WHERE it stands: DFU's building key, `(block x << 16) +
(block y << 8) + record`. Every record a save keeps by key would wake in
another building when a town's layout changes under it:

- the house you bought (banking's deed) and everything you did to it - the
  decor placed in its frame, the built-in furniture taken out by name, the
  chests filled, its yard, its painted look;
- a room rented at an inn, a quest's building and the markers its people stand
  on, an item left at a smith, a Recall anchor set indoors, a save made inside
  a building;
- the buildings the automap knows by name.

DFU itself lets them wake in the wrong building. The port does not
(`src/systems/layoutPins.js`):

1. **Every such record is STAMPED with its town's layout when it is made** -
   which layout mods were changing that town then (`layoutStampOf`:
   `beautiful-villages@1.4.2`, joined by `+` for two), and nothing at all for
   Daggerfall's own town, so a game without the mods saves exactly what it
   saved before. A record from before WD3 carries none and is, correctly,
   classic. A stamp names only the mods that CHANGE that town (its location
   file, or a block its grid names - `layoutModTouches`), so a record made where
   a mod changes nothing never holds its town to that mod.
2. **A load pins each town its records hold** to that layout (`pinsFrom`; the
   strongest record of a town decides: a house, then a room, a quest site, an
   inside save or an anchor, a repair ticket). A pin turns a mod OUT of a town
   (a house bought before the mod was switched on keeps its classic town) or
   lets one IN (a house bought in a Beautiful Village keeps its village when
   the mod is switched off since - the mod's pack is fetched for that town
   alone). Everything else in the world follows the switches as they stand.
3. **The world-data door serves a pinned town its layout**: its location and
   the blocks laid out in it come with exactly the mods its pin names
   (`formats/worldDataReplacement.js`, the door asks the pin oracle; the
   block reads ask for the town whose grid named them - `MapsFile.getRmbBlockName`
   notes it, `systems/worldDataVariants.js` `readingLocationKeyOf`).
4. **A pinned town is read again and built again** when a load changes its
   answer (`world.js` `applyLayoutPins`, after the save's player and quests
   are restored and before its place is built - the world load and a dungeon's
   own same-dungeon load both).
5. **A town is released** the moment nothing holds it - the house sold, the
   room expired, the quest ended - and next loads as the mods would have it.

Two stores that are not records get the same law:

- **an interior's cached scene** (what you left in a shop, a chest opened)
  carries its town's layout and is restored only into that layout - an
  ordinary one cached in another layout goes, a permanent one (a house, a
  rented room) is kept unrestored for the layout it belongs to
  (`worldModes.js` `restoreInteriorScene`);
- **a town's discovered buildings** carry the layout they were found in, and a
  town whose layout moved forgets them at the load (the town itself stays
  found; `systems/discovery.js` `pruneDiscoveryLayouts`).

## Online

The two switches are the ROOM's (`systems/onlineLane.js`
`ONLINE_ROOM_MOD_KEYS`, forced on): two players who disagreed would walk two
towns, one through the other's houses, and a building key - an online home's,
a shared quest's - would name two buildings.

Every online home bought before WD3 was bought in Daggerfall's own towns. The
account service keeps the layout each home's town was bought in
(`homes.layout`, migration `0046_home_layout.sql`; NULL is Daggerfall's own -
exactly the layout every existing home was bought in). A claim stores the
layout its client's town stands in unless the town already holds a home, whose
layout every later one takes (`homes.js` `claimStatement`). Every client reads
`/v1/homes/layouts` - each town holding a home and its layout - at its online
boot, before the first town is built, and pins those towns; online, a save's
own records pin nothing (one player's save would stand one town apart from the
room's). The decor placed, the look painted, the yard and the rooms let stay in
the building they were made for.

Online the world-data door is open whatever Replace Game Artwork says
(`worldDataOn`): the ground is the room's, and a player with the switch off
stood no town of the room's (Detailed Ships' decks and Roleplay & Realism's
fort had the same hole). The switch keeps the textures and the music it gates
elsewhere.

## Daggerfall's own laws the mods meet

- **Windmills.** Kamer's mill is DFU's replacement of model `41600` wherever it
  stands. Four of Beautiful Villages' farms carry his mill subrecord; a `41600`
  a block's OWN records place is the port's mill (tower, sails, collider, hum)
  on the enhanced skin with the Windmills switch, and a block served from world
  data stands no Kamer placement of its own name (Beautiful Cities loads after
  Windmills of Daggerfall; its farms are the ones read) - `world/rmbLayout.js`.
- **The Order of the Raven.** A block served from JSON keeps its
  `FldHeader.OtherNames`, so RMBLayout's `KRAVE01.HS2` guild hall fires in a
  knightly block of Beautiful Cities as it does in DFU.
- **Roleplay & Realism's Master Armorer.** RR hard-codes the shop's key by its
  cell in the three classic towns; Beautiful Villages moves `ARMRAM03` in two
  of them (Penmore's to (2,2), Pjiga's to (0,1)), and in DFU the two mods
  together name a neighbour's house "Dharjen Custom Armor". The key is read off
  the town's grid (`systems/rrQuestLine.js` `rrMasterArmBuildingKeyIn`) - a
  recorded departure.
- **The decor catalogue** stays what DAGGERFALL furnishes: it reads
  `BLOCKS.BSA` past the door (`decorScan.js`), so 1,400 redecorated interiors
  never renumber or grow it.
- **Houses for sale.** Every building the bank or a door can sell in either
  mod stands on a classic model (measured: 1,658 village houses and 3,358 city
  houses), so every price is DFU's own `GetHousePrice` over the ARCH3D radius.
  Beautiful Cities' 224 `House5` records whose one model is a wall piece
  (`53210`) and two `House2` with none have no exterior door and are no
  residence: nothing sells them.
