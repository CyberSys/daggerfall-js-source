# THE PROFESSIONS ARC - life skills, materials, the Notice Board and Marks (PROF0, the design record)

**Status: DESIGN RECORD, every question decided. Nothing here is built.** Opened 2026-09-28 beside the town-control
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
2. **DAGGERFALL'S ITEMS FIRST.** A material is one of DFU's own items wherever DFU has one (the 8 gems, 25 plants, 22
   creature parts and 11 metals, section 4); a product is one of DFU's own templates at one of DFU's own materials. A
   crafted Dwarven longsword IS Daggerfall's Dwarven longsword. New templates only for what Daggerfall lacks, in the
   **reserved range 600-699** (4.8), registered through `registerCustomTemplates` (`src/systems/itemTemplates.js`)
   as RRI (513-526), Climates & Calories (530-541), the Thunderlock (560-561) and the Sigil Stone (570) already are.
3. **THE STORES ARE THE SERVER'S.** Gathered materials land in the **Stores**, a per-character inventory the account
   service keeps, not in the pack. Crafting consumes the Stores on the service and hands the product to the save. A
   material withdrawn to the pack becomes an ordinary save item and **never goes back**: nothing edited into a save can
   be laundered into the server's economy.
4. **THE NODES ARE THE CLOCK'S.** Which nodes exist today is a pure function of the UTC day and the map pixel, as the
   Oblivion Gate's site is (`src/net/gateLaw.js`); **yields are rolled by the service**, never the client.
5. **THE HANDS DO THE WORK** - DECIDED (Mac: "Active player involvement"). Every harvest is an act the player plays
   (section 5), and an act played well gives more - within a bound a modified client cannot break (5.1).
6. **NO NEW COMMITTED ART IN THE FIRST SLICES** - DECIDED. Tools in the hand are DFU's own weapon sprites (and the
   Morrowind arms on that lane), new items' icons are DFU's own icons recoloured at runtime from the player's data
   (4.8), nodes are DFU's own flats tinted. The one committed art is the heraldry's 24 devices (SEAT0 8.1), the port's
   own. If Mac later commissions art, it replaces a runtime composition icon by icon.
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
| Deep Waters fish | templates 9001-9007 (Longnose Butterflyfish, Largemouth Bass, Canary Rockfish, Crucian Carp, Mackerel, White Zebra Angelfish, Juvenile Finulon), each with its waters (`PASSIVE_FISH_SPECIES`, `src/world/passiveFish.js`: Tropical, Temperate, Swamp, Desert, OpenOcean, Cold) | Fishing's catch |
| World of Daggerfall | 209,436 rock-field prefabs among 227,938 (`03-World/World-Of-Daggerfall.md`); WOD7's shared camps (`src/world/wodShared.js`) | Mining's anchors; bounties |
| Terrain nature | `src/world/terrainNature.js` | Logging's and Herbalism's anchors |
| Climates | `mapsFile.js`: Ocean, Desert, Desert2, Mountain, Rainforest, Swamp, Subtropical, MountainWoods, Woodlands, HauntedWoodlands | Every native table (section 4) |
| Dyes | `src/systems/itemDye.js` | Outfitting |
| Bulletin boards | `BULLETIN_BOARD_MODEL_ID` (`src/world/rmbLayout.js`), `src/systems/bulletinBoard.js` (ROAD A9) | The Notice Board (10.1) |
| Player trade | TRADE1 (`src/net/tradeSession.js`, `src/ui/enhancedPlayerTrade.js`) | Stays how loot changes hands |
| Held objects | `src/combat/heldPose.js` (MAP3) | The rod and the sickle in the hand |
| Sigil Stones | template 570 (`src/systems/gateSpoils.js`) | Daedric smithing |
| Gold | the save's; the guild treasury is the only gold a server holds | Why Marks exist (10.5) |

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
| Fishing | **Angler** - the bite window +40% / **Netter** - Deep Waters' passive fish yield double | **Deep-Sea** - rare sea catches x2 / **Pearl Diver** - pearl chance x3 |
| Smithing | **Weaponsmith** or **Armoursmith** - that family +1 quality step | **Masterwright** - Masterwork chance +5% / **Quartermaster** - ingots and repair kits x2 |
| Outfitting | **Tailor** - clothing +1 step / **Leatherworker** - leather armour +1 step | **Couturier** - two-colour dyes / **Saddler** - a wagon upgrade (Horse Cart and Cargo) of +100 kg |
| Carpentry | **Bowyer** - bows and arrows +1 step / **Joiner** - furniture at half the planks | **Siegewright** - Rams +50% vitality; siege works a day sooner / **Master Joiner** - furniture carries the maker's mark |
| Masonry | **Quarryman** - Rough Stone cuts 1:1, not 2:1 / **Builder** - fortification projects need 10% less stone | **Fortifier** - once a Season a seat's Walls skip their drop on capture / **Sculptor** - stone decor pieces |
| Alchemy | **Brewer** - 3 potions a brew at Journeyman / **Distiller** - Potent chance +10% | **Master Alchemist** - Potent is +40%, not +25% / **Transmuter** - three of a DFU metal make one of the next up (Tin, Copper, Silver, Gold, Platinum) |
| Enchanting | **Efficient** - a further -5% cost / **Disenchanter** - Arcane Essence x2 | **Soulbinder** - filled soul gems give +10% points / **Runecaster** - a Masterwork's property chosen from three |
| Cooking | **Cook** - +1 serving a dish / **Field Cook** - a campfire without a Campfire Kit's charge | **Chef** - feasts last +50% / **Provisioner** - rations and dishes never spoil |
| Jewelcrafting | **Gemcutter** - a set gem adds +10% enchantment points / **Goldsmith** - Silver counts as Gold | **Master Jeweller** - jewellery Masterwork chance +5% / **Lapidary** - Siege-cracked Gems set as any gem |

