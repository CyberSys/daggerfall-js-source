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
  carries none - on the shop's first shelf alone (the second audit's H8: the horse and the cart are every shelf's, as DFU
  stocks them; a bag on each one sold one bag several times over). Its base price is **250**; DFU's shop price is 2 x (cost x (quality - 10) / 100 + cost), so **500 gold**
  at a middling shop and 456 to 550 by the shop's quality (1 to 20), before the region and the haggle - "like 500g".
- **It holds 300 kg** - two fifths of a wagon's 750 (`BAG_KG_LIMIT`): "quite a lot", never unlimited. A day's Logging
  (60 trees of 2-4 logs at 2 kg) is about 360 kg; the bag holds most of a day in one craft.
- **Only materials go in it** - an item whose group and template are those a material mints as. The map from an item
  back to its material is BUILT BY MINTING every material once (both of a food's skins, Climates & Calories on and
  off), so the bag's rule and the mint can never disagree about what an Oak Log is. A quest's piece, a summoned one, a
  worn one or an enchanted one is never a material.
- **Its own list**, `entity.bagItems`, beside `wagonItems` - in the save (`systems/save.js`: snapshotted, restored,
  repaired and swept for orphans with the rest), counted by the realm with the pack and the wagon
  (`net/realmGoldLaw.js` carriedItemLists, `systems/realmCustoms.js`). Its food rots as the pack's does
  (`survival/needs.js`), and a food on its way to putrid is no longer the material the mint makes.
- **The cart's own rule**: a bag that holds anything never leaves the pack - not dropped, stored, sold or given
  (`itemTransfer.js` planStore, `tradeModes.js` localClickDecision: "Empty your Materials Bag first."). And the bag
  never goes to another player or the guild's vault at all (`tradePack.js`, `realmTradeLaw.js` tradeableRecord): its
  list is its owner's save's.

## 2. The window

The enhanced inventory's remote pane shows the bag as it shows the wagon (`ui/enhancedInventory.js`,
`systems/inventorySession.js`): a **Materials Bag** button in the pane's header (no bag: "You have no Materials Bag.
Every General Store sells one."), the bag's list as the remote list while it shows, its 300 kg on the weight line,
**Put in bag** on a material's menu (never on what the bag refuses), a move refused past the weight in the companion's
pack's words ("Your Materials Bag cannot carry any more."). The bag and the wagon never show together; the bag is no
floor (a house's word against a drop never reaches it); no gold goes in it; it never opens over a reward tray (a piece
taken from the side window there is the reward chosen). With nothing beside the pack, the bag's button stands on the
pack's footer. `REMOTE_TARGET_TYPES.Bag` (4) is the port's own, after DFU's four.

