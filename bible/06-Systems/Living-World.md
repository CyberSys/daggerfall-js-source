# THE LIVING WORLD (LW, opened 2026-10-04)

Mac, 2026-10-04: "The new living world enhancement. NPCs are no longer just random walking entities. They dynamicly
all have tasks, travel between towns, can encounter enemies in the overworld, dyanamivally have a sleep schedule,
perform activities, form caravans, link with the ship AI at ports, have conversations with each other, etc, much like
the crew on board ships. NPCs adventuring beyond towns will dress out in armor/gear before leaving. You can find them
dungeon diving, make friends or enemies, and explore a dynamic world. This is one of the biggest changes our game will
be recieving and I want this to be absolutely perfect. A masterpiece".

The port's own. Daggerfall's townsfolk are DFU's PopulationManager: a pool of identity-less shells around the player,
each re-rolled into a stranger at every spawn, wandering the navgrid by tile weights and gone at dusk
(`systems/townPopulation.js`, verbatim). Nothing in Daggerfall travels, sleeps, works or remembers.

## LW0 - the decisions

Taken at the design, in the request's own order; each is Mac's to overrule.

1. **THE ENHANCED LANE, A FEATURES ROW.** `living-world`, on by default, the player's own online (no wire field reads
   it: a player with it off sees DFU's walkers and shares nothing less with anyone). The classic skin, and the row off,
   keep `townPopulation.js` 1:1.
2. **ONE CLOCK, NOTHING SENT.** The living world runs on the sky (`worldTick.js skyMinutes`): the minute the sun, the
   lamps and the shop hours are read off - offline the one calendar, online the sky's own (TIME1, a day each real
   hour). Every resident, every plan, trip, caravan, camp, encounter and dive is a PURE FUNCTION of the world's own data
   (MAPS, BLOCKS, the roads), a seed and that clock - so every player on a page sees the same baker walk to the same
   oven at the same minute, and not a byte crosses the relay. A rest, a wait, a fast travel or a prison sentence moves
   the clock and the world with it: the people are where their day has taken them.
3. **PEOPLE WALK AT THEIR OWN PACE.** On the street a resident walks DFU's 1.3 m/s (`PERSON_MOVE_SPEED`); the clock's
   rate turns it into the clock's minutes (`CLASSIC_MINUTES_PER_SECOND`, twelve a real minute; the sky's
   `skyMinutesPerMsAt`, twenty-four), so a resident beside the player keeps pace with them and every day is lived at
   walking speed. A journey's time scale speeds the calendar and the people with it.
