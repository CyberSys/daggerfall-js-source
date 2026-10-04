# FIELD BUGS 2026-10-04 - a gatherer's goods in the pack, past its weight; the Materials Bag on every shelf

Mac, from play the day after BAG1 shipped: *"People are doing gathering without a crafting bag and theyre not seeing
the materials in their inventory"*, then *"Also nobody can find material bags in store"*. Each fix below is pinned by
tests that fail on the code before it, and its pins are mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "People are doing gathering without a crafting bag and theyre not seeing the materials in their inventory" (Mac) | a carried harvest (BAG1) was minted into the bag, then the pack up to its weight, and the rest was "left where it was gathered" - counted carried by the service and never made. A DFU pack is carried to its limit (every loot take is weighed against it), and with no bag the pack is all there is, so a loaded character gathered goods it never saw | PACK-OVER |
| 2 | "Also nobody can find material bags in store" (Mac) | the bag stood on a General Store's first shelf alone and was left off a shelf stocked by a character who carried one; the first shelf is just the first model the building lists, and online a shelf's stock is the room's for the day, so one bag-owner's open hid it from everyone | BAG-SHELF |

## PACK-OVER (1)

`net/profBook.js` mintHarvest; `net/bagLaw.js` goodsWhere, BAG_WORDS.overWeight; `scenes/gatherHost.js` the haul
card's line. Ruled out first: the account service had taken BAG1 (`acct74` on `/v1/health`, migration 0076 applied - the
deploy's red is a smoke step after it, `/v1/auth/guest` answering 500), the realm's checkpoint judges a first save
alone, the item lands in DFU's own tab, and the world host's hands are the module's one `playerEntity`. With room in the
pack every unit came. Without it, none did: a strength-50 character 3 kg under its 75 kg gathered four Oak Logs and was
handed one; one AT its limit gathered herbs through the real Worker and was handed none, the service counting every one
as carried.

BAG1 had written the law down (Materials-Bag.md 3: "what has no room is left where it was gathered, and said") and kept
the opposite for every other door: a withdrawal's and a smelt's units go into the pack past its weight (the audit's B5,
the second's K4/H5 - `giveCarried`, "a unit the service counted as carried and the save never got was lost to the
character"). DFU's Foraging mod, which the professions' acts are built on, does the same - its finds are
`Player.Items.AddItem` with no weight in it (`systems/foragingInstall.js` give), and its one weight rule is the act's
refusal to START when fully encumbered (foragingLaw.js `encumbered`). So the harvest is the withdrawal's now: the book
mints through the hands' `give` - the bag, the pack, then the pack past its weight - and its `put` says `over`. The
node's own refusal stands as it was (`carryFull`: no room for one unit, "No room in your bag or pack"), which is the
mod's refusal to start; what an act yields is never weighed again. Hands with no `give` (an older host's shape) still
mint through `mint`, `left` and `lost` naming what could not be made - now only a thing with no pack form.

The words: the line says "+4 Oak Logs to your pack - your pack is over its weight"; on the enhanced skin the haul card
counts all four and the line beside it says "Your pack is over its weight. Put materials in your Stores in any town, or
carry them in a Materials Bag." The weight's consequences are DFU's own and the player's to clear: the next act refuses
to start while the pack is full, and the Stores page's Put in (or a Materials Bag) takes the load off.

The four hosts: the gathering acts run in `scenes/world.js` alone (its one `createGatherHost`, whose hands are
`carryHands` - `give` is `giveCarried(playerEntity, ...)`, pinned by BAG1's wired test); `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` run no harvest (a dungeon's veins are world.js's gather host
too). `test/fb1004_packover.test.js`; `tools/mutants/fb1004_packover.json` (6, all dead), with `tools/mutants/bag1.json`
(89, all dead) run beside it. BAG1's own page restated (Materials-Bag.md 3, 7, 13).

## BAG-SHELF (2)

`systems/shopStock.js` stockShopShelf. BAG1 shelved the bag only where `shelfIndex === 0` (the second audit's H8: "a
bag on each one sold one bag several times over") and only for a stocking character with no bag of its own. A player
buys shelf by shelf, and shelf 0 is just the first shelf model `interiorCtx.shelves` lists - nothing marks it. Online a
shelf's roll is published to the building (`worldModes.js` interiorPublishLoot) and is the room's until the game day
turns, so a bag-owner who opened that shelf first stocked it without a bag for everyone in the building. The bag stands
on every General Store shelf online now, whoever stocks it, as the horse and the cart do; offline none, as before. A
second bag bought is the buyer's choice, as a second cart is. A shelf already stocked this game day keeps that stock
until its restock. The four hosts: shelves are stocked in `scenes/worldModes.js` alone (openShelf, openMerchantSell);
exterior.js, world.js and dungeonContext.js stock no shop shelf. Pinned in `test/bag1_client.test.js` (BAG1 bought: a
bag-owner's shelf and a second shelf both shelve it); `tools/mutants/bag1.json`'s shelf records retargeted (the first
shelf alone, none to a bag-owner, offline) - 89, all dead.
