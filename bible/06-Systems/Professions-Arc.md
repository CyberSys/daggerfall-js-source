# THE PROFESSIONS ARC - life skills and materials (PROF0, the design record)

**Status: DESIGN RECORD. Nothing here is built.** Opened 2026-09-28, beside the town-control design
(`11-Multiplayer/Seats-Arc.md`, SEAT0), at Mac's word: "If theres also sub systems (like life skills + materials) that
can play a part, we can do that also. The sky is the limit" - and "Make sure we're documenting everything before
building... I want this to have insane depth, replayabiity and everything else."

The marks are the Seats arc's: **DECIDED** (Mac's word), **PROPOSED** (this record's default, Mac may overrule),
**OPEN** (Mac's question), **FACT** (the tree today, the file named). Nothing below is DECIDED yet except that the
arc exists and that it feeds the seats.

## 1. The laws this arc keeps

1. **ONLINE ONLY, AND DAGGERFALL'S MAKERS UNTOUCHED.** FACT: Daggerfall has no crafting skill; its three makers - the
   potion maker (`src/systems/potions.js`, 20 recipes), the spellmaker (`spellMaker.js`) and the item maker
   (`enchanting.js`) - are ported 1:1 and use no skill at all. Offline they stay exactly that. A profession is a
   Ledger A departure, online's alone, earned only online (Renown's law: offline play earns nothing).
2. **DAGGERFALL'S ITEMS FIRST.** A material is one of DFU's own items wherever DFU has one (FACT, `itemTemplatesData.js`
   `GROUP_TEMPLATE_INDICES`: 8 gems, 25 plant ingredients, 22 creature ingredients, 11 metals - Mercury, Tin, Brass,
   Lodestone, Sulphur, Lead, Iron, Copper, Silver, Gold, Platinum). A product is one of DFU's own templates at one of
   DFU's own materials (FACT, `WEAPON_MATERIALS` and `armorMaterials.js`: Iron, Steel, Silver, Elven, Dwarven,
   Mithril, Adamantium, Ebony, Orcish, Daedric). A crafted Dwarven longsword IS Daggerfall's Dwarven longsword. New
   templates exist only for what Daggerfall lacks (ores above iron, lumber, hides, cloth, ingots, tools), registered
   above DFU's range through `registerCustomTemplates` as Climates & Calories (530-541) and RRI (513-526) already are.
3. **THE STORES ARE THE SERVER'S.** FACT: every item and every coin online lives in the client's save. The seats
   need a material economy no client can inflate (Seats law 3). PROPOSED: gathered materials land in the **Stores** -
   a per-character inventory the account service keeps - not in the pack. Crafting consumes the Stores on the
   service and hands the product to the save. A material WITHDRAWN to the pack (to feed DFU's own potion maker, say)
   becomes an ordinary save item and **can never go back**: a one-way valve, so nothing edited into a save can be
   laundered into the server's economy.
4. **THE NODES ARE THE CLOCK'S.** Which gathering nodes exist today is a pure function of the day and the map pixel,
   the way the Oblivion Gate's site is (`src/net/gateLaw.js`), so the client, the relay and the service agree without
   a frame, and the service can refuse a harvest of a node that does not exist. **Yields are rolled by the service**,
   never the client.
5. **NO COMMITTED GAME-DATA ART.** A node is drawn from the player's own ARENA2 at runtime (DFU's own rock, tree and
   plant flats, tinted), or from Morrowind models when the player has attached Morrowind (the Morrowind asset layer,
   `06-Systems/Morrowind-Assets.md`). A new item's icon is the port's own art. OPEN: who draws the new icons.
6. **CRAFTING DOES NOT RETIRE LOOT.** FACT: Loot Rarity has Common, Magic, Rare, Legendary, Aetheric and Artifact
   (`src/systems/lootRarity.js`); Sigil Sets are online-only set gear (`11-Multiplayer/Sigil-Sets.md`). PROPOSED: a
   craft reaches **Rare at most**; Legendary, Aetheric, Artifact and Sigil pieces are never craftable. A crafter's
   ceiling is a named **Masterwork** (7.3) - a player's mark on the world, not a bypass of it.

