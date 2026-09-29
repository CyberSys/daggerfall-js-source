# THE PROFESSIONS ARC - life skills, materials, the Notice Board and Marks (PROF0, the design record)

**Status: DESIGN RECORD, every question decided. Built so far: MARKS1 (10.5) and NOTICE1 (10.7), both at `dev`; the
professions themselves are not.** Opened 2026-09-28 beside the town-control
design (`11-Multiplayer/Seats-Arc.md`, SEAT0), whose marks this page uses: **DECIDED (Mac)**, **DECIDED** (the
record's, at Mac's instruction), **FACT**, **MEASURED**.

## Mac's words

- "If theres also sub systems (like life skills + materials) that can play a part, we can do that also. The sky is
  the limit"
- "Make sure we're documenting everything before building ... I want this to have insane depth, replayabiity and
  everything else."
- **"New currency"**
- "Life skills will utilize things like tree chopping, picking up ingredients, fishing, etc. Active player
  involvement and actual UI integration for life skills."
- "The new notice board should be a physical object that houses quests, the player auction house, etc"
- **"I want you to make the decisions with the intent as being as detailed as possible."**

Every number below lives in a pure law module: the Marks' in `src/net/marksLaw.js` and the board's in
`src/net/boardLaw.js` (built - MARKS1, NOTICE1); the rest in three still to be written with their slices,
src/net/professionLaw.js (tracks, ranks, caps, acts, quality), src/net/recipeLaw.js (every recipe as data) and
src/net/nodeLaw.js (the nodes). Appendix B lists them in one place.

## 1. The laws this arc keeps

1. **ONLINE ONLY; DAGGERFALL'S MAKERS UNTOUCHED.** FACT: Daggerfall has no crafting skill; its three makers - the
   potion maker (`src/systems/potions.js`, 20 recipes), the spellmaker (`src/systems/spellMaker.js`) and the item
   maker (`src/systems/enchanting.js`) - are ported 1:1 and use no skill. Offline they stay that. A profession is a
   Ledger A departure, online's alone, and offline play earns nothing toward one (DECIDED; Renown's law).
2. **DAGGERFALL'S ITEMS FIRST.** A material is one of DFU's own items wherever DFU has one (the 8 gems, 25 plants, 23
   creature parts and 11 metals, section 4); a product is one of DFU's own templates at one of DFU's own materials. A
   crafted Dwarven longsword IS Daggerfall's Dwarven longsword. New templates only for what Daggerfall lacks, in the
   **reserved range 600-699** (4.8), registered through `registerCustomTemplates` (`src/systems/itemTemplates.js`)
   as RRI (513-526), Climates & Calories (530-541), the Thunderlock (560-561) and the Sigil Stone (570) already are.
   **The tools are Foraging's own** (Wood-Axe 1600, Pick-Axe 1601, Sickle 1602, Fishing-Net 1603, Basket 1607 -
   Harbinger451's mod, ported 1:1, `06-Systems/Foraging.md`, FORAGE0); the range adds only the Skinning Knife (603).
3. **THE STORES ARE THE SERVER'S.** Gathered materials land in the **Stores**, a per-character inventory the account
   service keeps, not in the pack. Crafting consumes the Stores on the service and hands the product to the save. A
   material withdrawn to the pack becomes an ordinary save item and **never goes back**: nothing edited into a save can
   be laundered into the server's economy. **What may enter the Stores**, the whole list: a harvest the service
   rolled (section 6), a craft the service made (section 9), a market purchase or a buy order filled (10.2-10.3), a
   writ's return or refund (section 11), the Board's two counters - the Weavers' and the Apothecaries' (4.5) - a Siege
   Honour's Spoils of War (4.7), and Disenchanting's Essence from a provenance item (9.3). Nothing else - no pack item,
   however it was come by. **Every Stores unit carries its origin** (section 7): **own** (this character's harvest or
   craft) or **bought** (everything else); only own units raise a seat's influence at their value (section 11).
4. **THE NODES ARE THE CLOCK'S.** Which nodes exist today is a pure function of the UTC day and the map pixel, as the
   Oblivion Gate's site is (`src/net/gateLaw.js`); **yields are rolled by the service**, never the client.
5. **THE HANDS DO THE WORK** - DECIDED (Mac: "Active player involvement"). Every harvest is an act the player plays
   (section 5), and an act played well gives more - within a bound a modified client cannot break (5.1).
6. **NO NEW COMMITTED ART IN THE FIRST SLICES** - DECIDED. Tools in the hand are DFU's own weapon sprites (and the
   Morrowind arms on that lane; the net and the basket are the item's own picture held as the held map is - 5.1), new items' icons are DFU's own icons recoloured at runtime from the player's data
   (4.8), nodes are DFU's own flats tinted. The one committed art is the heraldry's 24 devices (SEAT0 8.1), the port's
   own. If Mac later commissions art, it replaces a runtime composition icon by icon. Foraging's seven textures are the
   author's own art, vendored with Mac's word of permission - a mod's work carried, not art the port made (FORAGE0
   law 5).
7. **CRAFTING DOES NOT RETIRE LOOT.** FACT: Loot Rarity's tiers are Common, Magic, Rare, Legendary, Aetheric, Artifact
   (`src/systems/lootRarity.js`); Sigil Sets are online set gear (`11-Multiplayer/Sigil-Sets.md`). DECIDED: a craft
   reaches **Rare** at most (a Masterwork); Legendary, Aetheric, Artifact and Sigil pieces are never craftable.
8. **MARKS, NOT GOLD** - DECIDED (Mac: "New currency"). Everything this arc prices between players is in Marks
   (10.5), which only the server holds and only server-witnessed acts mint.

## 2. What already stands (FACT)

| Foundation | Where | Use here |
|---|---|---|
| DFU's makers | `potions.js` (+ `potionMakerWindow.js`), `spellMaker.js`, `enchanting.js` (+ `itemMakerWindow.js`) | Alchemy and Enchanting are layers over them |
| DFU's items | `src/characters/itemTemplates.json`; `GROUP_TEMPLATE_INDICES` (`src/systems/itemTemplatesData.js`) | Every material and product named in section 4 |
| Home stations | `DECOR_STATIONS`, `DECOR_STATION_FEES` (`src/net/decorLaw.js`); the account service's decor | Alchemy/spells/enchant stations placed for a licence; new station kinds join the list |
| Repair | `src/systems/repairService.js` | Repair kits (Smithing) |
| Climates & Calories | `src/systems/survival/` - camps, the Skillet, cooking at fires and hearths, foraging, corpse meat; templates 530-541 (Camping Equipment, Rations, Apple, Orange, Bread, Raw Fish, Cooked Fish, Meat, Raw Meat, Waterskin, Skillet, Campfire Kit) | Cooking's ground; Hunting's butchery |
| Deep Waters fish | templates 9001-9007 (Longnose Butterflyfish, Largemouth Bass, Canary Rockfish, Crucian Carp, Mackerel, White Zebra Angelfish, Juvenile Finulon), each with its waters (`PASSIVE_FISH_SPECIES`, `src/world/passiveFish.js`: Tropical, Temperate, Swamp, Desert, OpenOcean, Cold) | Fishing's haul (the species named; the Stores keep Raw Fish, 5.2) |
| World of Daggerfall | 209,436 rock-field prefabs among 227,938 (`03-World/World-Of-Daggerfall.md`); WOD7's shared camps (`src/world/wodShared.js`) | Mining's anchors; bounties |
| Terrain nature | `src/world/terrainNature.js` | Logging's and Herbalism's anchors |
| Climates | `mapsFile.js`: Ocean, Desert, Desert2, Mountain, Rainforest, Swamp, Subtropical, MountainWoods, Woodlands, HauntedWoodlands | Every native table (section 4) |
| Dyes | `src/systems/itemDye.js` | Outfitting |
| Bulletin boards | `BULLETIN_BOARD_MODEL_ID` (`src/world/rmbLayout.js`), `src/systems/bulletinBoard.js` (ROAD A9) | The Notice Board (10.1) |
| Player trade | TRADE1 (`src/net/tradeSession.js`, `src/ui/enhancedPlayerTrade.js`) | Stays how loot changes hands |
| Held objects | `src/combat/heldPose.js` (MAP3) - the Morrowind arms' held-sheet pose only; the classic lane's held map is a bottom-anchored sprite that hides the weapon from its place in the draw ladder (MAP-WEAPON, `10-UI/Held-Map-Arc.md`) | The net and the basket in the hand (5.1) |
| Sigil Stones | template 570 (`src/systems/gateSpoils.js`) | Daedric smithing |
| Gold | the save's; the guild treasury is the only gold a server holds | Why Marks exist (10.5) |

**Standing since FORAGE1-FORAGE3 (2026-09-28)**: Foraging (`06-Systems/Foraging.md`, `src/systems/foragingLaw.js`,
`src/systems/foragingInstall.js`): the tools and their shelves, their checks (daylight, no foe near, not encumbered),
the Basket's foods, the attribute pairs, and the tools in loot (a shelf's and a house's hook, every pile at its index,
the corpses - FORAGE3), and online the quests' time as a wait (FORAGE4). Foraging stands whole in both lanes.

## 3. The professions

### 3.1 Thirteen professions

| Gathering (5) | Crafting (8) |
|---|---|
| **Mining** - DFU's metals and gems, the higher ores, stone | **Smithing** - DFU's weapons and metal armour, ingots, repair kits |
| **Logging** - logs by climate, charcoal, resin | **Outfitting** - leather armour, DFU's clothing, dyes, rugs and tapestries |
| **Herbalism** - DFU's own plant ingredients | **Carpentry** - bows, staves, arrows, DFU's furniture, the Ram |
| **Hunting** - hides, DFU's creature parts, meat | **Masonry** - cut stone, mortar, fortifications, stone decor |
| **Fishing** - Deep Waters' species, pearls | **Alchemy** - over DFU's potion maker |
| | **Enchanting** - over DFU's item maker; Disenchanting |
| | **Cooking** - C&C's foods, dishes, feasts |
| | **Jewelcrafting** - DFU's jewellery from gems and precious metals |

### 3.2 Ranks and XP

