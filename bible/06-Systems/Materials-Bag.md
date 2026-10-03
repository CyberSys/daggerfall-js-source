# THE MATERIALS BAG - what a gatherer carries (BAG1, 2026-10-03)

The port's own (DFU has no professions, so no bag for them): a bag the player buys at a General Store, carried as DFU
carries the wagon - a second list beside the pack, with a weight it may not pass - and the end of "every harvest goes
straight into the Stores". Online only; a Ledger A departure (`01-Overview/Port-Ledger.md`). Its law is
`src/net/bagLaw.js`, the save's hands `src/systems/materialsBag.js`, the book's flows `src/net/profBook.js`, the
service's count `server-account/src/professions.js` and `motherlodes.js` (migration `0076_materials_bag.sql`).

## Asked

From the Discord, LostMyLeg: "implement a crafting mats bag that gets handled like the cart in an extra slot. It
shouldnt carry unlimited weight but quite a lot" - "make the bag available in every general store for like 500g" -
"Aslong theres no bag the mats just go into the players inventory". Mac: "So I definitely like this idea instead of the
current go straight into your storage. Like having a new player actually buy the crafting bag, and still allowing
crafting materials in the inventory itself." And: "This is something I really want you be detailed on and focus."

## 1. The bag

- **An item**, template **600** (the professions' reserved range, Professions-Arc 4.8 - unused until now): "Materials
  Bag", DFU's own Backpack picture (ItemTemplates 89: TEXTURE.205 record 44 - law 6, the picture is DFU's), weightless
  as the Small Cart is (`hasNoEncumbrance`), one to a slot. **Owning one is holding one**, as DFU's HasCart reads the
  cart in the pack.
- **Bought** at every General Store, online, after the horse and the cart (`systems/shopStock.js`), to a character who
  carries none. Its base price is **250**; DFU's shop price is 2 x (cost x (quality - 10) / 100 + cost), so **500 gold**
  at a middling shop and 450 to 550 by the shop's quality, before the region and the haggle - "like 500g".
- **It holds 300 kg** - two fifths of a wagon's 750 (`BAG_KG_LIMIT`): "quite a lot", never unlimited. A day's Logging
  (60 trees of 2-4 logs at 2 kg) is about 360 kg; the bag holds most of a day in one craft.
- **Only materials go in it** - an item whose group and template are those a material mints as. The map from an item
  back to its material is BUILT BY MINTING every material once (both of a food's skins, Climates & Calories on and
  off), so the bag's rule and the mint can never disagree about what an Oak Log is. A quest's piece, a summoned one, a
  worn one or an enchanted one is never a material.
- **Its own list**, `entity.bagItems`, beside `wagonItems` - in the save (`systems/save.js`: snapshotted, restored,
  repaired and swept for orphans with the rest), counted by the realm with the pack and the wagon
  (`net/realmGoldLaw.js` carriedItemLists, `systems/realmCustoms.js`).
- **The cart's own rule**: a bag that holds anything never leaves the pack - not dropped, stored, sold or given
  (`itemTransfer.js` planStore, `tradeModes.js` localClickDecision: "Empty your Materials Bag first."). And the bag
  never goes to another player or the guild's vault at all (`tradePack.js`, `realmTradeLaw.js` tradeableRecord): its
  list is its owner's save's.

## 2. The window

The enhanced inventory's remote pane shows the bag as it shows the wagon (`ui/enhancedInventory.js`,
`systems/inventorySession.js`): a **Materials Bag** button in the pane's header (no bag: "You have no Materials Bag.
Every General Store sells one."), the bag's list as the remote list while it shows, its 300 kg on the weight line,
**Put in bag** on an item's menu, a move refused past the weight in the companion's pack's words ("Your Materials Bag
cannot carry any more."). The bag and the wagon never show together; the bag is no floor (a house's word against a
drop never reaches it); no gold goes in it. `REMOTE_TARGET_TYPES.Bag` (4) is the port's own, after DFU's four.

DEPARTURE: the classic skin's inventory is DFU's own window, every rect cited (THE NATIVE-WINDOW RULE), and it has no
slot for a bag pane - there the bag is reached from the Stores page (section 4), whose Put everything in and Take out
work on either skin (CLASSIC-PAGES). Nothing is lost: what the bag holds counts as held at every station.

## 3. Where a harvest goes

A carrying client's harvest (`carry: true`) is the bag's and the pack's - never the Stores':