## 2. What already stands (FACT)

| Foundation | Where | Use here |
|---|---|---|
| DFU's makers | `potions.js`, `potionMakerWindow.js`; `spellMaker.js`; `enchanting.js`, `itemMakerWindow.js` | Alchemy and Enchanting's professions are layers over them, never replacements |
| Home stations | `DECOR_STATIONS` / `DECOR_STATION_FEES` in `src/net/decorLaw.js`, `server-account/src/decor.js` (HOME-STATIONS, STATION-FEES) | Alchemy/spells/enchant stations placed in a home for a one-off licence; new station kinds join this list |
| Repair | `repairService.js`, `merchantRepairWindow.js` | Material repair becomes a sink |
| Climates & Calories | `src/systems/survival/` - camps, campfire kits, cooking at fires and hearths, foraging, corpse meat | Cooking's ground; hunting's |
| Deep Waters fish | templates 9001-9007 (sellable, not edible) | Fishing's first catch |
| World of Daggerfall | 227,938 placed prefabs, 209,436 of them rock fields (`03-World/World-Of-Daggerfall.md`); WOD7 shares camps online (`src/world/wodShared.js`) | Anchors for mining nodes; Bounty edicts |
| Terrain nature | `src/world/terrainNature.js` - decoration only today | Anchors for logging and herbalism nodes |
| Dyes | `src/systems/itemDye.js` | Outfitting's colours |
| Player trade | TRADE1 (`tradeSession.js`, `enhancedPlayerTrade.js`) - face to face, 5 m, items and gold | Stays the way to hand over loot |
| Shops online | WORLD6a: a shop's shelf belongs to its room; sold items stand on it for others | Already a crude player-to-shop-to-player market |
| Sigil Stones | template 570 (`gateSpoils.js`), one per gate kill | Daedric crafting's rare input |
| Gold | the save's; the guild treasury is the only gold a server holds (`0013_guilds.sql`) | The currency question (8.4) |

What does not exist anywhere (FACT, searched): a profession or life skill, mining, logging, skinning, ore, lumber,
hide or cloth items, gathering nodes, a market or auction, buy orders.

## 3. The professions

### 3.1 Gathering (five)

| Profession | What it gathers | Where | Tool (new template) |
|---|---|---|---|
| **Mining** | DFU's metals and gems; the higher ores (4.1); stone | Rock fields, mountainsides, dungeon veins | Pick |
| **Logging** | Logs by climate (4.2); bark; resin | Trees of the wilderness | Woodcutter's axe |
| **Herbalism** | DFU's own plant ingredients by climate and season | Plants of the wilderness and marsh | Sickle |
| **Hunting** | Hides and pelts (new); DFU's creature ingredients; meat (C&C) | The animals the player kills (skinning a corpse the player's own blow felled) | Skinning knife |
| **Fishing** | Deep Waters' fish (9001-9007, made edible for Cooking); pearls (a gem) | Shores, rivers, the sea, the Sea update's waters | Rod and bait |

All five are open to every character, PROPOSED: gathering is how a newcomer earns, and a gatherer is never a wasted
build.

### 3.2 Crafting (eight)

