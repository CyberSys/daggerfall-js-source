# The Loot Arc - powers, the chase and the loop (LOOT)

> Design page, written before the code (2026-10-01). The slices at the foot ship in that order; each is shippable and
> verifiable without the next. Where this page and a shipped slice disagree, the slice's own record (section 15) is
> what runs.

## What Mac asked for

Mac, 2026-10-01: *"So weve been making so much progress and I want to talk about enhancing the rarity loot system.
Currently we have rarity tiers, armor set bonuses, boss loot, etc and im wondering how we could go further"*.

Ten directions and a quick win were offered in three groups: DEPTH (items that change how you play: Legendary powers,
affixes that do things, the roll seen and the Exalted, more Legendaries), CHASE (where it comes from: signature drops,
champion foes, bad-luck protection) and the LOOP (something to do with loot: salvage and a reroll, a Legendary codex,
a line of light over every Rare drop); the quick win was AUDIT-LR's second note - a warhammer that rolls +20 Impish.
Mac: *"Do you wanna turn this into and arc and do all of the above?"* - all of it, as an arc.

## 1. The laws this arc keeps

Every one of these is a standing call of Mac's, and no slice moves it:

1. **The source sets the odds, never the player** (`Loot-Rarity.md`, LR1). A signature drop steers WHICH Legendary a
   source's kind of foe yields, never whether; the drought multiplies the source's OWN Legendary chance, so a rat's
   stays a rat's; a champion is a source, stronger because it is.
2. **Shops and quest rewards do not roll** (LR1). The Reforge is a service on a piece the player already owns; no
   shelf is stocked, nothing is rolled for sale.
3. **A craft reaches Rare at most** (`Professions-Arc.md` law 7). Nothing here makes a Legendary: an imprinted Rare
   (LOOT10) carries a Legendary's power and stays Rare.
4. **Loot never enters the Stores** (`Professions-Arc.md` 9.3). The salvage's shard is a pack item, bound, and never
   the Stores'.