4. **A RESIDENT IS A DFU TOWNSPERSON WHO KEEPS THEIR IDENTITY FOR LIFE.** The billboard race is the climate's people,
   the outfit one of `PERSON_TEXTURES`' four, the talk portrait `PERSON_FACE_RECORDS`' own law, the name `fullName` on
   the region's bank with DFRandom's state saved and put back (`shipCrew.js handName`'s pattern) - every part DFU's, but
   drawn once from the resident's seed instead of at every spawn.
5. **ARMOUR IS THE CLASS SPRITE.** Daggerfall draws no worn gear on any NPC; the armed look it has is the eighteen
   human classes' sprites (`enemyBasics.js` 128-145, eight archive pairs). A resident who goes beyond the walls to fight
   - an adventurer, a caravan's guard, the watch on the road - walks out in their class's sprite and walks home in it;
   in town, at home, they are a townsperson again.
6. **RELATIONS ARE THE CHARACTER'S.** Who is a friend and who an enemy is per character and per resident, saved with
   the character (`modSaveData` vendor `LivingWorld`); online it rides the character's snapshot as every other modData
   record does. The world is shared; how it feels about you is yours.

## LW0 - the model

- **THE CENSUS** (`systems/livingWorld/census.js`). A town's residents are minted from its own buildings: each house a
  household, each shop its keeper, each tavern its staff, each temple its priests, each guild hall its members, the
  palace its court, and the town's size its watch, its merchants, its adventurers, and at a port its sailors. Slot `i`
  of a town is the same person for every reader: `L<mapId>.<i>`.
- **THE PLACES** (`systems/livingWorld/places.js`). Every building's door as a walkable navgrid cell before it; the
  social spots (before taverns, temples, guild halls and the palace, and the town's square); the market spots (before
  the shops); the exits (the border cells the town's own streets reach - a walled town's gates by construction).
- **THE DAY** (`systems/livingWorld/dayPlan.js`). A resident's day from 04:00 to 04:00, drawn from their seed and the
  day: wake by their temper (a lark, the day's own, a night owl), work at their trade, errands to the shops, a meal, the
  evening's tavern, temple or square, home, sleep; the watch on day or night shift walking its beat. Between two places
  a walk, on the navgrid's own A* (`townPaths.js`), its minutes by the walking pace. Outdoors is what is seen; indoors
  is a door shut behind them.
- **CONVERSATIONS** (`systems/livingWorld/meetups.js`, `lines.js`). The town's meetings for the day - two or three
  residents at a social spot with time free in all their days - and what they say: the crew's two-and-three-line
  scripts' shape (`crewLife.js CREW_TALKS`), their topics the residents' own (the trade, the weather, the temple, the
  roads - and what happened on them, read off the trips of the town's own people).
- **THE ROADS** (LW3). A traveller's trips are drawn per cycle of days from their seed: where (a neighbour town, a
  temple town for a pilgrim, a dungeon for an adventurer, a port across the water), when, how long they stay. The route
  is the Travel Options planner's on Hazelnut's roads (`travelRoute.js planRoute`); they walk it by day and camp by
  night. Merchants hire the town's guards and the week's travellers to the same place go with them - a caravan. An
  adventurer gears up at home before the walk out.
- **TROUBLE** (LW4). Each leg's danger, the region's and the ground's, rolls an encounter at a minute of it and its
  outcome against the party's strength - driven off, won, fled home, slain. A player near at that minute sees it
  fought, and can turn it.
- **THE PORTS** (LW5). A sea leg rides the SEA-LANES packets (`naval/seaLanes.js`): wait on the quay for the next one,
  board her, sail, step off at the far port.
- **THE DEEP** (LW6). A dive: in at the dungeon's door, hours inside room to room, out - or not, and what is left of
  them lies where they fell.
- **FRIENDS AND ENEMIES** (LW7). Words, help in a fight, a blow, a crime seen: each moves a resident's regard; a
  friend greets you by name, an enemy will not talk, and an armed one draws on you beyond the walls.

## The slices

- LW1 - the census, the places, the day, the meetings, the lines, the relations store (pure).
- LW2 - the town: residents walk the streets in the streaming host.
- LW3 - the roads: trips, caravans, camps, the gear; the wilderness and the Overworld.
- LW4 - trouble on the road.
- LW5 - the ports.
- LW6 - the deep.
- LW7 - friends and enemies, in full.

## LW1 - the census, the places, the day, the meetings, the lines, the regards (2026-10-04)

`systems/livingWorld/`, pure. Every roll is the living world's own (`seed.js`: the port's `hash32` under `LW_SALT`,
`wind.js seededRng` over it) - none on Math.random, none on DFRandom's stream (a name draw saves and restores it).

- **`census.js`.** `travellerRoster(town)` off the MAPS row alone: merchants from two blocks (1 + blocks/8, to 5),
  sellswords from nine (blocks/8, to 6), adventurers from four (1 + blocks/10, to 6), sailors at a port (2 +
  blocks/10, to 6), pilgrims from two (two from sixteen), couriers from sixteen (two from thirty-six). `watchRoster`:
  none in a one-block hamlet, one at two blocks, then 1 + blocks/4 between two and twelve. `householdCensus(town,
  buildings)`: each House1-House6 a family of one (a quarter), two (half) or three; each shop its keeper (a smith at
  the Armorer and the WeaponSmith, a clerk at the Bank, a scholar at the Library and the Bookseller) and a hand at one
  of quality twelve or more, half the time; the tavern its innkeeper and one server (two at quality twelve) living
  there; the temple two priests living there; the guild hall two members; the palace two courtiers living there. The
  trades are dealt to the houses' people in a seeded order, a trade left over lives where it works, the people left
  over take the town's common work by its size (labourers, farmers - the villages' own -, a port's fishers, crafters,
  homemakers, a city's beggars); `CENSUS_MAX` 260, the common hands trimmed first. `townCensus` gives the watch the
  palace and every traveller a house (an adventurer the tavern a quarter of the time). Identity is `mintResident`'s:
  the climate's people (`raceOfPeople`), half female, an outfit of `PERSON_TEXTURES`, a face of
  `PERSON_FACE_RECORDS` + 0..23, a name on the region's bank (`residentName`), the watch GUARD_TEXTURE male outfit 0
  (RandomiseNPC's arms, every part); a temper (lark, day, owl) weighted by the job, three leanings (company, piety,
  drink), a class for the armed (an adventurer any of the eighteen, a sellsword the fighting seven, a courier the
  light three) and a level.
- **`places.js`.** The street net is the grid's largest four-neighbour walkable component (`streetNet`). A door's
  cell: out along its normal 0.9-4 m until the net takes a foot, then the other way (a model's normal can face in),
  then the nearest net cell within four. Social spots `SOCIAL_OUT` cells before the tavern, temple, guild hall and
  palace, market spots `MARKET_OUT` before the shops, a dock before a Ship; the square the net cell by the middle with
  the most net in its 7x7, sampled every third cell; an exit per side, the net cell nearest that edge.
- **`townPaths.js`.** A* over the grid's static weights, four neighbours, a step `1 + (15 - weight) / 10` (a road 1,
  grass 1.3, the average 1.8, stone 2.1), ties on opening order, one scratch set per grid; `pathLine` keeps the turns;
  `createPathBook` keeps 768 walks and spends a frame's search budget.
- **`dayPlan.js`.** The living day 04:00-04:00 (`DAY_START_MIN`), every minute covered once. Wake and bed by temper
  (a lark 05-06 and 20-21, the day 06-07:30 and 21:30-23, an owl 08-10 and 00:30-02); the watch by shift
  (`(slot + day) mod 3`: 06-16, 14-24, a day off). The jobs' days as the code says them, the favourites (`favourites`:
  two social spots, a tavern, a temple, a guild and a market, near home, the seed's alone) set where; a stroll (two
  short stops) for the sociable; a lark's turn about town at first light. `schedule` lays them: each begins when the
  walk allows and not before its hour, nor more than its slack after; a stay ends by its `until`, by the walk home
  before bed, and before an away window's going; a gap longer than the walk home and back by `HOME_GAP` is spent at
  home, a shorter one going on at once and waiting at the next place (nobody lingers where a stay ended - a shop shut
  at six is left at six; the LW1 pins found the helper who stayed on); an away window (trips.js, LW3) is geared for at home `GEAR_MIN` where the traveller goes armed, walked out to
  arrive as it opens and home as it closes, each walk ARMED. A walk's minutes: the cells' Manhattan distance x
  `WALK_DETOUR` + `WALK_EXTRA_M`, over the pace.
