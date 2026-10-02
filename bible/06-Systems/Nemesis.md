# Nemesis

**Status:** shipped 2026-10-02 (`src/systems/nemesis.js`, `test/nemesis.test.js`).
Mac: "the ability for these enemies that kill you, or a very small chance to flee at low health. These enemies can
return at a later time stronger, with a new name, a chance of more loot and taunt the player. This is our own
similar nemesis system."

A special foe that kills you, or breaks and runs at low health and gets away, is remembered by your character. It
comes back later under a name of its own, stronger, carrying better loot, and it tells you it remembers.

## 1. Who becomes one

A **special** foe: an elite (`systems/eliteFoes.js`), a LOOT7 champion (`systems/champions.js`), or a nemesis already.
It must be level 3 or more (LOOT7's floor), and never the city watch, an ally, or a quest's foe
(`nemesisCandidate`). With the **Loot rarity** row off nothing here happens: no nemesis is made, flees or returns.

Two deeds make one:

| Deed | How | Seam |
|---|---|---|
| **Slew** | Its blow takes the player's last health (melee or an arrow) | The struck seam marks the attacker (`combat/formulas.js`), the damage door takes the mark, the hurt tells `registerPlayerBlowLanded` (`systems/sigilSetPowers.js`). Confirmed a microtask later, after `hurtPlayer` is done, so a death Stendarr's mercy (`setAvoidDeathHook`) undoes makes no nemesis. |
| **Fled** | Under 20% of its health for the first time, it wins a roll (5%; 15% for a nemesis already) and runs. Out of reach before its run ends, it has escaped. | `scenes/exteriorFoes.js` update: `nemesisFleeHealth` and `rollNemesisFlee`, then `ai.flee(playerFeet, 8 s)` (`characters/enemyMotor.js`). While fleeing it does nothing else. At the end of its run or 45 m off, `escapeFoe` removes it with no corpse and no kill. |

A kill no blow names (a spell's burn, a lingering effect's round, a poison's tick) goes to the foe whose harm last
reached the player (**NEMESIS-HARM**, `systems/harmMark.js`, a leaf):

- a spell landing on the player marks its caster for 30 s (`scenes/hostMagic.js applySpellToPlayer`);
- a lingering effect's round marks its caster again as it lands (`systems/effects.js runEffectRound`);
- any foe's blow marks it for 120 s (the struck seam), since a poisoned weapon's dose rides that blow and its ticks come later.

A killing blow always outranks the mark.

**NEMESIS-DUNGEON** applies the same flee law in a dungeon to a foe of the player's alone: offline, or past the room's
shared run online (a room's layout foe vanishing on one client would leave it standing on the rest). It aims at nothing
while running, its walk still drawn. It is retired through the quest pool's own door (`escapeDungeonFoe`). A slain
nemesis closes there too.

**One flee law** for every pool: `nemesisFleeStep` answers each frame with `start`, `run`, `escape`, `cornered` or
nothing. A foe chased down, its run spent within 20 m (`NEMESIS_ESCAPE_NEAR`), is **cornered**: it turns and fights to
the end and never runs again ("Then I take you with me!"). Only out of reach does it escape. The step is asked only of a
foe running or under the line, so nothing is made per foe per frame.

**A slain foe is no one's nemesis**: a death no blow names never goes to a foe already dead (a fall after the fight).

## 2. What it becomes

A record per character:

```
{ id, rev, mobileType, gender, given, epithet, name, rank 1..5, kills, escapes, returns,
  trait (a champion's id) | null, elite, born, dueAt, out, outAt, defeated, defeatedAt, notice, history[≤12] }
```

- **Given name**: DFU's own name banks (`characters/nameHelper.js`). A monster gets a Monster1 or Monster2 name; a
  class foe (a person) gets a first name from one of the eight races' banks. The draw runs on DFRandom **seeded by the
  nemesis's id**, and the shared seed is restored afterwards: making a nemesis moves nobody's dice, and one id always
  gives one name.
- **Epithet** by the deed: *the Butcher*, *Bane of Ayla* for a kill; *the Scarred*, *Who Ran* for an escape. From rank 3,
  whatever the deed, the risen ones: *the Thrice-Risen*, *Nemesis of Ayla*. Every deed after the first ranks it up
  (to 5) and gives it a new epithet, never the one it wore.
- **Named at once**: the foe that killed you wears its new name where it stands (`entity.nemesis`). Kill it there and
  it is slain.
- **Cap**: five living nemeses. A sixth replaces the weakest, oldest, which is BURIED: its record becomes a tombstone (its
  id and a newer revision), which every merge keeps over an older copy, so an older save never raises it.
- **Bounded**: the page keeps the newest 12 slain (`NEMESIS_FALLEN_MAX`); older ones are buried too. At most 200
  tombstones are kept (`NEMESIS_TOMBS_MAX`).
- **Told once**: after a kill, the player is told once they stand alive again (online's respawn, or the next load
  offline): "The Orc that killed you lives on as Grushnak the Butcher. It will come for you again."

## 3. Its return

- **Due** one to three days later on the character's own clock (`worldTick.ownMinutes`).
- **Claimed by its roll**: the record is out from the roll that picks it, so no second copy stands while its stand loads. A stand that stood nobody frees it (`releaseNemesisStand`).
- On a due nemesis, an open-world encounter roll (`scenes/world.js runEncounterTick`) stands it instead, 50% of the
  rolls. Only one is out at a time, the highest rank first. This happens before the party's group-roll gate: a nemesis
  is the player's own.
- **Stood** by `spawnFoe(..., { nemesis })` (`nemesisSpawnOptions`):
  - an elite's glow again where elites stand (online), never a fresh roll, and outside ELITE-RARITY's gate;
  - its champion trait again, never a fresh roll;
  - then **its rank**: health ×(1 + 0.25·rank), blows ×(1 + 0.1·rank), over whatever its trait or glow gave;
  - a class foe at the player's level + 2·rank.
- **Taunt**: in sight, on me, within 25 m, once each return. The line knows its last deed and the player's name. A
  beast or a mindless thing (rats, bears, atronachs, zombies...) bares its teeth instead.
- **Out** from its stand until it dies, escapes, or leaves. Outrun past the cull, swept by a load, or the like, it is
  due again in six hours (`nemesisPresence`, which looks in the open world's pool and in whichever host the player stands in, with a few seconds' grace for a stand still loading).
- **Slain**: its record is closed (`defeated`). It never returns: "Grushnak the Butcher has fallen. Your nemesis is no
  more."

## 4. Its drop

This drop comes on top of its kind's own loot, from the elite's minting (`eliteFoes.tieredGear`):

- gold: level × rank × 15–40;
- a Magic piece 50% of the time;
- a Rare at 15% + 10% per rank, and always from rank 3;
- a Legendary at 3% + 3% per rank.

## 5. Its keeping

Two places, merged per record by `rev`:

1. **The save**: the per-mod slot `Nemesis` (`systems/modSaveData.js`), which travels with an online character. A
   record is never saved as out: the foe that stood for it is not in a fresh world.
2. **The app's storage**: `dagger.nemesis.<characterId>`. An offline death ends the run with nothing saved, and a death
   is exactly what makes a nemesis.

A reload of an older save keeps every nemesis made since, and never raises one already slain. Another character's
nemeses are its own.

## 6. Online

A nemesis is its character's own memory. A returning one is my own foe, streamed as any: its kind, health, trait, glow
and (**NEMESIS-WIRE**) its name. The foe record's `nm` is printable and at most `NEMESIS_NAME_MAX` (64) characters,
validated in `net/wire.js validFoeRecord`; the relay is `world144`. Every puppet is called what its owner calls it.

## 7. Names everywhere (FOE-TITLE)

`systems/foeTitle.js` is the one home for what a special foe is called. In order: a nemesis's own name, then a
champion's trait before its kind, then "Elite" before its kind. The target bar, the hover (named even while hostile:
`foeTitled`), the death line and the body's title all ask it.

## 7a. The card (NEMESIS-CARD, Enhanced Plus)

Everything a nemesis says or does is an **event** (`nemesisEvent` and the builders `nemesisTauntEvent`, `nemesisFleeEvent`,
`nemesisEscapeEvent`, `nemesisSlainEvent`, `nemesisRiseEvent`). An event carries:

- a kicker: *Nemesis*, *Fleeing*, *Escaped*, *Nemesis slain* or *A nemesis rises*;
- its name, and what it is (rank, kind, trait, elite);
- its **portrait**: the sprite it wore (a retextured kind's own), else its kind's by gender, at the front-facing record (the idle's, 15, else the walk's, 0);
- its **words** in its own voice: a taunt, "This isn't over!", an escape's promise, last words, a gloat;
- what happens in the narrator's voice (a beast never speaks: "Bares its teeth - it remembers you.");
- the one `line` a text surface says instead.

`systems/nemesisVoice.js` (a leaf) hands an event to the registered face, or speaks its line through the host's `say`.

The face is `ui/nemesisCard.js`, on the enhanced skin only:

- **Placement and lifetime**: the notices' twin at the LEFT edge, sliding in and out. One card per nemesis, two at most. The words are typed at 42 letters a second, then held 3.5 to 7.5 s.
- **Colours**: a blood edge for a taunt or a rise, amber for a flight or an escape, brass for a fall (the portrait grey and struck through).
- **Drawing**: drawn on drawHud's one call, behind the HUD's hide gate (hidden, its clock stops) and its hide door. The DISC29-D watchdog hides it when a host stops drawing. HUD-MOVE moves it (`'nemesis'`, with a preview).
- **Plus dressing**: the kit dresses it by role: panel and accent edge, the portrait a well, the rank a chip, the name a header rule. Stone gets brighter words, as the stats card does.
- **Accessibility**: a screen reader gets the whole line at once; reduced motion types and slides nothing.
- **Classic skin**: the presenter declines and the line is said, as before.

## 7b. The page (NEMESIS-PAGE)

`ui/nemesisPage.js` is the **Nemeses** page on the Enhanced pause menu's Stats rail, shown while nemeses are made or
any is remembered. The living come first, strongest first, each with:

- its portrait and rank;
- what it is;
- what it has done to you ("Killed you twice, escaped you once");
- when it will come (*Hunting*, *Biding*: "in about 2 days", or *Abroad*);
- its last deeds.

Then the **Fallen**, struck through, with when each fell. A character with none is told how one is made.

## 8. The numbers

Every number is a named constant at the top of `systems/nemesis.js`:

| Constant | Value |
|---|---|
| `NEMESIS_MIN_LEVEL` | 3 |
| `NEMESIS_MAX` | 5 |
| `NEMESIS_MAX_RANK` | 5 |
| `NEMESIS_FLEE_HEALTH` | 0.2 |
| `NEMESIS_FLEE_CHANCE` / `_NEMESIS` | 0.05 / 0.15 |
| `NEMESIS_FLEE_SECONDS` | 8 |
| `NEMESIS_ESCAPE_DISTANCE` | 45 |
| `NEMESIS_RETURN_MIN/MAX_MINUTES` | 1440 / 4320 |
| `NEMESIS_RETURN_CHANCE` | 0.5 |
| `NEMESIS_LOST_MINUTES` | 360 |
| `NEMESIS_HEALTH_PER_RANK` | 0.25 |
| `NEMESIS_DAMAGE_PER_RANK` | 0.1 |
| `NEMESIS_LEVEL_PER_RANK` | 2 |
| `NEMESIS_TAUNT_DISTANCE` | 25 |
| `NEMESIS_LOOT` | see section 4 |

## 9. Every host

The streaming world (`scenes/world.js`) and the single-location host (`scenes/exterior.js`) both:

- stand a due nemesis on an open-world roll;
- read its presence;
- tell the player of a kill once alive again.

The open world's pool (`scenes/exteriorFoes.js`) and the dungeon (`scenes/dungeonContext.js`) both run a fleeing foe
and close a slain one. Returns stay in the open world: a dungeon's foes are its layout's.