5. **A set works online only, never in a duel** (`11-Multiplayer/Sigil-Sets.md`). Untouched. The new affixes and the
   Legendary powers work offline and online - as a Legendary's numbers always have - and never on a player: they
   answer my blows at a FOE and a foe's blows at me, and a duel's blows reach neither (SET2's damage door passes a
   duel's blow without asking the port, and every blow modifier here refuses a target that is a player).
6. **Off is DFU exactly** (LR1). Every slice hangs off the one `loot-rarity` row: off, no field is written, no read
   moves, no champion stands, no line of light is drawn, no shard is minted.
7. **The Aetheric is never rolled** (SET6). The Exalted is a Legendary's variant, not a rung: the ladder keeps its six.

## 2. The shape, end to end

```
 DEPTH   a roll ──► affixes that lean to the item (LOOT1) ──► their bands on the card, a Perfect (LOOT2)
         a Legendary ──► one in ten Exalted (LOOT2) ──► thirty records (LOOT3) ──► each with a POWER (LOOT5)
         five affix kinds that DO things - a sear, a leech, thorns, focus, a slayer's edge (LOOT4)
 CHASE   the source's family ──► its signature Legendaries weigh five to one (LOOT6)
         a champion: a trait, a name, twice the health ──► a Rare or better, always (LOOT7)
         the drought: pieces taken without a Legendary ──► the source's own chance, up to three times (LOOT8)
 LOOP    a Magic+ piece ──► salvaged for Welkynd Shards (LOOT9) ──► the Reforge: one line rolled again
         a Legendary found ──► the codex (LOOT10) ──► its power imprinted on a Rare
         a body or a pile holding a Rare+ ──► a thin line of its tier's light (LOOT11)
```

## 3. LOOT1 - a skill affix leans to the item's own skills

AUDIT-LR's second note, the tuning slice it named: "a warhammer can roll +20 Impish ... a weighting toward the group's
own combat skills would be a tuning slice, not a fix". A skill affix's skill is drawn:

| the item | half the time | then, to 85 in a hundred | the rest |
|---|---|---|---|
| a weapon | its own weapon skill (the skill that swings it: a bow's Archery, a staff's Blunt Weapon) | the strike's kin: Critical Strike, Backstabbing, Dodging | any skill |
| armour | - | the body's twelve: the seven ways of fighting (the six weapon skills, Critical Strike) and Dodging, Running, Jumping, Climbing, Swimming | any skill |
| jewellery | - | the mind's thirteen: the six schools, Etiquette, Streetwise, Mercantile, Lockpicking, Pickpocket, Stealth, Medical | any skill |

A WEIGHTING, NEVER A FENCE: a language was a skill affix 9 times in 35; now about 1 in 30. A step with no free skill
(a kind with a param never repeats one on a piece) gives way to the next, so the draw never comes back empty. The
Legendaries' skills are their records', untouched.

## 4. LOOT2 - the roll seen, and the Exalted

**The band on the line.** Every affix the ladder ROLLED reads with its band: `+18% damage [10-25]`. A Legendary's
record lines carry none - they are its signature, fixed - and an Exalted's extra line carries the Legendary band.

**Perfect.** A Rare whose every rolled affix stands at its band's top reads `Perfect Rare` on its tier line - one
Rare in a few thousand, worth a word - once its numbers are read. Never a Magic piece: one line at its top is one
Magic in eight, no word's worth.

**The Exalted.** A Legendary minted at a source - a body, a pile, the gate's spoils, a town's thanks - is EXALTED one
time in ten: `item.exalted = true`, and one more affix: a kind its record does not carry, allowed on its group, its
value in the TOP HALF of the Legendary band. Its tier line reads `Exalted Legendary`; its tile wears a fourth pip
(the Legendary's three diamonds and a star); it is worth 1,000 more and its line's points. Its name is its record's -
the record is what a player learns; "Exalted" is the find. The roll is taken AFTER everything a door already rolls, so
a seed's earlier draws stay what they were (the gate's spoils' own law, SET6), and the Sigil Broker's Legendaries are
never Exalted: its stock is the day's fixed tables, and a roll there would move every day's.

## 5. LOOT3 - thirty Legendaries

The pool grows from ten to thirty: every weapon family, every armour place and every kind of jewellery has a record of
its own, and each record keeps LR2's law - three or more affixes in the Legendary band, kinds its group may carry, ONE
DFU catalogue enchantment priced by DFU's own table, a line of lore, a base it can land on. The new twenty are named
in the lore of the Bay (the Ansei of Hammerfell, the Tsaesci, Orsinium and its king, the Direnni, the King of Worms,
the Warp in the West, King Lysandus, Wayrest's couriers and its Knights of the Rose, Camlorn's Order of the Raven,
the Dark Brotherhood, the walls of Daggerfall, the Nine, the Glenmoril witches, the Hist, the Reach) and never take
an artifact's name. The full table, with each record's power and signature, is LOOT3's section once it ships.

## 6. LOOT4 - five affix kinds that do things

The six kinds LR1 shipped are numbers a wearer carries. Five more DO something, through the seams the Sigil Sets
opened (SET2), in one module (`systems/lootPowers.js`):

| kind | on | slot | Magic | Rare | Legendary | does |
|---|---|---|---|---|---|---|
| `elemental` (fire, frost, shock) | weapons | prefix | 1-3 | 3-6 | 6-10 | that much of its element on every weapon blow at a foe - none on a foe immune to it, half on one that resists |
| `leech` | weapons | suffix | 2-4 | 4-7 | 7-10 | that share (%) of every weapon blow that lands heals you |
| `thorns` | armour | prefix | 1-3 | 3-6 | 6-10 | a foe whose blow lands on you takes that much back (all you wear, at most 25 a blow) |
| `focus` | jewellery | prefix | 2-4 | 4-7 | 7-10 | that share (%) off your spells' magicka (all you wear, at most 30%) |
| `slayer` (undead, daedra, humanoid, animal) | weapons | suffix | 5-10 | 10-20 | 20-30 | that much more (%) weapon damage to that kind of foe - DFU's own grouping (`enemyEntityGroup`: a vampire undead, a dragonling an animal, an orc humanoid) |

A weapon's three are the weapon IN HAND's alone; a wearer's armour and jewellery sum, under the caps. Each answers MY
entity alone, offline and online, and never a player (law 5). Names: `Burning Longsword of the Leech`, `Barbed
Cuirass of the Bear`, `Adept's Ring of the Owl`, `Shortsword of the Gravewatch`.

## 7. LOOT5 - every Legendary a power

Each of the thirty records names one POWER: a sentence, a brief (the card's row, CARD-FIT's 32 characters) and its
numbers, fixed (a Legendary does not grow - its sigil, if it carries one, does). The powers are DATA read by the one
kit LOOT4 builds - a blow's share under a condition (a kind of foe, an unaware foe, a foe under or at full health, me
under a line, the night, a first blow, bare hands), stacks a strike or a kill raises, a blow that arcs or quakes or
echoes, a leech, a kill's heal or magicka or gold or spell on me, a charge that turns a blow aside, a hex on the foe
that struck me, a death cheated, a cost cut, a spell absorbed, a round's regeneration, a better find. A power counts
ONCE however many pieces carry it (a Legendary and a Rare imprinted with it). The powers work offline and online and
never on a player (law 5); the HUD's set chips show a power's stacks and recovery as a set's do.

## 8. LOOT6 - signature drops

Each record names the FAMILY it is found among - the port's grouping of the foe table: the **undead** (the skeletal
warrior to the Ancient Lich, the vampires among them), the **daedra** (the five Daedra, the four atronachs, the imp
and the gargoyle), **dragons** (the two dragonlings), **beasts** (the animals, the werecreatures, the creatures of
the water and the wild), **brutes** (the orcs and the giant), **casters**, **rogues** and **warriors** (the class
foes by their own teams and magic). When a source of a family rolls a Legendary, its signature records weigh FIVE
against one in the pick. A corpse's family is its foe's; a treasure pile's is its dungeon kind's (a Crypt's the
undead, a Dragon's Den's dragons, a Coven's casters). Whether a Legendary drops is still the source's tier alone
(law 1). The codex (LOOT10) tells a player where a record is found.

## 9. LOOT7 - champion foes

**Who.** About one foe in twenty of level 3 or more (never a quest's, the watch, an ally, the gate's Warden) stands
as a CHAMPION, with one TRAIT:

| trait | does |
|---|---|
| Mighty | its blows land half again as hard |
| Stalwart | half again its health, on top of a champion's double |
| Swift | thirty more Speed (at most 100): it closes and attacks sooner |
| Vampiric | half of what its blows take from you heals it |
| Thorned | your blows that land on it hurt you back, a seventh of them |

Every champion has twice its health and its blows a quarter harder (damageScale, multiplied - never overwriting an
elite's). Its name is the trait's and its own - `Mighty Orc Warlord` - on the HUD's target bar, its corpse and its
death line.

**Its loot.** A champion is a stronger source: its tier +4 and its quality x1.5. And it ALWAYS carries a Rare or
better: if its own roll found none, its best eligible piece is made Rare - or, carrying none, a weapon or a piece of
armour at its level is minted and made Rare. The chime rings at its fall.

**Online.** A dungeon's foes are its layout's, built on every client from the location (the elite's way): the
champion and its trait are a HASH of the location and the marker, so every client stands the same champion with no
wire word. A foe in the street or a building is its owner's: the owner's hash says it, and the foe record carries its trait
(`cp`, sent only when set) to every puppet, which wears the same scaling, so a puppet's blow resolved on my side is a
champion's. Said so: when a dying owner hands a street foe over, its carried loot does not travel (the hand-over's
own law), so a champion adopted mid-fight carries none.

## 10. LOOT8 - the drought

Bad-luck protection. Every eligible piece (a weapon, armour, jewellery - LR1's eligibility) the player TAKES from a
body or a pile below Legendary adds one to the character's drought; a Legendary or better taken empties it. At every
source door, the Legendary threshold is multiplied by `1 + 0.2 x floor(drought / 25)`, at most x3 - after 25 pieces
x1.2, after 250 x3 - and never above the Rare threshold (the ladder never inverts). Counted at the TAKE because a
body's loot is rolled when its foe is spawned (`hostCombat.spawnEnemyLoot`): counting the rolls would fill the
drought by walking into a dungeon. A piece is counted once (a mark the source door puts on it, cleared at its first
take - dropped and taken again, it is not counted twice). The drought rides the character's save (a mod record, the Sigil Broker's way); offline and online alike.
Foxglove's power (LOOT5) is the other door to a better find, and it too multiplies the source's own chance.

## 11. LOOT9 - salvage, and the Reforge

**The Welkynd Shard.** A sliver of Ayleid magicka-crystal: a stacking pack item, BOUND (never sold, traded, dropped
or listed - the Sigil Stone's law, SS1/SS3), the Reforge's only coin. Template 571, beside the Sigil Stone.

**Salvage.** A Magic piece yields 1 shard, a Rare 3, a Legendary 8, an Exalted 15. Never an Aetheric piece (the
Broker's dismantle is its), an artifact, a quest's item, a worn, locked or bound piece. From the pack (the enhanced
card's button, as the Broker's Dismantle) and at the Mages Guild (both skins).

**The Reforge** - the Mages Guild's, a fourth row beside Identify. Pick a Magic or Rare piece (known, not worn) and
one of its lines; that line is rolled again from its tier's pool, never a kind or a param another line carries, a
Rare keeping its prefix and its suffix (so its name keeps both parts). The name and the price follow. Once a piece has
been reforged, only THAT line may be reforged again (`reforged`, the line's index). An Exalted Legendary's extra line
may be reforged too; a record's own lines never. The price: a Magic 2 shards and 100 gold, a Rare 4 and 400, an
Exalted 10 and 2,000.

## 12. LOOT10 - the codex, and the imprint

**The codex.** Every Legendary record - and every Aetheric piece - a character has TAKEN is in its codex, with the day
it was first found. The first find is said and heard (the HUD's line, the level-up's fanfare): *"Wyrmbane - a
Legendary! It joins your codex."* The Codex window lists all thirty and the Aetheric sets: a found record's name,
lore, lines, power and where it is found; an unfound one's place and its hint (*"Said to be carried by the
undead"*). It rides the character's save (a mod record).

**The imprint** - the Reforge's second row. A Rare (known, not worn, not already imprinted) takes the POWER of a
Legendary of its group from the codex: `imprint: '<record id>'`, its card says *"Imprint: Silent Death (of
Nightwhisper)"*, and the power works as the Legendary's does (once, law of LOOT5). It stays Rare (law 3). The price:
20 shards and 5,000 gold.

## 13. LOOT11 - a line of light over every find

A body or a pile holding a Rare or better stands a thin line of its best tier's colour - WBX3's form (a line out of
the find's top, never a beam beside it) through the gate spoils' own renderer (`render/spoilsGlow.js`: additive,
fogged, no light, no new program), a Legendary's and better pulsing. The nearest eight within 40 m, in the dungeon,
the street and a building; gone the moment its best is taken below Rare. A peer's body in the street shows none: its
list lives on its owner's side (the street's own law). Off, nothing draws.

## 14. The slices

| slice | what | shippable alone because |
|---|---|---|
| LOOT1 | a skill affix leans to the item's own skills | the roll alone |
| LOOT2 | the band on the line, Perfect, the Exalted | a display, and one roll after a Legendary |
| LOOT3 | twenty more Legendaries | records; the Test Room shows them |
| LOOT4 | five affix kinds that do things, and the kit | the kinds roll and work |
| LOOT5 | every Legendary a power | the kit reads the records |
| LOOT6 | signature drops | a weight on the record's pick |
| LOOT7 | champion foes | a source, and its guarantee |
| LOOT8 | the drought | a counter and a multiplier |
| LOOT9 | the Welkynd Shard, salvage, the Reforge | the shard and the guild's row |
| LOOT10 | the codex and the imprint | a record and a window |
| LOOT11 | a line of light over every find | a render pass |
| AUDIT LOOT | the whole arc, audited | - |

## 15. What shipped, slice by slice

### LOOT1 - a skill affix leans to the item's own skills (2026-10-01)

`systems/lootRarity.js`: `skillKin(item)` answers `{ own, kin }` - a weapon's own skill by `weaponSkillUsed` (the
skill that swings it, so a mod's weapon class and the Thunderlock answer their own) and the strike's three; the
body's twelve; the mind's thirteen. `pickSkill` is the one draw `rollAffixes` makes for a skill affix's param, and it
takes ONE roll, as the `pick(free, rolls)` it replaced did: the roll's place in [0, 1) chooses the step - under
`SKILL_OWN_SHARE` (0.5) the own skill when it is free, under `SKILL_KIN_SHARE` (0.85) a kin skill, else any free skill -
and the skill within it, each step's interval spread evenly over its list, a step with nothing free giving its interval
to the next. The rest of the ladder is the roll it was: the other kinds' params, the counts, the bands, the
prefix-and-suffix guarantee of a Rare.

**One roll, found the hard way.** The first cut drew the step and the skill with two rolls. Every seeded mint then drew
one roll more after a skill affix, and everything it minted after moved: the gate's spoils for a receipt (REALM P1.3's
two receipts no longer gave the same number of pieces - the Regalia's roll had moved), the Sigil Broker's day (SS5's
ware was no longer a pauldron), and a Masterwork's roll off its product's seed. The suite caught it; the one-roll draw
keeps every seeded mint's count of rolls, so only the skill a skill affix names has moved. A skill affix's WORD is its
band's alone ("of Practice", "of Skill", "of Mastery"), so no name moved either.

Measured over 1,500 seeded warhammer Rares (1,833 skill affixes): the own skill 0.519 of each piece's first skill affix
(a second skill affix on one piece can never be the first's skill), the hand's 0.875, a language 0.032 (it was 9 in
35, 0.257). Over 1,200 Rares each: greaves 0.891 to the body, an amulet 0.900 to the mind, a language 0.035 on either -
above the 0.85 because the open draw lands on a kin skill too, now and then.

Pinned: `test/loot1_kin.test.js` (6); `tools/mutants/loot1.json` (11, all dead).

### LOOT2 - the roll seen, and the Exalted (2026-10-01)

`systems/lootRarity.js`: `affixBand(item, i)` - the band line `i` was rolled in (a Magic's or a Rare's by its tier; an
Exalted Legendary's extra line - past its record's count - by the Legendary band; else null) - and `affixLine`, the
line as the card and the tooltip read it, `+18% damage [10-25]`; `rarityLines` prints every line through it.
`isPerfect` (a Rare, every line at its top) and `tierLabel` - the first line's words: "Exalted Legendary" (said while
the piece is still unknown - its pips say it anyway), "Perfect Rare" (only once it is read), else the tier.

`exaltLegendary(item, rolls)` exalts IN PLACE: a kind the piece's lines do not carry and its group may (Foxglove's
weight or skill), else - a record already carrying every kind its group may, as Wyrmbane does until LOOT4's kinds - a
kind with a param its lines leave free; the value from `ceil((lo + hi) / 2)` to the band's top; `exalted: true`; the
price `+ EXALTED_WORTH` (1,000) and the line's points. `rollExalted` is the one-in-ten (`EXALTED_PER_MILLE`, 100),
switch-gated, and it is taken in a door's LAST PASS (`lastPass(pieces, rolls)`), after everything the door already
draws: the host door (`rollLootRarity`, over every piece it laddered, the unique finds among them), the gate's spoils
(`gateSpoils.rollSpoils`, after the Regalia's roll), a town's thanks (`raidSpoils.rollRaidSpoils`, after the set
piece's). The first cut rolled it beside each piece, and a list's later pieces drew differently when an earlier one
was a Legendary; the last pass keeps every piece of a list its stream's. The Sigil Broker's `applyRarity` calls, the
item maker's Masterwork roll and the bounty board's Magic never reach it.

`exalted` is a declared item field (`itemFields.js`, a flag), so a forged `'yes'` is refused at the wire like a string
`enchantments`. The pack's frames wear `data-exalted` beside `data-rarity` (`enhancedInventory.js markItemFrame`) and
the Plus sheet's `rarityVarsCss` lays the Exalted's pips - three diamonds and a star, `EXALTED_PIPS` - after the five
tiers' rules. The Test Room's loot door adds one Exalted Legendary, known (LR's own pin counts it).

SET6's pin that the gate's earlier spoils are their seed's compares a piece's RECORD lines now (an Exalted's extra
line is appended after every draw) - the law it pins, every earlier draw the seed's, unmoved; LOOT2's own pin holds it
against the same seeds with the chance at zero, for the gate and a town alike.

Pinned: `test/loot2_exalted.test.js` (6); `tools/mutants/loot2.json` (20, all dead).

### LOOT3 - thirty Legendaries (2026-10-01)

`systems/lootRarity.js` `LEGENDARIES`: the first ten stand as LR2 shipped them, and twenty more follow them - twelve
weapons, ten pieces of armour, eight of jewellery in all. Every weapon template but the arrow, every armour place and
every kind of jewellery but the wand is NAMED by a record (a wand, as before, takes the three that name none:
Foxglove, King's Mark, the Archmage's Loop); every weapon family - by the skill that swings it - has two or more.

| record | lands on | its lines | its enchantment |
|---|---|---|---|
| Ansei's Edge | Broadsword, Saber, Longsword, Katana, Claymore, Dai-katana | +30% damage, +12 Agility, +25 Long Blade | Potent Vs: Humanoid |
| Tsaesci Fang | Tanto, Wakizashi, Katana, Dai-katana | +28% damage, +12 Speed, +25 Critical Strike | Cast When Strikes: Hand of Decay |
| Orsinium's Anvil | Mace, Flail, Warhammer | +32% damage, +12 Strength, +25 Blunt Weapon | Potent Vs: Daedra |
| The Glenmoril Bow | Short Bow, Long Bow | +28% damage, +10 Agility, +22 Archery | Potent Vs: Animals |
| The Direnni Staff | Staff | +20% damage, +15 Intelligence, +25 Destruction, +10 Willpower | Cast When Strikes: Magicka Leech |
| Gortwog's Cleaver | Battle Axe, War Axe | +36% damage, +10 Strength, +25 Axe | Vampiric Effect: when strikes |
| Worm's Tooth | Dagger, Tanto | +24% damage, +12 Intelligence, +22 Mysticism, +20 Backstabbing | Cast When Strikes: Energy Leech |
| Warp-Edge | Broadsword, Claymore, Dai-katana | +38% damage, +12 Luck, +22 Critical Strike | Cast When Strikes: Sphere of Negation |
| The Visor of King Lysandus | Helm | +16 armor, +12 Willpower, +40% Magic resistance, +10 Personality | Regens Health: in darkness |
| The Wayrest Courier's Treads | Boots | +12 armor, +15 Speed, +25 Running | Improves Talents: Athleticism |
| Gauntlets of the Rose | Gauntlets | +14 armor, +12 Strength, +25 Hand-to-Hand | Strengthens Armor |
| The Mountain's Root | Greaves | +16 armor, +12 Endurance, +40% carrying capacity | Increased Weight Allowance: 50% additional |
| The Raven's Wings | Left Pauldron, Right Pauldron | +14 armor, +12 Agility, +25 Dodging | Cast When Held: Slowfalling |
| The Night Mother's Embrace | Cuirass | +14 armor, +10 Agility, +25 Backstabbing, +20 Stealth | Cast When Held: Shadow Form |
| The Wall of Daggerfall | Kite Shield, Tower Shield | +18 armor, +12 Endurance, +40% Shock resistance | Repairs Objects |
| The Amulet of the Nine | Amulet, Cloth Amulet | +12 Willpower, +25 Restoration, +40% Magic resistance | Regens Health: in sunlight |
| The Witch-Sisters' Ring | Ring | +12 Intelligence, +25 Illusion, +40% Frost resistance | Extra Spell Pts: During New Moon |
| The Duelist's Vambrace | Bracer, Bracelet | +12 Agility, +10 Speed, +25 Critical Strike | Improves Talents: Adrenaline Rush |
| The Mark of the Hist | Mark | +12 Endurance, +45% Poison resistance, +25 Swimming | Cast When Held: Water Breathing |
| The Reachman's Torc | Torc | +12 Strength, +10 Willpower, +40% Shock resistance | Extra Spell Pts: Near Humanoids |

Their lore names the Bay's own: the Ansei sword-singers of drowned Yokuda, the Tsaesci, Orsinium's anvil and King
Gortwog, the Glenmoril witches and Hircine's hunt, the Direnni of the Adamantine Tower, the King of Worms, the Warp in
the West, King Lysandus and Cryngaine Field, Wayrest's couriers and its Knights of the Rose, the Dwemer's deep halls,
Camlorn's Order of the Raven, the Night Mother, the gate Daggerfall was named for, the Nine, a Glenmoril coven, Sentinel's
duels, the Hist, the Reach. No name takes one of DFU's 23 artifacts' (`loot.js` ARTIFACT_SUB_TYPE_NAMES).

Every record keeps LR2's law (`test/lr1_lootrarity.test.js` reads them all - its bases are every jewellery template
now, not the amulet and the ring it was written with, so a bracer's, a mark's and a torc's record are each shown to
land). A held spell is a cheap one - Slowfalling (240), Shadow Form (150), Water Breathing (170) - since DFU bills a
CastWhenHeld's casting cost in condition at the first equip (LR4's watch item 9); the first ten's Aegis of Dawn keeps
its Spell Resistance as LR2 shipped it.

What moved with the pool: the Sigil Broker's Legendaries are drawn from the thirty (`baseLegendaries` - the port's
own records, the same on every machine, so the stock is still the day's alone), and the gate's spoils and a town's
thanks pick from the thirty - one roll a pick, as before, so no seed draws more. The Thunderlock's own pin read a
dagger's pool as Wyrmbane and Nightwhisper alone; it reads Worm's Tooth beside them now (and a longsword's Ansei's
Edge), the gun's exclusive claim unmoved.

Pinned: `test/loot3_legendaries.test.js` (4); `tools/mutants/loot3.json` (10, all dead).

### LOOT4 - five affix kinds that do things (2026-10-01)

`systems/lootRarity.js`: five kinds join the six, marked `proc` - `elemental` (fire, frost, shock) and `slayer` (the
undead, daedra, humanoids, animals) and `leech` on a weapon, `thorns` on armour, `focus` on jewellery - each banded
Magic / Rare / Legendary as section 6 says, each a word (`Burning`, `of the Leech`, `Barbed`, `Adept's`, `of the
Gravewatch` ...) and a label (`+5 Fire damage`, `5% life leech`, `4 thorns`, `-6% spell cost`, `+15% damage vs the
undead`), each worth its points. They are NEVER in the ladder's own draw (`rollAffixes` draws the six numbers alone, so
every seeded mint draws as it did) and they NEVER name a piece (`nameAround` passes them by): a Magic keeps its one
word and a Rare its two, as LR1 made them.

**The roll.** A door's last pass (`lastPass`, LOOT2's) now gives every Magic one chance in five and every Rare 35 in a
hundred at ONE such line (`rollProcLine`, `PROC_PER_MILLE`; `addProcLine` mints it): a kind its group may carry and it
does not, its tier's band, appended after its numbers, the price with it. Every proc in the pass is drawn before any
Exalted, so neither moves the other's roll whatever a list's order. The gate's spoils and a town's thanks take them in
the same pass, after every earlier draw.

**What they do** - `systems/lootPowers.js` (new, the kit), registered at import under one name (`lootPowers`) and
imported by the game beside the sets' own (`scenes/world.js`, folded onto the sets' import line - line-neutral):

- the BLOW modifier: the slayer's per cents of the whole blow at its kind of foe (`foeGroup` - DFU's own four groups,
  `enemyEntityGroup`, a class foe a humanoid by its Human affinity), the fraction carried on the weapon (the sets'
  own law), and the elemental's flat sear - none on a foe IMMUNE to the element, half (floored) on one that RESISTS
  (`elementShare`, the career's own `careerTolerance`); the weapon IN HAND's lines alone.
- a STRIKE listener (the blow that landed, its final damage): the leech's share heals me, the fraction carried
  (`healMine`), never past my maximum and never a body.
- a LANDED-BLOW listener: the thorns I wear back to the foe whose blow took my health, summed under `THORNS_CAP` (25),
  through the foe's own pool's door. **One law of a blow**: `sigilSetPowers.js` now tells named listeners
  (`registerPlayerBlowLanded`) from inside its own hurt, at the moment Spite answers - the struck tail's mark, taken by
  the door as it opens (AUDIT FINAL F10), so a fall, a poison's round or a blow the door swallowed answers no thorn -
  and exports `pendingPlayerBlow`, the blow a hurt carries, for LOOT5's damage modifiers.
- a CAST COST modifier: the focus I wear off my spells, under `FOCUS_CAP` (30%).

Never at a player (a duel's blow refused by the blow modifier, a duel's blow at me never asking the port), never a
peer's blow resolved here, never the Warden's ward; off, nothing (`linesOf` reads none).

Pinned: `test/loot4_procs.test.js` (8); `tools/mutants/loot4.json` (26, all dead). LR2's six-kinds pin reads the six
numbers and the five after them; SET6's earlier-spoils pin passes the appended lines by.

### LOOT5 - every Legendary a power (2026-10-01)

`systems/lootRarity.js` `LEGENDARY_POWERS`: one power a record, keyed by its id (the records keep LR2's own shape; a
mod's record may carry its own `power`, and `powerOf` reads both) - a name, a brief inside CARD-FIT's 32 characters, a
sentence, a `kind` and its numbers. The card and the tooltip say it after the enchantment (`powerLine`, "Dragonsbane:
+50% vs dragons and giants"), the lore still last.

| record | power | what it does |
|---|---|---|
| Wyrmbane | Dragonsbane | Its blows deal +50% damage to dragonlings and giants |
| Nightwhisper | Silent Death | Its blows deal double damage to a foe that has not noticed you |
| Graveward | Sanctified | Its blows deal +40% damage to the undead, and each undead foe you kill while you wield it heals you 10% of your health |
| Stormcaller's Bow | Chain Lightning | Each of its arrows that lands arcs to the nearest other foe within 6 m, for half its damage as shock |
| The Warden | Last Stand | Under a quarter of your health, the damage you take is lessened by a quarter |
| Titanheart | Unyielding | No single hurt takes more than a quarter of your health |
| Aegis of Dawn | Dawnward | Each foe's blow that lands on you charges it; at five charges, the next foe's blow is turned aside whole |
| Foxglove | Fortune's Favour | While you wear it, every Legendary you find is half again as likely - its source's own chance, times one and a half |
| King's Mark | Tribute | Each foe you kill pays you 5 gold for each of its levels |
| Archmage's Loop | Spell Mastery | Your spells cost 15% less magicka, and 30% less while your magicka is under half |
| Ansei's Edge | Way of the Sword | Each of its blows that lands grants Flow for 6 s, up to five: +6% weapon damage a stack |
| Tsaesci Fang | Serpent's Kiss | Its blows carry 8 poison, twice that to a foe under half its health - none to a foe immune, half to one that resists |
| Orsinium's Anvil | Earthshaker | Each of its blows that lands shakes the ground: every other foe within 3 m takes a quarter of it |
| The Glenmoril Bow | Hunter's Moon | At night its blows deal +35% damage, and +35% more to animals |
| The Direnni Staff | Arcane Conduit | While you wield it your spells cost 20% less magicka, and each of its blows that lands restores 3 magicka |
| Gortwog's Cleaver | Orc Rage | While you wield it each foe you kill heals you 10% of your health, and under a third of your health its blows deal +30% damage |
| Worm's Tooth | Soul Siphon | While you wield it each foe you kill restores 15% of your magicka |
| Warp-Edge | Many Endings | Each of its blows that lands strikes again, one time in ten, for the same damage |
| The Visor of King Lysandus | The Ghost-King's Vigil | When a hurt leaves you under a third of your health, you are healed 20% of it. Recovers in 60 s |
| The Wayrest Courier's Treads | Courier's Haste | A kill fortifies your Speed by 20 for two magic rounds. Recovers in 10 s |
| Gauntlets of the Rose | Open Hand | Each of your bare-handed blows that lands strikes again for the same damage |
| The Mountain's Root | Bedrock | Each foe's blow that lands on you lessens the blows after it by 4% for 6 s, up to five times |
| The Raven's Wings | Raven's Evasion | A foe's blow is turned aside whole 15 times in a hundred |
| The Night Mother's Embrace | Sweet Mother's Kiss | Your weapon blows deal +50% damage to a foe under a quarter of its health |
| The Wall of Daggerfall | Bulwark | Each foe's blow on you is lessened by 5 points, never under 1 |
| The Amulet of the Nine | Divine Grace | Damage that would kill you leaves you standing, healed a quarter of your health. Recovers in 180 s |
| The Witch-Sisters' Ring | Hex | A foe whose blow lands on you is hexed for 8 s: its blows on you are lessened by a quarter |
| The Duelist's Vambrace | First Blood | Your first weapon blow on each foe deals +60% damage |
| The Mark of the Hist | Hist-Sap | Each magic round you regenerate 2% of your health, 4% while you are under half |
| The Reachman's Torc | Hagraven's Pact | A Destruction spell that strikes you is absorbed 15 times in a hundred, as Spell Absorption is |

**Who.** `systems/lootPowers.js` `wornPowers(entity)`: MY entity's worn pieces - a Legendary's record (a piece that is
a Legendary; an id on anything else wakes nothing) and, from LOOT10, a Rare's imprint - ONE entry a power, however many
pieces carry it. A WEAPON's power rides that weapon's own blows (`blowPowers`: the one that struck); the rest of it
while it is wielded; armour's and jewellery's ride every blow of mine, my fists' too. Asleep in a duel (the sets' own
word, `setsDueling`), nothing with the switch off, and offline as online.

**Through which seam.** The blow (bane, unaware - the host's own word that the foe had not noticed me -, sanctified,
flow's stacks, venom's poison under the element's law, the moon by the world clock's night, rage, the execution, first
blood); the landed strike (chain - a bow's, the nearest other foe within 6 m, shock under its law -, quake - a melee
blow's, every other foe within 3 m -, echo, the open hand, the conduit's magicka, flow's stack); the landed foe's blow
(Dawnward's charge, Bedrock's stack, the Hex on the foe that struck); MY damage door's modifier (a foe's blow - the
sets' `pendingPlayerBlow` - turned aside whole by Dawnward's five charges or the Raven's 15 in a hundred, lessened by
its Hex, Bedrock and Bulwark; any hurt by the Last Stand under its line and Unyielding's share at most), its death
save (Divine Grace, its heal told after the door leaves me at 1) and its hurt listener (the Ghost-King's Vigil); my
kill (Sanctified's and Orc Rage's heal, Soul Siphon, Tribute, Courier's Haste - the city watch and an ally never
count, the sets' own law); the cast price (the Direnni Staff, the Archmage's Loop, beside LOOT4's focus - all of it
at most `SPELL_CUT_MOST`, 50%); the absorption roll (Hagraven's Pact); the magic round (Hist-Sap, and "ready again");
the host door's FINDER (`lootRarity.js registerLegendaryFind` - Fortune's Favour times the source's own Legendary
threshold, past its cap but never past the Rare threshold; `rarityChances` takes `find`, the host door reads
`legendaryFindMult` once a list). The reach powers spare an ally or a foe at peace, a foe a storey away and one behind
a wall, as Cleave and the Nova do.

**Seen.** `lootHudChips` - Flow's and Bedrock's stacks, Dawnward's charges, a recovery running - beside the sets' chips
(`scenes/world.js` hands the HUD both, line-neutral), in the Legendary's orange (`ui/enhancedHud.js`).

**What it moved.** SET5's pin on the HUD's wiring reads both lists; five mutant records whose anchors the arc's edits
moved were re-aimed by content (DISC29-B's unguarded name, SET3's import and its fall, SET5's chips, LOOT4's focus
cap) and still die (`test/mutantdrift.test.js`).

Pinned: `test/loot5_powers.test.js` (7); `tools/mutants/loot5.json` (38, all dead).

### LOOT6 - signature drops (2026-10-01)

`systems/lootRarity.js`: `FOE_FAMILIES` groups the foe table in eight - the **undead** (15, 17, 18, 19, 23, the two
vampires 28 and 30, the two liches), the **daedra** (the five Daedra, the four atronachs, the imp and the gargoyle),
**dragons** (the two dragonlings), **beasts** (the animals, the werecreatures, the spriggan, centaur, nymph and harpy,
the slaughterfish, dreugh and lamia), **brutes** (the four orcs and the giant), and the class foes by their own teams
and magic - **casters** (Mage, Spellsword, Battlemage, Sorcerer, Healer, Nightblade), **rogues** (Bard, Burglar,
Rogue, Acrobat, Thief, Assassin) and **warriors** (Monk, Archer, Ranger, Barbarian, Warrior, Knight, the watch). Every
foe of the table is in one, the horse in none (`foeFamily`). `DUNGEON_FAMILY` gives each of DFRegion's nineteen
dungeon kinds its family or none (a Mine is no one's). `LEGENDARY_FOUND` names where each of the thirty is found -
the undead four, the daedra three, dragons two, beasts four, brutes three, casters four, rogues four, warriors six -
and `foundAmong` reads a mod's record's own `found` too.

**The pick.** `pickLegendary(pool, family, rolls)` takes ONE roll, as LR1's `pick` did: with no family it is exactly
`pick`'s index for the same roll; a source's family weighs its own records `SIGNATURE_WEIGHT` (5) to one.
`applyRarity` takes `{ family }`; the host door hands its source's family on; `corpseSource` reads a foe's mobile
type (`rollCorpseLoot` hands `entity.mobileType` - LR4's one corpse door); a dungeon's treasure pile names its
kind's family (`scenes/dungeonContext.js`, line-neutral). The gate's spoils, a town's thanks, the Broker and a
Masterwork name none, so they pick as they did - SET6's earlier-spoils pin unmoved. WHETHER a Legendary drops is
the tier's alone: `rarityChances` reads no family.

Measured: a vampire's two pieces (a dagger, whose pool holds no undead record, and a battle axe, whose pool holds
Graveward beside Wyrmbane and Gortwog's Cleaver) gave the undead's own over a quarter of their Legendaries in 3,000
seeded kills - a third of the axe's would be the even pick; five sevenths is the weighed one.

Pinned: `test/loot6_signatures.test.js` (4); `tools/mutants/loot6.json` (11, all dead). LR1's corpse-source pin
reads the family (null without a type), and its four-hosts pin the pile's.

### LOOT7 - champion foes (2026-10-01)

`systems/champions.js` (new): the five traits (`CHAMPION_TRAITS`, in the wire's order - each name its id
title-cased, so the two leaves that cannot import it spell it the same), `applyChampion` (on the entity, before its
loot: twice its health - the Stalwart half again more - its blows a quarter harder MULTIPLIED onto whatever
`damageScale` it has, so an elite's double stands under it - the Mighty half again more - and the Swift's thirty
Speed, capped at 100; never under level 3, the watch, an ally, or off), `championName`, and the two traits that
answer a blow on SET2's seams: the Vampiric (the struck tail: half of a blow that reached me heals it, never past its
maximum) and the Thorned (the strike tail: a seventh of my blow that landed on it, through `hurtPlayer` - my one
damage door, so a shield, a ward and a death save see it as any hurt; never a peer's blow, never an ally's).

**Who.** A dungeon's: `markDungeonChampions` marks the layout's records by an FNV hash of the location id and the
marker's index - one in twenty (`CHAMPION_PER_MILLE` 50), its trait from the hash's high bits - so every client
stands the same champions with no wire word, and a mark rides its record through a rebuild. Every build arm of
`applyEliteScaling` stands it, an elite dungeon's onto the elite's scaling. A quest's foe is never in the layout. The
street's: an ordinary encounter's foe (`capped` - never a quest's, a summons, a placed camp's or a replacement) is
`rollStreetChampion`'s - the same mixer over where it stands, its type and the pool's count of them, NEVER a draw:
the pool's stream (its loot, its kit) draws as it did, and a seeded test's street stands the same foes every run
(the row is on by default, so a draw would have made every street pin a one-in-twenty flake). The foe
record carries the trait (`cp`, `net/wire.js` `validFoeRecord`, at most `CHAMPION_TRAIT_MAX`; RELAY_VERSION
**world138**, NOT YET DEPLOYED - a relay before it strips the field and a peer's puppet of a champion stands as an
ordinary foe, the owner's health word still ruling it); a puppet and an heir's adoption stand the same champion; a
save keeps it (`champion` on the pool's record) and a load stands it again, never rolled. The gate's Warden is the
relay's and never a pool foe.

**Its name** is the trait's and its own - `Mighty Orc` - on the hover over it alive (`worldTooltips.js`
`liveEntityName`, every pool's one namer), the HUD's target bar (`ui/hudFoeTarget.js`), its body (both pools) and
its death line (`corpseMarker.js` `sayEnemyDied`).

**Its loot.** `rollCorpseLoot` reads the mark: a champion's corpse door is the plain door with `CHAMPION_SOURCE`
(four tiers, quality x1.5). Then `scenes/hostCombat.js` `ensureChampionLoot`: when its own roll found no Rare or
better, its most valuable piece that could be (a plain one, or one the ladder made Magic) is made Rare; carrying
none, a weapon (never ammunition) or a piece of armour at the player's level is minted onto it and made Rare - all
off the spawn's own stream, after every draw before it. Never its worn kit (LR4's law). LR3's drop chime already
rings over a body carrying a Rare, so it rings at every champion's fall.

**What moved from the design.** "It moves a third again as fast" read DFU's motor wrong: an enemy's speed is
(Speed + 150) x the scale (`enemyMotor.js` `enemyMoveSpeed`), so the Swift's thirty Speed is about a seventh faster
on foot - and its attack roll (`attackRollPasses`) passes likelier. The table says what it does. The Thorned answers
any blow of mine that lands (a bare hand's too), not a weapon's alone - the strike tail's own law.

**Along the way.** LOOT6's `pickRecord` shared its name with `world/underwaterDecorations.js`'s, past audit24's
one-home ratchet: renamed `pickLegendary`. WORLD8's pile pin read LOOT6's family. The relay's version pins re-chained
("LOOT7 moved it on last (world138 ...); KEPT-KILL moved it on (world137 ..."), soc1.json's S38 and BOUNTY1 B4.

Pinned: `test/loot7_champions.test.js` (7) - the traits, the dungeon's marks (about one in twenty, golden marks for
two locations so a client on another build cannot stand others), the street's hash (never a draw; golden for one street) and the record, the scaling and
its refusals, the name in all four places, the two traits on their tails, the guarantee over 600 seeded kills of an
orc, a rat and a Fire Daedra, its most valuable piece, the mint's mix, and the corpse door against the boosted source
seed by seed; `tools/mutants/loot7.json` (50, all dead).

### LOOT8 - the drought (2026-10-01)

`systems/lootDrought.js` (new): the character's DROUGHT - one more for every piece taken below Legendary, none again
when a Legendary or better is taken. `droughtMult` - `1 + 0.2 x floor(drought / 25)`, at most x3 - is a FINDER
(LOOT5's `registerLegendaryFind`), so at every door that ladders a list (`rollLootRarity`: a body, a dungeon's pile, a
house's, a camp's) it multiplies the Legendary threshold beside Foxglove's, and `rarityChances` keeps the product under
the Rare threshold. Off, it answers 1.

**Counted at the take, once.** A source door marks every piece it ladders `untaken` - whatever tier it rolls, a unique
find too (never its ammunition, never gold or an arrow) and a champion's minted piece - a declared item field
(`itemFields.js`), so the mark rides a save, a body's record and a peer's grant. `inventory.js` gains the one TAKE seam
(`registerTakeListener`/`tellTaken`), told by both ways a piece reaches the pack from a container: the loot window's
and quick loot's (`itemTransfer.js` `applyTransfer` into the pack) and a body's bulk take and a peer's grant
(`takeOneInto`). The drought's listener counts a marked piece and clears its mark - so a piece dropped and taken again
counts nothing, and neither does a shop's, a quest's, a crafted piece or anything else no door rolled. Online, the
first player to take a piece counts it, whichever client rolled it.

**The record**: a mod record (`LootDrought`, `systems/modSaveData.js` - the Broker's way): a whole count, at most
`DROUGHT_MAX` (100,000); a forged one is none, a new game none. `world.js` imports the module beside the sets' powers,
so the finder and the listener stand in the game.

**What moved from the design.** "A piece is counted once a session" became once EVER: a list of this session's pieces
cannot follow a piece across the wire (a room re-sends a container as new records, so a piece dropped into a shared
chest and taken again would have counted every time) - the mark on the piece itself can.

Measured: 4,000 seeded tier-8 corpse rolls gave 42 Legendaries with no drought, 51 at 25, 78 at 100 and 127 at 250
(the threshold 10.6 per mille to 31.8, still under the Rare's 63).

Pinned: `test/loot8_drought.test.js` (7) - the multiplier and its cap, the finder (off 1), the mark on every eligible
piece of 60 seeded piles (never gold or arrows; none off; it rides the wire, a forged one refused), the take (once; a
Rare one more, a Legendary none, the ceiling; unmarked, gold and off nothing), every take seam (into the pack, never
out; a throwing listener never stops a take; the body's bulk take), the record (save, load, forged, a new game), the
doors in play (sixty bodies taken, sixty counted; three times the Legendaries at 250), and a unique find's mark;
`tools/mutants/loot8.json` (31, all dead).
