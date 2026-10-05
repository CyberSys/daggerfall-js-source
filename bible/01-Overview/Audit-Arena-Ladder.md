# AUDIT ARENA-LADDER (2026-10-05) - fighters that telegraph at each other, a climb that costs, the bout's holes

The owner, before the arena's branch merged: "Before we merge this. Can you do a comprehensive audit on the new arena?
Ensure AI enemies sometimes recieve telegraphed attacks, ensure climbing the PvE ladder isnt an easy feat, and look at
where we can make improvements". Four read-only lenses ran over the arena (`bible/11-Multiplayer/Arena.md`): the
telegraphs, the climb's difficulty, the bout's correctness, the online trust. Each verified finding was reproduced
against the real modules (the bout driver, the brain, the relay's brain, the account service over node:sqlite), and
the owner chose the climb's law from four questions:

- what a lost ladder bout costs - **"Lose the tier's run"** (not "lose one won bout", not "keep as is");
- what may be used on the sand - **"No cheese spells or potions"** (no potions, Levitate, Invisibility/Chameleon or
  Calm, and a height ceiling over the ring);
- which difficulty changes ship - **"Elite champions"** alone (NOT raising the summit, NOT the time-out rule offline,
  NOT the fixed mountain - recorded below as not done);
- how much of the online side - **"Relay and service"**: the relay's judges, telegraphs between fighters and faster
  fighters; the service's laurel needing distinct opponents and ladder bouts keyed per player. A relay version
  (world167) and an account-service migration (0082, acct79).

Pinned by `test/arenaladder_audit.test.js` (23, each red on the code before it) and mutation-checked
(`tools/mutants/arenaladder.json`, 54, all dead). Nothing here was seen in a browser.

## Telegraphs (the owner's first ask)

Before it, TACT4's telegraphed blows were only ever at the local player (`ai/tactics.js`: `key === LOCAL && _me`, the
verdict at `_me.feet`), so an AI fighter never received one: the Grand Melee's fighters, an exhibition's pair, the
two-against-one's partner never wound up at each other, and the relay's fighters had no shapes at all - its `atk`
word was a 350/450 ms lead on every blow, casters included.

