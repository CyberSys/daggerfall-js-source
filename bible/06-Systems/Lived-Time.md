# Lived Time - your own time online (LIVED1, 2026-09-29)

Mac, sharing the Discord (Dracula/Valentin: *"my money, my guild and i cant even travel at day
anymore"*; Subdon: *"since we cant just import/export characters anymore, how we getting
lycanthropy now? becuse we need to wait 72 hours but the in game clock aint moving"*):
*"Makes a good point. We need a better system for time online instead of a band aid fix.
Something detailed and that really makes sense"*.

It answers RESTX1's open door (Mac, 2026-09-15: *"We can dive deeper in how we want to handle it
at a later time but for now this is the solution"*) and OL3's recorded alternative (*"the shared
world keeps ONE clock, so per-player deadlines would be a different design"*). This is that design.

## The problem, stated whole

DFU has one clock, and the player owns it. Every "and then time passes" moves it: a night's sleep,
a loiter, a journey, a training session, a sentence, the vampire's fortnight in the grave. Every
per-minute law walks the minutes it moved.

Online there is one clock too, but it is the world's (WORLD5): a function of wall time, the same on
every screen, and nobody may move it. So every "and then time passes" became a refusal, and each
system that needed its time back got a patch of its own:

- RESTX2's `_onlineSimMinutes`, a counter local to one rest session and forgotten when it ended,
  fed the encounter roll and the magic-round catch-up;
- REST-ROUNDS aged spell effects over those minutes, and AUDIT RISE-REST F2 paid the needs;
- MAC-LVL1 banked a skill-check credit on the entity and spent it at the rest's end;
- WORLD5 C3 shifted every marker a save carries across an absence, and each marker someone later
  remembered was added by hand (MAC-BUG3's repairs; DISC10-D/E V9's infection and werewolf stamps;
  AUDIT DISC28 TM-4's body clocks);
- DISC28-E / TM-3 / TM-4 skipped the minutes spent dead the same way;
- WORLD5 C6 paid the exhaustion collapse's health once a world hour; C9 served no prison days; C14
  withheld the cautious traveller's heal; a journey passed nothing.

What never came back:

- **An infection counts only days spent online and awake.** The turn needs more than three calendar
  days after the dream, which is 6-8 real hours of play; no rest, loiter or journey counts.
- **A guild's 28-day rank wait is 56 real hours.**
- **A repair's days are real hours,** and training's hours and a sentence's days pass nothing.
- **A journey's inn nights are billed and never slept.**

The patches also disagree at their seams. Each of these was found by reading the code:

1. A rest crossing a simulated midnight rolled a disease's day and moved its `lastDay` ahead of the
   world. The next real round read `daysPast = -1` (no guard in diseases.js), gave the day back, and
   rolled it again: one extra damage roll per simulated midnight.
2. After an online night the needs record sat ahead of the world. A load or a relay correction inside
   that span read `awakeSince > now` and reset hunger, thirst, wetness and drink to fresh: a free meal.
3. A rest in a rented room counted the room's hours on its own counter and said "Your time for this
   room has expired". The landlord then checked the world's clock, and the room stayed.
4. A long rest ran the curse clocks on simulated minutes. The dream could play and the turn land
   mid-rest, then the markers sat ahead of the world.
5. Conjured items were not aged by an online rest; spell effects were.

## The design: two clocks

**THE WORLD'S CLOCK** (`worldTick.js worldMinutes`), unchanged. It is WORLD5's shared clock. Nobody
moves it; the sky, the calendar and everything every player shares read it.

**THE CHARACTER'S CLOCK** (`worldTick.js ownMinutes`). One number per character, saved with them.

- **Offline it IS the world's clock.** One variable; DFU byte for byte. Nothing offline reads
  differently, and every test of the offline game stands as it was.
- **Online:**
  - it runs WITH the world's clock while the character is in the world and alive, a minute for a
    minute (the wire's one rate, TimeScale 12);
  - it runs AHEAD whenever the character spends time the world does not wait for - every
    RaiseTime DFU has (`advanceOwnMinutes`, and the tickers' `advance`);
  - it STANDS while the player is away (no tick runs for someone who is not here) and while they
    are dead (no tick runs under the death screen).

**The rule for which clock a law reads.** The sun, the moons, the calendar and the world everyone
shares read the world's. The body, its magic, its needs, its contracts and its standing read the
character's.

### Reads the world's clock (as before)

- sun and moons, day and night, seasons, holidays, weather, lighting, music;
- the vampire's day and night (VAMP-DAY's -20/+20), the no-departure-by-day rule, a sun-damaged
  career's sunlight, the werewolf's full moon;
- the night-or-day table a wandering spawn is drawn from (`skyMinutes` on the spawn roll);
- the survival air (the month and the hour a temperature is felt at) and the tavern kitchen's hours;
- regional prices (ECON1), the price flags off the world's index, the six climate zones, faction
  powers and regional conditions (the shared day's rolls);
- shops, gates, guild halls and NPC schedules (OL4, OL5), the day's shelf stock;
- gates, raids, bosses, the broker, respawns (WORLD8), campfires, dropped torches;
- **quest clocks** (WORLD7's played time; OPEN 1 below).

### Reads the character's clock (changed online; offline identical)

- **the magic rounds** - spell durations, diseases, poisons, the infections' dream and turn, the
  vampire's thirst, the werewolf's urge and once-a-day change;
- **the needs** - hunger, thirst, sleep, and fatigue's per-minute drain; food, drink and meals;
- conjured items' lifetimes, and the enemy alert's 8-hour decay;
- **the skill check** (six hours), training's cooldown (twelve hours), and a guild's rank wait
  (28 days) and join date;
- the Thieves Guild's and Dark Brotherhood's letters (three days);
- **rented rooms, loans (with their reminders and the Empire's call) and repairs**;
- the reputation drift (112 days) and the racial override quests (the clans' 38 days, the cure's 84);
- the wandering-spawn cadence (the minute a roll is asked on).

### What moves the character's clock

Everything DFU calls RaiseTime:

- a rest or a loiter (each ten-minute sub-tick);
- a fast travel: the trip's minutes, inns and ships included;
- a guild's training (three hours), and a quest's TrainPc;
- a prison sentence (its days), plus the four release hours;
- the vampire's turn: the fortnight to dusk;
- a tavern meal, a drink, a blackout night, a camp's cooking and the hunting search;
- the exhaustion collapse (an hour);
- the cures' hour.

The world's clock stands through all of them. The next tick walks the span on the character's clock,
exactly as the offline tick walks a raised clock: the broker (capped, under the synthetic shield), the
per-minute loop, the day block's own half, the calendar's own arms, the letters and the needs.

## What it retires

Each is stamped SUPERSEDED where it is written:

- `_onlineSimMinutes` (RESTX2), and MAC-LVL1's `restSimMinutes` credit (dropped from the save's list);
- REST-ROUNDS' and AUDIT RISE-REST F2's online arm of `createPlayerTicker.advance`;
- WORLD5 C1, the claim that moved the tick's world reading;
- WORLD5 C3's arrival shift (`alignEntityClocks`) and every marker added to it since;
- AUDIT SURV-TIERS' needs shift across a relay correction;
- the revival's body shifts (DISC28-E's needs pause, TM-4's carried effect clocks);
- WORLD5 C6's once-a-world-hour collapse pay, and C9's prison without days (with DEATHLOOP1's
  online floor, now inside the refill);
- C14's withheld cautious heal, and WORLD5's "no jump, no catch-up window" for a journey;
- OL2's "now" in the travel popup and the enhanced map;
- OL3's real-time wording for rooms, loans and repairs.

## Absence and death

**Away.** The character's clock stands; nothing ages and nothing needs carrying. What an arrival
still does is the world's:

- the tick's world reading re-anchors, so the absence walks none of the world's arms (the standing
  rule);
- TM-1 stands (Mac, 2026-09-28: *"Recovery only"*): over the world's minutes from the one the save
  left at, a reputation below zero moves back one point per 112-day boundary;
- the day's sky is rolled from the shared day's seed.

The needs keep SURV7's kindness: a break longer than the world's day comes back fed, watered and
rested. An hour away no longer costs an hour of hunger - the clock does not punish absence (OL3), now
by construction.

**Dead.** The character's clock stood under the death screen, so the body is billed nothing and
nothing of theirs moves (DISC28-E's rule, now the clock's own). The world's half of the dead span
still walks the world's minutes since the last reading, then re-anchors: its day block (the price
flags, the six zones) and its calendar arms (powers, conditions).

The character's own calendar - the landlord, the loans, the drift, the racial quests - does not walk
the span. They did not live it. (This supersedes TM-3 for those four arms.) TM-2's PreventEnemySpawns
stands.

## The vampire, and the sun

The sun is everyone's. A rest moves the character's clock, not the sky, so a vampire still cannot set
out by day. The sunlight refusals (the career's, the curse's, and PARTY-TRAVEL's) now add, online,
when the world's night falls, in real minutes: *"You cannot initiate fast travel during the day. The
sun is the world's - night falls in about 23 minutes."* (`worldNightfallText`).

A world day is two real hours, so the wait is at most one. The vampire's thirst is theirs: rests and
journeys make them hungry, as DFU has it. A vampire must still be fed within their own day to rest.

## Party

- Each member's clock is their own. A party rest mirrors the leader's night, and each mirror spends
  its own hours (the follower's advance hook).
- A buff a partner casts on you runs on your clock.
- Nothing a character's clock does is visible to anyone else: everything shared reads the world's.

## The numbers, and what a rest can buy

The character's clock opens no faucet the world pays for. Everything the world owns reads the world's
clock: stock, prices, respawns, events, the day's shelf.

What a player can speed by resting is their own waits, each exactly as DFU lets a single player, and
every cost comes with it:

- **the waits:** an infection's turn, a promotion's 28 days, training's cooldown, a repair, a letter,
  the reputation drift, the cure roll;
- **the costs:** effects run out; hunger, thirst and sleep build; the vampire thirsts; the werewolf's
  urge builds; rooms and loans run.

Realm-Arc section 5's "a cooldown ... the skill-clock credit from resting is capped per hour" remains
available as a named constant if play shows it is needed. The credit is gone; the gate is the clock's.

## On screen

- **Rest window:** "World time 15:05 - you rest on your own clock" (a loiter "waits"), on the classic
  window's pages and the default skin's rest card alike (AUDIT LIVED1 O, S).
- **Travel popup and enhanced map:** the trip's days, as offline, with "Online: the days pass on your
  own clock. You arrive in the world's present." / "N days of your time".
- **Tavern offer:** "The room is yours for 7 days of your time (14h of play) - resting spends it,
  time away does not." - on the classic window in two rows, split at the play's bracket, so it fits
  the screen (AUDIT LIVED1 N). Heart's Day, a meal's holiday and the kitchen's hours read the world's
  calendar (`worldNow`), and so do the temple's free and half-price cure days (AUDIT LIVED1 C).
- **Bank due-by and the smith's ready line:** "in 3 days of your time (6h of play)".
  `ownTimeLeftText` says the time left on the character's clock, and the most play it can take. The
  classic bank's parchment and the character sheet's loan column have no room for the play, so they
  take `ownTimeLeftShort` ("in 359 days of your time", "in 359 days"); a loan already due says "due
  now" (AUDIT LIVED1 L, P, Q).
- **The daylight refusal:** the nightfall words ride their own HUD row, since the classic HUD draws a
  line unwrapped (AUDIT LIVED1 M).
- **The Online pane's rules:** the character's own time, said at the door.

## The save

`classicMinutes` is the character's clock. Offline it is the one clock, as always. Online a save also
writes `worldMinutes`, the world's minute it left at. That field is additive: an older build ignores
it.

- **Online load:** the character's clock is restored from `classicMinutes`. The absence is
  `worldMinutes` to the world's now. A save from before LIVED1 carried the world's minute as its own,
  and every marker in it was stamped on that clock, so it answers for both.
- **Copy to offline:** the offline world's clock is the character's, so every marker of theirs stays
  in tune - and the WORLD's stamps the envelope carries (a quest clock's sample, a CreateFoe's last
  wave, the rumours' limits, the spawned dungeons' ledger, a fire's hours) are rebased onto it by the
  distance between the two clocks at the save; `worldMinutes` goes (`systems/offlineCopy.js
  offlineCopyOf`, AUDIT LIVED1 E).
- **Bring online:** the offline clock becomes the character's; the world's stamps move onto the shared
  clock, and the envelope says it joined at the world's minute, so the first join pays no absence the
  character never had (`onlineCopyOf`, AUDIT LIVED1 G).
- **Save cards:** a card is a local slot's, and a local slot plays offline on its one clock - so every
  card says `classicMinutes`' date, the date it loads at. [AUDIT LIVED1 T corrected this line: it said
  the world's date, which no local slot but a copy carried.]
- **A save from before LIVED1** whose disease day, poison minute or curse clock sat ahead of its clock
  (RESTX2's checkpoint under a rest) is brought back to it on the online load (`save.js
  clampMarkersAheadOf`, AUDIT LIVED1 F).

## The law in code

- `systems/worldTick.js`:
  - the clock: `ownMinutes`, `setOwnMinutes`, `advanceOwnMinutes`;
  - `tickPlayerMinutes`' two windows and its `raiseMinutes`;
  - `runDayChange` and `runCalendarArms` take `arms` (`DAY_ARMS.world` / `own` / `all`);
  - `runMagicRoundsFor`' `skyMinutes`;
  - arrival and death: `alignEntityClocks` (arrival), `skipDeadMinutes` (the world's half), and the
    world arms' high-water mark both respect (AUDIT LIVED1 I);
  - `tickInFlight`: an online raise from inside a tick is a bare move (AUDIT LIVED1 J);
  - words: `ownTimeLeftText`, `ownTimeLeftShort`, `worldNightfallText`.
- `systems/offlineCopy.js`: the two doors between the lanes (AUDIT LIVED1 E, G).
- `scenes/shared.js`:
  - the ticker's `ownMinutes`, and `advance` online;
  - RaiseSkills on the character's clock;
  - the turn's fortnight;
  - the rest deps' composed quest stand-down.
- `systems/restSession.js`: one sub-tick law.
- The four hosts:
  - `world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js`: every personal read on the
    character's clock, every sky read on the world's (the dungeon's clock view is the character's);
  - `world.js` only: the journey's days, the cautious heal, the nightfall words, and the arrival.
- `scenes/arrestFlow.js` (the sentence), `systems/rest.js` (the collapse), `systems/save.js` (the
  envelope and the arrival).
- The words: `ui/restWindow.js`, `ui/travelPopUp.js`, `ui/heldMap.js`, `ui/tavernWindow.js`,
  `ui/enhancedTavern.js`, `ui/enhancedTrade.js`, `ui/enhancedHud.js`, `ui/enhancedMenu.js`.
- Spawns: `systems/encounters.js` and `systems/campEncounters.js` (`skyMinutes`).
- The curses: `systems/lycanthropy.js` and `systems/vampirism.js` (`skyMinutes` for the moon and
  the day).

No relay change. The servers keep the save opaque, and `RELAY_VERSION` does not move.

## OPEN - Mac's calls

1. **Quest clocks on the character's clock?** LIVED1 leaves WORLD7: a quest's timer charges played
   time, and a rest or a journey charges it nothing.
   - **Recommended:** a quest's COUNTDOWNS (the Clock resource: "you have N days") charge the
     character's own time, so a journey spends a quest's days as in DFU, and a loiter fast-forwards a
     quest's wait ("come back in three days"). This is FB-2026-09-25's open "loiter fast-forward for
     timed quests".
   - Its time-of-day windows (DailyFrom, "at night") stay on the world's sky.
   - It tightens WORLD1's leniency: N days would no longer be 2N real hours of play.
   - A shared quest runs on its owner's clock.
2. **A vampire's daylight departure.**
   - **Recommended:** keep DFU's refusal on the shared sun, with the nightfall words above.
   - **The alternative:** let them set out by day at the cost of waiting for dusk on their own clock.
     They would arrive in the world's day, at -20.
3. **A rest cooldown** (Realm-Arc section 5), if play shows the character's clock is rested too
   freely.

## Record

- Pins: `test/lived1.test.js` (13). The superseded pins are re-aimed in their own files; each re-aim is
  named in the commit.
- Mutants: `tools/mutants/lived1.json` (26, all dead). The older slices' records that named the retired
  source were re-aimed by content where their law stands (46, all dead) and retired with it where it
  does not (14: the arrival's and the correction's shifts and pauses, the session counter and its seed,
  the rest arm's second window).
- Audited: `01-Overview/Audit-Lived1.md` - six lanes, every finding reproduced and fixed or recorded;
  `test/auditlived1.test.js` (13), `tools/mutants/auditlived1.json` (67, all dead).
- Not verified in a browser: no online session exists in this container.