- A track from **0 to 100** per profession per character, kept by the service (Renown's shape). Ranks: **Novice**
  0, **Apprentice** 25, **Journeyman** 50, **Expert** 75, **Master** 100.
- XP to reach rank n: **10 x n^2** (Apprentice 6,250; Journeyman 25,000; Expert 56,250; Master 100,000).
- XP earned: a harvest **15 x tier** (+50% for a clean act); a craft **20 x tier x units**, **+500** the first time
  a recipe is made; a writ **2 x its Mark value**. A node or recipe more than two tiers below your rank gives a
  quarter.
- All XP is service-witnessed: the service performed the harvest, the craft, the delivery.
- **Tiers**, the ladder every material, node and recipe sits on - the rank each needs:

| Tier | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Rank needed | 0 | 10 | 25 | 40 | 55 | 70 | 90 |

- **The crafter's limit** - DECIDED: a character may raise at most **two crafts above Journeyman (50)**. Gathering is
  unlimited. No one character makes everything; trade equips an army.
- **Online only** - DECIDED: nothing offline earns profession XP.

### 3.3 Specialisations

At 50 and again at 100 each profession offers two; the choice is made on the Professions tab. A change costs **1,000
Marks** and a week's wait.

| Profession | At 50 | At 100 |
|---|---|---|
| Mining | **Prospector** - veins within 200 m marked on the compass and held map; gem chance +10% / **Deep Delver** - dungeon veins yield +50% | **Motherlode Sense** - Motherlode warnings 30 minutes ahead, not 10 / **Stonebreaker** - quarrying yields Cut Stone directly |
| Logging | **Lumberjack** - 2 chops fewer a tree (3 at least) / **Forester** - heartwood chance x2 | **Charcoal Burner** - a log burns to 2 Charcoal, not 1 / **Timberwright** - a log saws to 3 planks, not 2 |
| Herbalism | **Gardener** - common herbs yield +1 / **Botanist** - the steady window +50% | **Seasonal Eye** - off-season herbs at half rate / **Apothecary's Friend** - every herb you pick counts as unbruised |
| Hunting | **Tracker** - animals within 100 m marked / **Tanner** - hides cure 1:1, not 2:1 | **Trophy Hunter** - a trophy decor piece from a tier 5+ kill / **Butcher** - meat x2, and it spoils half as fast |
| Fishing | **Angler** - the tug window +40% / **Netter** - a school's haul +2 fish, not +1 | **Deep-Sea** - the sea's Pearl and Slaughterfish chances x2 / **Pearl Diver** - pearl chance x3 |
| Smithing | **Weaponsmith** or **Armoursmith** - that family +1 quality step | **Masterwright** - Masterwork chance +5% / **Quartermaster** - ingots and repair kits x2 |
| Outfitting | **Tailor** - clothing +1 step / **Leatherworker** - leather armour +1 step | **Couturier** - two-colour dyes / **Saddler** - a wagon upgrade (Horse Cart and Cargo) of +100 kg |
| Carpentry | **Bowyer** - bows and arrows +1 step / **Joiner** - furniture at half the planks | **Siegewright** - Rams +50% vitality; siege works a day sooner / **Master Joiner** - furniture carries the maker's mark |
| Masonry | **Quarryman** - Rough Stone cuts 1:1, not 2:1 / **Builder** - fortification projects need 10% less stone | **Fortifier** - once a Season a seat's Walls skip their drop on capture / **Sculptor** - stone decor pieces |
| Alchemy | **Brewer** - 3 potions a brew at Journeyman / **Distiller** - Potent chance +10% | **Master Alchemist** - Potent is +40%, not +25% / **Transmuter** - three of a DFU metal make one of the next up (Tin, Copper, Silver, Gold, Platinum) |
| Enchanting | **Efficient** - a further -5% cost / **Disenchanter** - Arcane Essence x2 | **Soulbinder** - filled soul gems give +10% points / **Runecaster** - a Masterwork's property chosen from three |
| Cooking | **Cook** - +1 serving a dish / **Field Cook** - a campfire without a Campfire Kit's charge | **Chef** - feasts last +50% / **Provisioner** - rations and dishes never spoil |
| Jewelcrafting | **Gemcutter** - a set gem adds +10% enchantment points / **Goldsmith** - Silver counts as Gold | **Master Jeweller** - jewellery Masterwork chance +5% / **Lapidary** - Siege-cracked Gems set as any gem |

## 4. Materials

### 4.1 Metals - DFU's ten materials on the seven tiers

| DFU material | Raw | Refined (new, 4.8) | Tier | Where |
|---|---|---|---|---|
| Iron | Iron (DFU 71) | Iron Ingot | 1 | every rock field and vein |
| Steel | Iron Ingot + Charcoal | Steel Ingot | 2 | smelted |
| Silver | Silver (DFU 73) | Silver Ingot | 3 | Mountain, MountainWoods |
| Elven | Moonstone Ore | Moonstone Ingot | 4 | Woodlands, HauntedWoodlands deep veins; everywhere in the Kingdom of Daggerfall (4.7) |
| Dwarven | Dwarven Scrap | Dwarven Ingot | 4 | dungeon veins only |
| Mithril | Mithril Ore | Mithril Ingot | 5 | Mountain; everywhere in the Kingdom of Wayrest (4.7) |
| Adamantium | Adamantium Ore | Adamantium Ingot | 6 | deep dungeon veins; gate-touched ground; the Isle of Balfiera |
| Ebony | Ebony Ore | Ebony Ingot | 6 | Desert and Desert2; everywhere in the Kingdom of Sentinel (4.7) |
| Orcish | Orichalcum Ore | Orichalcum Ingot | 6 | only in Orsinium Area and the Wrothgarian Mountains |
| Daedric | Ebony Ingot + Daedra's Heart (DFU 53) + a Sigil Stone (570) | Daedric Ingot | 7 | smelted only - the Oblivion Gate's gift |

**Smelting**, at any forge (a home's, or a Weaponsmith's or Armorer's for the use fee, 9.3), with no act: **2** raw
metal (DFU's or an ore) make **1** ingot; Steel is 1 Iron Ingot and 1 Charcoal; Brass 1 Copper and 1 Tin; Daedric as
the table says. An ingot gives Smithing **10 x its tier** XP. An ingot's origin is its inputs' (section 7).

**What a vein holds**, by climate (DFU's metals by tier: Iron, Tin, Copper, Lead, Sulphur 1; Lodestone, Mercury 2;
Silver 3; Gold 4; Platinum 5):

| Climate | Vein metals |
|---|---|
| Woodlands | Iron, Copper, Tin, Lodestone; Moonstone in deep veins |
| MountainWoods | Iron, Copper, Silver, Lead |
| Mountain | Iron, Silver, Gold, Platinum; Mithril |
| HauntedWoodlands | Iron, Lead, Mercury; Moonstone in deep veins |
| Swamp | Iron, Mercury, Sulphur |
| Rainforest | Iron, Copper, Gold |
| Subtropical | Iron, Copper, Tin, Sulphur |
| Desert, Desert2 | Iron, Lead, Sulphur, Gold; Ebony |

**Brass** is smelted from 1 Copper and 1 Tin. DFU's other metals gain uses beside their potions: **Tin, Copper** (fittings, 1 a weapon), **Brass** (instruments,
lanterns as decor), **Lead, Sulphur** (Mortar), **Gold, Platinum** (Jewelcrafting), **Lodestone** (a compass decor
piece), **Mercury** (Alchemy's Transmuter).

### 4.2 Wood - DFU's own woods

Daggerfall's furniture is Oak, Cherry, Mahogany and Teak (FACT, templates 221-232); those are the woods, with Pine and
two rarities.

| Wood (log / plank, 4.8) | Tier | Climates |
|---|---|---|
| Pine | 1 | Mountain, MountainWoods |
| Oak | 2 | Woodlands, MountainWoods, Swamp |
| Cherry | 3 | Woodlands, Subtropical |
| Teak | 4 | Subtropical, Rainforest |
| Mahogany | 5 | Rainforest |
| Ironwood | 6 | Rainforest - 1 tree in 20 |
| Ghostwood | 6 | HauntedWoodlands - 1 tree in 20 |

A log saws to **2 planks** (Timberwright 3) at a workbench; a log burns to **1 Charcoal** (Charcoal Burner 2); every
tree gives **1 Resin** in 4. Charcoal and Resin are tier 1 (**1** Mark each). A Clean Cut (5.2) may drop **Heartwood** (2%): a tier-up plank of the same wood, worth
one quality step in any recipe.

### 4.3 Herbs - DFU's own plants

| Climate | Common | Uncommon | Rare |
|---|---|---|---|
| Woodlands | Green Leaves, Clover, Red Flowers, Yellow Flowers | Red Berries, Yellow Berries, Red Rose, Yellow Rose, Red Poppy | Golden Poppy, White Poppy |
| MountainWoods | Pine Branch, Clover, Green Berries | Root Tendrils | White Rose |
| Mountain | Pine Branch, Twigs | Root Bulb | White Poppy |
| HauntedWoodlands | Twigs, Root Tendrils | Black Rose, Black Poppy | Ginkgo Leaves |
| Swamp | Root Tendrils, Root Bulb, Green Leaves | Bamboo | Black Poppy |
| Rainforest | Bamboo, Green Berries | Ginkgo Leaves, Fig, Red Flowers | White Rose |
| Subtropical | Palm, Aloe, Yellow Flowers | Fig, Bamboo | Golden Poppy |
| Desert, Desert2 | Cactus, Twigs | Aloe, Palm | Golden Poppy |

For ranks and XP a common herb is **tier 1**, an uncommon **tier 2**, a rare **tier 3**.

**The seasons** (DFU's calendar): in **winter** the flowers, roses, poppies and berries do not grow (Pine Branch,
Twigs, the Roots, Bamboo, Ginkgo Leaves, Palm, Aloe, Fig and Cactus do); in **autumn** berries yield +50%; in
**spring** flowers yield +50%. Seasons of the Iliac Bay, where it is on, changes nothing here - it is a look.

### 4.4 Hides and creature parts - from the foes DFU spawns

| DFU foe | Hide (4.8) | Tier | A chance of the DFU ingredient |
|---|---|---|---|
| Rat | Rat Pelt | 1 | - |
| Giant Bat | Bat Leather | 2 | - |
| Grizzly Bear | Bear Hide | 2 | Big Tooth (56) |
| Sabretooth Tiger | Tiger Pelt | 3 | Big Tooth (56) |
| Spider | Spider Silk | 3 | Spider's Venom (41) |
| Giant Scorpion | Scorpion Chitin | 4 | Giant Scorpion Stinger (47) |
| Slaughterfish | Slaughterfish Scales | 4 | - |
| Harpy | Harpy Feathers | 5 | - |
| Dreugh | Dreugh Shell | 5 | - |
| Dragonling | Dragonling Scale | 6 | Dragon's Scales (46) |

Hides cure to **Cured Leather** (tiers 1-3) or **Hardened Leather** (tiers 4-6) at a tanning rack, **2:1** (Tanner
1:1). Butchery gives C&C's Raw Meat either way. DFU's own corpse loot is untouched: skinning adds, never replaces.

### 4.5 Cloth, stone and the Board's counters

- **Linen Bolt** and **Wool Bolt** are sold by the Notice Board's own supplier - the Weavers' counter on the Market
  tab - for **2** and **3 Marks** a bolt, straight into the Stores: a Marks sink, never a purse-gold purchase, because a
  Stores material bought with gold a client may not have had is exactly the leak law 3 closes. They are never
  gathered. **Silk Bolt** is woven from Spider Silk (3:1).
- **The Apothecaries' counter**, the supplier's second, sells into the Stores the sixteen DFU ingredients that DFU's
  potion recipes need and no gathering route yields (FACT, `POTION_RECIPES`, `src/systems/potions.js`), at **a fifth of
  DFU's price in Marks**, rounded up: Werewolf's Blood 5, Fairy Dragon's Scales 18, Unicorn Horn 40, Ectoplasm 12,
  Troll's Blood 4, Snake Venom 2, Mummy Wrappings 8, Saint's Hair 40, Small Tooth 1, Pure Water 5, Rain Water 2, Orc's
  Blood 4, Elixir Vitae 6, Nectar 3, Ichor 4, Ivory 3. Without it the brewing act (9.3) could make none of the twenty
  potions. A Marks sink; its goods are **bought**, never own. (A fifth, not the Bank's eighth: the counter is never a
  better way to turn Marks into gold than the Bank's exchange.)
- **Rough Stone** is quarried from rock fields (Mining); **Cut Stone** is cut from it **2:1** (Quarryman 1:1);
  **Mortar** is made ten at a time from 1 Sulphur, 1 Lead and 5 Rough Stone. Tiers and Marks values: Rough Stone
  tier 1 (**1**), Cut Stone tier 2 (**2**), Mortar tier 2 (**2**).

### 4.6 Gems

DFU's eight gems come from veins, 3% a strike on a clean glint (5.2), by climate: **Amber** (Woodlands), **Jade**
(Rainforest), **Turquoise** (Desert, Desert2), **Malachite** (Swamp), **Ruby, Sapphire, Emerald** (Mountain), and
**Diamond** only from deep dungeon veins. **Pearl** (DFU 77) comes from Fishing at sea.

### 4.7 Regions - signatures, marches, free lands

DECIDED - the kingdoms' map is SEAT0 4.3's, and the materials follow it:

| Where | Signature |
|---|---|
| Kingdom of Daggerfall | Moonstone veins in every climate there, at twice the usual rate |
| Kingdom of Wayrest | Mithril veins in every climate there |
| Kingdom of Sentinel | Ebony veins in every climate there |
| Orsinium Area, Wrothgarian Mountains (Free Lands) | Orichalcum - the only place it is found |
| Isle of Balfiera (Free Land) | Adamantium surface veins - the only open-world place outside gate-touched ground |
| The Marches (Betony, Anticlere, Lainlyn) | every node +25% yield - contested wealth |
| **Gate-touched ground** | for 2 real hours (a game day) after an Oblivion Gate falls - day or night - its pixel holds 6 Adamantium veins and Daedra's Heart can be skinned from any foe there |
| **The Spoils of War** (SEAT0 6.8) | Warforged Steel Ingot (tier 6: counts as Ebony with +1 quality step), Standard-bearer's Silk (tier 5 cloth), Siege-cracked Gem (a gem of the roller's choice, Lapidary only) |

So the crowns sit on the richest veins, the free lands hold what no crown can, and the marches are worth fighting for.

### 4.8 The new templates (600-699)

Icons are DFU's own, recoloured at runtime (law 6): each row names the DFU icon it borrows. **600-602 and 604 are
unused**: the Pick, the Woodcutter's Axe, the Sickle and the Fishing Rod this table first held are Foraging's own
Pick-Axe (1601), Wood-Axe (1600), Sickle (1602) and Fishing-Net (1603), and the Basket (1607) joined them (FORAGE0 14).
The Basket's foods are Foraging's and C&C's own templates, not new ones (FORAGE0 14.6).

| Id | Name | Stores / pack | Icon from |
|---|---|---|---|
| 603 | Skinning Knife | pack (tool; 0.5 kg, 50 HP, 100 gold, online shelves only - FORAGE0 14.2) | DFU Dagger |
| 610-615 | Moonstone Ore, Dwarven Scrap, Mithril Ore, Adamantium Ore, Ebony Ore, Orichalcum Ore | Stores | DFU Lodestone, tinted per ore |
| 620-630 | Iron, Steel, Silver, Moonstone, Dwarven, Mithril, Adamantium, Ebony, Orichalcum, Daedric, Warforged Steel Ingot | Stores | DFU Iron, tinted per metal |
| 635-641 | Pine, Oak, Cherry, Teak, Mahogany, Ironwood, Ghostwood Log | Stores | DFU Twigs, tinted |
| 645-651 | the same seven Planks | Stores | DFU Small Oak Table's board, tinted |
| 652, 653, 654 | Charcoal, Resin, Heartwood | Stores | DFU Lodestone / Aloe / Twigs, tinted |
| 655-664 | the ten hides of 4.4 | Stores | DFU Small Skins, tinted |
| 665, 666 | Cured Leather, Hardened Leather | Stores | DFU Large Skins, tinted |
| 668-671 | Linen, Wool, Silk Bolt, Standard-bearer's Silk | Stores | DFU Small Tapestry, tinted |
| 673-675 | Rough Stone, Cut Stone, Mortar | Stores | DFU Lodestone, greyed |
| 678 | Siege-cracked Gem | Stores | DFU Diamond, cracked overlay |
| 680 | Arcane Essence | Stores | DFU Ectoplasm, tinted |
| 685-688 | Hunter's Stew, Fisherman's Supper, Orchard Tart, Feast of the Hearth | pack (food) | C&C's Meat / Cooked Fish / Bread, tinted |
| 690 | Ram Kit | Stores (a siege work) | DFU Battle Axe, tinted |
| 692 | Repair Kit | pack | DFU Warhammer, tinted |
| 695 | Recipe Scroll (one template, the recipe in its variant) | pack | DFU parchment icon |

**Marks value** of a material (the writs' and the market's reference, 10.5, section 11): tier 1: **1**; 2: **2**; 3:
**4**; 4: **6**; 5: **9**; 6: **14**; 7: **40** Marks. A common herb **1**, uncommon **2**, rare **5**.

## 5. The hands do the work - the acts

DECIDED (Mac: "tree chopping, picking up ingredients, fishing, etc. Active player involvement").

### 5.1 The common shape

- **The tool is carried, and drawn for the act.** The tools are Foraging's (law 2), group-9 items DFU cannot wield,
  so nothing is equipped: the act **draws the tool in the hand for its length** and puts back what the hand held
  (FORAGE0 14.1). The weapon rig draws it with DFU's own weapon sprites for the classic arm (the War Axe's for the
  Wood-Axe, the Warhammer's for the Pick-Axe, the Dagger's for the Skinning Knife, the Tanto's for the Sickle), Weapon
  Widget's swing, bob and inertia (`05-Combat/Weapon-Widget.md`), the Morrowind arms on that lane. The Fishing-Net and
  the Basket have no weapon sprite: on the classic lane the act draws **the item's own picture** (the author's net,
  Daggerfall's basket), bottom-anchored where the held map's sprite stands, and the weapon, shield and torch hand are
  hidden by the same place in the draw ladder the held map takes (MAP-WEAPON, `10-UI/Held-Map-Arc.md`); on the
  Morrowind lane the arms hold it in the held-sheet pose (`src/combat/heldPose.js`). No new art: the pictures are the
  items' own. A tool used from the inventory is Foraging's own use, 1:1, in both lanes - one item, two gestures.
- **Foraging's checks come first** (FORAGE0 14.3), each with Foraging's own refusal: not inside (except a dungeon
  vein and Hunting), not in a settlement, **daylight 07:00-17:59** (not a dungeon vein, a Motherlode, a gate-touched
  vein or Hunting), not at sea (but Fishing), no foe near (DFU's rest test), not fully encumbered. **The service
  enforces daylight itself** (section 6) - for a surface node other than a Motherlode or a gate-touched vein, and for
  every Fishing haul; the tool, its wear, the foe and the load are the client's courtesy, which
  the service never sees.
- **Wear**: a completed act lowers the tool's condition by 1, as a Foraging use does; a tool lasts 50 harvests.
- **The attribute bands**: Foraging's attribute pair for the tool widens or narrows the act's skill window - x0.85,
  x1.00, x1.15, x1.30 for <=39, 40-59, 60-79, >=80 (FORAGE0 14.4). Attributes are the save's, so a band only moves a
  window; the honest bound below is untouched.
- **The node answers Interact** (E, KB1's registry - `10-UI/Controls.md`); the tool's action is **attack**; **Esc**
  cancels an act with nothing lost (the node stays).
- **Every act has a skill moment**, and a clean moment gives more. A missed one never fails the harvest - it gives
  less. The new player is never punished, only the good one rewarded.
- **The honest bound.** The act is played on the client, so it may be lied about. The act's report can move the
  service's roll by at most **one quality step and +50% yield**, never past the character's rank. The node's
  existence, the daily caps and the dice stay the service's.
- **Others see it.** The pose grows an activity field (tool and act: 4 bits), a relay version with its LAW row: a
  peer sees you swing, kneel, throw and haul. The node's state is each character's own (section 6), so a tree another
  felled still stands for you.
- **Gentle acts** (a setting, accessibility): every act completes at a plain result, with no clean bonus and no
  bruise. **Reduced motion** draws the rings and bands as static bars. Every cue is a shape and a sound as well as a
  colour.

### 5.2 Each profession's act

| Profession | The act | The skill moment | Clean gives |
|---|---|---|---|
| **Logging** | Swing at the trunk: tier 1-2 trees take **5** chops, 3-4 take **6**, 5-6 take **8** (Lumberjack -2, at least 3). The tree creaks at half, leans, and falls away from you (the flat tips over and fades in 1.5 s; the Morrowind model falls). Logs drop at its foot and are taken by walking over them. A stump stands for the rest of your day. | **The ring**: a circle shrinks onto the trunk's notch over **900 ms**; strike while it is inside the band - **±12%** of the notch's radius at Novice, **±20%** at Master - for a **Clean Cut** (worth 2 chops) | fewer swings; Heartwood 2% a Clean Cut |
| **Mining** | Strike the vein: tiers 1-2 take **4** strikes, 3-4 **5**, 5-6 **7**. It cracks in stages (crack decals) and sheds chunks. | **The glint**: one of five points on the vein face glints for **1.2 s** (**2 s** at Master) and moves after every strike; a strike within the glint's radius counts **double** | a gem chance 3% a clean strike; a **clean finish** (every strike on the glint) raises the ore one quality step |
| **Quarrying** (Mining, on a rock field's boulders) | As Mining; yields Rough Stone | As Mining | Cut Stone directly on a clean finish (Stonebreaker always) |
| **Herbalism** | Kneel at the plant (E). A common herb comes up in **0.8 s**. | **The steady hand**, for uncommon and rare herbs with the sickle: hold E for **2.5 s** while a meter fills; turning the view more than **3 degrees** or moving **bruises** the herb | an unbruised herb (+5% Alchemy Potent chance each, 9.3); a bruised one yields 1 less (at least 1) |
| **Hunting** | Kneel at a body your own blow felled (E) with the knife. | **The trace**: a dotted line of 5-9 points over the carcass; draw the knife along it (mouse; the right stick moves a cursor; a finger on the touch layer). Accuracy is the mean deviation against a tolerance that widens with rank | a **clean pelt** (score 0.8+) is one quality step up; a **torn** one (under 0.4) yields 1 less |
| **Herbalism, the Basket** | Kneel at a patch (E) with the Basket (FORAGE0 14.6); the patch gives its food once a day besides its herbs | **The search**: three finds glint in turn among the leaves, **1.0 s** each (**1.4 s** at Master); tap each while it glints | all three: +50%; two: +25% |
| **Fishing** | Stand in water, swim, or stand at sea on a boat or pier (the net's water, FORAGE0 6.4). Hold attack to wind the throw (**0.3-1.5 s**), release; the net flies **3-12 m** and spreads, a ring of floats on the water (WATER1's surface, the Sea update's). Wait **5-30 s** - the first and last daylight hours halve it, a storm doubles it. | **The tug**: the floats dip, a splash sounds, the pad and phone buzz (TI2's haptics): haul within **600 ms** (Angler +40%). **The haul**: the net's weight runs along a bar; hold to raise the tension band (**20%** of the bar at Novice, **30%** at Master), release to let it fall; keep the weight inside to fill the haul meter within **20 s**; **2 s** outside, counted in total, and the net comes in with the plain haul | the haul; a trophy (x3 weight, a decor piece) 1 haul in 200 |

**What the net brings up** (Fishing): the species is Deep Waters' for the water (FACT, `PASSIVE_FISH_SPECIES`:
Tropical, Temperate, Swamp, Desert, OpenOcean, Cold), the pixel's climate choosing the waters by Deep Waters' own
`climateToBiome` (`src/world/underwaterDecorations.js`, imported, not re-typed); the sea adds a **Pearl** (DFU 77) in 1
haul of 50 (Pearl Diver x3) and a **Slaughterfish** in 1 of 100 - the heaviest haul - which yields Slaughterfish
Scales. **The haul lands in the Stores as Raw Fish** - one material, tier 1, 1 Mark - the species named in the toast
("+2 Largemouth Bass, as Raw Fish"). Withdrawn to the pack, Raw Fish becomes the template Foraging's own code would
make: C&C's Raw Fish (535) while C&C is on (FACT, C&C's food table keys its cooking on it, `src/systems/survival/food.js`),
else Foraging's Fish (1605). A **trophy** is the species' own Deep Waters template, straight into the pack as decor.

### 5.3 The world answers

- A felled tree, a spent vein, a picked patch and a skinned body are gone **for you for the rest of the UTC day** - a
  patch once both its harvests are taken (its herbs, and the Basket's food).
- The sounds are DFU's own from the player's data (the wood and stone hits, the splash), and Immersive Footsteps' and
  Better Ambience's where they are on.
- Weather and the hour matter: the net fills fastest in the first and last daylight hours (Foraging's day, 07:00-17:59 -
  the wilderness closes at night; the dungeon veins, Hunting and the stations do not); rain wets the herbs (the steady window -20%); a storm
  drives the fish deep (longer waits, bigger fish).

## 6. Nodes

- **The law** - nodeLaw.js: for a map pixel and a UTC day, `hash(NODE_SALT, pixelX, pixelY, day)` gives the day's
  node set from the pixel's climate. A node id is `(pixelX, pixelY, day, slot)`. The **client places** each node on
  the ground from its own terrain (the nearest suitable anchor: a rock-field prefab or terrain rock for a vein, a tree
  flat for a tree, a plant flat or an open patch for an herb). The **service** knows the id is real from the law; it
  knows the pixel's **climate and region** only from **the witnessed world** (SEAT0 3.2): the harvest request carries
  the pixel's climate and region as the client derived them, and the service keeps them as a witnessed row. A pixel
  **confirmed** by 3 accounts yields its whole table; an **unconfirmed** pixel yields tiers 1-2 only (so a lie about a
  pixel nobody else has walked buys little); a **disputed** pixel (two witnesses agreeing on another answer) keeps its confirmed table until a moderator settles it (SEAT0 3.2).
- **How many** - per wilderness map pixel per day, never inside a location's rect:

| Climate | Trees | Herb patches | Veins | Boulders (quarry) |
|---|---|---|---|---|
| Woodlands | 6 | 4 | 2 | 1 |
| MountainWoods | 5 | 3 | 3 | 2 |
| Mountain | 2 | 2 | 6 | 3 |
| HauntedWoodlands | 4 | 4 | 2 | 1 |
| Swamp | 3 | 5 | 1 | 0 |
| Rainforest | 6 | 5 | 1 | 0 |
| Subtropical | 4 | 4 | 2 | 1 |
| Desert, Desert2 | 0 | 3 | 5 | 3 |
| Ocean | - | - | - | - (fishing only) |

- **A node's tier** rolls on the climate's table, higher tiers rarer (tier 1: 40%, 2: 25%, 3: 15%, 4: 10%, 5: 6%,
  6: 4%); a region's signature (4.7) replaces one vein a pixel with its signature ore.
- **Dungeon veins**: each dungeon holds `hash(NODE_SALT, mapId, day)` **1-4** veins a day, placed by the client on its
  own RDB walls; tier 3-6; Dwarven Scrap and Adamantium are found only here (and 4.7's places); Diamonds only here.
- **Fishing spots**: any water the net works in (FORAGE0 6.4). A **school** (a ripple on the surface, 2 a coastal pixel
  a day) gives a haul +1 fish (Netter +2). A haul names no node, so Fishing, like Hunting, is **bounded, not
  witnessed** (below).
- **Per character, never contested**: each character sees every node and takes each once a day. No stealing, no
  camping.
- **Motherlodes** - the contested ones: **3 a day** server-wide, at a pixel from `hash(MOTHERLODE_SALT, day, k)`,
  announced by the hub **10 minutes** before (Motherlode Sense: 30): a tier-6 vein that yields to the **first 20
  characters** to strike it, each finding **10 Marks** besides the ore. A strike counts only from a socket the relay
  holds in the Motherlode pixel's cell room (a client's position is its own claim, so this is a bound, not a proof),
  and an account takes at most **one Motherlode a day**. A Motherlode, like a dungeon vein, keeps no hours: it may
  be struck by night.
- **Hunting cannot be witnessed** - FACT, a foe's life and death are its spawner's client's alone ("A FOE IS ITS
  SPAWNER'S: the spawner steps it and streams it, everyone else in the cell puppets it", WORLD6b, `src/net/wire.js`;
  AUDIT 28 replaced a quotation that is nowhere in the tree). So Hunting is the one bounded profession: at most **30 hides a day** an account, of which
  at most **3** of tiers 5-6; the tier is the foe's the client claims, and the cap is the whole defence. **Fishing**
  is the other: **40 hauls a day an account** (not a character), the water the client's own claim, the pixel's
  climate and region from the witnessed world; an unconfirmed pixel's hauls bring no Pearl and no Slaughterfish.
- **Gate-touched ground** (4.7) is the day's gate pixel from the witnessed world (SEAT0 3.2), so its veins exist only
  once three fighters' receipts agree where the gate stood.
- **The harvest**: after the act (section 5), the client asks `{node, kind, character, act, at}` - `kind` is herbs or
  food at a patch (the Basket's second harvest), the node's one kind elsewhere; `at` is the act's end on the shared
  clock. The service checks the id against the law for today; the cap (**60** harvests a gathering profession a day a
  character, the Basket's among Herbalism's; Fishing **40** hauls an account); that this character has not taken this
  `(node, kind)`; and **the hour** - `at` no more than 10 minutes past (the queue's bound, section 19) and, for a
  surface node, inside 07:00-17:59 on `sharedClassicMinutes` (`src/net/wire.js`), a pure function the service
  computes itself. It rolls the yield (CSPRNG), applies the act's bounded step, and adds to the Stores as **own**.
  Travel time is the natural limit; the cap is the honest one.
- **Yields** (before the act): a tree **2-4** logs; a vein **2-3** ore (+ the gem chance); an herb **1-3**; the Basket's food **1**, **1-2** or
  **1-3** by the patch's block (FORAGE0 14.6); a hide **1** (+ the ingredient chance); a haul **1-2** fish; a boulder
  **3-5** Rough Stone. **The order**: the base roll, then the act's step (at most x1.5), then a march's +25% (4.7), then
  a Tide's (SEAT0 9.3), then a school's +1; a fraction of a unit left at the end is that chance of one more, on the
  service's dice.

## 7. The Stores

- A per-character inventory on the service, at most **5,000** of any one material. The player reads "the Stores";
  the code says **`profStores`** (tables `prof_stores`, `guild_prof_stores`) - FACT, `src/systems/features.js`
  already exports a `STORES` (the three preference stores), and one word must not name two things.
- **The Stores tab** (section 8) is the only place a Stores material is seen. Moving to the pack is allowed (one-way, law 3);
  a pack item never moves into the Stores.
- **Origin.** Every unit is **own** or **bought**. Own: this character's harvest (section 6), a craft whose every input
  was own (section 9), Disenchanting's Essence from an own provenance item (one this character made, never sold), a
  Siege Honour's Spoils. Bought: a market purchase, a filled buy order, a counter's goods (4.5), a craft with any
  bought input, Essence from any other provenance item. A craft spends bought units first, so a character's own stay
  for writs. A unit keeps its origin through a writ's refund, and through the guild Stores only for its depositor: a
  member's own deposit is own again when that member withdraws it, and bought to any other member who withdraws it -
  so an Officer cannot turn a guildmate's harvest into their own influence. A sale makes it bought for the buyer. Only own units raise influence at their
  value (section 11; SEAT0 4.2), so Marks cannot buy influence past Tribute's rate and cap.
- **Food keeps** in the Stores (a warehouse, not a pack); C&C's spoiling starts when it is withdrawn.
- **Guild Stores**: a guild warehouse at its hall and any seat it holds: any member deposits from their Stores;
  Officers and the Guildmaster withdraw; every movement on a ledger (the guild ledger's trigger pattern).
- **Seat stockpiles** (SEAT0 7.5): the holder's (fortifications), filled by the seat's writs (section 11) and the
  Levy - the Levy fills only the holder's - and each pledged challenger's **Siege Camp** (siege works), filled only by
  its guild's writs and **spent at the Turning**: a Ram Kit to the siege it won, the rest burnt.

## 8. The interface

DECIDED (Mac: "actual UI integration for life skills"). Everything is drawn in the Enhanced Plus UI - the one UI
since MENU-TOGGLE and PLUS-DEAD (`PATCH-NOTES-One-UI-Choice.md`) - in its brass and bone, scaled by the UI scale,
laid out for the phone's touch layer as for the desktop.

- **The prompt**: bottom centre above the hotbar - "[E] Chop Oak - Logging 34". **The hover** (World Tooltips):
  "Oak - tier 2 - 6 chops - taken today: no"; at a patch, "Red Rose - herbs: taken - food: no".
- **The act's meter**: centred on the crosshair, 160 px across at 1080p (30% larger on touch); the ring, the glint,
  the hold meter, the search, the trace and the haul bar each have a still form for Reduced motion.
- **The haul**: toasts on the right, 4 at most, 3 seconds each - "+3 Oak Logs to your Stores", "+45 Logging XP
  (Clean Cut x2)", "Logging 34 -> 35"; a rank-up banner at 25, 50, 75 and 100, and at 50 and 100 the specialisation
  choice opens.
- **The day's cap**: a chip under the compass - "Logging 34 / 60 today".
- **The Professions tab** (character sheet): a left column in two groups (Gathering, Crafting) - each row the icon,
  name, rank, rank's name and a thin bar; the right pane for the chosen one - XP to the next rank, the specialisation
  cards (choose one), the unlocks by rank (tiers, recipes), today's harvests, and "Crafts above Journeyman: 1 of 2".
- **The Stores tab**: a grid of materials with counts, each count split own / bought on its card; filters (Ores and
  Metals, Wood, Herbs, Food, Hides and Cloth, Stone, Gems, Essences, Spoils of War), a search box, sort by tier, name or count; a material's actions - **Withdraw to
  pack** (a quantity), and at a Notice Board **List** and **Deliver to a writ**.
- **A station**: left, the recipe list (filters: Can make now, All known, by tier); centre, the recipe - its inputs
  (have / need, from the Stores), the product as an item card, a bar of its quality odds (9.2); buttons **Craft**
  (plays the act, 9.4), **Quick craft**, **Craft x N** (quick, up to 10); right, the act's panel while it plays.
- **The held map** marks the patches and veins a character has worked before, and a Prospector's veins.
- **Keys** from KB1's registry, under a Professions group in Controls: Interact (E), attack, Esc, and an **act
  choice** key, chosen from the free keys at PROF1 (KB1's rule: one key, one action; Mac's four calls stand): at a
  patch it switches E between the herbs and the Basket's food, and the prompt says which ("[E] Pick Red Rose" /
  "[E] Search with the Basket"). E starts the herbs first while they are untaken.
- **The pad**: A / Cross interacts, RT acts, the right stick traces and aims. **Touch**: tap the node; the act's
  buttons on screen.

## 9. Crafting

### 9.1 The act of crafting

- The player opens a station, chooses a recipe they know, and plays its act (9.4) or skips it.
- **The service crafts**: it checks the recipe, the rank and the Stores; takes the inputs; rolls the quality (9.2);
  and answers with a **signed product record**: the DFU template, the material, the quality, the maker's name, and a
  **provenance id** (16 hex digits from the service's CSPRNG, unique across the server). The client adds the item to
  the save as a shop purchase adds one.
- **Recipes known**: most unlock with rank (their tier's rank); some are **found** (a Recipe Scroll, 1 in 500 from
  loot, 1 in 20 from a Motherlode); a few come **only from writs** (a guild's or seat's posted recipe reward).

### 9.2 Quality

| Quality | Effect (within DFU's bounds for the template and material) |
|---|---|
| Crude | condition max -25% |
| Standard | DFU's own item |
| Fine | condition max +15%, weight -5% |
| Superior | condition max +30%, weight -10%; one Loot Rarity **Magic** roll |
| Masterwork | Superior, and one Loot Rarity **Rare** roll, and the maker's mark in its name ("Silverthorn's Mithril Longsword") |

The roll, by the **margin** (the crafter's rank minus the recipe's rank):

| Margin | Crude | Standard | Fine | Superior | Masterwork |
|---|---|---|---|---|---|
| 0-9 | 20 | 60 | 20 | - | - |
| 10-24 | - | 50 | 40 | 10 | - |
| 25-44 | - | 20 | 50 | 28 | 2 |
| 45+ | - | - | 40 | 52 | 8 |

Then **+1 step** each, at most: a seat's Forge / Workshop / Apothecary (SEAT0 7.5); a clean act (9.4); a
specialisation that says so; Heartwood or a Warforged ingot among the inputs. Masterwright adds 5 points to
Masterwork. Nothing passes Masterwork.

### 9.3 The recipes

**Smithing** (a forge: a home station, or any Weaponsmith or Armorer for a 50-gold use fee to the shop):

| Product | Ingots | Also |
|---|---|---|
| Dagger, Tanto | 1 | 1 Tin |
| Shortsword, Wakizashi | 2 | 1 Tin |
| Broadsword, Saber, Longsword, Katana, Mace, Flail | 3 | 1 Copper, 1 Cured Leather |
| Warhammer, Battle Axe, War Axe | 4 | 1 Copper, 1 Oak Plank |
| Claymore, Dai-katana | 5 | 1 Copper, 1 Cured Leather |
| Cuirass | 6 | 2 Cured Leather |
| Greaves | 4 | 1 Cured Leather |
| Helm, Buckler | 2 / 3 | 1 Cured Leather |
| Left / Right Pauldron, Gauntlets, Boots | 2 | 1 Cured Leather |
| Round / Kite / Tower Shield | 3 / 4 / 5 | 1 Oak Plank |
| Chain pieces | as the plate piece, x 0.75 (rounded up), Steel only | - |
| Repair Kit (repairs 25% of an item's condition, once) | 1 of the item's metal | 1 Cured Leather |

The ingot is the material: Iron Ingots make Iron, and so on to Daedric. The recipe's rank is its material's tier
(4.1).

**The tools** (FORAGE0 14.7) - Foraging's own templates, their quality on their life (Crude 37 uses, Standard 50,
Fine 57, Superior 65, Masterwork 65 and the maker's mark; no Loot Rarity roll): Smithing makes the Wood-Axe and the
Pick-Axe (2 Iron Ingot, 1 Pine Plank), the Sickle and the Skinning Knife (1 Iron Ingot, 1 Pine Plank) at rank 0, and
the Spade (2 Iron Ingot, 1 Oak Plank) at rank 10; Outfitting the Fishing-Net (2 Linen Bolt); Carpentry the Basket (2
Pine Plank). A tool wears out every 50 harvests, so the crafts are never out of work.

**Outfitting** (a tanning rack or loom: a home station, or any Clothing store for 50 gold): leather armour - Cuirass
6, Greaves 4, Helm 2, Pauldrons 2 each, Gauntlets 2, Boots 2 Cured Leather (Hardened Leather for the tier 4-6
leathers' step); clothing - small garments (Straps, Armbands, Sash, Shoes, Sandals, Brassiere, Tights) 1 bolt, middle
(shirts, tunics, pants, breeches, skirts, vests, the Eodoric) 2, large (robes, gowns, cloaks, dresses, the Khajiit
Suit, the surcoats, the Kimono) 3, boots +1 Cured Leather; the cloth's tier sets the garment's step (Linen 1, Wool 2,
Silk 4, Standard-bearer's Silk 5). Rugs 3 Wool, tapestries 4 Wool + a dye, Large / Small Skins 2 / 1 of a hide (DFU's
furniture 237-245). Dyes: `itemDye.js`'s colours; Couturier two at once.

**Carpentry** (a workbench): Staff 3 planks; Short Bow 3 planks + 1 Resin; Long Bow 4 planks + 1 Resin; Arrows x 20:
1 plank + 1 Iron Ingot + 1 Harpy Feathers (or 4 Twigs, one step lower); DFU's furniture in its own wood - beds 8
planks + 2 Linen, large tables 6, small tables 3, chairs 2 (an Oak Table in Oak, a Teak Chair in Teak); the **Ram
Kit** (rank 60): 40 Oak Planks, 20 Iron Ingots, 4 Bear Hides; the bow's or staff's material step is its wood's tier.

**Masonry** (a mason's bench): Cut Stone and Mortar (4.5); stone decor (Sculptor): a column, a bench, a font, a
statue plinth (DECOR pieces); the fortification components are delivered as Cut Stone and the other materials SEAT0
7.5 lists, straight from the Stores.

**Jewelcrafting** (a jeweller's bench, or any Pawn Shop or Gem store for 50 gold): Ring - 1 Silver, Gold or Platinum
(+ a gem); Mark - 1 metal + 1 gem; Bracelet - 2 metal; Bracer - 2 metal + 1 Cured Leather; Amulet - 2 metal + 1 gem;
Torc - 3 metal; Cloth Amulet - 1 Linen + 1 gem; Wand - 2 Ironwood or Ghostwood Planks + 1 gem. The piece's
enchantment points: Silver +0%, Gold +10%, Platinum +20%, a set gem +10% (Gemcutter +10% more).

**Cooking** (any campfire, hearth or brazier; C&C's Skillet widens the fire's window). Every input comes from the
Stores - Hunting's Raw Meat and Fishing's Raw Fish land there, Herbalism's plants, and the Basket's foods (Apple,
Orange, Mushroom, Egg - Foraging's own, `06-Systems/Foraging.md`) - and every dish goes to the pack:
**Hunter's Stew** - 2 Raw Meat, 1 Mushroom, 1 Root Bulb: C&C's hunger filled, Endurance +5 for 2 game hours;
**Fisherman's Supper** - 2 Raw Fish, 1 Egg, 1 Green Leaves: Agility +5 for 2 hours; **Orchard Tart** - 2 Apple, 1 Egg,
1 Yellow Berries: stamina regained +20% for 4 hours; **Feast of the Hearth** (rank 70) - 4 Raw Meat, 4 Raw Fish, 2
Apple, 2 Orange, 2 Mushroom, 2 Egg: the whole party (the party's buff frame, PARTY-BUFFS) Strength, Endurance and
Willpower +5 for a game day. C&C's own cooking at a fire (its Raw Fish and Raw Meat from the pack) is C&C's, untouched,
and earns no Cooking XP - the service did not see it.

**Alchemy** - two doors, one book. DFU's own potion maker (pack ingredients) stays 1:1 and earns nothing online,
because the service never sees it. The profession's door is the **brewing act** at an alchemy station: the
ingredients come from the Stores (the gathered ones, and the Apothecaries' counter's sixteen, 4.5), and the service runs DFU's own recipe law on them - `POTION_RECIPES`, imported,
the order-independent ingredient hash DFU keys it by - so the same twenty recipes, and no new ones, make the same
potions, into the pack. There the brew makes **2** potions at Journeyman and **3** at Master (Brewer 3 at Journeyman);
**Potent** (+25% magnitude, named so) at 10% at Expert and 20% at Master, +5% an unbruised herb; and Alchemy XP.

**Enchanting** (DFU's item maker, unchanged): cost **-10%** at Journeyman, **-20%** at Master (Efficient -5% more) -
a discount on the player's own item, which cheats no one. Enchanting **XP** comes only from what the service sees:
enchanting a **provenance** item at a station (the enchantment is written onto its product record) and
**Disenchanting** (new, at any enchanting station): a **provenance** item the player owns becomes **Arcane Essence**,
one per 100 enchantment points it carried (Disenchanter x2), into the Stores, and is gone. Loot cannot be
disenchanted - Essence from a save item would be a pack item entering the Stores. A Masterwork's Rare roll consumes
5 Essence (Runecaster: choose of three).

### 9.4 Hands at the station

The crafts' acts, under the same honest bound (5.1). Any act may be skipped (**Quick craft**): the roll takes no act
step, and nothing else is lost.

| Craft | The act |
|---|---|
| Smithing | **The heat**: the ingot's glow rises and falls; strike three times while it is in the band |
| Carpentry | **The plane**: a steady drag along the grain, deviation scored as the trace is |
| Outfitting | **The stitch**: presses on a beat, eight in a row |
| Masonry | **The chisel**: strikes on marked lines that the glint's rule moves |
| Jewelcrafting | **The facet**: a slow turn stopped where the gem catches the light (a 10-degree window) |
| Cooking | **The fire**: take the pan off in its window (the Skillet's is wider) |
| Alchemy, Enchanting | none - DFU's windows stay 1:1 (law 1) |

## 10. The Notice Board and the market

DECIDED (Mac): "The new notice board should be a physical object that houses quests, the player auction house,
etc".

### 10.1 The Notice Board - a thing that stands in the town

- **It is Daggerfall's own board.** FACT: Daggerfall's towns carry a bulletin board, a 3D model the town blocks place
  (`BULLETIN_BOARD_MODEL_ID`, `src/world/rmbLayout.js`), activated as DFU activates it (`src/systems/bulletinBoard.js`:
  the reach gate, the location's name, the rumour mill's line). **Offline a rumour board stays exactly that.**
- **BOUNTY1 took half of every town's boards** (FACT - shipped 2026-09-28 at Mac's word, `06-Systems/Bounty-Boards.md`):
  in a town with two boards or more, every other one by position is a **Bounty Board** in BOTH lanes, posting the
  town's four hunts. DECIDED: the Notice Board is the OTHER boards' - a bounty board stays the town's hunts, online as
  off, and the Notices tab pins one line under the rumour: "The town's bounties are posted on its Bounty Board." A
  board stood for a seat or hub (below) is a Notice Board. The Work tab's black Bounty seal is a WRIT (section 11),
  never a board's hunt; the two share a colour because both are a price on a beast's head.
- **Online, a rumour board opens the Notice Board** - every board of a town that is not a bounty board, a lone board
  included. DFU's reach gate still applies (256 classic units).
- **Every seat and hub has one.** A seat or hub whose blocks place no board gets one: the same DFU model, drawn from
  the player's own ARENA2 at runtime, stood at an anchor derived from the town's layout - the market square (the open
  block nearest the town's centre), else beside the palace door. SEAT-COUNT counts them.
- **Its face**: a small count floats over it for the looker - "3 new" - drawn by the name layer (`src/ui/nameLayer.js`).
- **The window**: a corkboard of pinned parchment in the Enhanced Plus UI, six tabs along its top; each note a card
  with a pin, a wax seal whose colour says who posted it, opened large on a click.

| Tab | What it holds |
|---|---|
| **Notices** | DFU's rumour, pinned first; the server's word with a red seal (sieges, Turnings, Edicts, Festivals, revolts, Motherlodes, gates rising, Tides); players' notes (10.6) |
| **Work** | Writs (section 11) with seals by poster - Court purple, Seat in the holder's colours, Guild in its colours, Commission green, Bounty black - each with its need, pay, time left, **Take** and **Deliver** |
| **Market** | The auction house (10.2): Materials, Crafted, My listings, Buy orders, History |
| **Seat** | At a seat's boards: SEAT0 7.9 |
| **Guilds** | Recruitment posters (each guild's heraldry and a line); a guild's own notes, members only |
| **Makers** | The Hall of Makers: this Season's most Masterworks and most writs filled, per profession |

- **Capacity**: 30 player notes a board (newest shown), the last 20 server notices, every live writ of the region.

### 10.2 The market - the auction house

- **What sells**: Stores materials (escrowed by the service - safe by construction) and crafted goods with a
  provenance id (the listing takes the item out of the save; the service holds the record; only the id's **owner**
  may list it, and an id has one live listing at a time - so a duplicated copy can never be sold beside its original,
  section 18). **Loot does not list**: it has no provenance. TRADE1 stays how loot changes hands.
- **Priced in Marks.**
- **Regional markets** - DECIDED: a listing stands on the boards of the region it was listed in. A buyer in that
  region takes it at once; a buyer anywhere else pays the **courier fee** and the goods reach their Stores after the
  **courier's time**. So a signature material (4.7) is cheap at home and dear abroad, and hauling is a trade.
- **Buyout first, bids later** - DECIDED: PROF5 ships buyouts (a listed price, taken whole or, for materials, in part);
  **PROF5b** adds timed auctions for **Masterworks only** - 24 hours, a 5% minimum raise, and a bid in the last 2
  minutes adds 2.
- **Listings**: last **72 hours**; at most **30** an account; price **1 to 1,000,000 Marks**; a cancelled listing
  returns its goods (the fee kept). **History**: every material's 7-day median, drawn as a small line on its card.

### 10.3 Buy orders

A standing order ("buy 200 Mithril Ore at 8 each") on a board: the Marks are escrowed when it is posted; any gatherer
in that region fills it straight from their Stores, in whole or in part; at most **20** an account; unfilled after 7
days, the rest is returned.

### 10.4 Fees, the Tithe and couriers

| Fee | Amount | Paid by | Where it goes |
|---|---|---|---|
| Listing | 1% of the price, at least 1 Mark | the seller, on listing | burnt |
| Sales tax | 5% of the price | the seller, from the proceeds | burnt |
| The Tithe (every board of a held seat's bailiwick, SEAT0 7.2) | the holder's rate, 0-10% (palace) or 0-15% (crown), of the price | the seller, from the proceeds | the holder's Marks treasury |
| Courier | ceil(units / 20) x (1 + map pixels between the two regions' seat or hub towns / 25) Marks, at least 2 - by the load, so moving 5,000 units across the Bay costs thousands, and regional prices hold | the buyer, on top | burnt; the receiving seat's Tithe share of it to its holder |
| Courier's time | 15 minutes + 1 minute per 10 map pixels (Bandit Summer doubles it, SEAT0 9.3) | - | - |

**The buyer always pays the listed price** (plus a courier, when the goods travel). The seller receives the price
less the sales tax and the board's Tithe. Every board in a seated region is in some seat's bailiwick (SEAT0 7.2), so
there is no untaxed board to walk to; where two seats share a region, sellers choose the lower Tithe, and a greedy
holder empties its own bailiwick.

### 10.5 Marks - the server's currency

DECIDED (Mac: "New currency"). FACT, why: online gold is the save's ("The GOLD is the client's, the economy being the
save's" - GUILD1), so anything paid in purse gold can be paid by a client that never had it.

- **The name**: **Marks** - an Imperial promissory note, struck by the Bank of the Empire's counting houses (the name
  EMPIRE-BANK gave the online bank). A Mark is worth about **10 gold** of play.
- **Held by the service**: one balance **per account** (all its characters share it), at most 10,000,000; a
  **Marks treasury** per guild beside its gold one (deposits from any member's balance; withdrawals by the
  Guildmaster alone - GUILD1's law); one ledger for every movement.
- **Where Marks come from** (the faucets) - only acts a server witnessed:

| Faucet | Amount | Cap |
|---|---|---|
| Court writs (section 11) | their pay | 3 an account a day |
| Oblivion Gate receipts | 50 a receipt (100 under a Daedric Incursion, SEAT0 9.3) | **2 a UTC day** an account - FACT, a gate rises every game day, twelve a real day, and `gate_kills` keys on the game day, so the gate's own law allows twelve |
| Siege Honours (SEAT0 6.8) | 50 / 25 | one a siege |
| Motherlodes | 10 a find | 1 an account a day (3 Motherlodes a day server-wide) |

- **Where Marks go** (the sinks): listing fees, sales taxes, the burnt part of couriers, seat claim fees and
  upkeep, Tribute (SEAT0 4.2: burnt), Festivals, heraldry, fortification projects, respecialisation, the Board's
  counters (4.5), the Bank's exchange.
- **What only moves them**: the market, buy orders, player-posted writs, the Tithe (and Conscription and a vassal's
  share of it), guild deposits and withdrawals, sellsword contracts, a Bounty's payouts and the Royal Tourney's prize
  (SEAT0 7.6, from the holder's treasury).
- **The one mint outside the faucets**: a developer's strike of a held seat refunds its burnt claim fee (SEAT0 16) -
  in the ledger, by the dev glyph alone.
- **Marks and gold**: Marks **sell for gold** at any Bank of the Empire counter, **1 Mark for 8 gold** (a spread that
  is itself a sink), at most **300 Marks a day**; **gold never buys Marks** - that door would mint a Mark from gold a
  client may not have had.
- **The weekly report** (for Mac, from the ledger): Marks minted by faucet, burnt by sink, in circulation; the median
  price of the twenty most-traded materials; the accounts at the faucets' caps.
- **As built (MARKS1, 2026-09-28)** - `06-Systems/Online-Arc.md` MARKS1 holds the whole record: the law both ends read
  (`src/net/marksLaw.js`); the balances, a guild's Marks treasury and ONE LEDGER whose own triggers move them
  (`server-account/migrations/0018_marks.sql`), every movement decided in one statement (`server-account/src/marks.js`);
  the gate's counted receipt as the first faucet; the Bank's sale paid into the account at that bank (a sale whose
  answer was lost is kept and settled - `src/net/marksBook.js`); the report a developer's (`/v1/marks/report`; the
  materials' median prices join it with the market, PROF5). Behind MARKS_OPEN, shipped at `dev`.

### 10.6 Player notes

A registered player may pin a note on a board under MAIL1's letter law (its bounds, its filter; the reports are the
board's own - MAIL1 has none, 10.7): at most
3 live notes an account, each for up to a week. A note may carry one button: a **party invitation**, a **guild's
recruitment**, a **duel challenge**, or a **commission** (section 11).

### 10.7 NOTICE1 - the board as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Go"**. What the design above left open, DECIDED here (the record's, at Mac's instruction), and what was found:

- **Which boards.** Online, every board of a town that is not a bounty board opens the Notice Board - once the account
  service has said the board is open to this account (`BOARD_OPEN`). Until it has, and offline, the board is DFU's
  rumour box byte for byte (ROAD A9's pins hold). The town underfoot is read on arrival, so the first press knows.
- **A board is its town's.** A note is pinned to the TOWN - its MAPS.BSA map id, unsigned (regionHubs.js's key) - so
  every rumour board in a town shows the same notes, and a board stood later for a hub is the same board.
- **The Notices tab, in its order**: the rumour (DFU's sign; its name row is the window's heading), the bounty board's
  line, the server's word under the red seal (the Oblivion Gate while it stands - the map's own mark, WB1 - and the
  developers' notices), then the players' notes, newest first.
- **One tab.** The Work tab arrives with PROF1's Court writs, the others with their slices: a tab that can hold
  nothing is a door painted on a wall. (The NOTICE1 row below said "the Notices and Work tabs"; the Work tab moved to
  PROF1, which brings the first writ.)
- **A note** is MAIL1's letter law, whole (`src/net/boardLaw.js` imports `letterWords`: a subject to 60, a body to 800
  and 40 lines, cleaned, refused past its bounds, never cut); 1, 3 or 7 days; at most 3 live an account on every
  board together, bounded inside the one INSERT; 10 pins an hour; registered accounts alone (a guest reads).
- **Its one button** answers the author through the doors that stand. FACT: SOC1 has no request to join a party
  (`party.invite` is the inviter's act), GUILD1 joins by invitation alone, and DUEL1 challenges within 10 m outdoors.
  So a party's or a guild's button is a LETTER to the author, addressed and begun (MAIL1, the social panel's draft -
  through JOURNAL1's pending door, opened the first frame the panel may stand: AUDIT 28 N1 found the letter opened
  directly under the closing board, which the slot still held, so it never opened); its subject "Re: " and the note's,
  or the note's own where "Re: " would not fit - never cut (N15); a duel's is DUEL1's own challenge when the author
  stands within reach, else the letter. A recruitment note names its guild and its author's character, and only a
  rank that may invite (Guildmaster, Officer) pins one; it recruits - its button and its seal - only while that
  character is still in that guild at such a rank (N4), and a guild that is gone leaves its notes standing without the
  button. Commissions come with PROF6.
- **The author is the handle** (the letter's `from` rule): no account id leaves the service on a note.
- **Reports** - new here (MAIL1 has none): a registered reader reports a note once and stops seeing
  it at once; the third reporter that COUNTS - an account neither muted nor a sprout (younger than fourteen days,
  titles.js SPROUT_S) - hides it from everyone but its author until a moderator removes it or restores it (a restored
  note is not hidden again). Its author still sees it, marked, and may take it down (AUDIT 28 N2, N3: three accounts
  made that minute hid any note, and the author lost the note and its place for a week). Moderators (`MODERATOR_HANDLES` and `DEVELOPER_HANDLES`) see a hidden note with its count and its
  id, and remove it from the window or with `/note remove <id>` anywhere. A mute stops a pin and takes the author's
  notes off every board while it stands.
- **The server's word**: a developer posts a notice to every board for 1 to 14 days. The gate's card is composed on
  the client from the law every client reads, so it needs no row.
- **The count over a board**: "3 new", in the name layer's face and law (`src/net/remotePlayers.js` nameFrame's
  `extra`), over a Notice Board within 40 metres, in front and in sight, whose town has notes or server notices this
  device has not read (both - a developer's new notice lights every board it hangs on; AUDIT 28 said so); reading the
  board sets it to nought (`src/net/noticeBook.js`, the newest 200 towns remembered).
- **Failures** (section 19): a minute's cache - of every answer, a refusal too, so a town stood in at `dev` is one read
  a minute, not one a second; a slow service shows the last good board, marked; a pin and a developer's notice carry
  their request id, kept with their words until the service answers - a lost answer asked again with it, across
  presses, is never two - and a take-down or a removal asked again after a lost answer that finds the note gone was
  the first try's; the tries wait between them, and every request gives up after fifteen seconds; a second press while
  one is in flight is the same press, and the window does one act at a time (AUDIT 28 N5-N9 - "every write carries its
  request id" was false: the notice and the take-down had none).
- **The switch**: `BOARD_OPEN` in `server-account/wrangler.toml` - shipped at `dev`; one line opens it. The service is
  `acct18`.
- **Boards stood for a hub - NOTICE1b.** 10.1 gives a hub whose blocks place no board one of its own, at the open block
  nearest the centre or beside the palace door. This lane holds no ARENA2, and a board stood blind through a building
  is worse than none. MEASURED next: `tools/boardCount.mjs` - Mac runs it over his own ARENA2 - lists every hub's
  boards, bounty and rumour; NOTICE1b builds only if it names a hub with none. A seat's boards come with SEAT1.
- **The four hosts** (17.1): the streaming world (`scenes/world.js`) wires the boards, the press, the count and the
  window in the overlay slot; the fixed city (`scenes/exterior.js`) keeps DFU's board (FLAGGED by name: it hands the
  shared mode machine no `openNoticeBoard`); the building interiors and the dungeons have no boards.

`test/notice1.test.js` (17) - the law, the schema, the switch, read and pin, take down and report, moderation and the
mute, the recruitment note, the server's word, expiry and the hour, the book (the cache, the stale board, what was
read, one request id through every retry), the refusals, the cards' order, the wiring and the one door, the count in
the names' pass, the measure. `tools/mutants/notice1.json`, 26 mutations, 26 dead. AUDIT 28 (`06-Systems/Online-Arc.md`
AUDIT 28): `test/audit28_notice.test.js` (14) - N1-N16 fixed, among them THE MODAL CONTRACT's pin this section owed (the
note's answer plan, one shape from every exit) and the window driven on the minimal DOM.

## 11. Writs - the Work tab

- **Court writs** (the faucet): every region with a seat or hub posts **6 x max(1, ceil(active / 100)) a UTC day** (a
  pure function of the day, the region and `active`, the count the crown's scale reads - SEAT0 7.1), so the supply
  grows with the server: 45 such regions post 270 a day at up to a hundred active accounts, 810 at three hundred. A
  writ asks for a material from the region's own **witnessed** tables - metals, wood, herbs (4.1-4.3) and stone (4.5),
  never hides or fish, which are bounded, not witnessed (section 6), since a Mark is minted only for a witnessed act
  (law 8) - mostly tiers 1-4, one a day of tier 5-6; **10-50** units, fewer at higher tiers. **Pay**: units x the material's Marks value x
  1.2, and Renown XP 25 x tier x units / 10. Each writ is filled once, by the first to deliver; at most **3** an
  account a day. (The economy model, Appendix C, set 3 and 1.2: at 5 and 1.5 the Marks minted ran at 2.3 times the
  Marks burnt.)
- **Guild and seat writs**: their pay is escrowed from the guild's Marks treasury, so posting one is a withdrawal:
  the **Guildmaster** posts them (GUILD1's law: only the Guildmaster withdraws), or an **Officer** within a weekly
  **writ budget** the Guildmaster sets on the Guild tab. A writ's pay may not exceed **1.5 x the materials' value**
  (4.8), so a writ cannot be a disguised transfer to an alt. Partial fills pay pro rata; unfilled after 7 days, the
  escrow returns. A seat's writs build its fortifications (SEAT0 7.5) and count as influence at **the materials'
  value, never the pay** (SEAT0 4.2), for the holder or a pledged guild - **and only** for a delivery by a character
  who has been in the posting guild 7 days, whose account is bound to that guild for the week (SEAT0 4.2's per-account
  war), and only for **own** units (section 7). Bought units count at Tribute's rate (1 per 10 Marks of value) inside
  Tribute's cap; a counter's goods never count; anyone else's delivery earns the pay alone. A Siege Camp's stock is
  **spent at the Turning** - a Ram Kit to the siege it won, the rest burnt - and never withdrawn; the holder's stockpile is spent by its projects, never withdrawn - so a
  unit raises influence once.
- **Commissions**: a player posts a writ naming a crafter and a product; only that crafter can fill it; the item
  passes through the board (its provenance kept).
- **Bounties**: the Bounty Edict's camps (SEAT0 7.6).
- **In person**: a writ is taken at any board and delivered at the board that posted it: the delivery comes out of
  the Stores, and the deliverer must stand at that board (the relay knows it).

## 12. Why a player comes back

A daily round of nodes; three Motherlodes a day; weekly Tides; the seasons' herbs; gate-touched veins after every
gate; recipes still to find; specialisations to choose; a Masterwork with your name in someone else's hand; the Hall
of Makers; commissions; regional prices to haul between; and every seat on the map wanting what you gather.

## 13. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client fakes harvests | Node ids from the pure law; service-rolled yields; daily caps (section 6) |
| A modified client fakes a craft | The service crafts; the client only receives (9.1) |
| A modified client plays a perfect act | Capped at one quality step and +50% yield, never past the rank (5.1) |
| A save-edited item enters the economy | The Stores are one-way (law 3); only a provenance id's owner lists it, one listing at a time (10.2, 18) |
| Fake gold buys the market | The market is in Marks (10.5) |
| Marks inflate | Faucets only from witnessed acts, each capped; the weekly report; the Bank's spread and every fee burn |
| Bots farm nodes | Per-character nodes, daily caps, travel |
| A modified client claims a rich node on a pixel nobody walks | The witnessed world: an unconfirmed pixel yields tiers 1-2 only (section 6) |
| A modified client claims kills it never made | Hunting is bounded, not witnessed: 30 hides a day, 3 of tiers 5-6 (section 6); hides mint no Marks (no Court writ asks for them, section 11) |
| A modified client claims hauls from water it is not in | Fishing is bounded: 40 hauls a day an account; no Pearl or Slaughterfish on an unconfirmed pixel; fish mint no Marks (section 6, 11) |
| A modified client gathers at night | The service checks the act's hour on the shared clock itself (section 6) |
| Marks buy influence (materials bought at their value, then delivered to a seat) | Only **own** units count at their value; bought units at Tribute's rate inside its cap; counter goods never (section 7, 11) |
| An alt or an outsider fills a guild's seat writ for influence | Only a 7-day member bound to the guild for the week earns influence by delivery; the rest earn the pay (section 11) |
| An Officer drains the Marks treasury through writs to an alt | Writ posting is the Guildmaster's, or an Officer's within a budget; pay at most 1.5 x the materials' value (section 11) |
| One character does everything | Two crafts above Journeyman (3.2) |
| Crafting obsoletes loot | Rare at most (law 7) |

## 14. The server's shape

- `prof_tracks` (player, char_id, profession, xp, spec50, spec100) - BUILT, `0020_professions.sql`, with the
  pending change of specialisation (respec_rank, respec_to, respec_at)
- `prof_stores` (player, char_id, material, origin, qty) - BUILT, `0020_professions.sql` - `origin` own or bought
  (section 7); `guild_prof_stores` (guild_id, material, origin, qty) with its ledger - not built (AUDIT 29: this line
  read as built)
- `node_harvests` (day, node, kind, player, char_id - the node its one spelling, AUDIT 29) - BUILT,
  `0020_professions.sql` (with the harvest's profession, material, qty, XP credited, rid and nonce; AUDIT 29's
  `0022_audit29.sql` adds `deep_unconfirmed`, a dungeon vein nobody vouched for; pruned after two days by the state's own read, section 20; PROF2's `0021_mining.sql` rebuilt it for
  the kinds `ore` and `stone` and a found `gem`; PROF4's `0024_logging.sql` rebuilt it again for the kind `logs` and a
  second find, `extra` - a tree's Resin); `prof_withdrawals` (a withdrawal's rid) and `world_witness` (SEAT0
  3.2's witnessed pixel) BUILT with it - its second kind, the witnessed dungeon, PROF2's; `fish_hauls` (day, account,
  n) for the account cap
- `prof_smelts` (player, rid, char_id, recipe, count, own, bought, xp, at, n) - BUILT, `0021_mining.sql` (PROF2: a
  smelt's decision, the row its answer is read back from)
- `prof_choices` (player, rid, char_id, profession, rank, spec, at, n) - BUILT, `0022_audit29.sql` (AUDIT 29: a free
  first specialisation's row, found by its id before the switch; a paid change keeps its Marks line, which names its
  track)
- `recipes_known` (player, char_id, recipe) - not yet: every recipe unlocks by rank until the found ones come (PROF6)
- `products` (provenance PK, template, material, quality, maker, made_at, listed, condition, enchantments JSON) - a
  listing writes the item's condition and enchantments as the pack held them, and the buyer receives exactly that -
  BUILT, `0023_smithing.sql` (PROF3: provenance, owner, char_id, maker, recipe, template, material, quality, seed, record,
  made_at, listed; condition and enchantments come with the listing, PROF5), with `prof_crafts` (a craft's row) and
  `prof_stock` (a purchase from the smith's stock); `0024_logging.sql` (PROF4) adds `products.marked` (the maker's mark
  a Masterwork or a Master Joiner's piece carries) and `prof_crafts.heartwood`
- `marks` (account, balance); `guild_marks` (guild_id, balance); `marks_ledger` (seq, src_kind, src_id, dst_kind,
  dst_id, kind, amount, day, at, actor, who, rid) - BUILT, `0018_marks.sql` (AUDIT 28: this line gave the first sketch)
- `market_listings` (id, region, seller, material or provenance, qty, price, expires_at); `market_orders`;
  `couriers` (buyer, goods, arrives_at) - BUILT, `0025_market.sql` (PROF5, section 26: `market_listings` - a material's
  units own and bought apart, a piece's provenance and wear, its fee, state and return; `market_sales` - a purchase's
  row, its tax, courier, road and arrival, the couriers' loads; `market_deliveries` - a piece on its way to a pack, bought
  or come back; `market_orders` and `market_fills`; `market_prices`, the History's day table; `market_reports`), with the
  ledger's `escrow` end, the witness's `hub` kind and `products` kept past its owner's account
- `writs` (id, kind, poster, region, key, material, qty, pay, escrow, expires_at, filled) - BUILT for the Court's
  writs alone, `0020_professions.sql` (id, kind `court`, day, region, slot, material, tier, qty, pay, renown, expires_at,
  filled_by, filled_char, filled_at, rid, n), with `writ_days` (a region's day written down, and its `active`)
- `board_notes` (id, map_id, author, author_name, subject, body, button, guild_id, char_id, at, expires_at, hidden,
  rid), `board_reports` (note_id, reporter, at) and `board_notices` (id, subject, body, author, author_name, at,
  expires_at, rid) - BUILT, `0019_board.sql` (AUDIT 28: this line gave the first sketch)
- Endpoints: `/v1/prof/*` (harvest, spec; `smelt` BUILT with PROF2; `craft` and `stock` BUILT with PROF3; PROF4's trees, burns, saws, Carpentry and
  the furnisher's Linen through the same five; PROF5's Weavers' counter too), `/v1/stores/*`, `/v1/marks/*` (balance,
  exchange, guild; the report's medians with PROF5), `/v1/board/*` (notes), `/v1/market/*` (BUILT with PROF5: read, list,
  buy, cancel, order, fill, unorder, collect, report, remove), `/v1/writs/*`.
- Law modules (pure, shared by client and service): marksLaw.js, boardLaw.js, professionLaw.js, nodeLaw.js and
  kingdomLaw.js (built - the last PROF2's, SEAT0 4.3's map); recipeLaw.js (built, PROF3; Carpentry's with PROF4) and productRecord.js (PROF3's signed record).
- The relay: the activity field on the pose (a `RELAY_VERSION` and LAW row); the in-person check for deliveries.

## 15. The slices, in order

| Slice | What | Done when |
|---|---|---|
| **PROF0** | This record | - |
| **MARKS1** - SHIPPED 2026-09-28 (at `dev`) | Marks: balances, the guild Marks treasury, the ledger, the Bank's exchange, the weekly report; the first faucet is the gate's receipts (Court writs come with PROF1's Stores - a writ filled from the pack would be a save item bought with Marks) | Every faucet capped and pinned; gold never becomes Marks, pinned |
| **NOTICE1** - SHIPPED 2026-09-28 (at `dev`) | The Notice Board (10.7): a town's rumour boards open it online (BOUNTY1's bounty boards stay the hunts), the rumour pinned first and the bounty board's line under it; the server's word; the Notices tab; player notes, their button, reports and moderation; the count over the board. The Work tab moved to PROF1 | Offline a rumour board is byte-for-byte DFU's (the ROAD A9 pins hold) |
| **NOTICE1b** | Boards stood where a hub lacks one (10.1), if `tools/boardCount.mjs` names any; a seat's with SEAT1 | Mac's run of the measure |
| **PROF1** - SHIPPED 2026-09-28 (at `dev`, section 22) | The Stores; **Herbalism** with its act; the board's **Work tab**; the Professions and Stores tabs, the prompt, the meter, the toasts; the Sickle and the Basket's search; withdraw to pack; **Court writs** (section 11); FORAGE0 law 6's online exception - the six tools shelve online whatever the switch says. **Needs FORAGE1-2 (shipped)**, MARKS1 and NOTICE1 (FORAGE0 17) | An herb picked online reaches DFU's potion maker by the pack |
| **PROF2** - SHIPPED 2026-09-28 (at `dev`, section 23) | Mining and Quarrying with their acts; the dungeon veins and the witnessed dungeon; gems; smelting at a forge (a smith's, or a home's forge station); ores and ingots (610-630) and stone (673-674); the Prospector's compass; metal and stone writs. Motherlodes and gate-touched ground are PROF2b. Needs FORAGE1-2 (shipped: the Pick-Axe) | Veins placed on rock fields; signatures by kingdom |
| **PROF3** - SHIPPED 2026-09-28 (at `dev`, section 24) | Smithing with its act; quality; provenance; the anvil (the forge stands since PROF2); the smith's stock (the fittings the professions do not yet yield) | A crafted Mithril Longsword is DFU's, with its quality |
| **PROF4** - SHIPPED 2026-09-28 (at `dev`, section 25) | Logging with its act (the falling tree); Carpentry; furniture; the Ram Kit | DECOR places a crafted table. Needs FORAGE1-2 (shipped: the Wood-Axe) |
| **PROF5** - SHIPPED 2026-09-29 (at `dev`, section 26) | The Market tab: listings, regional markets, couriers, buy orders, history; the Weavers' counter | A crafted Mithril Longsword listed in one region is bought from another by courier and reaches its buyer's pack, its owner moved. Needs MARKS1, NOTICE1, PROF3 (all shipped) |
| **PROF5b** | Timed auctions for Masterworks | - |
| **PROF6** | Writs: guild, seat, commissions, bounties | Needs SEAT1b for seat writs |
| **PROF7** | Hunting (the trace), the Skinning Knife (603: its template, its online shelves - law 6's exception, for 603); Outfitting | Needs FORAGE1-2 (shipped: the shelves' registry) |
| **PROF8** | Fishing with the net (the throw, the tug, the haul) | Needs FORAGE1-2 (shipped: the net, and the three-valued water state in both exterior hosts) |
| **PROF9** | Cooking | - |
| **PROF10** | Jewelcrafting | - |
| **PROF11** | Masonry | Needs PROF2 (quarrying); SEAT2b and PLOT1 consume what it makes |
| **PROF12** | Alchemy and Enchanting layers; Disenchanting | - |

## 16. What remains to measure

1. **The Marks economy** - after four weeks of MARKS1, the weekly report: if more is minted than burnt by a quarter,
   the Bank's rate falls a Mark's worth; if less, Court writ pay rises 20%. Recorded here.
2. **The node density** - Mac's eye in the field after PROF1-2: the table in section 6 moves by whole nodes.
3. **The act windows** - after PROF1, the share of clean acts: aimed at a third for a Journeyman.

## 17. The four hosts and the process laws

### 17.1 The four hosts

Every PROF slice's record names all four (Home.md, THE FOUR HOSTS RULE, 17e), each wired or FLAGGED:

| Host | What the professions are there |
|---|---|
| `scenes/world.js` - the streaming world | The wilderness nodes (trees, herb patches, veins, boulders, fishing spots and schools), placed as each terrain tile streams in and freed as it streams out; Motherlodes; gate-touched ground; the Notice Boards; every gathering act; Hunting's skinning outdoors |
| `scenes/exterior.js` - the fixed city | DFU's own board of its one city - never the Notice Board, which is online's (10.7; AUDIT 28 corrected "the board"). **FLAGGED by name**: no nodes - a fixed city has no wilderness around it and no streamer to place them |
| `scenes/worldModes.js` - building interiors | The stations (a home's, a guild hall's, a shop's for its use fee); the crafting acts; the Stores chest at a home, a hall or a seat's palace; a station's window in the host's overlay slot |
| `scenes/dungeonContext.js` - dungeons | Dungeon veins on the RDB walls (Dwarven Scrap, Adamantium, Diamonds); Hunting's skinning of a dungeon's foes; the act rig as outdoors |

### 17.2 The process laws, applied

| Law | What it means here |
|---|---|
| **ONE DFU MEMBER, ONE EXPORT** | Nothing DFU or a vendored mod owns is re-typed: DFU's recipes (`POTION_RECIPES`) are imported by the Alchemy layer, never copied; items through `templateByIndex`; C&C's `TEMPLATE` constants, Deep Waters' `PASSIVE_FISH_SPECIES`, `BULLETIN_BOARD_MODEL_ID`, `itemDye.js`'s colours and `WEAPON_MATERIALS` are imported. recipeLaw.js is the one home of every new recipe |
| **A PIN MUST FAIL** | Every recipe, node table and number in Appendix B is pinned by `deepEqual` against its law module, and each slice's mutants (`tools/mutants/prof*.json`) prove it |
| **TEST THE SHAPE THE PRODUCER MINTS** | A crafted item in a test is the service's own product record passed through the client's own add path (`setItemFields`), never an item literal - the exact failure 17e names (`{ enchanted: true }` written by no producer) is the one this law exists for |
| **THE MODAL CONTRACT** | The board's window, a station's window and the act overlay each return the same type from every exit, asserted in a test |
| **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD** | A station or the board in the host's overlay slot: the slot is nulled before the window is disposed; its close dispatches once |
| **ASYNC NEVER DROPS** | A harvest, a craft, a delivery, a listing each carry a request id; a second press while one is in flight coalesces; a lost answer is re-asked with the same id and answered, never credited twice (Renown's `last_rid`) |
| **EVERY ALLOCATION HAS AN OWNER** | Node billboards are owned by their terrain tile's batch and freed at stream-out; a felled tree's falling flat by the node; the act meter by its overlay; the tool's sprite by the weapon rig |
| **THE ONE CONSTRUCTION SEAM** | One constructor builds a station's window and one the board's, for every host; a test sweeps the source for a stray `new` |
| **THE NATIVE-WINDOW RULE** | The offline bulletin board's parchment is native and keeps its ROAD A9 cites; DFU's potion and item makers stay native and untouched; every new window is the port's own Enhanced Plus window and cites `src/ui/enhancedStyle.js` |
| **A SLICE CLOSES ITS LEDGER ROW** | MARKS1, NOTICE1 and PROF1 each add their Port-Ledger section A row (MARKS: THE SERVER'S CURRENCY; THE BOARD, ONLINE; PROFESSIONS); PROF2 added its own (MINING); later slices add theirs or narrow these |
| **THE RELAY VERSION** | The activity field on the pose and the in-person check are relay changes: a `RELAY_VERSION` and a LAW row each |

## 18. Lifecycles and edge cases

- **A character is deleted**: its Stores, tracks, specialisations and recipes go with it (the delete dialog lists
  them); its Marks stay, because Marks are the account's.
- **An account is deleted**: its Marks go; its live listings are cancelled and their goods burnt; its buy orders'
  escrow is burnt; a guild it led runs GUILD1's `succeed()`.
- **A guild disbands** (or its last member leaves): refused while its gold treasury or its guild Stores hold anything
  (GUILD1's rule, grown a clause), while it holds a Charter and while a Right of Siege or a Tourney is pending (SEAT0
  16). Its Marks refuse nothing: they go to its guildmaster in the same batch as the delete (AUDIT 28 M3/M5 - a switch
  the guildmaster could not pass would otherwise lock the guild for good), refused only past the guildmaster's cap.
- **The Stores are full** (5,000 of a material): the prompt says so before the act ("Stores full - Oak Logs"), so a
  harvest is never played for nothing.
- **A crafted item changes hands.** The service keeps each provenance id's **owner**. TRADE1's confirm step, when a
  provenance item is in the trade, asks the service to hand the id over (both parties' tokens, the relay's verified
  trade); a market sale hands it over by itself. A listing is accepted only from the owner, and an id has **one live
  listing at a time** - so a crafted sword can be bought and resold forever, and a duplicated copy in a save can never
  be sold as well, because its id's owner has moved on.
- **A crafted item goes offline.** It is DFU's own item, and its extra fields ride the save - FACT, the save snapshots
  every item whole (`snap.items = (entity.items ?? []).map((it) => ({ ...it }))`, `src/systems/save.js`), as Loot Rarity's
  `rarity` already rides. Offline it is simply the item it is. A classic-save export (`src/systems/classicSave.js`)
  carries DFU's fields alone, so there it becomes the plain DFU item it always was.
- **A Masterwork's maker renames**: the mark keeps the name at the moment of making - it is history.
- **An item sold to a shop's shelf** (WORLD6a: another player may buy it off the shelf): its provenance owner does not
  move, so it cannot be listed by the new holder until a TRADE1 or a relisting by its owner moves it - the shop is not
  a way round the market's law.

## 19. Failures and outages

- **The service is unreachable during an act.** The act still plays; its harvest request waits in a queue with its
  request id and is retried for up to 10 minutes (ASYNC NEVER DROPS); a node id that has expired (the UTC day ended)
  lapses with a toast saying so. The node greys only when the service confirms.
- **Crafting needs the service.** A station says "The counting-houses are not answering" and offers nothing; no
  offline crafting, because the Stores and the dice are the service's.
- **The board** reads through a 60-second cache, so a slow service shows the last good board; its writes wait for the
  service.

## 20. Rollout, moderation, data

- **Switches**: `PROFESSIONS_OPEN`, `MARKS_OPEN` and `BOARD_OPEN` in the account service's config (off, dev, on); at
  `dev` only the dev glyph sees them. `MARKS_OPEN` and `BOARD_OPEN` stand (MARKS1, NOTICE1, `server-account/wrangler.toml`), each shipped at `dev`. Season 0 (SEAT0 18) is the professions' beta too: Marks, the Stores and tracks
  are kept through its wipe.
- **Moderation**: player notes pass MAIL1's letter law and its filter; moderators (MOD1) remove a note
  (`/note remove <id>`) and may mute its author; a listing may be reported and removed the same way (the goods
  returned). Market wash-trading between one's own accounts is allowed and visible in the ledger - it moves Marks,
  it cannot mint them.
- **Rate limits** per account per hour (GUILD1's `GUILD_OPS_MAX` shape): harvests are already capped by the day;
  crafts 600, listings 60, notes 10, writ posts 20.
- **Data kept**: `node_harvests` pruned after 2 days; the Marks ledger and `products` forever (they are the
  economy's audit); listings' history 90 days; notes deleted on expiry.

## 21. The screens

Enhanced Plus windows, in its brass and bone; layouts, not art. The board's Seat tab is SEAT0 19.

**The board's Work tab** - the seal's colour says who posted a writ:

```
+--------------------------------------------------------------------------------------------+
| NOTICE BOARD - Anticlere           [Notices] [WORK] [Market] [Seat] [Guilds] [Makers]      |
+--------------------------------------------------------------------------------------------+
| (purple) COURT WRIT            | (SH) SEAT WRIT                 | (green) COMMISSION        |
| The Court of Anticlere needs   | The Silver Hand's Walls need   | For Silverthorn only:     |
| 30 Red Poppies                 | 280 more Cut Stone             | a Mithril Longsword       |
| Pays 72 Marks, 150 Renown      | Pays 2 Marks each              | Pays 900 Marks            |
| 14 hours left                  | 520 / 800 delivered            | 5 days left               |
| [Take]   34 in your Stores     | [Deliver 40 from the Stores]   |                           |
+--------------------------------+--------------------------------+---------------------------+
| Court writs today: 1 of 3                                                                  |
+--------------------------------------------------------------------------------------------+
```

**The board's Market tab**:

```
+--------------------------------------------------------------------------------------------+
| MARKET - the boards of Anticlere     [MATERIALS] [Crafted] [My listings] [Orders] [History]|
| Search [mithril        ]   Family [Ores and Metals v]   Tier [any v]   Sort [price v]      |
+--------------------------------------------------------------------------------------------+
| Mithril Ore       x120    8 Marks each   here                    median 8.4   _/\_/        |
| Mithril Ore       x40     7 Marks each   Wayrest  +26 courier, 45 minutes                  |
| Mithril Ingot     x12    21 Marks each   here                    median 22    __/          |
+--------------------------------------------------------------------------------------------+
| Buy 40 Mithril Ore for 280 Marks + 26 courier?    [Buy]          Your Marks: 1,240         |
+--------------------------------------------------------------------------------------------+
```

**The Professions tab** (the character sheet):

```
+----------------------------------+---------------------------------------------------------+
| GATHERING                        | LOGGING                         Apprentice  34 -> 35    |
|  Mining       Apprentice  27 ==  | [=====================-------]  11,900 / 12,250 XP       |
|  Logging      Apprentice  34 === | Today: 34 of 60 trees                                   |
|  Herbalism    Journeyman  52 ====| At 50, choose:  [ Lumberjack ]  or  [ Forester ]        |
|  Hunting      Novice       8 =   | Unlocks: Cherry (25), Teak (40), Mahogany (55),         |
|  Fishing      Novice       0     |          Ironwood and Ghostwood (70)                    |
| CRAFTING                         |                                                         |
|  Smithing     Journeyman  61 ====| Crafts above Journeyman: 1 of 2                         |
|  Carpentry    Apprentice  30 ==  |                                                         |
|  ...                             |                                                         |
+----------------------------------+---------------------------------------------------------+
```

**The Stores tab**:

```
+--------------------------------------------------------------------------------------------+
| THE STORES      Search [      ]  [Ores and Metals] [Wood] [Herbs] [Hides and Cloth]       |
|                                  [Food] [Stone] [Gems] [Essences] [Spoils]  Sort [tier v]  |
+--------------------------------------------------------------------------------------------+
|  [Iron Ingot 212]  [Steel Ingot 40]  [Mithril Ore 18]  [Oak Log 96]  [Oak Plank 30]         |
|  [Red Poppy 34]    [Golden Poppy 4]  [Bear Hide 6]     [Cut Stone 140]                     |
+--------------------------------------------------------------------------------------------+
| Oak Plank x30 - tier 2 - 2 Marks each      [Withdraw to pack]  [List]  [Deliver to a writ] |
+--------------------------------------------------------------------------------------------+
```

**A station** (a forge):

```
+-----------------------------+------------------------------------+-------------------------+
| RECIPES   [Can make now]    | MITHRIL LONGSWORD       rank 55    | THE HEAT                |
|   [All known] [Tier v]      | Mithril Ingot  3 / 3  (18 stored)  |   ___/\___/\___         |
|  Mithril Longsword  *       | Copper         1 / 1               |      [ band ]           |
|  Mithril Cuirass            | Cured Leather  1 / 1               |   strikes: o o .        |
|  Steel Claymore             | your rank 61, margin 6:            |                         |
|  Repair Kit (Mithril)       | Crude 20 | Standard 60 | Fine 20   |                         |
|                             | [Craft]  [Quick craft]  [Craft x N]|                         |
+-----------------------------+------------------------------------+-------------------------+
```

**The act meters**, centred on the crosshair (each with a still form for Reduced motion):

```
  Logging - the ring            Mining - the glint           Herbalism - the steady hand
       .-""""-.                  +-----------------+          [##########--------]  1.6 s
      /  .--.  \                 |  .    *     .   |          hold still  (3 degrees)
      |  |()|  |  <- band        |     .      .    |
      \  '--'  /                 +-----------------+
       '-....-'                    strike the *

  Hunting - the trace           Fishing - the haul                             The Basket - the search
   o . . . o . . . o             |---[  band  ]--------|   haul [########------]    ( * )  .   .     1 of 3
    (draw along the dots)                  ^ the net's weight                        tap the glint
```

## 22. PROF1 - the Stores, Herbalism and Court writs, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Begin!"** What the design above left open for PROF1, DECIDED here (the record's, at Mac's instruction), and
what was found (FACT):

- **Behind a switch, registered only.** `PROFESSIONS_OPEN` (off, dev, on) in `server-account/wrangler.toml`, shipped at
  `dev`. The Stores are a character's and a guest is a device (MARKS1's reading), so every professions route is a
  registered account's - the reads too: a guest has no Stores to read. A Court writ pays Marks, so a delivery needs
  `MARKS_OPEN` too. An act's request is found by its id BEFORE the switch is asked: a harvest or a delivery made is
  answered as made though the switch shut after it. The service is `acct19`; the tables are `0020_professions.sql`.
- **The laws.** `src/net/professionLaw.js` (the thirteen, ranks, XP, tiers, specialisations, the day's cap, the Stores'
  cap, the Herbalism acts' numbers, the materials PROF1 stores, the Court writs) and `src/net/nodeLaw.js` (section 6's
  node table, 4.3's herb tables, the seasons, a pixel's day of patches, the yields, the witnessed pixel). Both ends
  read them; recipeLaw.js comes with the first craft (PROF3).
- **An herb is DFU's own item, north or south.** FACT: DFU keeps two groups of plants - PlantIngredients1, named
  "(northern)" below template 18, and PlantIngredients2, "(southern)" (`src/systems/itemInfo.js` itemNameParts) - and
  nine plants are in both (Twigs, Green Leaves, Red and Yellow Flowers, Root Tendrils, Root Bulb, Green, Red and Yellow
  Berries). DECIDED: an herb's group is its pixel's region's by FALL.EXE's own table (`REGION_RACES`: a Breton region
  northern, a Redguard one southern); a plant only one group holds is that group's wherever it grows. So the Stores keep
  a two-group plant as two materials ("Twigs (northern)", "Twigs (southern)"), and a withdrawal is the very item DFU's
  own loot would have been.
- **A pixel's patches** (section 6, herbs): the climate's count a UTC day; a patch is `(x, y, day, slot)`; its place in
  the pixel is the law's; its tier rolls 40 / 25 / 15 renormalised over the herbs' three tiers (8 : 5 : 3) and is held
  to tier 2 on a pixel not confirmed; its herb is drawn evenly from that tier's herbs growing in the season - DFU's
  season (`seasonValue`), on the shared clock at the UTC day's first instant, so a day's patches never change under a
  player. The client stands a patch as a small cluster of the herb's own world picture (TEXTURE.254, the plant's item
  flat - no new art) and stands none where DFU's own nature would not (a location's rect, water, a slope - terrainNature's
  rules).
- **The seasons, read.** Winter bares the flowers, roses, poppies and berries (4.3); Green Leaves and Clover, which that
  line names on neither side, grow all year. Spring's +50% is every flowering herb the winter line bares less the
  berries (flowers, roses, poppies); autumn's is the berries. A patch whose herb is out of season yields to a Seasonal
  Eye at half (3.3): the law draws the herb from the patch's tier first, and a patch whose first draw is bare draws again
  among what grows at that tier, stepping down a tier until something does - the first draw stands for a Seasonal Eye.
- **The witnessed pixel** (SEAT0 3.2) is built here with its first kind: `world_witness` (kind, key, account, report,
  region, at). A harvest carries its pixel's climate and region; an account seven days registered reports a pixel once;
  three agreeing make it confirmed; two agreeing on another answer afterwards make it disputed, and the confirmed answer
  stands. `world_facts` and a moderator's settling come with SEAT1a. `/v1/prof/pixels` tells the client its streamed
  pixels' states, so a patch never shows a rare herb its pixel would not give. A march's +25% is a confirmed pixel's
  alone (an unconfirmed pixel is worth the least its kind allows).
- **The acts** (5.2): a common herb comes up by hand in 0.8 s, with no moment (plain XP); an uncommon or rare herb needs
  the Sickle and the rank (tier 2 at 10, tier 3 at 25) and holds E for 2.5 s, bruised by turning more than 3 degrees
  (times the band and Botanist's +50%) or by moving a quarter of a metre; letting go early or Esc ends it with nothing
  lost. The Basket: three glints in turn, attack while each shows. Foraging's checks first, with the Sickle's lines for
  herbs and the Basket's for food (FORAGE0 14.3). A completed act wears its tool by 1 (FORAGE0 14.1). Gentle acts (a
  setting): every act plain. Reduced motion is the system's own (FACT: the port has no setting of its own - every window
  reads `prefers-reduced-motion`); under it the meters are still bars.
- **The act choice key** (8): `ActChoice`, the Controls page's Professions group, default the up arrow (FACT: every
  letter and digit is bound, and `-`, `=` and `/` are the decorator's own keys - `scenes/decorTool.js` DECOR_FREE_KEYS -
  so the sweep that holds every raw key to its action, `test/inputmap.test.js` I2, refused `=`; it shipped on `;` until
  the merge of main, whose Come Sail Away took `;` for its lantern first (CSA-D) - the up arrow is read by no action in
  play).
- **Court writs** (11): a region posts once its ground is witnessed - the service knows no hub (SEAT0 3.2), and a region
  with ground has one - `6 x max(1, ceil(active / 100))` a UTC day, `active` the registered accounts whose last beat
  (ACC4's `played_at`) fell in the seven days before the day began, counted when the region's day is first read, when
  its writs are written down for the day. A writ asks a material the region's witnessed ground yields in the day's
  season (a confirmed pixel's whole table, an unconfirmed one's tiers 1-2) - herbs, in PROF1, since the Stores hold
  nothing else yet; units 10 to 50 in tens (so the pay and the Renown are whole), fewer at higher tiers; the day's first
  writ the table's highest tier. **Take** fills it - a Court writ is filled whole by the first to deliver (11), so taking
  one is delivering it, at a board of its region, from the Stores, bought units first. The service does not see the
  board: its in-person check comes with PROF6, where a delivery raises influence; a Court writ's pay is bounded by its
  three a day wherever it is asked from.
- **Withdraw to pack**: bought units first; the items the law names, minted as DFU mints them; a withdrawal whose answer
  was lost is kept and asked again with its id (MARKS1's kept sale).
- **The shelves' exception** (FORAGE0 law 6): online, the six tools shelve whatever Foraging's switch says.
- **The four hosts** (17.1): **the streaming world** (`scenes/world.js`, through `scenes/herbHost.js` - since PROF2 a
  kind in the one gathering host, `scenes/gatherHost.js`, section 23) stands a built
  wilderness pixel's patches in the pixel's own list, so its frame walk draws them and `destroyPixel` frees them; the
  prompt, the act, the answers, the Work tab on its boards. **The fixed city** (`scenes/exterior.js`) - **FLAGGED by
  name**: no nodes, as 17.1 says. **Building interiors** (`scenes/worldModes.js`): nothing stands there in PROF1 (the
  stations are PROF3's); the book's answers still come in (the host's tick runs indoors), and the Professions and
  Stores pages are the Enhanced pause menu's in every host (AUDIT 29: the classic skin's pause has no Stats rail -
  **FLAGGED**). **Dungeons** (`scenes/dungeonContext.js`): no herbs - their
  veins are PROF2's.
- **The tool in the hand**: for the steady hand's length the classic lane's rig draws the Sickle as DFU's Tanto
  (template 114), its idle frame, and nothing else (`combat/weaponRig.js` `actTool`, above the sheathe gates, as the
  held map's classic lane takes the hands). **The Morrowind lane keeps its stance - FLAGGED**: its arm draws a modelled
  weapon, not a sprite, and no model of a sickle is attached.
- **The pages**: the Professions and Stores pages are two more sections on the Stats page's rail (`ui/enhancedMenu.js`
  statsSections, `ui/profPages.js`), shown online while the professions are the account's; a page gone (the switch,
  offline) is never drawn. The specialisation cards sit on the Professions page, a change armed and confirmed in place.
- **Gentle acts** is a setting on the Professions page (`uiPrefs` `gentleActs`, off): the player's own, never the
  online lane's (`systems/onlineLane.js` ONLINE_PLAYERS_OWN_PREFS).
- **The hover** (8's World Tooltips line) is **not built**: the prompt says what a patch holds and what it needs
  (the herbs or the Basket, taken, the rank, the Sickle, the Basket, the Stores' room, the day's count).
- **The pad and touch** (AUDIT 29, corrected: this line said they reach an act through Interact): the pad's A is the
  activate (Mouse0), not Interact, and a finger has no Interact, so a node's act is E's - the controls page's registry
  can bind Interact to a pad button - **FLAGGED**, with 8's tap on the node and the act's own on-screen buttons, not
  built.
- **Not here, named**: the pose's activity field (5.1 - a kneel is nothing a peer's body draws; AUDIT 29, corrected:
  this line said PROF2's and PROF4's swings travel as the pose's swing count - a Pick-Axe's strikes are the act's, never
  the rig's swing, so no peer sees them); the held map's worked patches; an unbruised herb's Potent chance
  (PROF12 - the Stores keep no quality in PROF1).
- **Pinned**: `test/prof1_law.test.js` (14), `test/prof1_service.test.js` (13), `test/prof1_client.test.js` (15);
  `tools/mutants/prof1.json`, 58 mutants, every one dead. The done-when is `prof1_client`'s DONE WHEN: an herb
  harvested through the real Worker, withdrawn into the pack, minted as DFU's own plant and mixed by DFU's recipe law.

## 23. PROF2 - Mining and Quarrying, ores, ingots and the forge, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Go"** (PROF2 after PROF1). What the design above left open for PROF2, DECIDED here (the record's, at Mac's
instruction), and what was found (FACT):

- **What PROF2 is.** Mining's surface veins and Quarrying's boulders in the streaming world, the dungeon veins, the
  region signatures (4.7), the gems (4.6), smelting at a forge, the ores and ingots (610-630) and the stone (673-674)
  as items, the Prospector's compass, and the Court writs asking for metal and stone. **Not here, named**: the
  **Motherlodes** (section 6 - a relay room's socket check and the hub's warning; PROF2b) and **gate-touched ground**
  (4.7 - the gate's pixel is the client's to find, `src/net/gateLaw.js`, and a receipt carries no pixel today, so
  three fighters cannot yet agree where it stood; PROF2b); Daedric smelting (its Daedra's Heart and Sigil Stone cannot
  enter the Stores until Hunting and the gate's gift put them there - law 3); the held map's marks; a vein's cracks.
- **The kingdoms are one home.** FACT: nothing in the tree maps a region to a kingdom but SEAT0 4.3's table.
  DECIDED: that table becomes `src/net/kingdomLaw.js` (the regions of Daggerfall, Wayrest and Sentinel, the Marches,
  the Free Lands), which nodeLaw reads for the signatures and the Marches and the seats' slices will read for theirs.
- **The veins' tables** are 4.1's, each metal DFU's own (MetalIngredients: Mercury 65, Tin 66, Brass 67, Lodestone
  68, Sulphur 69, Lead 70, Iron 71, Copper 72, Silver 73, Gold 74, Platinum 75 - FACT, `itemTemplatesData.js`) at 4.1's
  tier, the six new ores at theirs (Moonstone 4, Dwarven Scrap 4, Mithril 5, Adamantium 6, Ebony 6, Orichalcum 6). A
  vein's tier is drawn over the tiers its climate's table holds by section 6's weights renormalised (a Woodlands vein
  is Iron, Copper or Tin at 40 : 25 against Lodestone), held to tier 2 on a pixel not confirmed, and its metal evenly
  among that tier's. "Deep veins" (4.1, 4.6) are the dungeon veins.
- **The signatures** (4.7): on a **confirmed** pixel of the kingdom, a signature stands BESIDE the climate's veins, in
  the slots after them (AUDIT 29: it took the first vein's place, so a Swamp's one vein was a crown's rare ore and a
  novice had no ore on witnessed ground there) - the
  Kingdom of Daggerfall's Moonstone **two** ("twice the usual rate"), Wayrest's Mithril, Sentinel's Ebony,
  the Orsinium Area's and the Wrothgarian Mountains' Orichalcum (found nowhere else), the Isle of Balfiera's
  Adamantium (the only open-world surface Adamantium). On a pixel not confirmed the slot is an ordinary vein - a
  signature is tier 4 to 6 and such a pixel is worth tiers 1-2. The Marches keep their +25%.
- **Where a node stands** (section 6: "the nearest suitable anchor"). FACT: World of Daggerfall is forced on for the
  online lane (`src/systems/onlineLane.js`) and 209,436 of its 227,938 instances are `Rocks` layouts, 2,502
  `Mountains` (`03-World/World-Of-Daggerfall.md`), so every client of a room stands the same rock pieces. DECIDED: a
  **vein** stands at the foot of the rock-field piece nearest its law point (the piece's own box, on the side facing
  that point) where the pixel has one; else on the terrain's stone tile (tile 3, `terrainNature.js`) nearest its point
  within 24 tiles where nature could stand; else where nature stands at its point; else nowhere. A **boulder** is a
  rock-field piece itself - Quarrying works "a rock field's boulders" (5.2) - so a pixel with no rock field, or with
  fewer pieces than its boulder slots, stands fewer. A piece holds one node. The node's picture is its material's own
  item flat (TEXTURE.254, the metal's own, a new ore Lodestone's; a boulder's loose stone Lodestone's), a small
  cluster at the piece's foot, as PROF1's patches are the herb's own flat (law 6).
- **The dungeon veins** (section 6): `1 + hash % 4` a dungeon a UTC day, a dungeon named by DFU's own identity
  (`MapTableData.MapId & 0xfffff`, `mapsFile.js`), the id `dvein:<id>:<day>:<slot>`. Their table: Silver 3, Gold 4,
  Dwarven Scrap 4, Platinum 5, Adamantium 6, and Moonstone 4 in a Woodlands or HauntedWoodlands dungeon (4.1's deep
  veins); tiers 3-6 by the weights. They stand on the dungeon's own walls: from one of its foe markers (the layout's
  list, the same on every client) a ray at chest height along the slot's bearing through the dungeon's collider to the
  first near-vertical face within 12 m, the vein a third of a metre off it - the elite foes' clearance rays' precedent
  (`dungeonContext.js`). A dungeon a client's hash made (`spawned`) grows none. **The witnessed dungeon** (SEAT0 3.2's
  law, a second kind): a harvest carries the dungeon's climate and region, three accounts a week registered agreeing
  confirm it; a dungeon not confirmed is worth its least - tier 3 (Silver) and no gem - and, its id the client's word,
  an account works four veins a day in such dungeons (AUDIT 29: `DEEP_UNCONFIRMED_PER_DAY`; invented ids had mined
  Silver at any hour). Dungeon veins keep no hours, and
  Foraging's inside, settlement, daylight and sea checks are not asked there (5.1); the foe and the load are.
- **The act** (5.2): the Pick-Axe drawn as DFU's Warhammer (template 126), its strike DFU's own StrikeDown frames.
  Strikes 4 (tiers 1-2), 5 (3-4), 7 (5-6); a boulder is tier 1 (Rough Stone's). Five points on the node's face in a
  box around it (their bearings from its centre); one glints for **1.2 s** (**2.0 s** at Master) x the Pick-Axe's
  band ((INT + AGI) / 2, FORAGE0 14.4), then moves - after a strike too. Attack strikes (one a 0.45 s swing); with the
  crosshair within **2.5 degrees** of the glinting point it counts **double**. A **clean finish** is every strike on
  the glint. FACT: the Stores keep no quality (section 22), so the finish's "one quality step" waits for PROF3's
  quality; here a clean finish is the clean act (+50% XP), and on a boulder, or always for a Stonebreaker, it yields
  **Cut Stone** at the mason's 2 : 1 (the cut done at the rock; Quarryman's 1 : 1 is the bench's). A **gem**: 3% a
  strike on the glint (Prospector x1.1), by the node's climate (4.6: Amber, Jade, Turquoise, Malachite, one of Ruby,
  Sapphire, Emerald in the Mountain; a Diamond from a dungeon vein), on a confirmed pixel or dungeon only - the
  service rolls each, never past the strikes a finish needs. Gentle acts: every strike plain, no clean act, no gem.
- **The yields** (section 6's order): a vein 2-3, a boulder 3-5 Rough Stone; Deep Delver x1.5 on a dungeon vein; a
  march's +25% on a confirmed surface pixel; the Cut Stone cut; the fraction a chance. A gem is one, beside.
- **A gem's tier** (the Stores' and a writ's reference): DECIDED by its DFU price's band - to 10 gold tier 2 (Jade), to
  50 tier 3 (Malachite, Turquoise), to 100 tier 4 (Amber), to 250 tier 5 (Ruby), past it tier 6 (Sapphire, Emerald,
  Diamond).
- **The materials and their items.** A DFU metal withdraws as DFU's own MetalIngredients item, a gem as DFU's own gem;
  the new ores (610-615), ingots (620-630) and stone (673 Rough, 674 Cut) are registered custom templates (as the Sigil
  Stone 570 is, `gateSpoils.js`), their pictures DFU's own (an ore Lodestone's, 254/66; an ingot Iron's, 254/63; stone
  Lodestone's) recoloured by DFU's own law - FACT, GetItemImage's ChangeDye with the metal's DyeColor over the
  WeaponsAndArmor swatch (`systems/itemDye.js`, ItemHelper.cs:473-476) is how DFU colours an Ebony blade apart from an
  Iron one - an ingot its metal's dye, an ore its metal's; stone is Lodestone's lump as it is. Brass (DFU 67) is
  smelted, tier 2.
- **Smelting** (4.1): at a forge, no act - 2 of a raw metal make 1 ingot (Iron, Silver, and the six ores); Brass is 1
  Copper and 1 Tin; Steel is 1 Iron Ingot and 1 Charcoal (the recipe stands; Charcoal comes with Logging, PROF4).
  Smithing XP 10 x the product's tier a unit, under **the crafter's limit** (3.2 - a third craft past Journeyman stops
  at rank 50). An ingot is **own** only when every unit that made it was (bought units are spent first, section 7).
  Up to 100 a smelt. **The forge**: a Weaponsmith's or an Armorer's (50 gold a smelt, the use fee, paid from the purse)
  or a home's **forge** station - HOME-STATIONS grows a fourth craft (`DECOR_STATIONS`, its licence 50,000 gold as the
  alchemy station's - offered, sold and worked only where the Stores page is: online, the professions the account's, on
  the Enhanced skin, AUDIT 29). The Forge is a section of the Stores page (`ui/profPages.js`, the Enhanced pause menu;
  the classic skin's has no pages - **FLAGGED**), live while
  the player stands inside a Weaponsmith's or an Armorer's (`scenes/worldModes.js` forgeHere; the fee paid on the
  service's answer, never on a repeat) or their own home with a forge station, whose press opens the pause menu at
  the Stores page. FACT: the service cannot see the forge (as it cannot see the board, section 22): the inputs are the
  Stores' and their units are the bound.
- **The Court writs** ask metal and stone too: a witnessed pixel's vein metals (a confirmed pixel's all, an unconfirmed
  one's tiers 1-2), its region's signature ore on a confirmed pixel of that kingdom, and Rough Stone where its climate
  has boulders. Never an ingot, Cut Stone or a gem (smelted, cut or found, not the ground's). A metal's or stone's writ
  XP is Mining's.
- **The Prospector** (3.3): the veins stood within 200 m are marked on the compass, both skins, beside the party's
  marks (`ui/hud.js`, `ui/enhancedHud.js`). The held map's marks are not built (as PROF1's patches').
- **One gathering host.** FACT: the streaming world's Herbalism was one host (`scenes/herbHost.js`), and every
  gathering profession needs the same shell - a pixel's nodes stood, the nearest target, one prompt, one act, the book.
  DECIDED: the shell is `scenes/gatherHost.js`, each profession a kind in it (Herbalism's patches and Mining's veins and
  boulders now; Logging's trees, Hunting's bodies and Fishing's water later), one prompt and one act at a time.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`. The service is `acct20`; the tables are `0021_mining.sql`
  (`node_harvests` rebuilt for the kinds `ore` and `stone` and its `gem`; `world_witness` rebuilt for the kind
  `dungeon`; `prof_smelts`); the route `/v1/prof/smelt`. A harvest's decision is still one INSERT - the day's cap, the
  node untaken, the Stores' room - and a gem rides in it, nulled there when the gem's own Stores are full (the ore is
  still given). A smelt's decision is one INSERT too - every input held, the product's room, its bought units read
  before a unit moves - and the spends, the products and the Smithing XP follow it in the same batch.
- **The four hosts** (17.1). **The streaming world** stands every kind through `scenes/gatherHost.js`: Herbalism is
  `herbKind` (`scenes/herbHost.js`), Mining `mineKind` (`scenes/mineHost.js`). A built pixel carries its rock pieces
  (`rocks`: the boxes of World of Daggerfall's placements named `Rocks` or `Mountains` that stood - after the road's
  clearance - `world/worldOfDaggerfall.js` picks now carry their name). **The fixed city** - **FLAGGED by name**, as
  PROF1's. **Building interiors**: the forge (above). **Dungeons**: `scenes/dungeonContext.js` hands the host its
  identity (`MapId & 0xfffff`, none for a spawned dungeon), its wall ray (`veinWall`: from a foe marker at chest
  height, a near-vertical face within 12 m) and its own flats' doors; the mode machine tells the host a dungeon was
  entered (after the flip and its lock) and left (the veins dropped while the dungeon still stands, beside the quest
  foes' hand-over); E reaches a vein before the exit's press; the dungeon rig draws the act's tool and swings nothing
  while an act plays.
- **The tool in the hand**: the Pick-Axe as DFU's Warhammer (template 126), idle between strikes and StrikeDown's
  frames over each 0.45 s swing. **The Morrowind lane keeps its stance - FLAGGED**, as PROF1's Sickle.
- **Esc** ends an act in every mode now: PROF1's cancel sat under the exterior gate, so an act underground could not
  be let go; it sits above the mode gate (a fix found by PROF2's own dungeon).
- **A harvest asked twice** (FOUND, fixed): a harvest is kept before it is asked, and the book's pump - which asks kept
  harvests again - could ask one whose first ask was still on the wire; the service answered both as one (the id), but
  the answer was said twice. The book now keeps the asks on the wire (`net/profBook.js` `sending`) and the pump skips
  them.
- **A PROF1 pin that proved nothing half the time** (FOUND, fixed): the Stores-overflow pin's harvest rolled 1 to 3, and
  a roll of 1 fits one unit of room with or without the cut - its mutant survived at random. The pin steers the
  service's dice to their top.
- **Pinned**: `test/prof2_law.test.js` (11), `test/prof2_service.test.js` (9), `test/prof2_client.test.js` (14);
  `tools/mutants/prof2.json`, 40 mutants, every one dead. The done-when is `prof2_client`'s DONE WHEN: a confirmed
  Wayrest pixel's first vein stood at its rock piece is Mithril, mined through the real Worker, smelted at a forge into
  a Mithril Ingot and withdrawn as its registered template.

## 24. PROF3 - Smithing: the anvil, quality and provenance, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Lets keep moving"** (PROF3 after the merge of main). What the design above left open for PROF3, DECIDED here
(the record's, at Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF3 is.** 9.3's Smithing recipes - the weapons, the plate, the shields, the chain, Foraging's tools and the
  Repair Kit - made at **the anvil**, each with **the heat** (9.4) or a quick craft; 9.2's **quality**, rolled by the
  service; a **provenance id** and a **signed product record** for every piece (9.1); the recipe law
  (`src/net/recipeLaw.js`, section 14's name for it). Not here, named: found and writ-only recipes (the Recipe Scroll
  695 is PROF6's writs' and the Motherlode's, PROF2b), a seat's Forge step (SEAT1b), listing and trading a provenance
  item (PROF5, and TRADE1's hand-over, section 18), Disenchanting and enchanting a provenance item (PROF12).
- **The anvil is the forge's other half.** FACT: "the forge stands since PROF2" (section 15) - a Weaponsmith's or an
  Armorer's, or a home's forge station, the Stores page's Forge section (`ui/profPages.js`). DECIDED: the anvil stands
  wherever the forge does - smelting is the forge's, smithing the anvil's - as its own section of the Stores page (named,
  not pictured - as built, below). A smith's anvil asks the forge's use fee (50 gold a craft, the purse's,
  paid on the service's answer and never on a repeat - the smelt's rule); a home's asks none.
- **The fittings the professions do not yet yield** (FOUND): 9.3 asks Cured Leather of every blade from a Broadsword up
  and of every piece of plate, Oak Plank of the axes, hammers, shields and the Spade, Pine Plank of the tools, and
  Charcoal of Steel - Hunting (PROF7) and Logging (PROF4) come after this slice, so only a dagger or a shortsword could
  be made, and the done-when's Mithril Longsword not at all. DECIDED: **the smith's stock** - the forge's own counter
  (4.5's precedent: a counter's goods, **bought**, never own, a Marks sink, never purse gold - law 3) sells the four into
  the Stores at a smith's forge: **Cured Leather 4 Marks, Oak Plank 4, Pine Plank 2, Charcoal 2** (twice each one's
  Marks value - Cured Leather tier 2, the cure of 4.4's tier 1-3 hides; Oak 2; Pine and Charcoal 1 - so a gatherer's own
  will always undersell it once the professions come), up to 100 a purchase. So Steel is smelted now, and chain made.
  Their pack forms wait for their professions: the Stores hold them and the anvil and the forge spend them; the Stores
  page does not withdraw them until PROF4 and PROF7 register their templates (FACT: none of 645, 646, 652, 665 is a
  template yet). The service cannot see the forge (FACT, section 23): it sells wherever it is asked, and the client asks
  only at a smith's - a lie buys the same goods at the same price.
- **The recipes** (9.3), each a product at a metal: the weapons (Dagger, Tanto; Shortsword, Wakizashi; Broadsword,
  Saber, Longsword, Katana, Mace, Flail; Warhammer, Battle Axe, War Axe; Claymore, Dai-katana - DFU's templates 113-128
  but the Staff, a carpenter's), the plate (Cuirass, Greaves, Helm, Left and Right Pauldron, Gauntlets, Boots) and the
  shields (Buckler, Round, Kite, Tower - DFU 102-112), at the ingot's material: Iron, Steel, Silver, Elven (Moonstone),
  Dwarven, Mithril, Adamantium, Ebony, Orcish (Orichalcum) and Daedric; Warforged Steel counts as Ebony with a step
  (4.7). The chain pieces (the plate's seven, not the shields - DFU has no chain shield): the plate piece's ingots x
  0.75 rounded up, Steel only, nothing else. Foraging's tools at Iron (FORAGE0 14.7): the Wood-Axe and the Pick-Axe 2
  Iron Ingot and 1 Pine Plank, the Sickle 1 and 1, at rank 0; the Spade 2 Iron Ingot and 1 Oak Plank at rank 10 (the
  Skinning Knife is PROF7's, its template with it). The Repair Kit (692) at every metal: 1 of the metal's ingot and 1
  Cured Leather. A recipe's rank is its material's tier's (3.2: 0, 10, 25, 40, 55, 70, 90); every recipe unlocks by rank
  in PROF3 - the found ones come with the writs.
- **The quality** (9.2), rolled by the service's CSPRNG on the margin (the smith's rank minus the recipe's), then a
  step each, at most, for: a clean act (the honest bound: one step, 5.1); the family's specialisation (Weaponsmith the
  weapons; Armoursmith the plate, the chain and the shields); a Warforged ingot among the inputs. Nothing passes
  Masterwork. Masterwright's 5 points of Masterwork come off the row's lowest quality. A tool's quality is its life (FORAGE0
  14.7: Crude 37 uses, Standard 50, Fine 57, Superior 65, Masterwork 65 and the maker's mark; no Loot Rarity roll). A
  Repair Kit has no quality (DECIDED: it is measured by its work, a quarter of an item's condition, once) - and a
  Quartermaster's kit is two (3.3).
- **The piece** (9.2): DFU's own item, minted by DFU's own law (`combat/enemyEquipment.js` weaponOfMaterial,
  armorOfMaterial - its material, its value, its condition) and then the quality on it: Crude condition x0.75; Fine
  x1.15 and weight x0.95; Superior x1.30, x0.90 and one Loot Rarity **Magic** roll; Masterwork Superior's and one
  **Rare** roll and the maker's mark in its name ("Silverthorn's Mithril Longsword" - the Rare's powers stand, listed in
  its info; the mark is its name). The rolls are the record's seed's (`seededRng`, as a gate's and a raid's spoils are),
  so the piece is the record's on every client. It carries `quality`, `provenance` and `maker` (declared item fields,
  riding the save as Loot Rarity's `rarity` does - section 18).
- **The product record** (9.1): `p1.<claims>.<signature>` - the provenance id (16 hex digits, the service's CSPRNG,
  unique across the server), the account, the character, the recipe, the quality, the maker and the seed - signed with
  the account service's identity key (a raid receipt's shape, `net/raidReceipt.js`: the version inside the signed bytes,
  claim fields disjoint from every other signed shape's). The service keeps it in `products` (section 14: provenance,
  owner, template, material, quality, maker, made at) and the piece carries only its id - a signature is longer than the
  trade wire's string bound (FACT, `systems/loot.js` validLootItem: 128).
- **The heat** (9.4): at the anvil, the ingot's glow rises and falls; strike three times while it is in the band. The
  band's width is Smithing's attribute pair, (STR + AGI) / 2, on Foraging's four bands (5.1). Space, Enter or a click
  strikes; Esc lets the act go with nothing spent. Three strikes in the band are a clean act (one step); fewer are a
  plain craft. **Quick craft** skips the act; **Gentle acts** crafts plain; under reduced motion the glow is a still bar
  with the heat's marker.
- **The XP** (3.2): 20 x the recipe's tier a craft, +500 the first time the character makes the recipe, a quarter for a
  recipe more than two tiers below the rank's top, under the crafter's limit; answered as credited (AUDIT 29).
- **Quartermaster's ingots** (FOUND): 3.3's Quartermaster doubles ingots and Repair Kits; PROF2 shipped the smelt with
  the choice offered and the doubling unbuilt. A Quartermaster's smelt of an ingot yields two a unit now (Brass is a
  metal, not an ingot); the XP stays the smelt's.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`; the smith's stock behind MARKS1's too (`MARKS_OPEN`). The
  service is `acct23`; the tables are `0023_smithing.sql` (`prof_crafts`, a craft's row - its quality, its pieces' ids,
  its seed, the XP it credited and whether it was the character's first of the recipe; `products`, every piece's
  provenance, owner, maker, template, material, quality, seed and signed record; `prof_stock`, a purchase); the routes
  `/v1/prof/craft` and `/v1/prof/stock`. A craft's decision is one INSERT - every input held, the XP under the crafter's
  limit with the first craft's 500 read in the same statement - and the spends, the pieces and the track follow it in
  the batch, keyed on its nonce; a purchase's is one INSERT too (the Marks held, the Stores' room), its `stock` line in
  the one ledger and its bought units keyed the same way. The Stores refuse to withdraw the stock (`prof-no-pack-form`).
- **The law** is `src/net/recipeLaw.js` (the recipes, 307 of them; the quality's rows, steps and effects; the XP; the
  heat; the maker's name; a piece's lines) and `src/net/productRecord.js` (`p1`, minted by the service, read by the
  client, verified with the identity key); the smith's stock is `professionLaw.js`'s (SMITH_STOCK, withdrawable).
- **The piece** is `src/systems/smithItems.js`: DFU's mint, then the quality (the Loot Rarity roll off the record's seed,
  `wind.js` seededRng - the same generator the gate's and the raid's spoils roll with); `quality`, `provenance`, `maker`
  and a kit's `kitMetal` are declared item fields (`itemFields.js`). A Masterwork's long name is its mark before its
  material (`itemInfo.js` itemNameParts); a crafted piece's tooltip and card open with its quality and "Made by" line
  (`recipeLaw.js` pieceLines, `ui/itemScroller.js`, `ui/enhancedInventory.js`).
- **The book** (`net/profBook.js`) KEEPS a craft before it asks it - its pieces are the save's once the service answers,
  so a lost answer is asked again (the same id; the service's row answers the same pieces) and the pieces are minted on
  the answer, once: the tab that lets the craft go mints it (AUDIT 29 C5's law), and the host mints a piece only when the
  pack holds no piece of its provenance (`scenes/world.js` profMintCraft). A kept craft is settled where a kept
  withdrawal is (the Stores page opened, the book's settle). One craft at a time.
- **The anvil** is a section of the Stores page under the Forge (`ui/profPages.js` drawAnvil): the families (Weapons,
  Armour, Tools, Repair Kits) and the metals, each recipe with "can make now", "wants its inputs" or the rank it asks;
  the chosen recipe's inputs as the Stores hold them, and at a smith's forge a "Buy N from the smith" beside a short
  fitting; the odds at the smith's margin; **Craft** (the heat, unless Gentle acts) and **Quick craft**. The heat is a
  bar the glow's marker runs along with the band on it and the three strikes under it; Space, Enter or Strike strikes;
  "Let it cool" lets it go; the page shut under it lets it go too. The piece's picture of DFU's anvil (INVE's) is not
  drawn - FACT: the Stores page is the Enhanced menu's DOM, and DFU's container images are classic-window art
  (`ui/targetIconPanel.js`), so the section is named, not pictured.
- **The Repair Kit** (692) is registered with the ores and ingots (`systems/profTemplates.js`), DFU's Warhammer's world
  picture dyed by its metal. DECIDED: **used from the pack, it mends the most-worn weapon or armour of its metal** (the
  lowest share of its condition left, an equipped piece first on a tie) by a quarter of its condition, never past whole,
  and is spent; with nothing of its metal to mend it is kept and says so ("Nothing of Mithril here wants mending"). A
  Steel kit mends the chain too. No picker: DFU's use is one press, and the most-worn piece is the one a smith would take
  up first. Offline as online - a kit is the pack's (`scenes/shared.js` installs its use in every host).
- **Pinned**: `test/prof3_law.test.js` (6), `test/prof3_service.test.js` (5), `test/prof3_client.test.js` (7);
  `tools/mutants/prof3.json`, 59 mutants, every one dead. The done-when is `prof3_client`'s DONE WHEN: a Mithril
  Longsword's Cured Leather bought from the smith for Marks and the sword made at the anvil with a clean heat through the
  real Worker, its piece minted from the answer - DFU's template 120 at Mithril (5), its damage DFU's, its condition its
  quality's, its provenance the signed record's.

## 25. PROF4 - Logging, Carpentry and the furniture, as built (SHIPPED 2026-09-28, at `dev`)

Mac: **"Continue"** (PROF4 after PROF3). What the design above left open for PROF4, DECIDED here (the record's, at
Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF4 is.** Logging's trees in the streaming world with their act (the ring, the fall, the stump); the logs,
  planks, Charcoal, Resin and Heartwood (4.2) as materials and as items; sawing at a workbench and burning at a forge;
  Carpentry's recipes at **the workbench** (9.3) with its act (**the plane**, 9.4); the furniture into DECOR, where the
  owner sets it down (the done-when); the Ram Kit named; wood in the Court writs. Not here, named: the Harpy-feathered
  arrows (Hunting's feathers, PROF7), the Ram Kit's making and use (its Bear Hides are Hunting's, its siege SEAT2's),
  Siegewright (SEAT2), the held map's marks, "Craft x N" (9.3's third button - neither station has it yet).
- **FOUND - PROF3 left Smithing unpractised on the Professions page.** The page's list of practised professions
  (`ui/profPages.js` PRACTISED) held Herbalism and Mining alone, so Smithing's four specialisation cards stood locked
  and its pane still said "the rest of the craft comes later" - the service took the choice (`chooseSpec` asks no such
  list); the page never offered it. Smithing, Logging and Carpentry are practised now, each with its unlocks by tier.
- **The woods** (4.2), each climate's: Woodlands Oak and Cherry; MountainWoods Pine and Oak; Mountain Pine; Swamp Oak;
  Subtropical Cherry and Teak; Rainforest Teak and Mahogany, and Ironwood one tree in 20; HauntedWoodlands Ghostwood one
  tree in 20 - FOUND: 4.2 names no other wood there. DECIDED: a haunted wood is a woodland under its curse - its other
  nineteen trees are Woodlands' Oak and Cherry. The Desert stands none (section 6's count). A tree's tier is drawn over
  the tiers its climate's woods hold by section 6's weights renormalised, the wood evenly among that tier's; the rare
  wood's one in twenty is its own roll first, on a confirmed pixel only. **A pixel not confirmed is held to tiers 1-2**
  (section 6) - so an unconfirmed Rainforest or Subtropical pixel stands no tree at all until three witnesses vouch for
  it (a claimed Rainforest anywhere would otherwise be Teak on anyone's word); its herbs and veins bring the witnesses.
- **Where a tree stands** (section 6: "a tree flat for a tree"). FACT: the streaming world lays out Daggerfall's own
  nature flats per pixel from a seeded roll (`world/terrainNature.js` layoutNature - every client the same forest), one
  merged billboard batch per (archive, record) (`scenes/world.js`), and nothing kept which flat was a tree. FACT: World
  of Daggerfall names the nature records (`vendor/world-of-daggerfall/Scripts/LocationHelper.cs` billboards: 504's trees
  12-18, 25 and 30, its trunks 19-20, its logs 31; each climate archive's own), and a winter archive is its summer
  archive's records under snow (`world/climateSwaps.js`). DECIDED: a built pixel keeps its **tree flats** (the records
  that table names Tree, by the climate's summer archive), and a tree node stands AT the tree flat nearest its law point,
  one node a flat - **the player chops a tree of the forest**, not a tree added to it. A felled tree's own flat is sunk
  below the ground in its batch (the batch rewritten in place, `render/renderer.js` moveBillboardBatch) for the rest of
  the character's UTC day; on a pixel rebuilt, the node is gone and sunk again.
- **The act** (5.2): the Wood-Axe drawn as DFU's War Axe (template 128), its chop StrikeDownRight's frames (FORAGE0
  14.1). Chops 5 (tiers 1-2), 6 (3-4), 8 (5-6), Lumberjack two fewer, three at least. **The ring**: a circle shrinks from
  three times the notch's radius onto it over **0.9 s** and on past it; a chop while it stands within the band - **12%**
  of the notch's radius at Novice to **20%** at Master, x the Wood-Axe's band ((INT + STR) / 2, Foraging's pair, FORAGE0
  14.4) - is a **Clean Cut**, worth two chops. One chop a 0.45 s swing; the ring starts again after each. A **clean act**
  is every chop a Clean Cut. The tree creaks at half its chops. Gentle acts: every chop plain.
- **The fall**: on the service's answer the tree tips away from the player and fades over **1.5 s** (the flat's own
  picture on a one-flat batch, leaned about its root by a per-batch tip the billboard shader gains - `uTip`, 0 for every
  other batch), and its **stump** stands - the climate archive's Tree Trunk (record 19) where World of Daggerfall's table
  names one (504, 506, 508, 510), else nothing. **The logs at its foot** are DFU's own Logs flat (record 31) where the
  archive has one (504, 508), gone when the player walks over them - a sight, not a second door: the logs were the
  Stores' the moment the service answered (law 3). The answer is waited for, as every node greys only when the service
  confirms (section 19).
- **The yield** (section 6): a tree 2-4 logs, a march's +25%, the fraction a chance; **Resin** one tree in four (tier
  1, the service's dice, any ground); **Heartwood** 2% a Clean Cut (Forester x2), one at most, on confirmed ground only
  (a find, as a gem is). The act moves no logs - clean gives fewer chops, the Heartwood chance and the clean act's +50%
  XP. The service bounds the report: the Clean Cuts at most the finish's (every chop clean), a clean act only with every
  chop clean. The harvest row's second find is a new column (`node_harvests.extra` - the Resin); the Heartwood rides the
  gem's (a Clean Cut's find, as a glint's).
- **Heartwood** (4.2): FOUND - 4.8 gives it one template (654), so it is one material, not a tier-up plank of each wood.
  DECIDED: tier 4 (a rare find worth a Teak plank's price); in any recipe that asks a plank - a carpenter's or a smith's
  - one Heartwood may stand in for one plank, and it is 9.2's "Heartwood or a Warforged ingot" step: one step, never two
  with a Warforged ingot.
- **Sawing and burning** (4.2): no act, up to 100 logs a press, at no XP (DECIDED: a log's XP was its fall's; the forge's
  smelt pays Smithing because Smithing has no gathering of its own, and Logging does). A log saws to **2 planks** of its
  wood at a workbench (Timberwright 3); a log burns to **1 Charcoal** at a forge (Charcoal Burner 2) - the fire is the
  forge's, and Steel's Charcoal is wanted there. They ride the smelt's route and decision (`/v1/prof/smelt`, one table,
  `prof_smelts`), each recipe naming its station and the specialisation that multiplies it (a Quartermaster's ingots
  moved into the same rule).
- **The workbench** (9.3: "Carpentry (a workbench)"): FACT: DFU's towns hold Furniture Stores (building type 7) whose
  shelves sell DFU's furniture (`systems/shopStock.js`, DECOR2b's furnisher). DECIDED: a Furniture Store's workbench,
  open for trade, for **50 gold** a craft or a saw (the forge's fee), or a home's **workbench** station - HOME-STATIONS'
  fifth, its licence 50,000 gold as the forge's, offered only where the Stores page is. The Workbench is a section of the
  Stores page, live where it stands; its press at home opens the page, as the forge's does.
- **Carpentry's recipes** (9.3), each at its wood (the recipe's tier and rank its wood's): the **Staff** (DFU 115) 3
  planks; the **Short Bow** (129) 3 planks and 1 Resin; the **Long Bow** (130) 4 planks and 1 Resin - a staff's or bow's
  material is its wood's tier's (9.3: "the bow's or staff's material step is its wood's tier"): Pine Iron, Oak Steel,
  Cherry Silver, Teak Elven, Mahogany Mithril, Ironwood Adamantium, Ghostwood Ebony (DECIDED - the two tier-6 woods
  split between the tier's metals, the hard wood the hard metal, the dark wood the dark one). **Arrows**, twenty: 1 Pine
  Plank, 1 Iron Ingot and 4 Twigs - DFU's Twigs is a plant of both lands (both plant groups, `professionLaw.js`), so the
  Stores keep it twice and the recipe is two, the northern Twigs' and the southern's, as the Stores name them. **The
  furniture**, DFU's own templates in their own wood: the Large Tables (221-224) 6 planks, the Small Tables (225-228) 3,
  the Chairs (229-232) 2, in Oak, Cherry, Mahogany and Teak; the beds 8 planks and 2 Linen - FOUND: DFU's four beds name
  no wood; DECIDED: each is the wood of its place in DFU's own rarity column (Plain Single 1 Pine, Plain Double 2 Oak,
  Fancy Single 3 Cherry, Fancy Double 4 Teak). **The Basket** (Foraging's 1607, FORAGE0 14.7) 2 Pine Planks. **The Ram
  Kit** (690, rank 60): 40 Oak Planks, 20 Iron Ingots, 4 Bear Hides - named on the workbench and never made in PROF4:
  its hides are Hunting's (PROF7) and its use the siege's (SEAT2); the service refuses it (`prof-later`).
- **Linen** (4.5) is never gathered, and a bed asks two. FOUND: the Weavers' counter is the Market tab's (PROF5).
  DECIDED: until it stands, **the furnisher's stock** - the Furniture Store's counter, the smith's stock's precedent
  (section 24): a counter's goods, bought, for Marks burnt - sells Linen Bolt at 4.5's **2 Marks**. Its pack form waits
  for Outfitting, as Cured Leather's for Hunting.
- **The quality** (9.2) on Carpentry's pieces: the staff and the bows as the smith's weapons (condition, weight, a
  Superior's Magic and a Masterwork's Rare roll, the mark); **arrows take none** - FACT: DFU mints an arrow stack at
  condition 0 (`combat/enemyEquipment.js` createWeapon's arrow arm) and a quiver is one stack, so a quality has nothing
  to act on and a mark on one arrow would split the quiver; the arrows carry no provenance either (the service keeps its
  row), and Twigs' "one step lower" waits with the feathers. **Furniture**: its quality is its worth - the condition's
  multiplier on its value - and never a Loot Rarity roll (DFU enchants no furniture); a Masterwork carries the maker's
  mark, and every piece a **Master Joiner** makes does (3.3). The steps: the clean plane; **Bowyer** the bows (9.3's "bows
  and arrows", the arrows taking none); Heartwood. **Joiner**: furniture at half the planks, rounded up.
- **The plane** (9.4: "a steady drag along the grain, deviation scored as the trace is"): at the workbench the grain
  runs across a board, a gentle curve its own each act; the player presses at its head and drags to its foot. The score
  is the mean deviation from the grain against a tolerance - **18%** of the board's half-height, x Carpentry's band
  ((AGI + WIL) / 2 - DECIDED: a steady hand, Foraging's four bands) and widening to half again by Master (the trace's
  rule, 5.2); a pass whose mean deviation is within it, taking at least **1.2 s** and at most **4 s** (a plane is drawn,
  not flicked), is clean - one step. A pass let go early starts again. Quick craft skips it; Gentle acts planes plain.
- **The furniture goes to DECOR.** FACT: DECOR2b keeps a player's furniture in the save's `furnishings` (`scenes/
  worldModes.js` decorHome), its "Your things" rows, set down free as any model of its kind the owner chooses
  (`systems/decorFurnish.js`); a piece of furniture in the pack is never offered. DECIDED: a crafted table, chair or bed
  is minted into the furnishings, as the furnisher's delivery is, and DECOR places it - the done-when. **Its mark goes
  with it**: a set-down piece's descriptor (`net/decorLaw.js` decorItemOf) carries its provenance id, and the account
  service writes the maker's mark into the placed row only from its own `products` row - the owner's, the template's -
  so a visitor reads "Silverthorn's Oak Table" and no client can write a mark a craft did not make.
- **The XP** (3.2): Logging a tree's 15 x its tier (+50% clean, a quarter more than two tiers below); Carpentry a craft's
  20 x its tier, +500 the first, under the crafter's limit.
- **The Court writs** ask logs too: the witnessed pixel's trees' woods (a confirmed pixel's all, an unconfirmed one's
  tiers 1-2), never a plank, Charcoal, Resin or Heartwood (sawn, burnt or found, not the ground's). A wood's writ XP is
  Logging's.

As built:

- **Behind PROF1's switch.** `PROFESSIONS_OPEN`, at `dev`; the furnisher's Linen behind MARKS1's too (`MARKS_OPEN`). The
  service is `acct24`; the table changes are `0024_logging.sql` - `node_harvests` rebuilt to learn the kind `logs` and a
  second find, `extra` (a tree's Resin; its Heartwood rides `gem`, the act's own find), every column carried and both
  indexes made again; `prof_crafts.heartwood` (a craft that spent one); `products.marked` (a piece that carries its
  maker's mark - a Masterwork, or any a Master Joiner made). No new route: a tree is `/v1/prof/harvest`'s (kind `logs`),
  a burn and a saw are `/v1/prof/smelt`'s (the recipe names its station, the XP none), Carpentry's craft is
  `/v1/prof/craft`'s (the recipe names its profession - its rank, cap and track Carpentry's), the Linen is
  `/v1/prof/stock`'s (the counter `furnisher`), and a crafted piece is set down through DECOR's place route. The Ram Kit
  is refused before anything is spent (`prof-later`, 409: "That is made when the sieges come.").
- **The law** is `src/net/professionLaw.js` (the woods and their items; the ring's numbers; the burns, the saws, the
  workbench's fee; the stocks by counter and what has no pack form), `src/net/nodeLaw.js` (the climates' trees, the
  yield and its finds, the writs' woods), `src/net/recipeLaw.js` (Carpentry's 41 recipes beside the smith's 307; what a
  craft spends - the Joiner's planks, the Heartwood's plank; the steps; the mark; the plane) and `src/net/decorLaw.js`
  (a set-down piece's provenance and mark). One statement decides each act, as PROF1-3's do.
- **The trees** are the forest's own (`src/scenes/treeHost.js`): the streamed pixel keeps its nature flats' tree
  records and their batches (`scenes/world.js`), each law tree stands at the nearest one not already taken, and a felled
  tree's flat is sunk in its batch (`moveBillboardBatch`) - the stump (record 19) stood in its place and the Logs pile
  (record 31) at its foot until the player walks over it. The fall is the billboard shader's (`render/renderer.js`
  `uTip`: the way it falls, away from the player, and the angle it has leaned, over 1.5 s), its shadow dropped. The ring and its meter are
  `systems/chopAct.js` and `ui/profHud.js` (a bar under reduced motion); the Wood-Axe in the hand is DFU's War Axe.
- **The workbench** is a section of the Stores page beside the Forge and the Anvil (`ui/profPages.js` drawWorkbench):
  the saws of the logs held, the families (Staves, Bows, Arrows, Furniture, Tools, Siege) and the woods, each recipe's
  inputs as the Stores hold them, a bed's Linen bought from the furnisher, "Use a Heartwood" where a recipe takes one,
  **Craft** (the plane, unless Gentle acts) and **Quick craft**. It stands at a Furniture Store (50 gold a craft or a
  saw) or at a home's `workbench` station (DECOR, 50,000); away, the word says where. The Forge burns the logs held; the
  Anvil lists the smith's recipes alone. The plane is `systems/planeAct.js`, drawn on the board's grain.
- **The piece** (`systems/smithItems.js`): a staff and a bow DFU's at the wood's material with the quality laid on,
  arrows twenty in one stack with no provenance, furniture DFU's template worth its quality's condition multiplier and
  marked by its record; a marked piece's name is its maker's (`itemInfo.js`, `itemFields.js` `marked`). Furniture is
  minted into `playerEntity.furnishings`, never the pack (`scenes/world.js` profMintCraft), and DECOR's descriptor
  carries its provenance and mark (`systems/decorItems.js`).
- **Pinned**: `test/prof4_law.test.js` (8), `test/prof4_service.test.js` (6), `test/prof4_client.test.js` (8);
  `tools/mutants/prof4.json`, 87 mutants, 86 dead and one recorded equivalent (the chops' floor of three, which no
  tree's count reaches today). The done-when is `prof4_client`'s DONE WHEN: an Oak felled, its logs sawn at the
  workbench, a Small Oak Table made through the real Worker and minted among the home's things, listed by DECOR, set
  down in a home and read by a visitor with its maker's mark.

## 26. PROF5 - The Market: listings, regional markets, couriers, buy orders and history, as built (SHIPPED 2026-09-29, at `dev`)

Mac: **"Continue"** (PROF5 after PROF4). What sections 10.2-10.5 left open for PROF5, DECIDED here (the record's, at
Mac's instruction - "make the decisions ... This is your baby"), and what was found (FACT):

- **What PROF5 is.** The board's **Market tab** (10.1) and its five views - Materials, Crafted, My listings, Orders,
  History: a Stores material or a crafted piece listed at a price in Marks and bought whole (a material in part), the
  **regional markets** and their **couriers** (10.2, 10.4), **buy orders** (10.3), the **History** (10.2's 7-day
  medians and their lines), the weekly report's median prices (10.5), and **the Weavers' counter** (4.5). Not here,
  named: timed auctions (PROF5b); **the Tithe** - FOUND: no seat is held (SEAT1 builds holders), so a sale pays none
  and the law carries the Tithe's term at nought until SEAT1 sets it; Bandit Summer's doubled courier (SEAT0 9.3's
  Tides are not built); **the Apothecaries' counter** (4.5) - DECIDED: its sixteen ingredients are the brewing act's
  (9.3), so it stands with PROF12's Alchemy, where they have a use; TRADE1's hand-over of a provenance id (section 18,
  TRADE1's own slice); the guild Stores' listings; commissions (PROF6).
- **The Market tab** stands beside Notices and Work on every Notice Board, while the board, the professions and the
  Marks are all open to the account (`BOARD_OPEN`, `PROFESSIONS_OPEN`, `MARKS_OPEN` - DECIDED: no switch of its own,
  section 20 names three; the service's word when any is shut is `market-closed`). FOUND: the window learns its
  region only through the Work tab (`scenes/world.js` openNoticeBoard hands `region` inside `work`, null while the
  professions are shut) - the Market's region is handed to the window on its own.
- **A board's region is its town's** (`maps.getRegionIndexAt`, the board's pixel), and **a listing stands on every
  board of the region it was listed in** (10.2). FOUND: the service holds no ARENA2 and knows no town's region - the
  Court writs (PROF1) and the homes (HOME1) take the region from the client, bounded by `regionOk`. DECIDED: so does
  the market, and the threat is named (section 13): a client may say it stands at any board; what the lie buys is a
  fast travel's worth - the Stores are the character's in every town, so an honest player who travels buys "here" too
  - and the courier is the price of not going.
- **The courier's road is witnessed** (SEAT0 3.2, "every fact the servers need that only ARENA2 knows"). FOUND: the
  hubs are the client's alone (`systems/regionHubs.js`, HUB1) and the service holds no map pixel. DECIDED: a new kind
  in `world_witness`, **`hub`** - keyed by the region, its report the hub town's map pixel (`x,y`) - written by every
  market act that crosses regions, from a week-old registered account, both ends' hubs (each client derives every
  region's hub from its own MAPS.BSA, so it can witness both), as a harvest writes its pixel. The road between two
  regions is the distance between their hubs' pixels, each read as the witnesses say it is: confirmed, else the answer
  most give, else the asking client's own - the unconfirmed answer is taken as given, because the lie it could carry
  (a short road) buys nothing the region's lie does not. `world_witness` is rebuilt to admit the kind (SQLite widens
  no CHECK in place). A region with no hub has no board, so no listing and no buyer stand there.
- **The courier** (10.4): **ceil(ceil(units / 20) x (1 + pixels / 25)) Marks, at least 2** - the pixels the hubs'
  straight-line distance, rounded; a piece is one unit - **burnt**, paid by the buyer on top of the price; **the
  courier's time 15 minutes + 1 minute for every 10 pixels begun**. A listing in the buyer's own region travels no
  road: no fee, no wait.
- **A listing of a material** (10.2): from the Stores of the character at the board, **1-5,000 units** it holds, at a
  **unit price of 1 to 1,000,000 Marks**, for **72 hours**. The units leave the Stores at once, **bought ones first**
  (a craft's rule, section 7 - so a character's own stay for writs), and the split is kept on the listing, so a cancel
  or an expiry returns each unit with the origin it left with. **The listing fee**: 1% of the listing's whole worth
  (units x price), rounded up, at least 1 Mark, burnt on listing and kept on a cancel.
- **A listing of a crafted piece** (10.2, section 18): a piece with a provenance id, in the pack or among the home's
  things (crafted furniture not set down), whose id **this account owns** and which stands in **no other live listing**
  (the product's `listed`, and a unique index on the open listings' ids); **a whole price of 1 to 1,000,000 Marks**; 72
  hours; the same fee. **The piece leaves the save when it is listed**: the book takes it out and keeps it before it
  asks (ASYNC NEVER DROPS), puts it back on a refusal, and lets it go on the answer. Refused: an equipped piece
  ("Unequip that first."), a locked one (itemLock's line), a piece with no provenance ("Only a crafted piece, with its
  maker's record, lists on the market." - loot does not list, 10.2).
- **What the listing carries of the piece.** FOUND: `products` has no condition or enchantments (section 14's line
  deferred them to PROF5). DECIDED: the listing carries the piece's **wear** - its condition as a share of its most, in
  thousandths - and the buyer's piece is minted from its record with that share of its condition; a lie about wear is
  a Repair Kit's work bought for the listing fee (the piece listed "whole" and cancelled comes back whole), and the
  buyer reads the wear on the card before buying. FOUND: nothing enchants a crafted piece but its record's seed (a
  Superior's Magic roll and a Masterwork's Rare, re-rolled the same on every mint), so **no enchantments are carried**
  - the column waits for PROF12's enchanting, which is the first thing that can change them.
- **The limits**: **30 live listings an account** (materials and pieces together) and **20 live buy orders** (10.2,
  10.3); **60 postings an hour** (a listing or an order, section 20); **120 market acts an hour** besides (a buy, a
  fill, a cancel, a collect - the Marks' own hourly rate, `MARKS_OPS_MAX`).
- **Buying** (10.4: "the buyer always pays the listed price"): a material in part (1 to the units left), a piece
  whole; the buyer's own listing is refused (`market-own` - a cancel is the way back; wash-trading between one's own
  accounts stays allowed and visible, section 20). **Here** - the listing in the board's region - a material goes
  straight into the buying character's Stores as **bought** (the Stores' room decided in the same statement), and a
  piece comes to the pack (furniture to the home's things) on the answer, kept before it is asked and minted once.
  **Elsewhere** the goods go by courier: the sale is written with the time they arrive; a material enters the Stores
  on the buyer's first read after it (a full Stores keeps it at the counting-house, "waiting for room", until there is);
  a piece is collected by the buyer's book once it has arrived, kept and minted once the same way.
- **The seller is paid at the sale**, wherever they are: the price less **the sales tax - 5% of the sale, rounded
  down** (DECIDED: a one-Mark sale is not taxed to nothing; a tier-1 material is worth one Mark) - and less the Tithe
  (nought, above); refused only if it would carry the seller past the Marks cap (`market-seller-full`).
- **The owner moves at the sale.** A sold piece's `products.owner` becomes the buyer's account in the sale's own batch
  (section 18: "a market sale hands it over by itself"); `char_id` stays its maker's character. FOUND: `products`'
  owner cascades on the account's deletion, against section 20's "`products` forever"; DECIDED: rebuilt without the
  cascade - a piece's row outlives its owner's account, and an owner that is gone never lists it again.
- **Buy orders** (10.3): a material, **1-5,000 units**, a unit price of 1 to 1,000,000 Marks, posted at a board for
  **7 days**; **the Marks are escrowed when it is posted**, no fee (10.4 names none). Any character at a board of the
  order's region **fills it from its Stores**, in whole or in part, **bought units first**; the filler is paid the price
  less the tax from the escrow; the units reach the orderer's posting character's Stores **at once, as bought** (an
  order buys "here" - where it was posted), refused past that Stores' room (`market-order-full`). Its own poster may
  not fill it. A cancel or the seventh day returns the rest of the escrow.
- **The escrow is the ledger's.** FOUND: `marks_ledger`'s ends are `mint`, `account`, `guild` and `burn`, `account`,
  `guild` - there is nowhere for Marks held for an order. DECIDED: a third end, **`escrow`**, its id the order's: the
  ledger is rebuilt to admit it (every line carried, its four triggers made again); an escrow end moves no balance by
  trigger (as `mint` and `burn` do not), and the order row holds what is left of its escrow, moved in the same batch as
  each line. The market's kinds (`MARKS_KINDS`): **`market-fee`**, **`market-tax`** and **`courier`** burn;
  **`market-sale`** (buyer to seller), **`order-escrow`** (account to escrow), **`order-fill`** (escrow to filler) and
  **`order-return`** (escrow to account) move. Every one is decided in one statement keyed on its nonce, as PROF1-4's.
- **Cancel, expiry and removal.** A seller cancels a listing whenever it stands: a material's units return to the
  listing character's Stores (room permitting - a full Stores keeps them waiting as an arrival does), a piece comes back
  to the pack on the answer. **An expired listing** (72 hours) leaves every board at once and its goods return the same
  way on its seller's next read; an expired piece is collected like an arrival. **An expired order** returns its escrow
  on its poster's next read. Each return is keyed on its row's own id, so it happens once.
- **Reports and removal** (section 20: "a listing may be reported and removed the same way"): a registered reader
  reports a listing once; a listing carries no words, so reports hide nothing - they are counted for the moderators
  (`MODERATOR_HANDLES`, `DEVELOPER_HANDLES`), who see the count on the card and remove it, its goods returned. A mute
  stops no trade: a listing says nothing.
- **History** (10.2): every sale of a material adds its units at its unit price to the day's price table
  (`market_prices`, day x material x price); **a material's median is the unit price its middle unit sold at over the
  last 7 UTC days, across the Bay** (DECIDED: not a region's - a region's price is its own listings, which the card
  shows beside it), and **its line is the seven days' medians**, a small polyline on its card. The History view lists
  the week's traded materials, most units first (30), and "Your trades", this account's last 20 sales and purchases.
  The weekly report (`/v1/marks/report`) gains the medians of the twenty most-traded materials (10.5). Sales and prices
  are kept **90 days** (section 20), pruned on read.
- **The Weavers' counter** (4.5): **Linen Bolt 2** and **Wool Bolt 3 Marks** a bolt, into the Stores as bought -
  4.5's own prices (the smith's twice-the-value rule would make Wool 4); on the Market tab's Materials view, through
  PROF3's stock route (counter `weavers`). **Wool Bolt** (669, tier 2) is registered as Linen was, with no pack form
  until Outfitting. The furnisher's stock keeps its Linen (PROF4, section 25) at the same price, so the two counters
  never disagree.
- **The window** (10.1, section 21's Market wireframe): the Materials view - search, family, tier, sort by price
  (the courier counted for this board) - each row its units, its unit price, "here" or its region with "+N courier, M
  minutes", its median and line; the picked row's "Buy N for P Marks + C courier?" and **Your Marks** (the Marks book's
  balance - FOUND: the smith's stock answer never told the Marks book its balance; every market and stock answer does
  now). Crafted - each piece's name as its record mints it, its quality, maker and wear. My listings - this account's,
  with Cancel, the fee kept, and **List** (a Stores material, or a piece chosen from the pack and the home's things).
  Orders - the region's open orders with **Fill N from the Stores**, this account's with Cancel, and **Post an order**.
  History. **On the road**, atop the tab while anything travels: "40 Mithril Ore from Wayrest - 32 minutes".
- **The book** (`net/marketBook.js`) is the board's shape (a minute's cache of every read, a stale read marked) and the
  profession book's (a listed piece, a bought piece and a collected piece KEPT before they are asked, minted or put back
  once on the answer; one act at a time; every request gives up after fifteen seconds). FOUND: a kept craft (PROF3) was
  settled only when a withdrawal was kept beside it - `pendingCrafts` had no reader - so a craft whose answer was lost
  waited for an unrelated withdrawal; the Stores page settles either now, and the Market tab settles its own.
- **FOUND: PROF4's plane was drawn undressed.** Its board's SVG (`ui/profPages.js` planeBoard) carries the classes
  `prof-board`, `prof-grain`, `prof-trail`, `prof-boardhead` and `prof-plane`, and no rule in `src/` dressed them - an
  SVG polyline with no rule paints its fill black and its line not at all, so the grain was a black shape and the
  player's stroke invisible. Dressed here (`ui/enhancedPlusStyle.js` PROF_CSS): the board its height and
  `touch-action: none`, the grain and the trail as lines, the head a pale band.
- **The service** is `acct25`; `0025_market.sql` holds the listings, the sales (a purchase's row, its courier and its
  arrival), the orders and their fills, the price table, the reports, the deliveries (a piece's arrival or return) and
  the three rebuilds (the ledger's ends, the witness's kind, the products' owner). Routes `/v1/market/*`: `read`,
  `list`, `buy`, `cancel`, `order`, `fill`, `unorder`, `collect`, `report`, `remove`. The law is `src/net/marketLaw.js`
  (pure, both ends): the bounds, the fees, the tax, the courier and its time, the road, the median, the kinds.
- **The four hosts** (17.1): the streaming world wires the tab (the board's region and the hubs, the pieces minted
  into the pack or the home's things); the fixed city keeps DFU's board (NOTICE1's flag); the interiors and dungeons
  have no boards.
- **Done when**: a crafted Mithril Longsword listed at a board in one region is bought at a board in another by a
  second account - the courier's fee burnt, the sword on the road, then collected into the buyer's pack, DFU's own piece
  with its quality and its wear, its owner moved - and Mithril Ore bought the same way reaches the buyer's Stores after
  its courier's time.

As built:

- **Behind three switches.** The market is open where `BOARD_OPEN`, `PROFESSIONS_OPEN` and `MARKS_OPEN` all are, at
  `dev` (server-account/src/market.js marketOpenFor); the service is `acct25`, its table changes `0025_market.sql` (section
  14's line, BUILT). Ten routes, `/v1/market/*`; every act one statement keyed on its nonce, its row looked for before the
  switch; every read, and a listing or an order before it is posted, settles its own account's expired listings and
  orders and arrived loads first, one row a batch, twenty at a time.
- **The law** is `src/net/marketLaw.js` (pure, both ends: the bounds, the fees, the tax, the Tithe's nought, the
  courier and its time, the road witnessed, a piece's wear, the median and its line, the catalogue); the ledger's seven
  market kinds are `marksLaw.js`'s; the witness law is nodeLaw.js `witnessedFact`, which now reads another kind's report
  by a `parse` handed to it (a pixel's by default, a hub's pixel for the road). Wool Bolt and the Weavers' counter are
  `professionLaw.js`'s.
- **The window** is the board's (`ui/noticeWindow.js`): the Market tab beside Notices and Work while the market is the
  account's, drawn by `ui/marketTab.js` (the one constructor, the window's alone), its acts through the window's
  one-at-a-time door and status line; the tab is read on its first showing, the kept acts settled and the arrived pieces
  collected first. The host (`scenes/world.js` openNoticeBoard) hands it the board's region, every region's hub as this
  client derived it, the Stores, the pieces that may be listed (in the pack, not worn, locked or bound - TRADE1's
  refusals - and the home's crafted furniture not set down), and the mint - a piece from its record at its wear, into
  the pack or the home's things, once by its provenance id.
- **The book** is `net/marketBook.js`; every answer's balance goes to the Marks book, so the Bank's counter and the
  account card read the same Marks.
- **Pinned**: `test/prof5_law.test.js` (7), `test/prof5_service.test.js` (8), `test/prof5_client.test.js` (6);
  `tools/mutants/prof5.json`, 109 mutants, 106 dead and three recorded equivalent (the listing fee's floor, which no
  listing's worth reaches; the catalogue's filter, which every key passes today; a reader's report count, dropped twice).
  The done-when is `prof5_client`'s DONE WHEN, through the real Worker.

## Appendix A - a day of a gatherer

Ilsa, a Journeyman herbalist and Apprentice miner in Anticlere (a march), sets out at seven, when the wilderness opens. The board's Work tab has a
Court writ for 30 Red Poppies (uncommon, tier 2: 30 x 2 x 1.2 = 72 Marks) and the Market's poppy median is 3. She walks
the woods east of town: Woodlands pixels, four herb patches each. Kneeling at a Red Rose she holds the sickle steady -
the meter fills, unbruised. By noon she has 34 Red Poppies (the march's +25%), 60 of 60 of today's herbs, and some 1,800
Herbalism XP. She delivers 30 poppies at Anticlere's board (72 Marks and 150 Renown XP; a Court writ gives no
influence - only a seat's own writs do), lists 4 Golden Poppies at 12 Marks each, and spends the afternoon at the vein
on the hill: an Iron vein, the march's +25% on it - two strikes, both on the glint (a clean finish), and an Amber (Woodlands' gem).
At dusk the hub warns of a Motherlode in the Wrothgarian foothills in ten minutes; she is too far. Tomorrow.

## Appendix B - every number

| Name | Value |
|---|---|
| Template range | 600-699 (the Skinning Knife 603; the other tools are Foraging's 1600-1603, 1607) |
| Ranks | Novice 0, Apprentice 25, Journeyman 50, Expert 75, Master 100 |
| XP to rank n | 10 x n^2 |
| XP a harvest / a craft / a first craft / a writ | 15 x tier (+50% clean; a quarter for a node or recipe more than two tiers below the rank's top) / 20 x tier x units / +500 / 2 x Marks value; answered as credited (AUDIT 29) |
| Tier ranks | 0, 10, 25, 40, 55, 70, 90 |
| Crafts above Journeyman | 2 |
| Respecialisation | 1,000 Marks, 7 days |
| Marks value by tier | 1, 2, 4, 6, 9, 14, 40; herbs 1 / 2 / 5 |
| Daily caps | 60 harvests a gathering profession a character (the Basket's among Herbalism's), and 120 an account (AUDIT 29 - a character is an id the client names); 4 dungeon veins an account in dungeons nobody has vouched for (AUDIT 29); Fishing 40 hauls an account; Hunting 30 hides an account, 3 of tiers 5-6 |
| Node tiers | 40 / 25 / 15 / 10 / 6 / 4 % |
| Dungeon veins | 1-4 a day |
| Motherlodes | 3 a day, 20 characters, 10 Marks, one an account a day, 10 (30) minutes' warning; no hours |
| Yields | tree 2-4, vein 2-3, herb 1-3, Basket 1 / 1-2 / 1-3, hide 1, haul 1-2, boulder 3-5; order: base, act (x1.5 at most), march +25%, Tide, school +1 (Netter +2); a fraction is a chance |
| Act bound | one quality step, +50% yield |
| Foraging's checks | inside, settlement, daylight 07:00-17:59 (checked by the service; not dungeon veins, Motherlodes, gate-touched veins, Hunting), sea, foe near, encumbered (FORAGE0 14.3) |
| Harvest hour | the act's end, at most 10 minutes past |
| Act bands | x0.85 / 1.00 / 1.15 / 1.30 by Foraging's attribute pair |
| Tool wear | 1 an act; 50 harvests a Standard tool |
| Tools crafted | Wood-Axe, Pick-Axe 2 Iron Ingot + 1 Pine Plank; Sickle, Skinning Knife 1 + 1; Spade 2 Iron Ingot + 1 Oak Plank (rank 10); Fishing-Net 2 Linen Bolt; Basket 2 Pine Plank; lives Crude 37, Standard 50, Fine 57, Superior 65, Masterwork 65 |
| Skinning Knife | 603: 0.5 kg, 50 HP, 100 gold, rarity 10; online shelves only |
| Smelting | 2 raw -> 1 ingot; Steel 1 Iron Ingot + 1 Charcoal; Brass 1 + 1; Smithing 10 x tier XP an ingot (a quarter more than two tiers below the rank's top, AUDIT 29), under the crafter's limit |
| Logging | chops 5 / 6 / 8, ring 900 ms, band 12-20%, Heartwood 2% |
| Mining | strikes 4 / 5 / 7, glint 1.2-2 s, gem 3% |
| Herbalism | common 0.8 s, steady 2.5 s, 3 degrees |
| Hunting | trace 5-9 points, clean 0.8, torn 0.4 |
| Fishing | throw 0.3-1.5 s / 3-12 m, wait 5-30 s (first and last daylight hour x0.5, storm x2), tug 600 ms, band 20-30%, 20 s, slip 2 s; pearl 1/50, slaughterfish 1/100, trophy 1/200; Raw Fish tier 1, 1 Mark |
| The Basket's food | tier 1, 1 Mark; 15 XP, 22 with all three found (the clean act) |
| The Basket | three glints of 1.0-1.4 s; clean +50%, two +25% |
| Stores cap | 5,000 a material |
| Board's counters | Linen 2, Wool 3 Marks a bolt (the Weavers', PROF5 - 100 a purchase, bought units, no pack form); the Apothecaries' sixteen at a fifth of DFU's price in Marks, rounded up (4.5; with PROF12) |
| Quality | the margin table (9.2); a step each, at most, for a clean heat, the family's specialisation and a Warforged ingot; Masterwright +5 Masterwork off the row's lowest (PROF3) |
| The heat (PROF3) | three strikes; the glow's breath 2.0 s; the band from 0.62, 0.2 wide x (STR + AGI) / 2's band; 0.35 s between strikes |
| The smith's stock (PROF3) | Cured Leather 4, Oak Plank 4, Pine Plank 2, Charcoal 2 Marks a unit (twice the Marks value), 100 a purchase, bought units |
| A piece's quality (PROF3) | condition x0.75 / 1 / 1.15 / 1.30 / 1.30; weight x1 / 1 / 0.95 / 0.90 / 0.90; Superior a Magic roll, Masterwork a Rare roll and the maker's mark; a tool's life 37 / 50 / 57 / 65 / 65 |
| The Repair Kit (PROF3) | 1 ingot + 1 Cured Leather; a quarter of the most-worn piece of its metal, once; a Quartermaster's two; 10 gold + 10 a tier |
| The woods (PROF4) | Pine 1, Oak 2, Cherry 3, Teak 4, Mahogany 5, Ironwood 6, Ghostwood 6; Ironwood and Ghostwood one tree in 20, confirmed ground only; an unconfirmed pixel's trees tiers 1-2 |
| A tree (PROF4) | 2-4 logs (+25% a march); Resin one tree in four; Heartwood 2% a Clean Cut on confirmed ground, a Forester's 4%, one at most; Logging XP 15 x the tier |
| The ring (PROF4) | chops 5 (tiers 1-2), 6 (3-4), 8 (5-6), a Lumberjack's two fewer, three at least; the circle from 3x the notch to it over 0.9 s and on to 0.5x; the band 12% (novice) to 20% (Master) of the notch x (INT + STR) / 2's band; a Clean Cut two chops; a swing 0.45 s; the creak at half; the fall 1.5 s |
| Burning and sawing (PROF4) | a log a Charcoal at a forge (a Charcoal Burner's two); a log two planks at a workbench (a Timberwright's three); no XP |
| The workbench (PROF4) | a Furniture Store's, 50 gold a craft or a saw; a home's `workbench` station, 50,000 gold |
| Carpentry's recipes (PROF4) | staves 3 planks; short bows 3 and a Resin; long bows 4 and a Resin (DFU material by the wood: Pine Iron, Oak Steel, Cherry Silver, Teak Elven, Mahogany Mithril, Ironwood Adamantium, Ghostwood Ebony); arrows 20 of a Pine Plank, an Iron Ingot and 4 Twigs, no quality; tables 6 and 3 planks, chairs 2, beds 8 and 2 Linen; the Basket; the Ram Kit rank 60, later (SEAT2); XP 20 x the tier, +500 the first |
| Carpentry's choices (PROF4) | Joiner: furniture at half the planks, rounded up; Bowyer: a step on the bows; a Heartwood: one plank and a step (one step with a Warforged ingot, never two); Master Joiner: every piece of furniture marked |
| The plane (PROF4) | tolerance 18% of the board's half-height x (AGI + WIL) / 2's band, x1.5 at Master; a pass 1.2-4 s, from the head (x <= 0.08) to the foot (x >= 0.98) |
| Furniture's quality (PROF4) | its value x its condition multiplier; no Loot Rarity roll; a Masterwork or a Master Joiner's piece marked |
| The furnisher's stock (PROF4) | Linen 2 Marks a unit, 100 a purchase, bought units; Linen, Cured Leather and Bear Hide have no pack form |
| Station use fee in town | 50 gold |
| Alchemy | 2 / 3 potions; Potent +25%, 10% / 20%, +5% an unbruised herb |
| Enchanting | -10% / -20%; 1 Essence per 100 points |
| Listings | 72 h, 30 an account, 1-1,000,000 Marks (a material's a unit, a piece's whole), 1-5,000 units; buy orders 20, 7 days; 60 postings and 120 market acts an hour (PROF5) |
| Fees | listing 1% of the listing's worth, rounded up (min 1); sales tax 5%, rounded down (PROF5); the Tithe 0-10% / 0-15% from the seller, across the bailiwick (nought until SEAT1 holds a seat); courier ceil(ceil(units / 20) x (1 + px / 25)), min 2, px the hubs' straight line rounded; courier's time 15 min + 1 min per 10 px begun |
| The History (PROF5) | a material's median: the unit price its middle unit sold at over 7 UTC days, across the Bay (an even count's two middle units' mean); its line the seven daily medians; 30 materials shown, 20 trades; kept 90 days; the weekly report's 20 most traded |
| A piece's wear (PROF5) | its condition over its most, in thousandths (1-1,000); the buyer's piece minted at that share, at least 1 |
| Marks | ~10 gold of play; balance cap 10,000,000; Bank: 1 Mark -> 8 gold, 300 a day |
| Faucets | Court writs 3 a day (from PROF1); gate 50 a receipt, 2 a UTC day; Honours 50 / 25; Motherlode 10, one a day |
| Court writs | 6 x max(1, ceil(active / 100)) a region a day, witnessed materials only, 10-50 units, pay x 1.2, Renown 25 x tier x units / 10 |
| Writ influence | own units at their value, from a 7-day member bound to the guild; bought at Tribute's rate in its cap; counter goods never; a Siege Camp spent at the Turning (a Ram Kit to the siege it won, the rest burnt) |
| Player notes | 3 an account, 7 days; 30 a board |

## Appendix C - the economy model

The numbers above were not guessed. A deterministic model (a seeded Monte Carlo of a week of play, 400 runs a row)
was run over three player profiles and the whole table, and the table was retuned until it balanced. SEAT1d ships
the model as a tool reading townSeatLaw.js and professionLaw.js directly (to be written), so every later balance pass
is re-run, not re-guessed.

**The players** - a guild's members are 35% casual, 45% regular, 20% hardcore:

| Profile | Sessions a week | In the seat town a session | Harvests a session | Writs a session | Gates felled a week | Renown XP a week |
|---|---|---|---|---|---|---|
| Casual | 3 | 20 min | 20 | 1 | 0.3 | 3,000 |
| Regular | 5 | 30 min | 45 | 2 | 1.5 | 9,000 |
| Hardcore | 7 | 60 min | 90 | 4 | 4 | 25,000 |

Each member does 60% of their play in the pledged region, gathers 2.5 units a harvest at 2.5 Marks a unit on
average, and sends a quarter of it to the Siege Camp.

**The fold (FORAGE0, second review)** changed two assumptions, and the table below is the re-run: **the wilderness
keeps Foraging's day** - a session's surface harvests happen in the 55 daylight minutes of each 120, and the night
gathers at half the day's rate (dungeon veins, Hunting), so harvests run at 55/120 + 65/120 x 0.5 = **0.73** of the
old count; and **Court writs are a fixed supply** (45 regions x 6 x max(1, ceil(active / 100)) a day), which the
first model had let grow with demand - fixed at 270 a day, three hundred accounts would have minted too few (0.57).

**What the first table did** (Court writs 5 a day at x1.5; palace upkeep 1,000; crown 10,000): Marks were minted at
**2.3 times** the rate they were burnt, and a palace's upkeep was 6% of a twelve-member guild's writ income - a
seat that cost nothing. **The retuned table** (writs 3 a day at x1.2, 10-50 units; claim 6,000 / 30,000 influence and
8,000 / 80,000 Marks; upkeep 2,500 / 15,000 with the crown's scale; the Bank's exchange 300 a day):

| Guild size | Influence a week (p10 / p50 / p90) | Writ Marks a week (p50) | Palace upkeep, of that | Crown upkeep, of that |
|---|---|---|---|---|
| 5 | 2,505 / 4,432 / 6,479 | 4,325 | 58% | 347% |
| 8 | 4,726 / 7,249 / 9,737 | 7,057 | 35% | 213% |
| 12 | 7,643 / 10,762 / 13,723 | 10,452 | 24% | 144% |
| 20 | 13,687 / 17,513 / 20,774 | 17,416 | 14% | 86% |
| 30 | 21,834 / 25,987 / 30,201 | 26,464 | 9% | 57% |
| 50 | 36,270 / 42,151 / 48,517 | 43,738 | 6% | 34% |

What the table means, and why each number is where it is:

- **A palace (6,000)** is within a regular eight-member guild's median week; a guild of five reaches it by sending
  more of its gathering to the Siege Camp. Holding one costs a twelve-member guild a quarter of its writ income - a
  real commitment, not a tax nobody notices.
- **A crown (30,000)** needs a thirty-member guild in a good week (its p90 is 30,201) or a forty-member guild at its
  median: the three
  crowns belong to the server's largest powers, as a capital should. Its upkeep is more than half of such a guild's
  writ income - so a crown is held by being loved (the Tithe, Conscription, vassals' tribute), not by grinding alone.
- **The whole server** (a hundred active accounts, twelve palaces and a crown held, 40% of gathering sold on the
  market, a third of players using the Bank's exchange): Marks minted / burnt = **1.00**. At fifty accounts **0.83**,
  at three hundred **0.81** - gently deflationary at the edges, which is safe, because the Bank's exchange is a
  voluntary valve: players stop selling Marks for gold when Marks grow scarce.
- **Scaling every seat's upkeep** with the server was tried and rejected: seats held already grow with the server, so
  it counted the growth twice (at three hundred accounts **0.73**, against 0.81; re-run with the fold). Only the crown's fixed cost is out of proportion on a small
  server, so only the crown scales (SEAT0 7.1).

**What the model leaves out**: on the faucet side the Motherlodes (10 Marks, one a day) and the Honours (50 / 25); on
the sink side the Tribute, the forts, Festivals, heraldry, respecs and the Board's counters. Each is small beside the
writs and the Bank's exchange, and all of them are in the weekly report the re-run below reads.

MEASURED: the model's players are assumptions. After four weeks of MARKS1 the weekly report (10.5) replaces them
with the server's own, and the model is re-run on those.
