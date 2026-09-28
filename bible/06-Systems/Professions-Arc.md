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

Every number below lives in one of three pure law modules (to be written): src/net/professionLaw.js (tracks, ranks,
caps, acts, quality), src/net/recipeLaw.js (every recipe as data) and src/net/nodeLaw.js (the nodes). Appendix B
lists them in one place.

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
- **Hunting cannot be witnessed** - FACT, a foe's life and death are its spawner's client's alone ("the relay reads
  none of this", WORLD6b). So Hunting is the one bounded profession: at most **30 hides a day** an account, of which
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
  (`server-account/migrations/0016_marks.sql`), every movement decided in one statement (`server-account/src/marks.js`);
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
  JOURNAL1's door); a duel's is DUEL1's own challenge when the author stands within reach, else the letter. A
  recruitment note names its guild, and only a rank that may invite (Guildmaster, Officer) pins one; a guild that is
  gone leaves its notes standing without the button. Commissions come with PROF6.
- **The author is the handle** (the letter's `from` rule): no account id leaves the service on a note.
- **Reports** - new here (MAIL1 has none): a registered reader reports a note once and stops seeing
  it at once; the third reporter hides it from everyone until a moderator removes it or restores it (a restored note is
  not hidden again). Moderators (`MODERATOR_HANDLES` and `DEVELOPER_HANDLES`) see a hidden note with its count and its
  id, and remove it from the window or with `/note remove <id>` anywhere. A mute stops a pin and takes the author's
  notes off every board while it stands.
- **The server's word**: a developer posts a notice to every board for 1 to 14 days. The gate's card is composed on
  the client from the law every client reads, so it needs no row.
- **The count over a board**: "3 new", in the name layer's face and law (`src/net/remotePlayers.js` nameFrame's
  `extra`), over a Notice Board within 40 metres, in front and in sight, whose town has notes this device has not
  read; reading the board sets it to nought (`src/net/noticeBook.js`, the newest 200 towns remembered).
- **Failures** (section 19): a minute's cache - of every answer, a refusal too, so a town stood in at `dev` is one read
  a minute, not one a second; a slow service shows the last good board, marked; every write carries
  its request id and a lost answer is asked again with it - never two notes - and a second press while one is in
  flight is the same press.
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
the names' pass, the measure. `tools/mutants/notice1.json`, 26 mutations, 26 dead.

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

- `prof_tracks` (player, char_id, profession, xp, spec50, spec100)
- `prof_stores` (player, char_id, material, origin, qty); `guild_prof_stores` (guild_id, material, origin, qty) with
  its ledger - `origin` own or bought (section 7)
- `node_harvests` (day, node_id, kind, player, char_id) - a day's rows droppable after the day; `fish_hauls` (day,
  account, n) for the account cap
- `recipes_known` (player, char_id, recipe)
- `products` (provenance PK, template, material, quality, maker, made_at, listed, condition, enchantments JSON) - a
  listing writes the item's condition and enchantments as the pack held them, and the buyer receives exactly that
- `marks` (account, balance); `guild_marks` (guild_id, balance); `marks_ledger` (seq, from, to, kind, amount, at)
- `market_listings` (id, region, seller, material or provenance, qty, price, expires_at); `market_orders`;
  `couriers` (buyer, goods, arrives_at)
- `writs` (id, kind, poster, region, key, material, qty, pay, escrow, expires_at, filled)
- `board_notes` (id, map_id, author, text, button JSON, expires_at)
- Endpoints: `/v1/prof/*` (harvest, craft, spec), `/v1/stores/*`, `/v1/marks/*` (balance, exchange, guild),
  `/v1/board/*` (notes), `/v1/market/*`, `/v1/writs/*`.
- Law modules (pure, shared by client and service): professionLaw.js, recipeLaw.js, nodeLaw.js (to be written).
- The relay: the activity field on the pose (a `RELAY_VERSION` and LAW row); the in-person check for deliveries.

## 15. The slices, in order