- **`meetups.js`.** Rounds of `ROUND_S` (40 real seconds) laid on the clock; whoever stands at a spot for a WHOLE round
  pairs off on an order drawn from the spot, the round and their ids (the odd three together); `TALK_SHARE` of circles
  talk; a line each `CREW_LINE_S` of the clock, the first member first; `circleStands` round the spot on the golden
  angle, `CIRCLE_APART` apart, facing in.
- **`lines.js`.** Original words in the crew's two-and-three-line shape: the town's talk, the trades', the weather's,
  the evening's and the night's; tokens with fallbacks; GREETINGS by regard.
- **`relations.js`.** A regard per resident (-100..100), a stranger 0: a word +3 once a day, a polite word +1, a gift
  +8, help +20, a life saved +35, a blow -45, a crime -15, one of theirs slain -60, a blunt word -6; friend at 40, enemy
  at -40, hostile at -70; eased toward zero half a point a day unseen and never across; 600 kept; the save's record
  `{ v: 1, people }`, a bad one nobody known.

## LW2 - the town (2026-10-04)

`systems/livingWorld/livingTown.js` `LivingTown`, in TownPopulation's shape (`pool` rows, `update()` the live seats,
`retire`, `nav`, `maxPopulation`), so every street seam takes a resident as it took a walker: the talk ray, the
pickpocket, the watch's conversion (`_guardPool().disable()`'s inline free reads as the resident TAKEN for the day),
the trample (`retire`), the probes.