- **The bag first**, as many as its weight allows; **then the pack**, as many as the character's own carry allows;
  **what has no room is left where it was gathered**, and said ("+3 Red Rose to your bag and pack - 1 left where it was
  gathered: no room"). No bag: the pack alone - LostMyLeg's "the mats just go into the players inventory".
- The first harvest of a session says so once: "Gathered goods go into your Materials Bag - or your pack while you have
  none. Every General Store sells the bag." The haul card's tag reads **Carried 41** where it read Stores 41.
- A node whose goods have nowhere to go says **No room in your bag or pack** where it said Stores full.
- The service keeps the older door: a client that does not say `carry` still harvests into the Stores, as before.
- A Motherlode's strike is the same (`motherlodes.js`).

## 4. The Stores, in town

The Stores stay the character's storage - and are **kept in town** now: put in and taken out in any town, on its
streets or in any of its buildings (DFU's IsPlayerInTown with mustBeInLocationRect, not mustBeOutside; never below
ground - `scenes/world.js` `_storesReached`). Away from one the page reads, and says "Your Stores are kept in town. Go
to any town to put materials in or take them out."

The Stores page (`ui/profPages.js`) shows each material's Stores count and, beside it, what is carried; for a
material, **Take out** (into the bag, then the pack) and **Put in** (from the bag, then the pack), and **Put everything
in** - the bag's whole load in one press.

## 5. Law 3, restated - the carried count

Law 3 (Professions-Arc 1): "a material withdrawn to the pack becomes an ordinary save item and never goes back:
nothing edited into a save can be laundered into the server's economy." A bag whose goods go back into the Stores
reopens exactly that door - unless the service knows what it handed out. So it counts:

- **`prof_carried`** - per character and material, by origin (own, bought, gold, as the Stores keep them): what the
  service handed to the save that has not come back. A carried harvest adds to it; a carried withdrawal moves units
  from the Stores into it, each under the origin it left as; a deposit moves them back, each origin as it was.
- **Every act that reads it first cuts it to what the client says it holds** (`held`, the bag's and the pack's items
  of that material together) - gold's units first, then bought, then own, the order a withdrawal fills the pack in, so
  the goods walled from every Marks act go first and a character's own (which raise a seat's influence) last. **It is
  never raised**: a pack holding more than the count adds nothing.
- So a save-edited Red Rose, a looted one and a gathered one are one item in the pack - and **only the gathered one is
  counted**. A deposit never moves more than the count; a station never uses more of what is carried than the count,
  and never gold's. What enters the Stores from the bag is exactly what the service handed out: law 3's guarantee,
  kept with the door open one way more.
- A lie about `held` can only cut the count, never raise it.

## 6. Stations, writs and the potion maker

A station spends the Stores, as it always has (the service's SQL is unchanged). What it lacks, the client puts in
first from what is carried (`profBook.ensureInStores`): every input's shortfall covered before any moves, bought units
before own, never gold's (`DEPOSIT_ORDERS.spend`); a shortfall nothing can cover moves nothing and says "You do not have
that many - in your Stores, your Materials Bag and your pack together." Every craft and brew at a station does it
(`craft`, `brew`), a smelt at the forge (`smelt`), a Court writ's delivery (`deliver`) and a guild writ's (the host's
`writBook.supply`). A smelt's product comes out carried, into the bag. DFU's own potion maker reads and spends the bag
after the cart (`scenes/worldModes.js`). The market, the guild Stores and Disenchanting read the Stores alone, as they
did: a material is listed, given to the guild or sold back from the Stores, so it is put in first.

## 7. Edges

- **A deposit's answer that never comes** keeps its items out of the bag and asks again with the same id at the next
  settle (`pendingDeposits`); refused, they are given back. A page closed before then, with a save written between,
  loses those units: the count still holds them and is cut to the pack at the next act that reads it. Accepted - an
  answer lost and the page closed inside the same save's window.
- **Two tabs** settling one kept harvest mint its goods once - the tab that lets it go (AUDIT 29 C5's law).
- **A unit left where it was gathered** stays counted until the next act cuts the count to the pack.

## 8. The threats, and the answers

| Threat | Answer |
|---|---|
| A save-edited material deposited into the Stores | Only the carried count moves; it is cut to the pack and never raised (5) |
| A looted DFU herb sold to a writ as a harvested one | It is held, never counted: a station uses the count, not the items (5) |
| Gold's goods spent at a station through the bag | A station's shortfall moves bought and own alone (6) |
| A client claims it holds more than it does | `held` only cuts the count |
| A loaded bag sold or given, stranding its list | Refused while it holds anything; never traded at all (1) |

## 9. Pins

`test/bag1_service.test.js` (the service, through the real Worker) and `test/bag1_client.test.js` (the law, the
save's hands, the window, the shop, the save, the book, a done-when through the real Worker); `tools/mutants/bag1.json`.
