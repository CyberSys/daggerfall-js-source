# Online Time - a sky that turns, a clock for the world's business, and your own

TIME (proposed 2026-10-01). Mac: *"I want to talk about how we could change online time, currently I
just feel like people have to wait insanely long, werewolf forms last insanely long, etc"*, then *"I
don't want a band aid, I want a detailed way we can do this."*

**Status: DESIGN. Nothing on this page is built.** It extends LIVED1 (`Lived-Time.md`), which gave every
character a clock of their own; it keeps all of it. Offline is untouched: one clock, DFU's TimeScale 12,
byte for byte.

## 1. The problem, stated whole

DFU's day is two real hours (TimeScale 12), and a single player can afford that: any wait is a rest of a
few seconds. Online, WORLD5 made the world's clock a function of wall time that nobody can move, at the
same rate. LIVED1 then gave each character their own clock, which a rest, a journey or a sentence does
move, and the waits that belong to the character came back as DFU has them: an infection's turn, a
promotion, training, a letter, a repair.

What LIVED1 could not reach is every wait on the SKY: a wait for a time of day, a date or a moon. No rest
moves the sky, so each of those is a real-time wait at the single-player rate:

| Wait | Real time today | Why no rest helps |
|---|---|---|
| A werewolf on a full-moon day | 2 h in beast form, forced back every game minute; two such days in every 64 h | the moon is the sky's (`lycanthropy.js` reads `skyMinutes`) |
| A vampire waiting for dusk | up to 1 h | the sun is the sky's (`worldTick.js worldNightfallText`) |
| A quest's `daily from` window | up to 2 h | the hour is the sky's (`quest/actions.js DailyFrom`) |
| A quest's countdown ("come back in 3 days") | 2 h of play per game day | charged by played time alone (WORLD7); a rest charges it nothing |
| Night | 1 h of dark | - |

The waits on the character's own clock are not on this list: they are already a rest away. A
promotion's 28 days is about five minutes of resting, an infection's turn under a minute.

And the tree already carries the pattern Mac called a band aid: each sky wait that hurt got a fix of its
own, and each fix is a special case.

- **GUARD-ONLINE** (`quest/onlineGuard.js`): one quest's `daily from 00:00 to 03:00` is replaced, online
  and for that quest alone, by a window that opens a minute after the player arrives, because the real
  window came round once every two hours.
- **The nightfall words** (`worldNightfallText`): a vampire is told how many real minutes until the
  world's dusk, because nothing could shorten it.
- **WORLD7**: quest clocks charge played time, one bounded step a frame, because the world's clock would
  have charged them through every logout and a rest could not charge them at all.
- **OL4 / OL5** (`buildingLocks.js`): shops and guild halls never close online; the code says the shared
  clock is the reason.

The next one would have been the full moon. This page replaces the pattern with a model.

## 2. The model: three clocks