| Profession | Makes | Station |
|---|---|---|
| **Smithing** | DFU's weapons and plate/chain armour, every material from Iron to Daedric; ingots; repair kits | Forge (home station), any Weaponsmith or Armorer in town (a fee to the shop) |
| **Outfitting** | Leather armour, DFU's clothing, dyed goods, bags | Tanning rack / loom (home station), any Clothing store |
| **Carpentry** | Bows, staves, arrows; decor pieces; the Ram and siege works (Seats 6.2); wagon repair (Horse Cart and Cargo) | Workbench (home station) |
| **Masonry** | Fortifications (Seats 7.5); homestead works (PLOT1); stone decor | Mason's bench (home station), the seat's own works |
| **Alchemy** | A layer over DFU's potion maker (3.4) | DFU's own: a Mages Guild, a home alchemy station |
| **Enchanting** | A layer over DFU's item maker (3.4) | DFU's own: a Mages Guild, a home enchanting station |
| **Cooking** | C&C's foods; feasts (party buffs) | Any campfire, hearth or brazier (FACT, `hearth.js`) |
| **Jewelcrafting** | Rings and amulets (DFU's jewellery templates, high enchantment points) from gems and silver/gold | Jeweller's bench (home station), a Pawn shop / Gem store |

### 3.3 Mastery

- PROPOSED: each profession has a track from **0 to 100**, kept by the service per character (Renown's shape:
  `renown_tracks`, one row a character). Ranks: Novice 0, Apprentice 25, Journeyman 50, Expert 75, Master 100.
- **The crafter's limit** - PROPOSED: a character may raise at most **two crafts above Journeyman**. Every
  gathering profession is unlimited. So no one character makes everything, and trade is how an army is equipped.
- **Specialisations** - PROPOSED: at 50 and at 100 each profession offers a choice of two (for Smithing: Weaponsmith
  or Armoursmith at 50; Masterwright - a Masterwork chance - or Quartermaster - double output of ingots and repair
  kits - at 100). A respecialisation costs gold and a week's wait.
- **XP** - PROPOSED: gathering by harvest (more for a higher tier); crafting by craft (more for a higher tier, a large
  bonus the first time a recipe is made); writs (section 9) pay profession XP beside gold. All of it service-witnessed
  (the service performed the harvest and the craft), so no profession XP is client-reported.
- **Renown is separate.** A Renown 50 knight may be a Novice smith. PROPOSED: a profession's rank grants nothing in
  combat; its gifts are what it makes.

### 3.4 Alchemy and Enchanting over DFU's makers

DFU's makers stay 1:1 (law 1). PROPOSED, online only, applied after DFU's own result:

- **Alchemy**: a brew at Journeyman makes 2 potions instead of 1, at Master 3; a Master's brew may come out **Potent**
  (the potion's magnitude +25%, marked on its name). Alchemy XP comes from brewing DFU's own recipes. New recipes are
  not added: DFU's twenty are the whole book.
- **Enchanting**: the item maker's enchantment point cost -10% at Journeyman, -20% at Master; **Disenchanting** (new):
  breaking an enchanted item the player owns into **Arcane Essence** (a new material, Stores-only) that Masterworks
  and Jewelcrafting consume.

## 4. Materials

### 4.1 Metals and the ten tiers

Every DFU material tier gets a source. PROPOSED:

| DFU material | Raw | Refined | Where it comes from |
|---|---|---|---|
| Iron | Iron (DFU metal) | Iron ingot | Any rock field |
| Steel | Iron + charcoal (Logging) | Steel ingot | Smelted |
| Silver | Silver (DFU metal) | Silver ingot | Rock fields, rarer; hills and mountains |
| Elven | Moonstone ore (new) | Moonstone ingot | Woodland and rainforest regions' deep veins |
| Dwarven | Dwarven scrap (new) | Dwarven ingot | Dungeon veins only |
| Mithril | Mithril ore (new) | Mithril ingot | Mountain regions |
| Adamantium | Adamantium ore (new) | Adamantium ingot | The deepest dungeon veins |
| Ebony | Ebony ore (new) | Ebony ingot | Desert regions (Hammerfell's) - a regional signature |
| Orcish | Orichalcum ore (new) | Orichalcum ingot | Orc country (the Wrothgarian mountains) - a regional signature |
| Daedric | Ebony ingot + Daedra's Heart (DFU creature ingredient) + a Sigil Stone (gate spoils) | Daedric ingot | Crafted only - the Oblivion Gate's gift |

DFU's other metals (Tin, Copper, Brass, Lead, Gold, Platinum, Mercury, Lodestone, Sulphur) stay what they are
(potion ingredients) and gain craft uses: Gold and Silver for Jewelcrafting, Copper and Tin for fittings, Sulphur and
Lead for Masonry's mortar.

### 4.2 Wood, hide, cloth, stone

| Family | Kinds (PROPOSED, by DFU climate) |
|---|---|
| Wood | Oak (temperate), Pine (mountain, woodland hills), Cedar (subtropical), Palm (desert), Mangrove (swamp), Ironwood (rainforest, rare), Ghostwood (haunted woodland, rare) |
| Hide | Rat, Wolf, Bear, Tiger (sabre-tooth), Spider silk (giant spiders), Dreugh shell (the sea) - from the foes DFU already spawns |
| Cloth | Linen and wool - bought at General stores (a gold sink), never gathered; dyed with `itemDye.js`'s colours |
| Stone | Rough stone, cut stone - quarried from rock fields (Mining) |

### 4.3 Regions matter

PROPOSED: each DFU climate has a **native table** (what its nodes can yield, and how often), and some regions carry a
**signature** material found nowhere else in quantity (Ebony in Hammerfell's deserts, Orichalcum in orc country,
Ironwood in the rainforest...). OPEN: the signature map - by climate (derived, PROPOSED) or by Mac's hand region by
region. This is the seam that makes the seats economic (Seats 11): the guild that holds the region taxes its
signature with the Levy edict, and challengers want it.

### 4.4 Seasons and tides

- DFU's own seasons (and Seasons of the Iliac Bay, when it is on) change what herbs grow: PROPOSED, a winter table
  and a summer table per climate.
- The Seats arc's weekly **Tide** (Seats 9.3) can be a Harvest (+25% yield in a kingdom) or a Blight (-25%).
- **Gate-touched ground** - PROPOSED: for two hours after an Oblivion Gate is felled, its site holds **Sigil-touched
  veins**: the only place Adamantium and Daedra's Heart are found in the open world. The world boss feeds the smiths.

## 5. Nodes

- **The law** - PROPOSED, src/net/nodeLaw.js (to be written) (pure, shared by client and service): for a map pixel and a UTC day,
  `hash(NODE_SALT, pixel, day)` gives the day's node set - how many, of which kinds - from the pixel's climate table.
  A node's id is `(pixel, day, slot)`. The CLIENT places each node on the ground (a rock field's rocks, a tree, a
  shore) from its own terrain; the SERVICE needs only the id to know the node is real.
- **Dungeon veins** - PROPOSED: a dungeon's day holds `hash(NODE_SALT, mapId, day)` veins, placed on the dungeon's own
  walls by the client from its RDB layout.
- **Per character, not contested** - PROPOSED: every character sees every node and harvests each one once a day. No
  one steals another's node, no one camps it. The contested ones are the **Motherlodes**: a rare node the hub
  announces, shared by the whole server, that yields to the first twenty characters to reach it.
- **The harvest** - the client asks `{node, character}`; the service checks the id against the law for today, the
  character's daily caps (PROPOSED 60 harvests a profession a day), and that this node is untaken by this character;
  it rolls the yield (CSPRNG) and adds it to the Stores. Travel time is the natural rate limit; the cap is the
  honest one.
- **The drawn node** - DFU's own flats from the player's ARENA2, tinted by kind, with a small glint; or a Morrowind
  model on the Morrowind lane. A harvested node greys out for the rest of the day, for this character only.

## 6. The Stores

- PROPOSED: a per-character inventory on the account service (`stores`: player, char_id, material, quantity), capped
  at 5,000 of any one material.
- **The Stores window** - opened from the pack (a tab), a home's chest, and any seat's hall. It is the only place a
  Stores material is seen. Moving a material to the pack is allowed (it becomes a save item, one-way - law 3); moving
  a pack item into the Stores is refused.
- **Guild stores** - PROPOSED: a guild warehouse (Officers and the guildmaster withdraw; anyone deposits from their
  own Stores), logged like the treasury (`guild_ledger`'s pattern).
- **Seat stockpiles** - the holder's (fortifications, garrison) and the challengers' **Siege Camp** (siege works);
  filled by writs and the Levy (Seats 7.6).

## 7. Crafting

### 7.1 The act

- The player opens a station, picks a recipe they know, and the Stores inputs it needs are shown.
- **The service crafts**: it checks the recipe, the rank and the Stores; it takes the inputs; it rolls the quality
  (7.2); and it answers with a **signed product record** - the DFU template, the material, the quality, the maker's
  name, and a **provenance id** unique across the server. The client adds the item to the save exactly as a shop
  purchase adds one.
- **Recipes** - PROPOSED: most unlock with rank; some are found (a recipe scroll in loot or a Motherlode); a few come
  only from writs (9) or a seat's fortification (Seats 7.5's Forge).

### 7.2 Quality

PROPOSED, within DFU's own bounds for the template and material:

| Quality | Effect |
|---|---|
| Crude | Condition max -25% |
| Standard | DFU's own item |
| Fine | Condition max +15%, weight -5% |
| Superior | Condition max +30%, weight -10%; rolls on Loot Rarity's Magic table |
| Masterwork | Superior, plus the maker's mark and one property from a short list (a Loot Rarity Rare roll) |

Quality is rolled from the crafter's rank, the station (a Seats fortification's Forge adds a step), and the inputs'
tier. A Masterwork's name carries its maker: "Silverthorn's Mithril Longsword".

### 7.3 Masterworks and commissions

- A Masterwork is the one crafted item that carries a name, and the Chronicle (Seats 9.2) keeps a **Hall of Makers**
  per profession per Season: the most Masterworks made, the most writs filled.
- **Commissions** - PROPOSED: a player may post a writ naming a crafter; only that crafter can fill it. A reputation
  economy on top of the material one.

### 7.4 Sinks

An economy that only makes things drowns. PROPOSED sinks: repair consumes materials; siege works are consumed by a
siege; fortifications cost upkeep in materials as well as gold; cooking's food is eaten; the Stores cap; station use
fees in town; market listing fees and the Tithe.

## 8. The market

### 8.1 The Consignment Hall

PROPOSED: a **Consignment Hall** at every seat (its Market Hall fortification widens it - Seats 7.5) and at every
hub (the Bank of the Empire's counter). It lists:

- **Stores materials** - escrowed by the service. Safe by construction.
- **Crafted goods with a provenance id** - the listing removes the item from the save and the service holds the
  record. The same provenance id can never be listed twice, so an item duplicated by editing a save cannot be sold
  twice.
- **Loot is not listed** - it has no provenance. Face-to-face trade (TRADE1) stays how loot changes hands.

### 8.2 Buy orders

PROPOSED: a player may post a standing order ("buy 200 Mithril ore at 40 each") that any gatherer fills straight
from their Stores.

### 8.3 Fees

A listing fee (a sink) and a sales tax that goes to the town's seat holder as Tithe (Seats 7.2), or nowhere at an
unheld seat or a plain hub.

### 8.4 The currency question

FACT: online gold is the save's ("The GOLD is the client's, the economy being the save's" - GUILD1). A market paid in
purse gold can be paid by a modified client that never had the gold, and the seats' claim fees and upkeep come from
treasuries fed by purse gold. OPEN, and the biggest question on both pages:

- **(a) Keep gold** (PROPOSED for the first slices): every online system already trusts it; caps and fees bound the
  damage; the service logs every movement so abuse is visible and reversible.
- **(b) A server currency** - "Marks", earned only from server-witnessed acts (a market sale, a writ, a siege Honour,
  a node's rare find), spent only at the market, the seats and the professions. Integrity by construction; a second
  currency for players to understand.

The record recommends (a) now and (b) as a named slice (MARKS1) if the logs show abuse.

## 9. Writs

- **Seat writs** - posted by a seat's holder from its treasury, filled into its stockpile (Seats 4.2, 7.5).
- **Guild writs** - posted by a guild for its warehouse or hall.
- **Court writs** - PROPOSED: each day the clock rolls a few NPC writs per region ("The Court of Wayrest needs 40 oak
  planks"), paid in gold and Renown - so there is always work, even in a region no guild holds.
- **Commissions** (7.3).
- Filling a writ is a service act from the Stores: witnessed, instant, and worth profession XP. Influence from a
  seat writ goes to the filler's guild only if that guild holds the seat or is pledged to it (Seats 4.1), so supplying
  a rival pays gold, not power.

## 10. Why a player comes back

A daily node round; a weekly Tide; the season's herbs; Motherlodes the hub announces; gate-touched veins after every
gate; recipes still to find; a specialisation to choose; a Masterwork with your name on it in someone else's hand;
the Hall of Makers; commissions; and every seat on the map wanting what you gather.

## 11. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client fakes harvests | Node ids from the pure law; service-rolled yields; daily caps (5) |
| A modified client fakes a craft | The service crafts; the client only receives (7.1) |
| A save-edited item enters the economy | The Stores are one-way (law 3); only provenance items list, once (8.1) |
| Bots farming nodes | Daily caps; nodes per character; travel time |
| Market paid with fake gold | OPEN (8.4) |
| Crafting obsoletes loot | Rare at most; Masterwork is a name, not a Legendary (law 6) |
| One character does everything | Two crafts above Journeyman (3.3) |

## 12. The server's shape (a sketch)

PROPOSED:

- `prof_tracks` (player, char_id, profession, xp, spec JSON)
- `stores` (player, char_id, material, qty); `guild_stores` (guild_id, material, qty) with a ledger
- `node_harvests` (day, node_id, player, char_id) - one row a harvest; the day's key makes old rows droppable
- `recipes_known` (player, char_id, recipe)
- `products` (provenance PK, template, material, quality, maker, made_at)
- `market_listings`, `market_orders`
- `writs` (id, poster kind, poster id, map_id, material, qty, pay, filled)
- Pure law modules: src/net/nodeLaw.js (to be written), src/net/professionLaw.js (to be written) (tracks, ranks, caps, every number here),
  src/net/recipeLaw.js (to be written) (every recipe as data: inputs, product template, material, rank).

## 13. The slices, in order (PROPOSED)

| Slice | What | Why first |
|---|---|---|
| **PROF0** | This record | - |
| **PROF1** | The Stores; Herbalism; withdraw to pack | DFU's own plant ingredients already exist and DFU's potion maker already consumes them: value on day one, no new art |
| **PROF2** | Mining; smelting; the ore templates | The metals exist; the higher ores are the first new templates |
| **PROF3** | Smithing; quality; provenance; the forge station | DFU's weapons and armour at DFU's materials |
| **PROF4** | Logging; Carpentry; decor pieces crafted | Ties into DECOR; the Ram waits for SEAT2b |
| **PROF5** | The Consignment Hall; buy orders | Needs provenance (PROF3) |
| **PROF6** | Writs (court, guild, seat) | Needs SEAT1b for seat writs |
| **PROF7** | Hunting and Outfitting | Hides, leather, clothing, dyes |
| **PROF8** | Cooking | C&C's foods; feasts |
| **PROF9** | Jewelcrafting | Gems and jewellery |
| **PROF10** | Fishing | The sea |
| **PROF11** | Masonry | Needs SEAT2b (fortifications) and PLOT1 |
| **PROF12** | Alchemy and Enchanting layers; Disenchanting | Over DFU's makers |
| **MARKS1** | A server currency, if (8.4) chooses it | - |

## 14. OPEN - Mac's questions

1. **The Stores** (law 3): server-held, one-way to the pack - yes?
2. **The currency** (8.4): gold now (PROPOSED) with MARKS1 held back, or a server currency from the start?
3. **The crafter's limit** (3.3): two crafts above Journeyman - or no limit?
4. **Online only** (law 1): professions earn nothing offline, like Renown - yes?
5. **Signature materials** (4.3): derived from climate, or drawn region by region?
6. **New art** (law 5): who draws the new materials' icons and the tools?
7. **Crafting's ceiling** (law 6): Rare at most, Masterwork as the top - yes?
8. **Daedric** (4.1): crafted only, from Ebony, a Daedra's Heart and a Sigil Stone - yes?
9. **Every PROPOSED number** here: accept as the starting table?
