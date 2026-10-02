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

A spell's or a poison's kill names no attacker, so it makes no nemesis. Fleeing is the open world's alone: a dungeon's
foes are the layout's on every client, and one that vanished would need its own wire word.

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
- **Cap**: five living nemeses. A sixth replaces the weakest, oldest.
- **Told once**: after a kill, the player is told once they stand alive again (online's respawn, or the next load
  offline): "The Orc that killed you lives on as Grushnak the Butcher. It will come for you again."

## 3. Its return

- **Due** one to three days later on the character's own clock (`worldTick.ownMinutes`).
- On a due nemesis, an open-world encounter roll (`scenes/world.js runEncounterTick`) stands it instead, 50% of the
  rolls. Only one is out at a time, the highest rank first. This happens before the party's group-roll gate: a nemesis
  is the player's own.
- **Stood** by `spawnFoe(..., { nemesis })` (`nemesisSpawnOptions`):
  - an elite's glow again where elites stand (online), never a fresh roll;
  - its champion trait again, never a fresh roll;
  - then **its rank**: health ×(1 + 0.25·rank), blows ×(1 + 0.1·rank), over whatever its trait or glow gave;
  - a class foe at the player's level + 2·rank.
- **Taunt**: in sight, on me, within 25 m, once each return. The line knows its last deed and the player's name. A
  beast or a mindless thing (rats, bears, atronachs, zombies...) bares its teeth instead.
- **Out** from its stand until it dies, escapes, or leaves. Outrun past the cull, swept by a load, or the like, it is
  due again in six hours (`nemesisPresence`, with a few seconds' grace for a stand still loading).
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

A nemesis is its character's own memory. A returning one is my own foe, streamed as any: its kind, health, trait and
glow. Its **name** is not on the wire yet, so the others see a champion's or an elite's name, or the plain kind.

## 7. Names everywhere (FOE-TITLE)

`systems/foeTitle.js` is the one home for what a special foe is called. In order: a nemesis's own name, then a
champion's trait before its kind, then "Elite" before its kind. The target bar, the hover (named even while hostile:
`foeTitled`), the death line and the body's title all ask it.

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

## 9. Not yet

- Spell and poison kills (no attacker reaches the hurt).
- Fleeing in dungeons.
- The name on the wire.
- Returns in the single-location host (`scenes/exterior.js`).
- A journal page listing your nemeses (`allNemeses()` is ready for one).