| Clock | Rate online | Who moves it | What reads it |
|---|---|---|---|
| **The sky** (new) | TimeScale 48: a day every 30 real minutes | nobody; a function of wall time | what the world looks like, and every "what time of day, what date, which moon" |
| **The event clock** (WORLD5's shared clock, unchanged) | TimeScale 12: a day every 2 real hours | nobody; a function of wall time | what the world schedules, stocks, prices and meters for everyone; the relay's every read |
| **Your clock** (LIVED1's, unchanged) | TimeScale 12 while you play | you: a rest, a loiter, a journey, a sentence | your body, magic, needs, contracts and standing; and, new, your quests' countdowns |

LIVED1's "world's clock" becomes two: the sky, which is new, and the event clock, which is the clock
LIVED1 already calls the world's. In code `worldMinutes()` keeps its meaning (the event clock online, the
one clock offline) and `skyMinutes()` is added beside it; renaming every reader across the open pull
requests would be churn for nothing.

**The rule for which clock a law reads.** Ask what the law is about.

1. **What the world looks like, or what the hour, the date or the moon is**: the sky. Light, sun, moons,
   stars, the season's ground, holidays, opening hours, night spawns, the curses' sun and moon, a
   quest's hour window, the date and time the menus show.
2. **What the world schedules, stocks, prices or meters for everyone**: the event clock. Gates, raids,
   the overworld's rows, prices, shelves, faction powers, regional conditions, terms, a day's caps, the
   weather's rolls, the time a player was away. None of these may speed up with the sky, or every daily
   reset, reroll and event would come four times as often.
3. **What happens to you**: your clock.

**Nothing walks the sky.** The sky holds no state; it is read, never walked. Every law that walks minutes
(the day block, the calendar arms, the broker's magic rounds, the per-minute loop, the weather's rolls and
evolution) walks the event clock or yours, exactly as it does today. That is what makes the sky's rate a
dial: changing it changes what players see and how long a wait on the sky lasts, and nothing else. A
census test holds every reader to its clock (section 5).

**Why the event clock and your clock keep TimeScale 12.**

- **Your clock paces combat and the body.** A magic round is a game minute on it (`claimMagicRounds`), so
  a buff, a poison, a disease, regeneration, hunger and thirst keep DFU's real-time feel. Speeding it up
  would quarter every spell's duration.
- **Your clock paces the road.** A game day of walking, a quest's deadline against travel, an inn's
  nights: DFU's ratio of real effort to game time stays.
- **The event clock is the relay's and the economy's.** Leaving it alone means the relay does not change
  and nothing is rebalanced by accident.
- **Today the shared clock and your clock already run at one rate,** so splitting the sky off moves
  nothing that is not sky. The character's window stays "the event clock's movement plus any raise",
  LIVED1's own law, untouched.

## 3. The rate

One constant, `SKY_MINUTES_PER_MS`; every number below follows from it.

| TimeScale | Sky day | Night, and the longest wait for dusk | Full-moon beast form (6.1's rule) | Moon cycle | Year | Season |
|---|---|---|---|---|---|---|
| 12 (today) | 2 h | 1 h | 2 h (DFU's whole day) | 64 h | 30 days | 7.5 days |
| 36 | 40 min | 20 min | 20 min | 21 h 20 min | 10 days | 2.5 days |
| **48 (recommended)** | **30 min** | **15 min** | **15 min** | **16 h** | **7.5 days** | **45 h** |
| 60 | 24 min | 12 min | 12 min | 12 h 48 min | 6 days | 36 h |
| 72 | 20 min | 10 min | 10 min | 10 h 40 min | 5 days | 30 h |

**Why 48.**

- **No wait for the sun or the moon outlasts a night,** and a night is 15 minutes. No wait for an hour
  of the day outlasts a day, and a day is 30.
- **The schedule is a clock face.** With the cutover aligned (section 4), midnight falls on the hour and
  the half hour for good, so a player can plan without arithmetic:

  | Sky time | Real time, every hour |
  |---|---|
  | 00:00 midnight | :00 and :30 |
  | 06:00 dawn | :07:30 and :37:30 |
  | 12:00 noon | :15 and :45 |
  | 18:00 dusk | :22:30 and :52:30 |

- **Night stays a place.** Fifteen minutes of dark is still long enough for the vampire, the thief and
  the night's spawns to matter; ten starts to lose it.
- **The sky still reads as a sky.** The sun crosses from dawn to dusk in 15 minutes, against 10 at
  TimeScale 72.

## 4. The cutover: one constant, no jump, no relay change

The sky's law is a new leaf, `net/skyLaw.js`, which imports WORLD5's from `net/wire.js`. It must not live in
`wire.js` itself: `wire.js` is in the relay's bundle, and `relayversion.test.js` binds `RELAY_VERSION` to
every byte of that bundle, so one added line would force a relay deploy and drop every connected player
for a law the relay never runs. A test pins the other half: the relay's import graph never reaches
`skyLaw.js`.

```js
/** TIME1: the instant the sky took its own rate, relay-clock ms - one of the aligned instants below. */
export const SKY_CUTOVER_MS = Date.UTC(/* chosen at merge */);
/** TIME1: classic minutes per real ms for the sky - TimeScale 48, a day every thirty real minutes. Mac's dial. */
export const SKY_MINUTES_PER_MS = 48 / 60 / 1000;
const SKY_CUTOVER_MINUTES = sharedClassicMinutes(SKY_CUTOVER_MS);
/** TIME1: the sky's clock, classic minutes, for a wall-clock instant - the event clock's before the cutover. */
export const skyClassicMinutes = (nowMs) => (nowMs < SKY_CUTOVER_MS ? sharedClassicMinutes(nowMs)
  : SKY_CUTOVER_MINUTES + (nowMs - SKY_CUTOVER_MS) * SKY_MINUTES_PER_MS);
/** TIME1: the inverse - the relay-clock ms at which the sky reads a classic minute. */
export const wallMsForSkyMinutes = (m) => (m < SKY_CUTOVER_MINUTES ? wallMsForClassicMinutes(m)
  : SKY_CUTOVER_MS + (m - SKY_CUTOVER_MINUTES) / SKY_MINUTES_PER_MS);
```

- **No jump.** At the cutover both laws read the same minute, so the sky does not skip.
- **Aligned.** If the cutover falls where the old sky's time of day already equals the new schedule's,
  the new sky's midnights land on the hour and the half hour forever after. At TimeScale 48 those
  instants recur every 40 minutes: 00:22:30, 01:02:30, 01:42:30, 02:22:30 UTC and so on, the same three
  in every two hours. The slice picks the first one after its merge, and a test pins the alignment.
  (Checked with the epoch's own numbers: at 01:02:30 UTC both skies read 02:00.)
- **The relay does not change.** It reads the event clock (gates through `gateLaw.js`, raids, overworld
  rows) and never the sky. `RELAY_VERSION` does not move.
- **The account service changes one read.** The professions' day (`net/nodeLaw.js dayDate`, which
  `server-account` bundles) takes its season and month from the sky, so a herb blooms in the spring the
  player sees (section 5.1). `nodeLaw.js` imports `skyLaw.js`, `account-deploy.yml`'s path list gains it
  (`accountdeploy.test.js` holds the list to the Worker's import graph), and the service redeploys with
  the merge. That Worker holds no sockets, so the deploy drops nobody; until it lands, a herb's season can
  lag the sky's by one deploy.
- **Saves do not change.** `classicMinutes` stays the character's clock, and an online save's
  `worldMinutes` stays the event clock's minute it left at. No stamp changes clock (section 5's rule), so
  no envelope needs a migration and the offline copy's rebase (`offlineCopy.js`) is untouched.
- **Release-day skew.** A tab open across the deploy draws the old sky until it reloads; the build
  notice (SRV-N, `Server-Update-Notice.md`) already asks it to. Until then two players side by side see
  different times of day, and each one's night spawns, curse and hour windows follow their own tab.
  Nothing the relay keeps is decided on the sky, so nothing it holds can desync.

## 5. Every reader, by clock

The census (section 8) makes every line choose. This is the map it starts from, read off the tree on
2026-10-01. It lists the kinds of reader, not every line; TIME1 classifies every line.

**No stamp is taken on the sky.** A reading that is saved, sent, or compared with a later reading is an
event stamp or an own stamp. The sky is only ever read for "now". That keeps every save, every wire frame
and every server check on a clock whose rate never changes, and it is why a sky reader can move without a
migration.

### 5.1 To the sky

| What | Where it reads today |
|---|---|
| The frame's sky: sun, moons, stars, light, colour | `world.js` and `exterior.js` `minuteNow` (`worldMinutes() % 1440`) |
| Interior light and its night ambient | `interior.js`, `worldModes.js` (`isNight(worldMinutes() % 1440)`) |
| The season's ground, the climate season, the herbs' and the writs' season | `world.js` and `exterior.js` (`refreshSeason`, `climateSeasonFromMinutes`, `seasonValue`); `net/nodeLaw.js dayDate` (with the account service, section 4) |
| The calendar: holidays and Suns Rest, Heart's Day, the kitchen's hours, the temple's cure days, a Daedra prince's summoning day | `worldModes.js` (`getHolidayId`, `worldNow`, `dayOfYearFromMinutes`) |
| Opening hours, locks by the hour, who is inside | `worldModes.js` (`_hour`, `resolveBuildingUnlocked`), `characters/interiorPeople.js` |
| The curses' and the careers' sun and moon | the rounds' `skyMinutes` (`worldTick.js`, the four hosts), `world.js`' sun rungs and party-travel refusal, `dungeonContext.js`' sunlight seam |
| Night's spawns, and the overworld's bands at night | `encounters.js`, `campEncounters.js` (`skyMinutes`); `world.js` `bandNight` |
| Enchantments and loot powers that read the season or the moon | `hostEnchant.js`, `lootPowers.js` |
| A torch doused by day on leaving a dungeon | `worldModes.js` (`rrDouseOnDungeonExit`) |
| The date and time the menus show, and the rest windows' world time | `ui/enhancedMenu.js`, `ui/restWindow.js`, `ui/enhancedRest.js`, `shared.js` (`sharedMinutes`) |
| The vampire's nightfall words | `worldTick.js worldNightfallText` (reading, rate and inverse) |
| A quest's hour window and date | `quest/actions.js DailyFrom` (TIME3) |

### 5.2 Stays on the event clock

Nothing in this table changes. It is listed so the census has its other half.

| What | Where |
|---|---|
| Gates: the day, the phases, the arena's window, the court's | `net/gateLaw.js`, `server/src/index.js`, `scenes/gateCourt.js` |
| Raids: the day, the window, the map's marks | `net/raidLaw.js`, `server/src/index.js`, `world.js` |
| The overworld's rows and how long they are kept | `net/overworldLaw.js`, `server/src/index.js` |
| Prices: the day's index and its flags | `worldTick.js` (`setWorldPriceSource`, `runDayChange`'s world half) |
| Faction powers and regional conditions | `worldTick.js runCalendarArms`, the world half |
| Stock by the day or the month: guild shelves, potions, houses for sale, shops | `worldModes.js` (`dayShelf`, `stockGuildPotions`, `housesForSale`), `shopStock.js` |
| The weather's rolls and evolution (6.4) | `worldTick.js`, `weatherSim.js` |
| Terms: a banishment, a pardon | `standing.js`, `arrestFlow.js`, the hosts' `worldNow` (`trustedWorldMinutes`) |
| Absence: TM-1's recovery, SURV7's fresh start, the save's `worldMinutes` | `worldTick.js` (`payAbsenceWhenHeard`), `save.js` |
| The world's half of a dead span | `deathRespawn.js` (`skipDeadMinutes`) |
| Camps: a fire's hours and a kit's | `scenes/camps.js` |
| Dropped torches burning | `scenes/droppedTorches.js` |
| A respawn's due time, through the event clock's inverse | `dungeonContext.js` (`_wallNow`) |
| The day a loot find is dated | `lootCodex.js` |
| The naval day | `world.js` (the naval `where`) |
| The minute a character joins online at | `ui/enhancedMenu.js` (`onlineCopyOf`) |

### 5.3 Your clock

Unchanged: everything `Lived-Time.md` lists under "Reads the character's clock". Added by TIME3: a quest's
countdowns, its spawn intervals and its tombstones (6.3).

### 5.4 Real time

Unchanged: respawns (WORLD8, one real hour), the camp encounter window (`CAMP_WINDOW_REAL_MINUTES`), the
gate's rise and collapse, the Seats' weeks, the Sigil stock's UTC days, a held torch's burn.

### 5.5 Every conversion names its rate

A conversion between game minutes and real time is the one place a faster sky can hide, so each one names
its clock:

- **the nightfall words:** the sky's rate; this changes;
- **`ownTimeLeftText`'s "of play":** your clock's rate, TimeScale 12; unchanged;
- **`gateCourt.js COURT_ROUND_MS`:** a magic round, your clock's; unchanged;
- **`overworldLaw.js OW_ROW_KEEP_MIN`:** the event clock's; unchanged;
- **the gate panel's local times** (`sharedWallMs`): the event clock's inverse; unchanged;
- **anything the render times in game minutes off the sky** (the weather's ease, `WEATHER_EASE_MINUTES`,
  CLK1, and its kin): moved to real seconds at today's values, so a front still takes as long to arrive.

## 6. The rules that change online

### 6.1 The full moon is a night

Online, the forced change holds while the full moon is UP: from dusk on the full-moon day to the next
dawn, the sky's night that begins on that date. At TimeScale 48 that is 15 real minutes. Masser and
Secunda are full four days apart (`gameDate.js lunarPhase`: offsets +3 and -1 on a 32-day cycle), so a
werewolf meets two such nights two real hours apart, then none for fourteen hours. DFU's rule, the whole
calendar day, stays offline.

- **The law:** `isFullMoonNight(skyMinutes)`. A night belongs to the date of its dusk: the hours before
  06:00 are the previous date's night. `lycanthropyMagicRound` forces the change when it holds and no
  Hircine ring is worn; offline it keeps `isFullMoonFromMinutes`.
- **At dawn the lock ends.** Changing back is the power, ungated, as DFU has it. The once-a-day gate on
  changing INTO the beast stays on the character's clock, so a rest clears it.
- **The words:** DFU's own line, "You dream of the moon.", as the change takes them, unchanged.
- **Why the night and not a fixed real-time lock:** the moon is in the sky. Look up, see it full, know
  why you are a wolf. A lock that ran out on a timer would end with the moon still up.

### 6.2 The vampire

No rule changes. The sun is the sky's, so the longest wait for dusk becomes 15 real minutes and the hood
(VAMP-HOOD) still opens the map by day. The nightfall words must compute with the sky's rate: they divide
by `ONLINE_MINUTES_PER_MS` today, which stays the event clock's rate, and would say four times too long.

### 6.3 Quests on two clocks (LIVED1 OPEN 1, answered)

- **A quest's countdowns run on the character's clock:** the Clock resource ("you have N days", "come
  back in N days"), the spawn intervals (`CreateFoe`) and the tombstones. A rest or a loiter spends quest
  days as in DFU, and so does a journey. A three-day wait is a 72-hour rest: about half a minute.
- **WORLD7's played step stays as the bound on the lived part of a frame,** so a hidden tab is still
  forgiven; a raise is charged whole.
- **A quest's hour and date reads use the sky:** `DailyFrom`, and any date a script tests. A `daily from`
  window comes round every 30 real minutes instead of every two hours.
- **A party's shared quest.** QUEST1 copies an accepted quest to each member (`systems/questShare.js`), and
  that copy is the "cross-player-visible state" for which `restSession.js` still stands quest ticks down
  under an online rest. Recommended: each copy runs on its holder's clock, so a member's rest spends only
  their own copy's days. LIVED1 recommended the owner's clock instead; that needs the owner's deadline
  carried in the copy. TIME3 settles which before any code (OPEN 3).
- **GUARD-ONLINE stays as it is.** Its reason, a two-hour wait, shrinks to at most 26 minutes (a three-hour
  window in a 30-minute day), so Mac may retire it later (OPEN 5).

The machine gets two clocks where DFU has one: `nowSeconds` becomes the character's, and a new
`skySeconds` serves `DailyFrom` and the date. Offline both are the one clock.

### 6.4 Weather keeps its pace

The six zones roll and evolve on the event clock's days and hours, as today: a roll every two real
hours, an evolution check every five real minutes (CLK2's `EVOLVE_CHANCE_PER_HOUR`). The sky's SEASON
chooses the table, handed in, so a winter sky never rolls summer weather. The sky turning four times as
fast does not make it rain four times as often, and a weather front still takes as long to roll in.

### 6.5 Seasons and the calendar run with the sky

A year every 7.5 days: each season about two days, every holiday once a week for half an hour. The
temple's cure days and Heart's Day keep their share of the year, in shorter, more frequent visits. The
year number climbs about 49 a real year. TIME1 reads every date reader its census finds for one that
counts years, before the years run faster.

## 7. On screen

- **The date and time the menus show, and the rest window's "World time":** the sky.
- **The Online pane's rules,** said at the door: "A day in the world is half an hour: midnight on the
  hour and the half hour, dusk at :22 and :52. Your own time runs as Daggerfall's does - resting and
  travel spend it, being away does not."
- **The vampire's nightfall words:** the sky's rate (6.2).
- **A character's deadlines** ("7 days of your time (14h of play)"): unchanged. They are on the
  character's clock, whose rate does not change.
- **The gate panel:** real local times only, as today. `World-Bosses.md`'s game-time column retires: the
  gate keeps its real schedule, and its game times stop matching the sky.
- **The patch notes,** in the pull request's description: "A day online is now 30 minutes. Nights, full
  moons and quest hours come round four times as often."

## 8. The law in code

- **`net/skyLaw.js`** (new leaf): the sky's law (section 4).
- **`net/wire.js`:** untouched. `sharedClassicMinutes`, `wallMsForClassicMinutes` and
  `ONLINE_MINUTES_PER_MS` keep their names and meaning, the event clock's; the comments that say so are
  written in `skyLaw.js` and the bible, not in `wire.js`, whose bytes are the relay's.
- **`net/nodeLaw.js`:** `dayDate` reads the sky (section 5.1); the account service redeploys with it.
- **`systems/worldTick.js`:**
  - `setSharedClock(source, wallOf, { sky, skyWall })`: the event clock's source as today, the sky's beside
    it.
  - `skyMinutes()`: the sky online, the one clock offline. `worldMinutes()`, `ownMinutes()` and
    `trustedWorldMinutes()` keep today's meaning.
  - The tick: unchanged windows. `runMagicRoundsFor`'s `skyMinutes` is the sky's reading.
  - `worldNightfallText`: the sky's reading, rate and inverse.
  - The weather's roll and evolution: the sky's season handed in (6.4).
- **`systems/lycanthropy.js`:** `isFullMoonNight` online (6.1).
- **`systems/quest/`:** the machine's two clocks (6.3).
- **The install,** `scenes/world.js` (today's line 786):
  `setSharedClock(() => sharedClassicMinutes(Date.now() + _sharedOffsetMs), (m) => wallMsForClassicMinutes(m) - _sharedOffsetMs, { sky: () => skyClassicMinutes(Date.now() + _sharedOffsetMs), skyWall: (m) => wallMsForSkyMinutes(m) - _sharedOffsetMs })`.
- **THE FOUR HOSTS RULE:** `world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js` each move
  their sky reads (section 5) and leave their event reads; every slice names all four.
- **The census:** `time1_census.test.js` (new). Every line in `src/` that calls `worldMinutes()`,
  `skyMinutes()`, `trustedWorldMinutes()`, `sharedClassicMinutes(` or `wallMsForClassicMinutes(`, or reads
  a ticker's or a context's `classicMinutes` getter (`shared.js`, `dungeonContext.js`: the spawned
  dungeons' clocks and the weather's application read the event clock that way), carries its clock in a
  `TIME1: sky` / `TIME1: event` / `TIME1: own` note. The test fails on any line that does not, so a new
  reader has to say which clock it means.
- **The relay:** nothing, and a test that its import graph never reaches `skyLaw.js`.

## 9. Slices

1. **TIME1 - the sky.** The law and its install, `skyMinutes()`, the census, every sky reader moved
   (section 5), the weather's season, the real-second eases (section 5), the nightfall words. It ships
   alone: the sky turns, and every wait on it shrinks fourfold.
2. **TIME2 - the full moon's night** (6.1).
3. **TIME3 - quests on two clocks** (6.3). Supersedes WORLD7's world-clock charge.
4. **TIME4 - the words** (section 7) and the bible: `Lived-Time.md`, `Online-Arc.md` WORLD5,
   `World-Bosses.md`, `Clock-Arc.md`.
5. **AUDIT TIME** over the arc, the house's four lenses.

Each slice is pinned red first, with its own mutant campaign (`tools/mutants/time<n>.json`), a Testing.md
row, and its player-facing notes in its pull request's description. TIME2 and TIME3 are independent of
each other once TIME1 has landed.

**TIME1's tests, at least:**

- the law: the sky equals the event clock up to the cutover, is continuous across it, runs at the new rate
  after it, and its inverse round-trips;
- the alignment: after the cutover every sky midnight falls at :00 or :30 UTC;
- offline: `skyMinutes() === worldMinutes() === ownMinutes()`, one clock, every existing offline test
  standing;
- the census;
- the bundles: the relay's import graph never reaches `skyLaw.js`, and the account service's deploy
  list names it;
- a sky read and an event read in each of the four hosts, crossing a sky midnight that is not an event
  midnight: the season, the hour and the moon move, and the prices, the shelves and the weather do not.

## 10. Alternatives weighed

- **Speed up the one shared clock** (sky, events and characters together). Every spell, poison and
  hunger tick quarters in real time unless the broker is re-cut; deadlines and inn nights tighten against
  walking; gates, raids, stock, prices and daily resets come four times as often; the relay changes.
  Rejected: it changes everything to fix the sky.
- **A sky per player** (each character's own time of day, as offline). Two players side by side would
  stand in day and night at once; shared weather, light and a party's night spawns stop agreeing.
  Rejected.
- **Skip the night by vote** (Minecraft's beds). It needs a quorum in a world with no edges, and turns a
  pure function of wall time into relay state. Rejected.
- **Patch each wait** (the moon next, then the one after). What the tree has done since WORLD5. Rejected
  by Mac.

## OPEN - Mac's calls

1. **The rate.** Recommended: TimeScale 48, a day every 30 minutes with midnight on the hour and the half
   hour. The alternatives are in section 3.
2. **The full moon.** Recommended: the night, 15 minutes. The alternative is DFU's whole day on the
   faster sky, 30 minutes.
3. **Quest countdowns on the character's clock.** Recommended: yes (LIVED1 OPEN 1), with a party's
   shared copy on its holder's clock. The alternative is one deadline for the party, on the owner's.
4. **The weather's pace.** Recommended: today's, on the event clock. The alternative, weather on the sky,
   changes four times as often.
5. **GUARD-ONLINE.** Recommended: keep it until play shows the 30-minute window is enough, then retire it.
6. **Gates.** Recommended: unchanged, every two real hours with the same real phases. The omen and the
   opening no longer promise a dusk. The alternative re-cuts them onto the sky: one gate every fourth
   night, open for that whole 15-minute night.
7. **The year.** It climbs about 49 a real year. Recommended: let it.
8. **Respawns.** Unchanged: one real hour (WORLD8, `wire.js RESPAWN_MS`). They run on real time, not the
   sky, so this design does not move them; a shorter respawn is its own call.

## Record

- 2026-10-01: proposed, this page. Nothing built.