| | Finding | Done |
|---|---|---|
| T1 | The relay cannot import `characters/mobileTypes.js` (the brain's graph), so it could not know a kind's shapes | The families (`BLOW_FAMILY` by MobileTypes number, `BLOW_CASTERS`), `blowShapesOf` and `inBlow` moved to the leaf `ai/blowShapes.js`; `ai/foeBlows.js` hands the leaf's own on. Every number pinned against the kind it names |
| T2 | No fighter wound up at another | `blowAim`: the local player's feet (TACT4's law), or on the sand a BOUT-MATE's - a fighter of the same live bout on another side, neither out nor held. The blow is marked for that one (`s.blow.tg`) and drawn for the stands to `SAND_DRAW_RANGE` (100 m - the colosseum is 93 m end to end). Street infighting and a peer's foe still see none |
| T3 | The landing asked only the player's feet | The verdict where the mark stands; a wind-up whose foe turned on another lands on no one; a blow with no mark is mine (TACT4's) |
| T4 | The foe-vs-foe hit paths never asked the shape (and a verdict left unspent could land on the player's next swing, out of reach x1.5) | `dungeonContext.js` and `exteriorFoes.js` resolve a fighter's blow on a fighter by `blowConnects` and weigh it by `blowScaled`, as at the player |
| T5 | A dodged telegraph was no miss: the hosts' resolution returns before DFU's damage roll, so the judges' miss count gave the fighter none and the replay showed no swing | `registerBlowDodgedListener`; `arenaBouts.blowDodged` counts the miss and records the swing (`world.js`, `exterior.js`) |
| T6 | The relay's fighters had no telegraph | `net/arenaBrain.js`: a fighter of the tier (level 10 up - `ARENA_BLOW_TIER_LEVEL`, the brain's - or an elite), its cooldown spent (8-15 s, the brain's), a roll (`ARENA_BLOW_CHANCE` 0.35 a blow begun) winds up a shape at its foe - a player or another fighter. The `atk` word carries `s`, `yw`, `ox`, `oz`; it lands by `inBlow`, weighed by the shape; a step out of it is a miss. Every screen draws it off the word (`arenaBouts.js` relayWord) |
| T7 | The Grand Melee: my damage was carded to the nearest fighter facing me - a lunge reaches 4.5 m, so the fighter behind me in its lane took the card | `attackerOfMe` reads the striker the formula named a moment ago (`C.hitMe`) first |

Which fighters telegraph: of the tier (TACT4's) - T5's Warriors, T6's Giant Scorpion, all of T7 to T10, and every tier's
champion now (an elite); never a caster (Healer, Sorcerer, Mage).

## The climb (the owner's second ask)

The lens's measure, before it: forty wins to the Grand Champion, a loss costing only the purse (the run kept, the
healers making the fighter whole), so every step fell to retries; potions, Levitate over the melee-only beasts and
champions, Invisibility no class fighter sees through and a Calm on the fighter; online, the relay's fighters walked at
3.2 and 3.6 m/s - slower than any character's walk - so one blow and three minutes walked away won the judges' card:
37 of the 40 steps, the Grand Champion's title included, fell to an unmodified client.

| | Finding | Done |
|---|---|---|
| L1 | A loss cost nothing but the purse | `ladderAfter`: a loss (a draw at the judges is one) sets the tier's run back to its first bout; `runLost` said ("Your run in ... is over"). A champion beaten stays beaten |
| L2 | The champions were the tier's ordinary foes (the T6 Spriggan, level 3, and the Grand Champion's Iron Atronach - 25 HP on a low roll - the softest after T1) | Every tier's champion an ELITE FOE (`champ()` in `LADDER_TIERS`, the floor's stage spawns `eliteFoe`; the relay's `arenaFoeStats` x5 health, x3 damage - `systems/eliteFoes.js`'s, pinned equal). Of the tier that telegraphs, so every champion winds up its blows. Ledger A ELITE-CHAMPIONS: an exception to Mac's online-only elites, by the owner's call |
| L3 | The kit: potions, Levitate, Invisibility, Chameleon, Shadow, Calm (Charm) | `systems/arenaKit.js`: while the player's own bout stands no potion is drunk (`useItem` refuses, the bottle kept), no spell carrying effect 13, 14, 23, 24, 34 or 43 is cast (`hostMagic.js` `wardedHere`, the one engine every host runs), and those already on the fighter are stripped while the fight is live (both the floor's and the relay's frame). A ceiling 4 m over the sand (`SAND_CEILING_M`, the motor's ring clamp, `ceilAbove`): over the highest honest jump (2.7 m), under a Levitate's reach |
| L4 | Online, one blow and the clock walked away | The relay's fighters run (`ARENA_CLASS_SPEED` 5.0, `ARENA_BEAST_SPEED` 6.0 m/s); at the time limit a ladder bout is the player's only if their side took `LADDER_JUDGES_SHARE` (half) of the opponents' whole health (`systems/arenaBout.js` `judgesFloor`, the relay's ladder alone) |
| L5 | Online, a loss was a receipt the device carried - a device that never carried it kept every step | THE ATTEMPT'S TICKET: `/v1/arena/attempt` mints one for the account's next bout (16 hex, `arena_attempts`); every attempt still open is FORFEIT first (its loss row written, its run broken). The relay opens a ladder bout only for one ('no ticket') and signs it into the receipt (`z`); the service keys the bout's row by it. The client carries every receipt it holds before it asks (`arenaOnline.js` `askTicket`), and says so when no ticket comes |

## The bout's holes (the third ask: "where we can make improvements")