DEPARTURE: the classic skin's inventory is DFU's own window, every rect cited (THE NATIVE-WINDOW RULE), and it has no
slot for a bag pane - there the bag is reached from the Stores page (section 4), whose Put everything in, Take out and
**Empty your bag into your pack** work on either skin (CLASSIC-PAGES). Nothing is lost: what the bag holds counts as
held at every station, and anything in it - a food that rotted there, which no Put in takes - comes out into the pack
from the Stores page, anywhere (the second audit's H1).

## 3. Where a harvest goes

A carrying client's harvest (`carry: true`) is the bag's and the pack's - never the Stores':

- **The bag first**, as many as its weight allows; **then the pack**, as many as the character's own carry allows;
  **what has no room is left where it was gathered**, and said, each by its own name ("+3 Red Rose to your bag and pack -
  1 left where it was gathered: no room"; a gem left is the gem's). No bag: the pack alone - LostMyLeg's "the mats just
  go into the players inventory".
- Every gathering kind names the material its goods are (a herb by its region, a tree's logs, a vein's ore, a foe's
  hide, a haul's fish), so the request says what the bag and the pack hold of it; the Basket's food and a boulder's
  stone are the service's roll, and name none.
- The first harvest of a session says so once: "Gathered goods go into your Materials Bag, then your pack. Every General
  Store sells the bag." The haul card's tag reads **Carried 41** where it read Stores 41.
- A node whose goods have nowhere to go says **No room in your bag or pack** where it said Stores full.
- The service keeps the older door: a client that does not say `carry` still harvests into the Stores, as before.
- A Motherlode's strike is the same (`motherlodes.js`).

## 4. The Stores, in town

The Stores stay the character's storage - and are **kept in town** now: put in and taken out in any town, on its
streets or in any of its buildings (DFU's IsPlayerInTown with mustBeInLocationRect, not mustBeOutside; never below
ground - `scenes/world.js` `_storesReached`). Away from one the page reads, and says "Your Stores are kept in town. Go
to any town to put materials in or take them out." **The town is the client's convention, not the service's law**: the
service checks no place, and a station's shortfall is put in wherever the station stands (section 6).

The Stores page (`ui/profPages.js`; the pause menu's Holdings tab since HOLDINGS, `03-World/Holdings.md`) shows each
material's Stores count and, beside it, what is carried; for a
material, **Take out** (into the bag, then the pack) and **Put in** (from the bag, then the pack), and **Put everything
in** - every counted unit the bag and the pack hold, in one press, whatever the page's filter shows: it says how many
went in and names each material refused (its Stores full) and goes on past it; the counting-house's silence ends it.
Put in and Put everything in stop at the Stores' own room (5,000 a material, every origin), and a full material is said,
never asked; why Take out or Put in is shut is drawn under the bar, not only on a title (the second audit's U1, U14).
**Empty your bag into your pack** stands on the page, in a town or out of one, whenever the bag's list holds anything:
every piece, as much of each as the pack's weight takes, what no Put in takes first (a full pack never leaves the jam
behind).

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
- A lie about `held` can only cut the count, never raise it. **What it bounds and what it does not**: a client may say
  it holds more than it does - a pack that sold three Red Roses saying it still holds them - and the count is then not
  cut; those units stay counted and may be deposited. That is not prevented. It is bounded: never past what the service
  handed out, so nothing enters the Stores the service did not put into the save. The count is a ceiling, not a census.
- **Only against the count the client heard** (the audit's B2): a request says, beside `held`, `seen` - the count as
  the client last heard it - and `heldKey`, the material the held count is of. The service cuts only where its count is
  that `seen`. When the count has moved since (a kept act's units counted with its answer lost, a second request in
  flight), the pack does not yet hold units the count has, and the cut is skipped - never the units lost. The decision
  is taken once a request, at the head of its own batch (`prof_carried_gate`), and an older client that says no `seen`
  is believed as before. `held` is read when the act is asked, never when it was kept, with a deposit's units still on
  their way counted as held. The wagon counts as held too. **And never under the count as heard while another carried
  act is kept** (the second audit's K2): a state read makes `seen` the service's own, and a kept harvest's units, landed
  and not yet minted, would be cut - so while one (or a kept withdrawal of the material) waits, the book says the count
  itself as held, which cuts nothing. The act being asked is not pending for itself.
- **A carried harvest's row is kept thirty days** (`CARRIED_ROW_DAYS`; a Stores harvest's two, as before): it is the
  answer a kept harvest asked again is given, and only that answer mints its items (the second audit's S1).

## 6. Stations, writs and the potion maker

A station spends the Stores, as it always has (the service's SQL is unchanged). What it lacks, the client puts in
first from what is carried (`profBook.ensureInStores`): every input's shortfall covered before any moves, bought units
before own, never gold's (`DEPOSIT_ORDERS.spend`); a shortfall nothing can cover moves nothing and says "You do not have
that many - in your Stores, your Materials Bag and your pack together." (`materials-short`); a put-in whose answer has
not come says so (`deposit-kept`) rather than that anything is short. Every craft and brew at a station does it
(`craft`, `brew`), a smelt at the forge (`smelt`), a Court writ's delivery (`deliver`, the shortfall the writ's card
names where the book's list has none) and a guild writ's (the host's `writBook.supply`). A smelt's product comes out
carried - as many withdrawals as the room takes, each within a withdrawal's 200 - and the smelt's line says where it
went and why any stayed ("Into your bag - 2 stay in your Stores: no room in your bag or pack."; "...: another withdrawal
was still being counted"; "4 on their way from your Stores: the counting-house has not answered yet"; a refusal's own
words). Every unit the service hands over is minted - into the bag, the pack, then the pack past its weight
(`giveCarried`), as a withdrawal always came: the service counted them carried. A station's refusal after some inputs
went in says so ("1 of the materials went into your Stores first - the next try spends them there."); a press while a
put-in of an input is unanswered says `deposit-kept` at once, and no craft is kept (the second audit's K4-K10). DFU's own potion maker reads and spends the bag
after the cart (`scenes/worldModes.js`). The market, the guild Stores and Disenchanting read the Stores alone, as they
did: a material is listed, given to the guild or sold back from the Stores, so it is put in first.

## 7. Edges

- **A deposit's answer that never comes** keeps its items out of the bag and asks again with the same id at the next
  settle. The deposit is KEPT with the other acts (the audit's B17: it was memory alone), so a page closed before the
  answer still hears it. **Its take is STAMPED in the save** (the second audit's K3/K7/H2: `entity.bagTakes`, its id,
  material, units and order), and that save is the realm's - a checkpoint that LANDED - **before the deposit is asked**.
  So the save a later page boots says what happened: holding the stamp, it saw the items go, and a refusal gives back
  every unit (into the bag, the pack, past the pack's weight); without it, the deposit was never sent (its checkpoint
  never landed) and is let go, the save keeping its items. A checkpoint refused on a first ask undoes the take whole
  ("Your game could not be saved just now, so nothing went into your Stores."); on a later ask the deposit stays kept. A
  stamp no kept deposit names (its answer heard, the page gone before the checkpoint that took it off; or kept on
  another device) is asked by its own id - the service answers a deposit made as made, for good (`prof_deposits`). The
  stamp is read and taken off in one turn, so a save's items are given back once. (The `before` count this replaced
  gave back one of four when a harvest had been minted since, and two deposits' shortfalls shared one.)
- **Two tabs** settling one kept harvest mint its goods once - the tab that lets it go (AUDIT 29 C5's law).
- **A carried harvest is never let go unminted** (the audit's B1): heard under another character it waits kept for its
  own, whose next ask the service answers with the same harvest; past its ten minutes it is asked until it is answered -
  the service answers a landed one whatever its age (its row kept thirty days) - and only a refusal lets it lapse.
- **A unit left where it was gathered** stays counted until the next act cuts the count to the pack.

## 8. The threats, and the answers

| Threat | Answer |
|---|---|
| A save-edited material deposited into the Stores | Only the carried count moves; it is cut to the pack and never raised (5) |
| A looted DFU herb sold to a writ as a harvested one | It is held, never counted: a station uses the count, not the items (5) |
| Gold's goods spent at a station through the bag | A station's shortfall moves bought and own alone (6) |
| A client claims it holds more than it does | `held` only cuts the count; the units stay counted, bounded by what was handed out (5) |
| A stale `held` (an answer lost, a twin request) cuts units the pack is about to get | The cut only against the count the client heard, once a request, never by a twin of a landed act (5, 10) |
| A loaded bag sold or given, stranding its list | Refused while it holds anything; never traded at all (1) |
| A deposit landed and its page gone before the save that took the items out | The take is saved before the ask; a save without its stamp never sent it (7) |
| A deposit refused after a reload given back twice, or not at all | By the stamp in the save, read and taken off in one turn (7) |
| A kept harvest's units cut before they are minted | The count as heard is said as held while another carried act waits (5) |

## 9. Pins

`test/bag1_service.test.js` (the service, through the real Worker) and `test/bag1_client.test.js` (the law, the
save's hands, the window, the shop, the save, the book, a done-when through the real Worker); `tools/mutants/bag1.json`.

## 10. The audit (2026-10-03, Mac: "Audit this")

Read whole before the merge, each finding reproduced against the real Worker or the real modules before it was fixed,
then pinned and its fix mutated (`tools/mutants/bag1.json`, the `AUDIT-BAG1-` records).

| # | Found | Fixed |
|---|---|---|
| B2 | A held count read when an act was kept, or before another's items were minted, cut units the service had just counted (three herbs kept offline, then pumped: counted 1 of 4) | `seen` and `heldKey`; the cut decided once a request against the count the client heard (`prof_carried_gate`, migration 0076); `held` read at the ask, a deposit still out counted (5) |
| B3 | A twin of a landed harvest or strike, racing it, cut the units the first had counted | The cut only while the request's own row is unwritten |
| B4 | No gathering kind named its material, so no carried harvest ever said `held` | Each kind names it (3) |
| B1 | A carried harvest heard under another character, or lapsed, was let go and its items never minted | Kept for its own character; a lapsed one asked once (7) |
| B17 | A deposit's answer lost with the page closed lost its units | Deposits kept; a reload's refusal gives back what the pack is short (7) |
| B5 | A withdrawal's goods with no room were counted and never minted | Into the pack, over its weight (6) |
| B6 | Herbs moved into the wagon were said as gone, the count cut under them | The wagon counts as held, taken last (5) |
| B7 | Food in the bag never rotted; a rotting one went into the Stores as fresh | The bag rots; a rotting food is no material (1) |
| B8 | A station's unanswered put-in said the materials were short | `deposit-kept` (6) |
| B9 | A Court writ read from another book's list found no shortfall to put in; a smelt said nothing of where its work went; a gem left behind was said as the harvest's | The card's word; `madeWhere`; each left material by name (3, 6) |
| H2 | The bag could not be opened from a plain pack (its button was the side window's alone) | A footer button (2) |
| H1 | Over a reward tray, a log taken out of the bag claimed the reward | No bag over a tray (2) |
| - | Put in bag offered for a dagger; Put everything in stopped at the first refusal and its button hid under a filter; the first harvest's words read as the pack only with no bag; the Work tab said a carrying book's count as the Stores' | Each fixed (2, 3, 4) |

Not changed, and why: the Stores' town is the client's convention (4) - the service checks no place, as it never did;
`held` over-reported stays bounded, not prevented (5).

## 11. The second audit (2026-10-03, Mac: "Audit again. Just want perfection")

Six reviewers read the whole PR again - the service, the book, the hands, the pages, the heraldry, the docs - and each
finding was reproduced (their repros against the real Worker and the real modules) before it was fixed, then pinned and
its fix mutated (`tools/mutants/bag1.json`, the `AUDIT2-BAG1-` records).

| # | Found | Fixed |
|---|---|---|
| S1 | A kept carried harvest asked after two days was refused `prof-day` (its row swept) and its counted units never came | Carried rows kept `CARRIED_ROW_DAYS` (30) (5) |
| K2 | A state read made `seen` current while a kept harvest's units were unminted, and the next act's cut took them (B2 half done) | The count as heard said as held while another carried act waits (5) |
| K3/K7/H2/H4/D1 | A deposit across a reload: given back one of four after a harvest's mint, one shortfall shared by two deposits, a landing with the page gone before the save kept the items too | The stamp in the save, the save the realm's before the ask (7) |
| K4/H5 | A smelt's carry-out minted through the bare mint, and units with no room by the answer were lost | Every unit given (`giveCarried`), past the pack's weight (6) |
| K10 | A product past 200 said "no room" with the bag half empty; a busy or unanswered withdrawal said as no room | As many withdrawals as the room takes; `why` said (`madeWhere`) (6) |
| K5/K6/K8/K12/K13 | A craft said "the work is kept" with none kept; a second press put a shortfall in twice; inputs moved before a refusal went unsaid; a deposit while one was out said "busy with another craft"; a smelt that threw held its id for good | `deposit-kept`, `moved` said, `deposit-busy`, the id let go (6) |
| K9 | A `carried-full` harvest refusal left the state unread | Read again, as Stores-full is |
| K11 | "+3 Oak Log to your bag" for goods that all went nowhere | "- all left where they were gathered: no room in your bag or pack" (3) |
| H1/U2 | The classic skin could not reach the bag, and a food rotted in it held the bag loaded for good | Empty your bag into your pack, on the Stores page (2, 4) |
| H3 | A take's undo wrote onto a stack sold or merged since, or into a bag that had left | The undo by each list's role, read at the undo |
| H8 | Every shelf of a General Store shelved a bag | The first shelf alone (1) |
| H11/H12 | `bagMayLeave` restated inline at five doors; Arcane Essence mintable as an item | One test; only what has a pack form is minted |
| U1/U14 | Put in offered past the Stores' room; why Take out was shut lived on a title alone; the qty field unlabelled | The room read; the reason drawn; "How many" (4) |
| U3/U6/U8/U11 | The footer's bag button grew the footer; the haul card counted what the service counted, not what came; the gold field came back over the pack after the bag; "your pack while you have none" | The gold button's rules; what came; the field put away; the words (2, 3) |
| S8 | No pin held a carried Motherlode strike or its twin | Pinned, a twin racing its first among them (`prof2b_motherlode.test.js`) |
| D3/D4 | Pins that read source a comment could fool (a host's material line, the potion maker's bag); no pin for the bag in the orphan sweep, the realm's customs or the hosts | Anchored to lines of code; the sweep and the enchanted piece driven |
| S9/D16 | The price note said 450; the law restated the Stores' bounds as literals | 456; `STORES_MAX`/`WITHDRAW_MAX` imported |

Not changed, and why: the wagon is reached from the inventory anywhere the cart is, as DFU reaches it - a design note
(H13), not a finding.

## 12. The four hosts (THE FOUR HOSTS RULE)

| Host | BAG1 |
|---|---|
| `scenes/world.js` | the book's hands (held, room, mint, give, take and the deposits' stamps, the checkpoint that landed); the Stores page; the inventory window interiors open (`bagItems`); the save |
| `scenes/exterior.js` | the inventory's bag pane (`bagItems`) |
| `scenes/dungeonContext.js` | the same, below ground |
| `scenes/worldModes.js` | DFU's potion maker reads and spends the bag after the cart; interiors' inventory is world.js's |
