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

A WEIGHTING, NEVER A FENCE: a language was a skill affix 9 times in 35; now about 1 in 25. A step with no free skill
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
| Swift | it moves a third again as fast |
| Vampiric | half of what its blows take from you heals it |
| Thorned | your weapon blows that land on it hurt you back, a seventh of them |

Every champion has twice its health and its blows a quarter harder (damageScale, multiplied - never overwriting an
elite's). Its name is the trait's and its own - `Mighty Orc Warlord` - on the HUD's target bar, its corpse and its
death line.

**Its loot.** A champion is a stronger source: its tier +4 and its quality x1.5. And it ALWAYS carries a Rare or
better: if its own roll found none, its best eligible piece is made Rare - or, carrying none, a weapon or a piece of
armour at its level is minted and made Rare. The chime rings at its fall.

**Online.** A dungeon's foes are its layout's, built on every client from the location (the elite's way): the
champion and its trait are a HASH of the location and the marker, so every client stands the same champion with no
wire word. A foe in the street or a building is its owner's: the owner rolls it, and the foe record carries its trait
(`cp`, sent only when set) to every puppet, which wears the same scaling, so a puppet's blow resolved on my side is a
champion's. Said so: when a dying owner hands a street foe over, its carried loot does not travel (the hand-over's
own law), so a champion adopted mid-fight carries none.

## 10. LOOT8 - the drought

Bad-luck protection. Every eligible piece (a weapon, armour, jewellery - LR1's eligibility) the player TAKES from a
body or a pile below Legendary adds one to the character's drought; a Legendary or better taken empties it. At every
source door, the Legendary threshold is multiplied by `1 + 0.2 x floor(drought / 25)`, at most x3 - after 25 pieces
x1.2, after 250 x3 - and never above the Rare threshold (the ladder never inverts). Counted at the TAKE because a
body's loot is rolled when its foe is spawned (`hostCombat.spawnEnemyLoot`): counting the rolls would fill the
drought by walking into a dungeon. A piece is counted once a session (dropped and taken again, it is not counted
twice). The drought rides the character's save (a mod record, the Sigil Broker's way); offline and online alike.
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
