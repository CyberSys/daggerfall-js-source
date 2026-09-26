# Sigil Sets - armour that answers to a Daedric Prince (SET)

> Design page, written before any code (2026-09-26). The slices at the foot are the order it ships in; each is
> shippable and verifiable without the next. Where the page and a shipped slice disagree, the slice's own record
> (the SET rows in `01-Overview/Port-Ledger.md`, and each slice's section here) is what runs.

## What Mac asked for

Mac, 2026-09-26: *"I wanna talk about making sigil armor sets that also come with set builds (think having multiple
of one set type grants detailed abilities)"*. Offered a shape and asked four questions, Mac chose:

- **Where they come from:** *"Sigil sets come from any source, just like weapons. Boss kills has the chance of
  dropping a rare boss themed weapon/armor set with the rarity Atheric (new). Sigil stones become a currency to trade
  for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate."*
- **The tiers:** 2 / 4 / 6 pieces.
- **Growth:** *"Grow together"* - the pieces drink Renown XP, and the bonuses scale with the LOWEST stage among the
  worn pieces, so a set is levelled as a whole.
- **Where they work:** online, never in duels - the weapon sigil's own rule.

And the four defaults offered and taken ("Lets begin this ... go all out on this, just like you did with the World
Boss"): the new rarity is **Aetheric** (from Aetherius; "Atheric" is no word of the lore), between Legendary and
Artifact; the first boss set is the gate boss's own; a set's **weapon counts** as a piece; the vendor stands at each
gate **only while it stands**, the same stock for everyone that day, **one of each** a player a day.

## The shape, end to end

```
 a foe dies online ──► its armour/shield/weapon rolls a SET SIGIL ──► worn: count per set ──► 2 / 4 / 6 tiers
 (any source)            (SIGIL1's chance law)                         │                        (the set's ABILITIES)
                                                                       ▼
 a kill, a quest ──► Renown XP ──► every worn set piece DRINKS it ──► the set's STAGE = its lowest piece's
                                                                       (scales every number of every tier)
 the gate boss falls ──► the spoils may hold one AETHERIC piece of RUHN'S REGALIA (the boss's own set)
                    └──► the SIGIL STONE ──► the SIGIL BROKER beside the gate ──► the day's stock, paid in stones
```

## 1. What a set piece is - the record (SET1)

A set piece is an item whose **sigil names a set**. The weapon sigil's record (SIGIL1, `systems/sigil.js`:
`{ power, party, xp }`) grows one optional field and loses one requirement:

| field   | a weapon sigil (SIGIL1) | a set piece: armour / shield | a set piece: weapon |
|---------|-------------------------|------------------------------|---------------------|
| `power` | the blow's per cent     | -                            | the blow's per cent |
| `set`   | -                       | the set's id                 | the set's id        |
| `party` | the fight that won it   | the fight that won it        | the fight that won it |
| `xp`    | what it has drunk       | what it has drunk            | what it has drunk   |

One sigil a piece, one growth a piece: a set weapon's blow and its set share the one `xp`, so a weapon never levels
twice. `validSigil` takes a record with a `power` or a `set` (or both) - never neither - and every reader of `power`
(the blow, its lines, its card) reads a set piece's absent power as no blow at all.

**What may carry one.** A Magic, Rare, Legendary or Aetheric piece of **armour** (the seven body pieces), a
**shield**, or a **weapon** (never ammunition). Never jewellery, clothing, an artifact or a quest's item. The pieces a
set can have are the nine places it can be worn: the helm, the two pauldrons, the cuirass, the gauntlets, the
greaves, the boots, the shield and the weapon.

## 2. The tiers and the stage (SET1)

- **Counting.** The set pieces WORN (on the equip table), counted per set. Two pauldrons are two pieces. A piece in
  the pack counts for nothing. A set's WEAPON counts once: Daggerfall readies a weapon in each hand and swings one at
  a time, so two weapons of one set in the two hands are one piece, not two.
- **The tiers.** A set's tier 1 wakes at 2 pieces, tier 2 at 4, tier 3 at 6 - each tier its own named ability, the
  lower ones staying awake under it.
- **The stage.** Every piece's own stage is the weapon sigil's: the LOWER of its rank (by its `xp`: Faint 0, Kindled
  5,000, Bright 12,500, Radiant 22,500, Ascendant 37,500) and the stage the wearer's Renown opens (1 / 10 / 20 / 30 /
  40). **The set's stage is the lowest of its worn pieces'** - Mac's "grow together" - and the card names the piece
  that holds it there.
- **The numbers.** Every number a tier has is given at Faint and at Ascendant, and a stage between takes its place in
  the line: `faint + (ascendant - faint) x stage / 4`, rounded as the number reads (whole points, whole per cents,
  whole seconds). So a set is felt from its first stage and is twice to three times that at its last.
- **Asleep.** Offline, online before the page knows its Renown, and while the wearer is in a duel, every set sleeps:
  no tier is awake, no number moves, no piece drinks. The card still shows what the set would do.