| Slice | What | Done when |
|---|---|---|
| **PROF0** | This record | - |
| **MARKS1** - SHIPPED 2026-09-28 (at `dev`) | Marks: balances, the guild Marks treasury, the ledger, the Bank's exchange, the weekly report; the first faucet is the gate's receipts (Court writs come with PROF1's Stores - a writ filled from the pack would be a save item bought with Marks) | Every faucet capped and pinned; gold never becomes Marks, pinned |
| **NOTICE1** - SHIPPED 2026-09-28 (at `dev`) | The Notice Board (10.7): a town's rumour boards open it online (BOUNTY1's bounty boards stay the hunts), the rumour pinned first and the bounty board's line under it; the server's word; the Notices tab; player notes, their button, reports and moderation; the count over the board. The Work tab moved to PROF1 | Offline a rumour board is byte-for-byte DFU's (the ROAD A9 pins hold) |
| **NOTICE1b** | Boards stood where a hub lacks one (10.1), if `tools/boardCount.mjs` names any; a seat's with SEAT1 | Mac's run of the measure |
| **PROF1** | The Stores; **Herbalism** with its act; the board's **Work tab**; the Professions and Stores tabs, the prompt, the meter, the toasts; the Sickle and the Basket's search; withdraw to pack; **Court writs** (section 11); FORAGE0 law 6's online exception - the six tools shelve online whatever the switch says. **Needs FORAGE1-2 (shipped)**, MARKS1 and NOTICE1 (FORAGE0 17) | An herb picked online reaches DFU's potion maker by the pack |
| **PROF2** | Mining and Quarrying with their acts; smelting; ores and ingots (610-630) | Veins placed on rock fields; signatures by kingdom. Needs FORAGE1-2 (shipped: the Pick-Axe) |
| **PROF3** | Smithing with its act; quality; provenance; the forge | A crafted Mithril Longsword is DFU's, with its quality |
| **PROF4** | Logging with its act (the falling tree); Carpentry; furniture; the Ram Kit | DECOR places a crafted table. Needs FORAGE1-2 (shipped: the Wood-Axe) |
| **PROF5** | The Market tab: listings, regional markets, couriers, buy orders, history | Needs MARKS1, NOTICE1, PROF3 |
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
| `scenes/exterior.js` - the fixed city | The board of its one city. **FLAGGED by name**: no nodes - a fixed city has no wilderness around it and no streamer to place them |
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
| **A SLICE CLOSES ITS LEDGER ROW** | MARKS1, NOTICE1 and PROF1 each add their Port-Ledger section A row (A SERVER CURRENCY; THE BOARD, ONLINE; PROFESSIONS); later slices narrow them |
| **THE RELAY VERSION** | The activity field on the pose and the in-person check are relay changes: a `RELAY_VERSION` and a LAW row each |

## 18. Lifecycles and edge cases

- **A character is deleted**: its Stores, tracks, specialisations and recipes go with it (the delete dialog lists
  them); its Marks stay, because Marks are the account's.
- **An account is deleted**: its Marks go; its live listings are cancelled and their goods burnt; its buy orders'
  escrow is burnt; a guild it led runs GUILD1's `succeed()`.
- **A guild disbands**: refused while its gold treasury, its Marks treasury or its guild Stores hold anything (GUILD1's
  rule, grown two clauses) and while it holds a Charter (SEAT0 16).
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
  `dev` only the dev glyph sees them. `MARKS_OPEN` stands (MARKS1, `server-account/wrangler.toml`), shipped at `dev`. Season 0 (SEAT0 18) is the professions' beta too: Marks, the Stores and tracks
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
| XP a harvest / a craft / a first craft / a writ | 15 x tier (+50% clean) / 20 x tier x units / +500 / 2 x Marks value |
| Tier ranks | 0, 10, 25, 40, 55, 70, 90 |
| Crafts above Journeyman | 2 |
| Respecialisation | 1,000 Marks, 7 days |
| Marks value by tier | 1, 2, 4, 6, 9, 14, 40; herbs 1 / 2 / 5 |
| Daily caps | 60 harvests a gathering profession a character (the Basket's among Herbalism's); Fishing 40 hauls an account; Hunting 30 hides an account, 3 of tiers 5-6 |
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
| Smelting | 2 raw -> 1 ingot; Steel 1 Iron Ingot + 1 Charcoal; Brass 1 + 1; Smithing 10 x tier XP an ingot |
| Logging | chops 5 / 6 / 8, ring 900 ms, band 12-20%, Heartwood 2% |
| Mining | strikes 4 / 5 / 7, glint 1.2-2 s, gem 3% |
| Herbalism | common 0.8 s, steady 2.5 s, 3 degrees |
| Hunting | trace 5-9 points, clean 0.8, torn 0.4 |
| Fishing | throw 0.3-1.5 s / 3-12 m, wait 5-30 s (first and last daylight hour x0.5, storm x2), tug 600 ms, band 20-30%, 20 s, slip 2 s; pearl 1/50, slaughterfish 1/100, trophy 1/200; Raw Fish tier 1, 1 Mark |
| The Basket's food | tier 1, 1 Mark; 15 XP |
| The Basket | three glints of 1.0-1.4 s; clean +50%, two +25% |
| Stores cap | 5,000 a material |
| Board's counters | Linen 2, Wool 3 Marks a bolt; the Apothecaries' sixteen at a fifth of DFU's price in Marks, rounded up (4.5) |
| Quality | the margin table (9.2) |
| Station use fee in town | 50 gold |
| Alchemy | 2 / 3 potions; Potent +25%, 10% / 20%, +5% an unbruised herb |
| Enchanting | -10% / -20%; 1 Essence per 100 points |
| Listings | 72 h, 30 an account, 1-1,000,000 Marks; buy orders 20, 7 days |
| Fees | listing 1% (min 1); sales tax 5%; the Tithe 0-10% / 0-15% from the seller, across the bailiwick; courier ceil(units / 20) x (1 + px / 25), min 2; courier's time 15 min + 1 min per 10 px |
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