## 4. Materials

### 4.1 Metals and the ten tiers

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
tree gives **1 Resin** in 4. A Clean Cut (5.2) may drop **Heartwood** (2%): a tier-up plank of the same wood, worth
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
| Sabertooth Tiger | Tiger Pelt | 3 | Big Tooth (56) |
| Spider | Spider Silk | 3 | Spider's Venom (41) |
| Giant Scorpion | Scorpion Chitin | 4 | Giant Scorpion Stinger (47) |
| Slaughterfish | Slaughterfish Scales | 4 | - |
| Harpy | Harpy Feathers | 5 | - |
| Dreugh | Dreugh Shell | 5 | - |
| Dragonling | Dragonling Scale | 6 | Dragon's Scales (46) |

Hides cure to **Cured Leather** (tiers 1-3) or **Hardened Leather** (tiers 4-6) at a tanning rack, **2:1** (Tanner
1:1). Butchery gives C&C's Raw Meat either way. DFU's own corpse loot is untouched: skinning adds, never replaces.

### 4.5 Cloth and stone

- **Linen Bolt** and **Wool Bolt** are bought at General stores (a gold sink; the save's gold is fine for a shop
  purchase) and are never gathered. **Silk Bolt** is woven from Spider Silk (3:1).
- **Rough Stone** is quarried from rock fields (Mining); **Cut Stone** is cut from it **2:1** (Quarryman 1:1);
  **Mortar** is made ten at a time from 1 Sulphur, 1 Lead and 5 Rough Stone.

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
| **Gate-touched ground** | for 2 hours after an Oblivion Gate falls, its pixel holds 6 Adamantium veins and Daedra's Heart can be skinned from any foe there |
| **The Spoils of War** (SEAT0 6.8) | Warforged Steel Ingot (tier 6: counts as Ebony with +1 quality step), Standard-bearer's Silk (tier 5 cloth), Siege-cracked Gem (a gem of the roller's choice, Lapidary only) |