## 3. The four sets of the world (SET3)

Each is a build, and each answers to a Prince. Every one can land on any won piece, of any material.

### Malacath's Bulwark - the one who will not fall (tank)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Orc-Hide** - armour on every body part, and Endurance | +2 -> +5 armour a part; +2 -> +6 END |
| 4 | **Spite of the Spurned** - a foe whose weapon lands on you takes a share of the blow back | 10% -> 30% |
| 6 | **Unbroken** - a blow that would kill you leaves you at 1 health instead, and for a while every blow on you is halved; then it must recover | 4 -> 8 s halved; recovers 300 -> 150 s |

### Dagon's Brand - the one who does not stop (melee)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Ravager** - Strength, and Critical Strike | +2 -> +6 STR; +4 -> +12 Critical Strike |
| 4 | **Bloodfury** - your weapon blows hit harder, twice as hard again below half health | +4% -> +12% (x2 below half) |
| 6 | **Rampage** - each kill grants a stack for 12 s (a kill refreshes them all), up to three; each stack strengthens your weapon blows | +4% -> +10% a stack |

### Nocturnal's Shroud - the one who is not seen (stealth, archery)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Shadow's Grace** - Stealth, and Agility | +4 -> +12 Stealth; +2 -> +6 AGI |
| 4 | **Nightfall Strike** - a blow (a bow's too) at a foe that has not noticed you | +25% -> +60% |
| 6 | **Eventide** - a kill wraps you in shadow (Chameleon), and a foe that has not seen you keeps not seeing you | 2 -> 6 s; recovers 30 -> 15 s |

### Mora's Mantle - the one who knows (magic)

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **Forbidden Lore** - Intelligence, and every school of magic | +2 -> +6 INT; +2 -> +6 each school |
| 4 | **Waters of Oblivion** - your spells cost less magicka | 5% -> 15% |
| 6 | **Eye of Mora** - a hostile spell that strikes you is sometimes drunk instead: nothing lands, and its magicka is yours | 10% -> 30% |

## 4. Where set pieces come from (SET4)

- **Any win, online** - Mac's "just like weapons": when a list is won online (a corpse at its foe's death, a treasure
  pile when it is minted - every door SIGIL1 stamps at), every Magic-or-better piece of armour and every shield rolls
  a set sigil by SIGIL1's own chance law (200 per mille alone, 40 more a fighter past the first), one of the four sets
  of the world at even odds. A weapon's sigil, when it lands, joins a set one time in three. Offline, nothing; a piece
  never gains a sigil after it is won and never loses one.
- **The boss** - Ruhn's Regalia (section 6).
- **The Broker** - section 7.

## 5. Growth - the set is levelled as a whole (SET4)

Every worn set piece drinks what the weapon in hand drinks: the Renown XP of every kill and quest, online, with the
party's bonus, never past the last stage (`SIGIL_XP_MAX`). A rise is said once for the set, not once a piece ("Your
Dagon's Brand brightens: Kindled."), and the card names the piece holding the set back. A piece swapped in fresh
pulls the set down to its stage until it catches up - the price of a new piece, and the reason to keep one.

## 6. Aetheric, and Ruhn's Regalia (SET6)

**Aetheric** is the ladder's new top rung under Artifact: a colour of its own (the aether's pale blue-white), a pip,
a frame, a price. Nothing rolls it - it is the boss's, and the Broker's.

**Ruhn's Regalia** is the set of Valkynaz Ruhn, Warden of the Burning Gate: nine Aetheric pieces of Daedric make, each
its own fixed record (a name, three affixes at the top of the Legendary band) and a set sigil of its own set.

| piece | template |
|---|---|
| Ruhn's Gatecleaver | War Axe |
| Ruhn's Horned Crown | Helm |
| Ruhn's Right Pauldron, Ruhn's Left Pauldron | Pauldrons |
| Ruhn's Warden-Plate | Cuirass |
| Ruhn's Brand-Gauntlets | Gauntlets |
| Ruhn's Greaves | Greaves |
| Ruhn's Cinder-Boots | Boots |
| Ruhn's Gate-Shield | Tower Shield |

| pieces | ability | Faint -> Ascendant |
|---|---|---|
| 2 | **The Burning Gate** - fire resistance, and your weapon blows sear | +15 -> +45 fire; +2 -> +6 fire damage a blow |
| 4 | **Cleave** - your melee blows also strike the nearest other foe near your target | 25% -> 60% of the blow |
| 6 | **Wrath of the Warden** - when a blow leaves you under 30% health, a Flame Nova bursts from you, and your blows burn hotter for 10 s; then it must recover | 10 -> 40 fire to all within 6 m; +10% -> +25%; recovers 180 -> 90 s |

**The drop.** A kill's spoils (WB5, `systems/gateSpoils.js`) roll one more thing AFTER everything they roll today, so
every earlier spoils stays what it was: one Regalia piece, a sixth of the time, from the receipt's own seed.

