# The Portal Stone - PORTAL1

The owner, 2026-10-04: *"So with the removal of fast travel, I want to implement a new item available at all shops,
this should cost weykar shards (from dismantling gear with rarity). These should always be readily available. When
using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a one use item that stays
open for a short time, allowing multiple players to traverse."*

"Weykar shards" are the **Welkynd Shards** LOOT9 shipped (`06-Systems/Loot-Arc.md` section 11): what salvaging a
laddered piece breaks it into - a Magic 1, a Rare 3, a Legendary 8, an Exalted 15. TRAVEL-ONLINE took instant travel
off the online map (`06-Systems/Travel-Options.md` item 9); IT1 brought it back as a carriage's fare
(`06-Systems/Immersive-Travel.md`). The Portal Stone is the third road: anywhere on the map, for shards, and anyone
near may follow.

Not a DFU member - the port's own (Ledger A, PORTAL1).

## What shipped

| File | What it is |
|---|---|
| `src/systems/gateSpoils.js` | the stone's row: template 572 beside the shard's 571 - bound, stacking with its own kind, the Diamond's art (TEXTURE.254 record 3), miscellany (`UselessItems2`) and never a gem: every Gems piece is a crystal a slot takes, so a gem stone was WORN from the hotbar. `portalStones(n)` mints a stack |
| `src/net/realmTradeLaw.js` | `BOUND_TEMPLATES` names 572 - the realm's trade service refuses it as the client does |
| `src/systems/portalStone.js` | the laws: the price (`PORTAL_STONE_SHARDS`, 5), the refusal and the sale, the Use's registered arm (`openPortal`), one stone spent, where a portal opens (`portalSpot`), the step in (`portalStepIn`), the wire (`portalWire`, `validPortalRecord`), the words (`PORTAL_TEXT`), the card's lines |
| `src/scenes/portalGates.js` | the host's pool: the portals in the WORLD frame, COMPANION-PORTAL's vortex held for each one's time, the step, mine on the wire and a peer's landed |
| `src/scenes/portalFx.js` | the vortex takes `holdMs` (a hold of its own) and `fixed` (stands where it opened), and `remove` - the companions' defaults unchanged |
| `src/ui/merchantServiceWindow.js`, `src/ui/merchantRepairWindow.js` | the classic popups' port row under the art (`portalRowRect`, key P, `drawPortalRow`) - the Reforge row's law (`guildServiceWindow.js` REFORGE_RECT) |
| `src/ui/merchantServiceDoor.js`, `src/ui/merchantRepairDoor.js` | the Enhanced Plus panel's button |
| `src/ui/nativeInventory.js`, `src/ui/enhancedInventory.js`, `src/systems/quickslots.js`, `src/systems/useItem.js` | the `openPortal` result routed on every reader - the pack closes and hands the stone to the host's door; a host with none says `USE_PENDING.openPortal` |
| `src/systems/itemInfo.js` | the stone's card: what it does and how long it stands, on both skins |
| `src/scenes/worldModes.js` | THE COUNTER: `portalRow` / `askPortalStone` / `buyPortalStoneNow` |
| `src/scenes/world.js` | THE USE AND THE PORTALS: `openPortalStone` / `standPortal`, the pool (`portalGates`), its tick and draw, `portalWord` and the peers' landing |
| `src/scenes/exteriorFoes.js` | the foes frame's `pg` field past the room test (`setOnPortals`) |

### The counter

Every shop's keeper - `shopStock.js` `isShop`'s nine kinds (alchemist, armorer, bookseller, clothier, furniture, gem
store, general store, pawn shop, weaponsmith) - carries a row on their popup: **Portal Stone (5 shards)**. Both popups
a keeper puts up carry it, the plain shop's (GNRC01I0) and the repair shop's (REPR01I0); on the classic skin it is the
port's own row just under the art (neither 130-wide panel has room), key P, closing the popup first as its sisters do;
on Enhanced Plus a button above Exit. A bank's teller and a street merchant with a mod's service (Immersive Travel's
driver) never carry it.

A press asks first - DFU's Yes/No box, "Buy a Portal Stone for 5 Welkynd Shards? You carry N." - and Yes is the
sale: five UNLOCKED shards out of the pack (a locked stack is the player's word to keep it, `reforge.js` shardsHeld),
the pack's own carry gate asked with the pack as the shards leave it (the Broker's: `planTake`'s dry run), a fresh
stone in. Refused, nothing is taken and the HUD says why. **Always in stock**: nothing stands on a shelf - every sale
mints a stone - so no keeper runs out, no restock waits a day, and no haggle, holiday or theft touches it.

NOT ON A SHELF, AND WHY. A shelf is the gold trade's: the price, the haggle, the steal, the counter's cost strip and
the online room's shared shelf all speak gold, and a bound piece on a shelf is stripped from the room's record
(`itemBound.js` unbound). A shard price inside the trade window would have meant ten gold-only seams on two skins; a
row on the keeper's popup is the Reforge's and the Broker's shape - an item purse beside the gold one.

### The use

The pack's Use - either skin - or a hotbar press hands the stone to the host's `openPortal` door. Only the open world
has one (`world.js`): a building's pack is that host's too, and refuses; a dungeon's and the standalone street's have
no door, and the reader says the same words - "A portal can only be opened under the open sky." The door also
refuses while a move is under way, with an enemy near (the travel map's own pool, a duel's opponent and a hostile
ship included), while the player's own portal still stands, and with no map to choose on.

The travel map opens in TELEPORT mode - the Mages Guild's, classic or held, with no Travel Options fee (the stone is
the fare) - so the picks are the places the map shows. A place picked spends ONE stone, the rest of the stack kept,
and tears a portal open `PORTAL_AHEAD` (2 m) along the camera's forward, on the ground found there (a downward probe,
mesh or terrain). A map closed without a pick spends nothing. The classic teleport box smashes the screen to black for
an arrival; there is none yet, so the black lifts.