So the crowns sit on the richest veins, the free lands hold what no crown can, and the marches are worth fighting for.

### 4.8 The new templates (600-699)

Icons are DFU's own, recoloured at runtime (law 6): each row names the DFU icon it borrows.

| Id | Name | Stores / pack | Icon from |
|---|---|---|---|
| 600 | Pick | pack (tool) | DFU Warhammer |
| 601 | Woodcutter's Axe | pack (tool) | DFU War Axe |
| 602 | Sickle | pack (tool) | DFU Tanto |
| 603 | Skinning Knife | pack (tool) | DFU Dagger |
| 604 | Fishing Rod | pack (tool) | DFU Staff, a line drawn over it |
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
| 685-688 | Hunter's Stew, Fisherman's Pie, Traveller's Bread, Feast of the Hearth | pack (food) | C&C's Meat / Cooked Fish / Bread, tinted |
| 690 | Ram Kit | Stores (a siege work) | DFU Battle Axe, tinted |
| 692 | Repair Kit | pack | DFU Warhammer, tinted |
| 695 | Recipe Scroll (one template, the recipe in its variant) | pack | DFU parchment icon |

**Marks value** of a material (the writs' and the market's reference, 10.5, section 11): tier 1: **1**; 2: **2**; 3:
**4**; 4: **6**; 5: **9**; 6: **14**; 7: **40** Marks. A common herb **1**, uncommon **2**, rare **5**.

## 5. The hands do the work - the acts

DECIDED (Mac: "tree chopping, picking up ingredients, fishing, etc. Active player involvement").

### 5.1 The common shape

- **The tool is held.** A tool is equipped as a weapon and drawn by the weapon rig the port already has: DFU's own
  weapon sprites for the classic arm (the War Axe's for the woodcutter's axe, the Warhammer's for the pick, the
  Dagger's for the knife, the Tanto's for the sickle), Weapon Widget's swing, bob and inertia
  (`05-Combat/Weapon-Widget.md`), the Morrowind arms on that lane. The rod is held the way the held map is held
  (`src/combat/heldPose.js`), a line drawn from its tip. A tool is also a weak weapon (DFU's damage for its sprite's
  family, at Iron).