## 7. The Sigil Broker - Sigil Stones buy the day's stock (SET7)

A Dremora trader stands beside each Oblivion Gate for as long as it stands. His stock is the DAY's (UTC), minted from
the day alone, so every player in the Bay sees the same pieces; it turns over at midnight UTC. He takes only Sigil
Stones - the gate's own trophy, one a kill - and each player may buy each piece once that day.

## 8. What it does not do, said so

- No server checks a set piece, as none checks a sigil: a forged save can carry one (`Multiplayer.md` "Trust").
- Jewellery, clothing and artifacts are never set pieces.
- A set never works offline or in a duel.

## 9. The slices

| slice | what | shippable alone because |
|---|---|---|
| SET1 | the record, the registry, counting, tiers, the stage | the law, pure; nothing drops yet |
| SET2 | the seams the abilities need (vitals, blows at the player, kills, spells, the unaware) | each seam a no-op until read |
| SET3 | the four sets' abilities | a test set wakes them |
| SET4 | drops and growth | sets appear and grow online |
| SET5 | the card, the tiles, the paperdoll's sets | a player can read them |
| SET6 | Aetheric and Ruhn's Regalia | the boss drops it |
| SET7 | the Sigil Broker | the stones buy the day's stock |
| AUDIT SET | the whole arc, audited | - |

## 10. What shipped, slice by slice

### SET1 - the law (2026-09-26)

`systems/sigil.js`: the record grows `set` (one of `SIGIL_SET_IDS`) and `power` stops being required - `validSigil`
takes a power, a set or both, never neither; `sigilSetId`, `sigilHasBlow`; every reader of the power (the per cent,
the words, the card's model) reads a set's armour as no blow. `systems/sigilSets.js`: the five sets and their numbers
(section 3, section 6), `stageValue` (the line from Faint to Ascendant), what may be a piece (`setPieceKind`: a body
piece, a shield, a weapon - never ammunition, jewellery or clothing), the worn pieces per set (`wornSetPieces`: the
seven body slots, the shield, one weapon a set), the state (`setState`: the count, the lowest piece's stage under the
Renown's cap, `heldPiece` / `heldRenown`, the tiers awake by the count), the session (`setSetsDueling`, `setsAwake`)
and the powers' one question (`awakeTier` - my entity alone). Pinned: `test/set1_law.test.js` (7);
`tools/mutants/set1.json` (15, all dead).

### SET2 - the seams (2026-09-26)

Every seam the powers read, each a no-op until registered:

- **The blow's word.** `combat/playerWeapon.js foeUnaware` (the foe's AI has not detected me; never a puppet's) is read
  where the foe RECORD is in hand - the swing (`resolveHit`) and the shaft (`arrowFlight.js`) - and carried as
  `unaware` through `calculateAttackDamage` to every blow modifier's new fifth argument (`entityMods.js
  weaponBlowMods`), and handed to a registered replacement core too.
- **PCAAO's core reads the port's layers - a bug found on the way.** PCAAO (Kirk.O's Physical Combat And Armor
  Overhaul) is ON by default with its redone armour formula, and that core replaces the stock one whole - and read
  neither of RF1's two layers: the weapon's own modifiers (a Loot Rarity damage affix) and the blow modifiers (SIGIL1's
  sigil). In a default game no damage affix and no sigil had ever landed. `pcaaoWeaponAttackDamage` reads both now, at
  the stock's own two places, so the sets' blows (and the affixes, and the sigils) land under either core.
- **The player's damage door** (`characters/playerEntity.js hurtPlayer`): `registerPlayerDamageMod` (before the
  shield), `registerPlayerDeathSave` (a live player left at 1, before the guild's avoid-death is asked),
  `registerPlayerHurtListener` (told what landed) - none asked on a SetHealth(0) door (drowning, the exhaustion
  collapse) or a duel's blow.
- **The struck listeners** (`combat/formulas.js registerPlayerStruckListener`) beside the Ring of Namira's one slot.
- **The player's own kills** (`systems/playerKills.js`): every pool's damage door tells it when MY blow killed a foe
  (never a peer's), and a puppet's owner's `slain` word tells it too.
- **A player's cast cost** (`systems/spellcost.js registerSpellCostMod`), never a foe's: the foe caster prices its
  cast with the player's skills (a recorded quirk) and asks with `portMods: false`. Never under 1.
- **The port's absorption chances** (`systems/absorption.js registerAbsorptionChance`), each its own roll under DFU's
  two gates (a Destruction effect, room in the magicka).
- **The door** (`systems/playerDoor.js`): the running host's magic engine publishes its live foes (the town's
  defenders passed by), my feet, a hurt as mine through the foe's own sinks, and a spell on me - every frame it runs.
- **The duel's word**: `scenes/world.js duelFrame` tells `setSetsDueling`.

Pinned: `test/set2_seams.test.js` (8); `tools/mutants/set2.json` (20, all dead).