### The portal

COMPANION-PORTAL's violet vortex (`portalFx.js`), fixed where it opened and held for `PORTAL_OPEN_MS` (30 s): it tears
open, stands, and seals as its time runs out. It is kept in the WORLD frame (the camps' wire converters), so the
floating origin moves nothing and a portal behind a teleport stays where it was.

**Anyone who walks into it arrives** - within `PORTAL_REACH` (0.9 m) across the ground and `PORTAL_REACH_Y` (2 m) in
height - through the Mages Guild's arrival (`world.js` teleportTo: free, at once, a start marker of the place, the
screen black over the rebuild). An entry is a STEP from outside to inside (`portalStepIn`): a portal that opens on top
of someone takes nobody, nor does one met on dismounting, leaving a building or ending a move - only a step in. The
opener stands outside their own (PORTAL_AHEAD > PORTAL_REACH) and walks in like anyone. Nobody steps through while
the host is busy (a move under way, a teleport, death).

### Online

The opener's foes frame carries the portal - `pg`, `portalWire`'s shape: its id, where it stands (the world frame),
the destination's PIXEL and the milliseconds left - on every FULL frame while it stands and the opener stands within
`PORTAL_SAY_REACH` (256 m) of it, and opening one owes the next frame full, so the cell hears of it at once. It is the
camps' and the duel ring's road: the relay reads nothing inside a foes frame, so no relay change and no RELAY_VERSION.
The frame reaches the players the relay fans it to - in range of the opener (3 map pixels), across a cell's edge by the
halo - and goes quiet while the opener is alone in the room.

A peer's word lands through `validPortalRecord` - a field outside its law refuses the record whole - and the
destination is NAMED off the receiver's own map (`mapDirectory.js` locationSummaryAt, the location's own name); a
pixel with no place refuses it. One portal an owner: the same id said again keeps its look and refreshes its time,
another replaces it. **A peer's copy is kept to its own time**: the opener stepping through, walking off or going
indoors closes nothing for the rest - a frame without `pg` leaves the copy to run out. Nothing is said when a portal
closes. A late arrival in the cell learns of a portal only while its opener is still near it.

### The four hosts

- `scenes/world.js` - WIRED: the open world's door, the pool, the step, the frame's word and the peers' landing.
- `scenes/worldModes.js` - WIRED: the counter (interiors). A building's pack is world.js's, whose door refuses indoors.
- `scenes/dungeonContext.js` - FLAGGED by design: no door - a portal is the open sky's; the reader says why.
- `scenes/exterior.js` - FLAGGED: the standalone `?exterior` street has no streamer and no travel map (its Recall
  refuses another pixel for the same reason); no door, the reader says why.

## Calls made here, put to the owner

- **The price: 5 shards** - five Magic pieces salvaged, or two Rares (with one over). The Reforge's Magic line is 2,
  a Rare's 4. A constant (`PORTAL_STONE_SHARDS`).
- **The time: 30 seconds** (`PORTAL_OPEN_MS`).
- **The destinations: the places the map shows** - the guild teleport's picks; a bare pixel of wilderness is not one.
- **Bound**: the shards that buy it are, so the stone never carries their worth to another player.
- **No sun rule, no quest offer**: the guild teleport asks neither, and the portal arrives through it.

## Pinned

`test/portal1_stone.test.js` (9): the row, the counter, the use on every reader, the place and the step, the wire, the
vortex held, the pool (mine, a peer's, refusals, replacement, the time), the classic popups' row and the panels'
button, and the hosts. `tools/mutants/portal1.json` (40, all dead - two survivors on the first run, the off-foot
reset and the load's clear, closed by sharper pins). Along the way, four pins moved by content: the two mounted foes
streams (`test/csa_together.test.js`, `test/audit0928_online.test.js`) stub `portalWord` as they stub every word on
the line; U61's count of openers gated on the travel map's door is four (`test/heldmap.test.js`); AUDIT REALM F1's
bound list reads the row (`test/auditrealm.test.js`); and three mutant records re-aimed (the two bound lists, the
enhanced card's survival arm).

NOT SEEN: the portal in a browser, and two players stepping through one. No ARENA2 in the container that built it.