- **The node answers Interact** (E, KB1's registry - `10-UI/Controls.md`); the tool's action is **attack**; **Esc**
  cancels an act with nothing lost (the node stays).
- **Every act has a skill moment**, and a clean moment gives more. A missed one never fails the harvest - it gives
  less. The new player is never punished, only the good one rewarded.
- **The honest bound.** The act is played on the client, so it may be lied about. The act's report can move the
  service's roll by at most **one quality step and +50% yield**, never past the character's rank. The node's
  existence, the daily caps and the dice stay the service's.
- **Others see it.** The pose grows an activity field (tool and act: 4 bits), a relay version with its LAW row: a
  peer sees you swing, kneel, cast and reel. The node's state is each character's own (section 6), so a tree another
  felled still stands for you.
- **Gentle acts** (a setting, accessibility): every act completes at a plain result, with no clean bonus and no
  bruise. **Reduced motion** draws the rings and bands as static bars. Every cue is a shape and a sound as well as a
  colour.

### 5.2 Each profession's act

| Profession | The act | The skill moment | Clean gives |
|---|---|---|---|
| **Logging** | Swing at the trunk: tier 1-2 trees take **5** chops, 3-4 take **6**, 5-6 take **8** (Lumberjack -2, at least 3). The tree creaks at half, leans, and falls away from you (the flat tips over and fades in 1.5 s; the Morrowind model falls). Logs drop at its foot and are taken by walking over them. A stump stands for the rest of your day. | **The ring**: a circle shrinks onto the trunk's notch over **900 ms**; strike while it is inside the band - **±12%** of the notch's radius at Novice, **±20%** at Master - for a **Clean Cut** (worth 2 chops) | fewer swings; Heartwood 2% a Clean Cut |
| **Mining** | Strike the vein: tiers 1-2 take **4** strikes, 3-4 **5**, 5-6 **7**. It cracks in stages (crack decals) and sheds chunks. | **The glint**: one of five points on the vein face glints for **1.2 s** (**2 s** at Master) and moves after every strike; a strike within the glint's radius counts **double** | a gem chance 3% a clean strike; ore quality +1 step at 3 clean strikes |
| **Quarrying** (Mining, on a rock field's boulders) | As Mining; yields Rough Stone | As Mining | Cut Stone directly on a clean finish (Stonebreaker always) |
| **Herbalism** | Kneel at the plant (E). A common herb comes up in **0.8 s**. | **The steady hand**, for uncommon and rare herbs with the sickle: hold E for **2.5 s** while a meter fills; turning the view more than **3 degrees** or moving **bruises** the herb | an unbruised herb (+5% Alchemy Potent chance each, 9.3); a bruised one yields 1 less (at least 1) |
| **Hunting** | Kneel at a body your own blow felled (E) with the knife. | **The trace**: a dotted line of 5-9 points over the carcass; draw the knife along it (mouse; the right stick moves a cursor; a finger on the touch layer). Accuracy is the mean deviation against a tolerance that widens with rank | a **clean pelt** (score 0.8+) is one quality step up; a **torn** one (under 0.4) yields 1 less |
| **Fishing** | Hold attack to wind the cast (**0.3-1.5 s**, **5-25 m**), release; the float lands on the water (WATER1's surface, the Sea update's). Wait **5-30 s** - dawn and dusk halve it, a storm doubles it. | **The bite**: the float dips, a splash sounds, the pad and phone buzz (TI2's haptics): strike within **600 ms** (Angler +40%). **The reel**: the fish's mark runs along a bar; hold to raise the tension band (**20%** of the bar at Novice, **30%** at Master), release to let it fall; keep the mark inside to fill the catch meter within **20 s**; the fish escapes after **2 s** outside, counted in total | the catch; a trophy (x3 weight, a decor piece) 1 catch in 200 |

**What bites** (Fishing): the water's kind decides the Deep Waters species by its own waters (FACT,
`PASSIVE_FISH_SPECIES`: Tropical, Temperate, Swamp, Desert, OpenOcean, Cold), the region's climate picks Tropical /
Temperate / Cold, and the sea adds OpenOcean species, a **Pearl** in 1 catch of 50 (Pearl Diver x3), and a
**Slaughterfish** in 1 of 100 - which fights (the reel's hardest) and yields Slaughterfish Scales. Any fish counts as
C&C's Raw Fish for Cooking.

### 5.3 The world answers

- A felled tree, a spent vein, a picked plant and a skinned body are gone **for you for the rest of the UTC day**.
- The sounds are DFU's own from the player's data (the wood and stone hits, the splash), and Immersive Footsteps' and
  Better Ambience's where they are on.
- Weather and the hour matter: fish bite at dawn and dusk; rain wets the herbs (the steady window -20%); a storm
  drives the fish deep (longer waits, bigger fish).

## 6. Nodes

- **The law** - nodeLaw.js: for a map pixel and a UTC day, `hash(NODE_SALT, pixelX, pixelY, day)` gives the day's
  node set from the pixel's climate. A node id is `(pixelX, pixelY, day, slot)`. The **client places** each node on
  the ground from its own terrain (the nearest suitable anchor: a rock-field prefab or terrain rock for a vein, a tree
  flat for a tree, a plant flat or an open patch for an herb). The **service** needs only the id to know it is real.
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
- **Fishing spots**: any water. A **school** (a ripple on the surface, 2 a coastal pixel a day) gives catches +1.
- **Per character, never contested**: each character sees every node and takes each once a day. No stealing, no
  camping.
- **Motherlodes** - the contested ones: **3 a day** server-wide, at a pixel from `hash(MOTHERLODE_SALT, day, k)`,
  announced by the hub **10 minutes** before (Motherlode Sense: 30): a tier-6 vein that yields to the **first 20
  characters** to strike it, each finding **10 Marks** besides the ore.
- **The harvest**: after the act (section 5), the client asks `{node, character, act}`; the service checks the id
  against the law for today, the character's cap (**60** harvests a gathering profession a day; Fishing **40**
  catches), and that this character has not taken this node; it rolls the yield (CSPRNG), applies the act's bounded
  step, and adds to the Stores. Travel time is the natural limit; the cap is the honest one.
- **Yields** (before the act): a tree **2-4** logs; a vein **2-3** ore (+ the gem chance); an herb **1-3**; a hide **1**
  (+ the ingredient chance); a catch **1** fish; a boulder **3-5** Rough Stone.

## 7. The Stores

- A per-character inventory on the service (`stores`: player, char_id, material, qty), at most **5,000** of any one
  material.
- **The Stores tab** (section 8) is the only place a Stores material is seen. Moving to the pack is allowed (one-way, law 3);
  a pack item never moves into the Stores.
- **Guild Stores**: a guild warehouse at its hall and any seat it holds: any member deposits from their Stores;
  Officers and the Guildmaster withdraw; every movement on a ledger (the guild ledger's trigger pattern).
- **Seat stockpiles** (SEAT0 7.5): the holder's (fortifications) and each pledged challenger's **Siege Camp** (siege
  works) - filled only by writs (section 11) and the Levy.

## 8. The interface

DECIDED (Mac: "actual UI integration for life skills"). Everything is drawn in the Enhanced Plus UI - the one UI
since MENU-TOGGLE and PLUS-DEAD (`PATCH-NOTES-One-UI-Choice.md`) - in its brass and bone, scaled by the UI scale,
laid out for the phone's touch layer as for the desktop.

- **The prompt**: bottom centre above the hotbar - "[E] Chop Oak - Logging 34". **The hover** (World Tooltips):
  "Oak - tier 2 - 6 chops - taken today: no".
- **The act's meter**: centred on the crosshair, 160 px across at 1080p (30% larger on touch); the ring, the glint,
  the hold meter, the trace and the reel bar each have a still form for Reduced motion.
- **The haul**: toasts on the right, 4 at most, 3 seconds each - "+3 Oak Logs to your Stores", "+45 Logging XP
  (Clean Cut x2)", "Logging 34 -> 35"; a rank-up banner at 25, 50, 75 and 100, and at 50 and 100 the specialisation
  choice opens.
- **The day's cap**: a chip under the compass - "Logging 34 / 60 today".
- **The Professions tab** (character sheet): a left column in two groups (Gathering, Crafting) - each row the icon,
  name, rank, rank's name and a thin bar; the right pane for the chosen one - XP to the next rank, the specialisation
  cards (choose one), the unlocks by rank (tiers, recipes), today's harvests, and "Crafts above Journeyman: 1 of 2".
- **The Stores tab**: a grid of materials with counts; filters (Ores and Metals, Wood, Herbs, Hides and Cloth, Stone,
  Gems, Essences, Spoils of War), a search box, sort by tier, name or count; a material's actions - **Withdraw to
  pack** (a quantity), and at a Notice Board **List** and **Deliver to a writ**.
- **A station**: left, the recipe list (filters: Can make now, All known, by tier); centre, the recipe - its inputs
  (have / need, from the Stores), the product as an item card, a bar of its quality odds (9.2); buttons **Craft**
  (plays the act, 9.4), **Quick craft**, **Craft x N** (quick, up to 10); right, the act's panel while it plays.
- **The held map** marks the patches and veins a character has worked before, and a Prospector's veins.
- **Keys** from KB1's registry, under a Professions group in Controls: Interact (E), attack, Esc, and a **tool swap**
  key chosen from the free keys at PROF1 (KB1's rule: one key, one action; Mac's four calls stand).
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

**Cooking** (any campfire, hearth or brazier; C&C's Skillet widens the fire's window): C&C's Cooked Fish and Meat
(C&C's own recipes); **Hunter's Stew** - 2 Raw Meat, 1 Root Bulb, 1 Pure Water: C&C's hunger filled, Endurance +5 for
2 game hours; **Fisherman's Pie** - 2 fish, 1 Bread: Agility +5 for 2 hours; **Traveller's Bread** - 1 Bread, 1 Fig,
1 Red Berries: stamina regained +20% for 4 hours; **Feast of the Hearth** (rank 70) - 4 Meat, 4 Cooked Fish, 4 Bread,
2 Red Berries, 1 Nectar: the whole party (the party's buff frame, PARTY-BUFFS) Strength, Endurance and Willpower +5
for a game day.

**Alchemy** (DFU's potion maker, unchanged): the brew makes **2** potions at Journeyman and **3** at Master (Brewer 3
at Journeyman); **Potent** (+25% magnitude, named so) at 10% at Expert and 20% at Master, +5% an unbruised herb.
DFU's twenty recipes are the whole book.

**Enchanting** (DFU's item maker, unchanged): cost **-10%** at Journeyman, **-20%** at Master (Efficient -5% more);
**Disenchanting** (new, at any enchanting station): an enchanted item the player owns becomes **Arcane Essence**, one
per 100 enchantment points it carried (Disenchanter x2), and is gone; a Masterwork's Rare roll consumes 5 Essence
(Runecaster: choose of three).

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
  the reach gate, the location's name, the rumour mill's line). **Offline it stays exactly that.**
- **Online, the same board opens the Notice Board.** DFU's reach gate still applies (256 classic units).
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
  provenance id (the listing takes the item out of the save; the service holds the record; one provenance id is
  listed once, ever - a duplicated item cannot be sold twice). **Loot does not list**: it has no provenance. TRADE1
  stays how loot changes hands.
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

### 10.4 Fees and couriers

| Fee | Amount | Where it goes |
|---|---|---|
| Listing | 1% of the price, at least 1 Mark | burnt (a sink) |
| Sales tax | 5% of the sale | the seat's Tithe share to the holder (SEAT0 7.2), the rest burnt |
| Courier | 1 Mark + 1 Mark per 25 map pixels between the two regions' seat or hub towns | burnt; the Tithe share at the receiving seat |
| Courier's time | 15 minutes + 1 minute per 10 map pixels (Bandit Summer doubles it, SEAT0 9.3) | - |

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
| Court writs (section 11) | their pay | 5 an account a day |
| Oblivion Gate receipts | 50 a receipt | one a day by the gate's own law |
| Siege Honours (SEAT0 6.8) | 50 / 25 | one a siege |
| Motherlodes | 10 a find | 3 a day |

- **Where Marks go** (the sinks): listing fees, the burnt part of sales taxes and couriers, seat claim fees and
  upkeep, Festivals, heraldry, fortification projects, respecialisation, the Bank's exchange.
- **What only moves them**: the market, buy orders, player-posted writs, the Tithe, Tribute, guild deposits and
  withdrawals, sellsword contracts.
- **Marks and gold**: Marks **sell for gold** at any Bank of the Empire counter, **1 Mark for 8 gold** (a spread that
  is itself a sink), at most **500 Marks a day**; **gold never buys Marks** - that door would mint a Mark from gold a
  client may not have had.
- **The weekly report** (for Mac, from the ledger): Marks minted by faucet, burnt by sink, in circulation; the median
  price of the twenty most-traded materials; the accounts at the faucets' caps.

### 10.6 Player notes

A registered player may pin a note on a board under MAIL1's letter law (its bounds, its filter, its reports): at most
3 live notes an account, each for up to a week. A note may carry one button: a **party invitation**, a **guild's
recruitment**, a **duel challenge**, or a **commission** (section 11).

## 11. Writs - the Work tab

- **Court writs** (the faucet): every region with a seat or hub posts **6 a UTC day** (a pure function of the day and
  the region) on its boards. A writ asks for a material from the region's own native tables (4.1-4.4), mostly tiers
  1-4, one a day of tier 5-6; **10-60** units, fewer at higher tiers. **Pay**: units x the material's Marks value x
  1.5, and Renown XP 25 x tier x units / 10. Each writ is filled once, by the first to deliver; at most 5 an account a
  day.
- **Guild and seat writs**: posted by Officers, the pay escrowed from the Marks treasury; partial fills pay pro rata;
  unfilled after 7 days, the escrow returns. A seat's writs build its fortifications (SEAT0 7.5) and count as
  influence for the holder or a pledged guild (SEAT0 4.2).
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
| A save-edited item enters the economy | The Stores are one-way (law 3); only provenance items list, once (10.2) |
| Fake gold buys the market | The market is in Marks (10.5) |
| Marks inflate | Faucets only from witnessed acts, each capped; the weekly report; the Bank's spread and every fee burn |
| Bots farm nodes | Per-character nodes, daily caps, travel |
| One character does everything | Two crafts above Journeyman (3.2) |
| Crafting obsoletes loot | Rare at most (law 7) |

## 14. The server's shape

- `prof_tracks` (player, char_id, profession, xp, spec50, spec100)
- `stores` (player, char_id, material, qty); `guild_stores` (guild_id, material, qty) with its ledger
- `node_harvests` (day, node_id, player, char_id) - a day's rows droppable after the day
- `recipes_known` (player, char_id, recipe)
- `products` (provenance PK, template, material, quality, maker, made_at, listed)
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
| **MARKS1** | Marks: balances, the guild Marks treasury, the ledger, the Bank's exchange, the weekly report; Court writs as the first faucet (delivered from the pack's DFU items until the Stores exist) | Every faucet capped and pinned; gold never becomes Marks, pinned |
| **NOTICE1** | The Notice Board: DFU's board opens it online, the rumour pinned first; boards stood where a seat or hub lacks one; the Notices and Work tabs; player notes | Offline the board is byte-for-byte DFU's (the ROAD A9 pins hold) |
| **PROF1** | The Stores; **Herbalism** with its act; the Professions and Stores tabs, the prompt, the meter, the toasts; the tools (600-604); withdraw to pack | An herb picked online reaches DFU's potion maker by the pack |
| **PROF2** | Mining and Quarrying with their acts; smelting; ores and ingots (610-630) | Veins placed on rock fields; signatures by kingdom |
| **PROF3** | Smithing with its act; quality; provenance; the forge | A crafted Mithril Longsword is DFU's, with its quality |
| **PROF4** | Logging with its act (the falling tree); Carpentry; furniture; the Ram Kit | DECOR places a crafted table |
| **PROF5** | The Market tab: listings, regional markets, couriers, buy orders, history | Needs MARKS1, NOTICE1, PROF3 |
| **PROF5b** | Timed auctions for Masterworks | - |
| **PROF6** | Writs: guild, seat, commissions, bounties | Needs SEAT1b for seat writs |
| **PROF7** | Hunting (the trace) and Outfitting | - |
| **PROF8** | Fishing (the cast, the bite, the reel) | - |
| **PROF9** | Cooking | - |
| **PROF10** | Jewelcrafting | - |
| **PROF11** | Masonry | Needs SEAT2b and PLOT1 |
| **PROF12** | Alchemy and Enchanting layers; Disenchanting | - |

## 16. What remains to measure

1. **The Marks economy** - after four weeks of MARKS1, the weekly report: if more is minted than burnt by a quarter,
   the Bank's rate falls a Mark's worth; if less, Court writ pay rises 20%. Recorded here.
2. **The node density** - Mac's eye in the field after PROF1-2: the table in section 6 moves by whole nodes.
3. **The act windows** - after PROF1, the share of clean acts: aimed at a third for a Journeyman.

## Appendix A - a day of a gatherer

Ilsa, a Journeyman herbalist and Apprentice miner in Anticlere (a march), sets out at dawn. The board's Work tab has a
Court writ for 30 Red Poppies (uncommon, tier 2: 30 x 2 x 1.5 = 90 Marks) and the Market's poppy median is 3. She walks
the woods east of town: Woodlands pixels, four herb patches each. Kneeling at a Red Rose she holds the sickle steady -
the meter fills, unbruised. By noon she has 34 Red Poppies (the march's +25%), 60 of 60 of today's herbs, and 1,800
Herbalism XP. She delivers 30 poppies at Anticlere's board (90 Marks and 150 Renown XP; a Court writ gives no
influence - only a seat's own writs do), lists 4 Golden Poppies at 12 Marks each, and spends the afternoon at the vein
on the hill: an Iron vein, the march's +25% on it - four strikes, three on the glint, and an Amber (Woodlands' gem).
At dusk the hub warns of a Motherlode in the Wrothgarian foothills in ten minutes; she is too far. Tomorrow.

## Appendix B - every number

| Name | Value |
|---|---|
| Template range | 600-699 |
| Ranks | Novice 0, Apprentice 25, Journeyman 50, Expert 75, Master 100 |
| XP to rank n | 10 x n^2 |
| XP a harvest / a craft / a first craft / a writ | 15 x tier (+50% clean) / 20 x tier x units / +500 / 2 x Marks value |
| Tier ranks | 0, 10, 25, 40, 55, 70, 90 |
| Crafts above Journeyman | 2 |
| Respecialisation | 1,000 Marks, 7 days |
| Marks value by tier | 1, 2, 4, 6, 9, 14, 40; herbs 1 / 2 / 5 |
| Daily caps | 60 harvests a gathering profession; 40 catches |
| Node tiers | 40 / 25 / 15 / 10 / 6 / 4 % |
| Dungeon veins | 1-4 a day |
| Motherlodes | 3 a day, 20 characters, 10 Marks, 10 (30) minutes' warning |
| Yields | tree 2-4, vein 2-3, herb 1-3, hide 1, catch 1, boulder 3-5 |
| Act bound | one quality step, +50% yield |
| Logging | chops 5 / 6 / 8, ring 900 ms, band 12-20%, Heartwood 2% |
| Mining | strikes 4 / 5 / 7, glint 1.2-2 s, gem 3% |
| Herbalism | common 0.8 s, steady 2.5 s, 3 degrees |
| Hunting | trace 5-9 points, clean 0.8, torn 0.4 |
| Fishing | cast 0.3-1.5 s / 5-25 m, wait 5-30 s, bite 600 ms, band 20-30%, 20 s, escape 2 s; pearl 1/50, slaughterfish 1/100, trophy 1/200 |
| Stores cap | 5,000 a material |
| Quality | the margin table (9.2) |
| Station use fee in town | 50 gold |
| Alchemy | 2 / 3 potions; Potent +25%, 10% / 20%, +5% an unbruised herb |
| Enchanting | -10% / -20%; 1 Essence per 100 points |
| Listings | 72 h, 30 an account, 1-1,000,000 Marks; buy orders 20, 7 days |
| Fees | listing 1% (min 1); sales tax 5%; courier 1 + 1 per 25 px; courier's time 15 min + 1 min per 10 px |
| Marks | ~10 gold of play; balance cap 10,000,000; Bank: 1 Mark -> 8 gold, 500 a day |
| Faucets | Court writs 5 a day; gate 50; Honours 50 / 25; Motherlode 10 |
| Court writs | 6 a region a day, 10-60 units, pay x 1.5, Renown 25 x tier x units / 10 |
| Player notes | 3 an account, 7 days; 30 a board |