- **The census read** four times a second: each resident's entry at the sky's minute; those out of doors within
  `LIVING_RANGE` (DFU's 150) wanted, nearest first, to `maxPopulationFor`. The circles are read over the WHOLE town's
  presence, so every reader's circles agree.
- **Where exactly** (`where`): a walk on its A* line at the day's pace, never slower, to `WALK_FAST` (1.6) times it on
  a long path and late past that (the stay after it waits for the arrival); arrived early, through the door or out of
  the gate, else at the spot. A stay in its circle's place, or its own. A body further than `SNAP_M` (30 m) from its day
  is stood there; nearer it walks there (a circle reshuffled, a stand left for a walk).
- **Coming and going**: ON ARRIVAL - the town's first frame, the clock jumped past `ARRIVAL_JUMP_MIN` (15: a rest, a
  wait, a load) or the player past `ARRIVAL_STEP_M` (40 m in a frame: a Recall, a teleport) - the street is as the day
  has it, everyone out of doors there at once (the searches raised to `ARRIVAL_PATHS_PER_FRAME` till it is stood).
  After it, the street's own churn keeps DFU's hiding - one more stood under the cap comes on beyond
  `POP_VISIBLE_RANGE` or behind the player's half of the view - or out of a door (a walk begun from one within
  `DOOR_POP_MIN`), which needs none; into a door at once; out of range when unseen. `suppressSpawns` (V4's transformed
  lycanthrope) holds new ones in. THE LW2 MUTANTS FOUND THE ARRIVAL: with DFU's rule alone, a street the player
  arrived facing stayed empty but for its doors - DFU's walkers spawn hidden, a resident is where their day is.
- **The politeness gate** stands a body as it stands DFU's walker; the minutes it stood are owed and walked off
  `CATCH_UP` (0.35) faster.
- **Lines**: a talking circle's line at this minute over its speaker; a word to the player passing within
  `GREET_RANGE` (once in `GREET_REST_MIN` of the clock): a friend's by name, an enemy's cold, a known face's plain, a
  stranger's now and then. `refuses(person)` an enemy's `REFUSAL`; `talked(person)` notes the word.
- **The body** is `characters/residentWalker.js` `ResidentWalker`: a MobilePerson that wears the walker's billboard on
  a yaw of its own (MoveAnims through `mobileOrientation`, idle 5, the watch's 15, AUDIT 26 F021's reset) and claims no
  tile. `mobilePerson.js` exports its `MOVE_RECORDS` and `MOVE_FLIPS` for it, unchanged.
- **The streaming host** (`scenes/world.js`): the population block stands a LivingTown where `livingWorldOn()`
  (`livingSwitch.js`: the enhanced skin and the row), on the same navgrid, collider, ground (`personGroundY`, JAN1's
  closure now one for both pools), batches and racial override, the town's MAPS row, its buildings' summaries and its
  doors (each door now carries its block's grid cell - `makeBuildingKey(blockX, blockY, recordIndex)` - and is laid
  into the location frame); `livingBaseRate`/`livingRate` the sky's rate online, the calendar's (and a journey's scale)
  offline; the regards one `createRelations` per character, saved as `LivingWorld`; the residents' lines merged into
  the crew's one speech layer (`livingLinePoints`, before `drawCrewLines`; under the name of one the player has met);
  `townTalk`'s new `livingTalk` door asks the body's town for a refusal before the conversation and notes the word
  once it is one.

## The four hosts

- `scenes/world.js` - WIRED (LW2): the streaming world's towns.
- `scenes/exterior.js` - FLAGGED: the fixed-city page keeps DFU's pool (its own doors and summaries are read at other
  seams; its town is not yet a LivingTown).
- `scenes/worldModes.js` - FLAGGED: indoors the street pool answers nobody (AUDIT 62 F14) and a building's people are
  its static NPCs; a resident whose day has them in the tavern is not yet stood inside it.
- `scenes/dungeonContext.js` - no town population (LW6 brings the divers).