| | Finding | Done |
|---|---|---|
| A1 | HIGH: fatigue run out on the sand killed the player - a bout's foe is always near, so `exhaustionOutcome` answered death, and `onExhausted` passed no spare | Under the bout's spare the collapse leaves 1 health (the bout's fall) and a breath of fatigue - never the death screen, never the hour of rest (`dungeonContext.js`, the duel's law) |
| A2 | MEDIUM-HIGH: a Dispel Daedra/Undead or a Wabbajack won a champion bout outright - the body removed past the foe yield floor, the driver reading the gone body as a fall: purse, tier and title paid (T8's Seducer, T9's Vampire, T10's third melee) | `inBout`: no dispel (`world.js`, `dungeonContext.js` - the two hosts that cast one) or Wabbajack (those and `exterior.js`) takes a fighter on the sand; a body gone without falling VOIDS my bout - healed, nothing won or lost (`voidBout`) |
| A3 | MEDIUM: a player out of a Grand Melee stayed the fighters' target - `setPlayerBout` kept a copy at the bell, so the driver's `out` and `hold` never reached the gate; and the out player's blows still felled fighters | The tag held live (`playerBoutOf` answers a copy); a blow of mine after I am out is made good, as a blow from outside is |
| A4 | LOW-MEDIUM: a fighter whose spawn landed after the stage changed was removed off the host's stage, never its own - a body at the gate that could not die | `(C.stage ?? stage).remove`, all four removals |
| A5 | LOW: Recall left a live bout unsaid - no loss, no run lost | Recall refused while my bout holds (`world.js`, `exterior.js`) |

## Online trust

| | Finding | Done |
|---|---|---|
| O1 | HIGH: the relay's fighters out-walked (L4 above) | L4 |
| O2 | MEDIUM-HIGH: win-trading with second accounts bought the season's #1 and the laurel - three rated bouts wore it, a pair counted five a day | The laurel takes `ARENA_CHAMPION_MIN_BOUTS` 10 rated bouts against `ARENA_CHAMPION_MIN_FOES` 5 different accounts (`laurelWorthy`, the board's `foes`); a pair's rated bouts counted `ARENA_PAIR_SEASON_MAX` 10 a season |
| O3 | LOW: a ladder bout's id could be taken over to cancel another's unclaimed win (`arena_pve` keyed by the room id, which the hall lists and the room forgets after ten minutes) | A ticketed bout's row is keyed by its ticket, the account's own (`claimLadder` refuses another account's: 'reused'). A receipt from a relay before world167 keeps the old key for its week |

## Deploy order

1. The account service, **acct79**, with migration **0082** (`npx wrangler d1 migrations apply daggerfall-accounts
   --remote`, then deploy).
2. The relay, **world167** (`npx wrangler deploy` in `server/`). Every connected player reconnects once.
3. The site (CI). Between 2 and 3 an older client's ladder `in` carries no ticket and is refused ('no ticket', said as
   "The Herald could not enter your bout"); its exhibitions, players' bouts and private sessions are untouched.

## Not done (named so they are not mistaken for missing)

- **Raise the summit, gate a tier on the character's level** - not chosen. The mountain tops out at level 21: a
  level-30 character finds every tier below it.
- **The time-out rule offline** - not chosen: offline the judges are as they were (the relay's ladder alone has the floor).
- **The fixed mountain** - not chosen: a class fighter's gear is still rolled at the player's level, and a monster's
  health still follows SOFTCAP for a veteran with Master Skills on.
- **Save-scumming offline** - the floor refuses a save, so a quit mid-bout reloads the save before it; nothing in a
  single-player save can prevent that.
- **Replays** do not carry a telegraph's shape (`systems/arenaReplay.js` records the swing, not the ground's mark).
- **Plausible, not verified** (the lenses' own words): the bout's spare skips the player's damage mods and hurt
  listeners on the sand; a quickload during a city exhibition may keep the stale bout; a blow on the first-landed body
  of a multi-fighter bout before the last spawns; `pending` never cleared when the floor refuses after `ask()`; spell
  blows have no reach check on the relay and a Shaft claim's cap is not held to a bow template; an exhibition's
  verdict could re-run if its room is evicted before `done`; the house's seeded record as a wager's fallback; the
  Fastest Grand Champion board times claims, not bouts; a late claim across a season boundary.

## The four hosts

`scenes/world.js` and `scenes/exterior.js` (the streaming hosts) - the dodge listener, the Wabbajack guard, the Recall
refusal, and world.js's dispel filter; `scenes/dungeonContext.js` (the floor instance and the undercroft's pit) - the
collapse, the dispel filter, the Wabbajack guard, the foe-vs-foe shape; `scenes/worldModes.js` - both stages spawn the
champion elite. `scenes/exteriorFoes.js` carries the street's foe-vs-foe shape for both above-ground hosts.
