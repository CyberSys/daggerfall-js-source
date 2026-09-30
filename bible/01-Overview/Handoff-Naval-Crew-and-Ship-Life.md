# The naval crew and ship-life hand-off, 2026-09-30

Mac's six-part ask for the sea, 2026-09-29:

> 1. Ships should be improved AI, actively port at docks and depart, sail
>    out in open waters and naturally do their own thing. I really want to
>    give intelligence and agency to the AI
> 2. Walking on the deck gives water sounds, hunting notifications appear
>    when sailing, shooting cannons should have attack canceling.
> 3. Improve the overall mobility and maneuverability of ships
> 4. Crew members shouldnt be the static sprites and instead the enemy type
>    sprites with multiple animations, they should navigate the deck, talk
>    with each other, blurb, sing chantys, etc
> 5. Boarding scenarios should be seamless, with crew naturally getting
>    into position and fighting enemies. There's an issue where
>    enemies/allys can navigate on the railing of ships.
> 6. Ally crew member's should have green health bars above their head,
>    and not be able to engage in friendly fire.

It was cut into five slices. Three are on the naval PR (#456, branch
`ccr-08848d60-ieuci5`). The fourth is finished and parked, and the fifth
is designed but not built. On 2026-09-30, with slice D finished and
verified but not yet committed, Mac said: "Lets pause before slice D and
log it for another session". This page is that log.

| Slice | Mac's items | State |
|---|---|---|
| A - DECK-FIELD | 2 | on the PR, `0d41a1fb3` |
| B - HELM-WAY | 3 | on the PR, `735f0c447` |
| C - DECK-WALK and SHIPMATES | 5 (the rail), 6 | on the PR, `304ec692d` |
| D - LIVING CREW | 4, 5 (seamless boarding) | **parked**, `7feab89ff` on `ccr-08848d60-ieuci5-living-crew` |
| E - SHIP-LIFE | 1 | **not started** - the research and design are below |

## First: the PR is behind main

When this page was written, `main` (`066fe8a5c`) was 31 commits ahead of
the PR: #444, #457, #458, #460, #461 and #462. A trial merge conflicted in
72 files:
- the bible's citations;
- citation comments in `src/`;
- the pins and mutant records that quote them.

It was left alone because of Mac's pause. Bring it in before anything
else. Follow the recipe this branch's earlier merges used:
1. Merge `origin/main`.
2. Resolve each hunk by content, not by number.
3. On the conflict-free tree, run `node tools/citeMerge.mjs origin/main
   <our-head> --apply` once, before the merge commit.
4. Fix whatever CD4 names.
5. Recount the Testing page's suite line.
6. Run the full suite.

## Slice D - LIVING CREW, parked

**Where it is.** The single commit `7feab89ff` on the branch
`ccr-08848d60-ieuci5-living-crew`, pushed with Mac's approval. The branch
was cut from `304ec692d`, the PR head at the time. No PR has been opened
for it. It is not on the PR.

**What it does.** A ship's crew stands on her deck as DFU's own mobile
units: each crew class's sprite, idle and walking, turned to the eye as
`characters/mobileUnit.js` turns every mobile. They work the deck. They
have stations and walk between them on the deck model's A* paths. They
talk in pairs, call out blurbs by faction and by battle, and sing three
original chanties. When the grapnels fly they muster at the rail. Within
`CREW_RANGE` (110 m) of the eye, the hull's people flats on or above her
main deck stand down and the living crew stands in their places. Beyond
`CREW_KEEP` (130 m) the flats stand again. A galley's rowers below her
deck are never touched. Boarding becomes seamless: the muster and the
hands are the crew already standing on deck. `crewOf` takes each man
where he stands, with his own class and sex. The landing is a deck point
next to the player. A party going over the rail is dealt rail spots
(`deck.rail(side, z)`, the outermost deck cell of that row).

**The files.** The two new modules and the new test files exist only on the parked branch, so they are named
here in `git show`'s own `<branch>:<path>` form, for example `git show ccr-08848d60-ieuci5-living-crew:src/scenes/navalCrew.js`.
- `ccr-08848d60-ieuci5-living-crew:src/systems/naval/crewLife.js` (new): the pure crew brain. It holds the
  roster, stations, walks, talk, blurbs, chanties, the grapple muster and
  take/trim.
- `ccr-08848d60-ieuci5-living-crew:src/scenes/navalCrew.js` (new): the host. It stands the flats down,
  draws the sprites and gives the speech with each speaker's head point.
- `src/systems/naval/navalDeck.js`: adds `rail(side, z)`.
- `src/scenes/navalHost.js`:
  - boarding takes the muster, hands and party off the crew (`crewOf`,
    `landing`, `railSpots`);
  - adds `crewShips()`, `myCrew()` and `boatOf()`.
- `src/scenes/world.js`:
  - the board deps;
  - `navalCrewFrame`, which runs after the foe pools move and before the
    town watch;
  - the crews' batches in the people pass;
  - the speech drawn by `navalHud`'s `drawCrewLines`.
- `src/scenes/comeSailAwayPeers.js`: a peer's boat carries its `peerKey`,
  which seeds its crew.
- `ccr-08848d60-ieuci5-living-crew:test/livingcrew.test.js` (13 tests) and
  `ccr-08848d60-ieuci5-living-crew:tools/mutants/livingcrew.json` (54 records).
- Docs:
  - the Naval-Combat "LIVING CREW" section;
  - the Port-Ledger "THE CREW LIVES" row;
  - the Testing row and suite line;
  - the patch notes' "A living crew".
- `node tools/citeShift.mjs --apply` moved every citation that the
  source moves shifted. That is why the commit touches about fifty
  bible and source files by a line or two each.

**How it was verified on its own tree.**
- The full suite: 16003 tests, 15740 pass, 2 fail, 261 skipped. Both
  failures were pins the slice itself moved, and both are fixed in the
  commit and re-run green:
  - disc19's host-order pin was re-aimed for the crews' frame, which sits
    between the pools and the watch.
  - MACRO-7's read-site census failed because the crew's speech API was
    first named `lines()`. The census reads every `.lines(` in `src/` as a
    TEXT.RSC record read, so the API is `speech()` now.
- The gates were run: citedrift, mutantdrift, ledger, doctrine,
  audit24_onehome, boot2, audit18, landing, manifest, relayversion.
- eslint and `npm run types` are clean.
- `ccr-08848d60-ieuci5-living-crew:tools/mutants/livingcrew.json`: 54 of 54 dead.
- `tools/mutants/deckwalk.json`: 60 of 60 dead.

**What the next session does to land it.**
1. Fetch the branch and bring `7feab89ff` onto the current PR head. If
   PR #456 has merged, bring it onto `main` instead. `git cherry-pick
   7feab89ff` applies cleanly onto `304ec692d` plus this page's commit,
   because the slice does not touch `Active-Arcs.md`.
2. If the base has moved, the conflicts will be citation numbers in the
   bible and in source comments. Do not resolve them by hand:
   1. Take the base's side of every citation-only hunk.
   2. Keep the slice's code, tests and doc sections.
   3. Rerun `node tools/citeShift.mjs --apply`. It reads HEAD against the
      working tree, and it refuses a second run until the first is
      committed.
   4. Fix whatever CD4 then names, by content.
3. Rerun, in this order:
   1. the full suite, `node --test --test-concurrency=8 "test/*.test.js"`;
   2. the gates above, eslint and `npm run types`;
   3. `node tools/mutate.mjs --jobs 6 tools/mutants/livingcrew.json`;
   4. the same for `tools/mutants/deckwalk.json`.

   Then set the Testing page's suite line to the new count.
4. The laws the slice already keeps, which must stay kept:
   - Nothing in `server/src`, `src/net/*` or `src/world/mat4.js` changes,
     not even a comment. The relay's bundle hash covers them (SLAM8).
   - No method named `lines` or `rows` (MACRO-7).
   - `combat/friendlyFire.js`'s `isShipmate` stays the only spare test.
     DISC19 W5's defenders depend on it.
5. Then close this page's slice D row: mark it landed in the table, and
   close its line in `Active-Arcs.md` if slice E has landed too.

## Slice E - SHIP-LIFE, designed, not built

Mac's item 1. Nothing is written yet. Below is what the reading found and
the shape it points to.

### What the sea does today

- **The director** (`systems/naval/navalDirector.js`):
  - It launches ships on `SPAWN_RING` (650 to 1000 m) around a player,
    never within `SPAWN_CLEAR` (450 m) of any player.
  - It only does so while a player is on the water: navalHost's `onWater`
    gate, which calls `director.reset()` otherwise.
  - Each ship is set on a slant across the player's waters and let go
    past `DESPAWN_BEYOND` (1900 m).
  - Faction weights shift toward merchantmen and the navy when a port
    town is within a pixel. world.js `navalNearPort` asks `csaIsPortTown`,
    which reads the location's `exteriorData.portTownAndUnknown`.
  - SEA-PEACE adds pairs launched already fighting: `plunder` and
    `patrol`.
- **The captain's cruise** (`systems/naval/navalAI.js` `cruiseCourse`):
  - A random waypoint `WAYPOINT_DIST` (900 to 2300 m) away in any
    direction, sounded clear in a straight line, then a new one on
    arrival.
  - It has no purpose. Only a NAV-R raider's `ship.course` overrides it.
- **No dock data exists.** A port town is only a flag in its exterior
  data. A harbour has to be found from the terrain: take the town's
  footprint (`world/streamingWorld.js` `locationWorldRect` in native
  units, into scene coordinates with `localFromWorld`) and the host's
  `isWater(x, z, hull)`.
- **A moored look already exists.** Come Sail Away's `Boat` has
  `IdleObject` and `ActiveObject`, and navalHost's pose code stows a sea
  ship's sails whenever her `sails` is 0.5 or less. A moored ship is
  `sails` 0 with the idle object shown.
- **The floating origin.** Sea ships live in scene coordinates, and
  navalHost's `offsetAll` shifts every ship and its `waypoint`. Any berth,
  harbour or path point a ship keeps must shift there too, or be kept in
  native coordinates.
- **Online:**
  - The stander launches the ships. `standsSea` delegates to
    `amGroupRollOwner`, and the seeds are salted with the stander's id.
  - The wire's ship record (navalAI `shipWireState`) carries position,
    yaw, speed, sails, heel, mode and damage, and no errand.
  - `src/net/*` is under the relay law, so an errand is never sent. The
    client that adopts a ship re-derives it from her seed and where she
    is.

### The shape

1. **`systems/naval/shipLife.js`, pure:**
   - `findHarbour({ rect, isWater, hull })` places berths along the
     town's shore. A berth's hull footprint is all water; she lies
     parallel to the shore; berths are spaced by hull length. It also
     picks the harbour's mouth, the approach point out in open water.
   - A lazy water grid with a bounded A*: cells of about 24 m, one cell
     of clearance from the land, a node cap so a query's cost is fixed,
     and line-of-sight smoothing.
   - The errands:
     - `moored`: at her berth, sails stowed, for a seeded dwell.
     - `depart`: berth to the mouth to open water.
     - `voyage`: to another port, or out of the world on a bearing.
     - `arrive`: mouth to berth, shortening sail and easing her way off
       to a stop.
     - `patrol`: the navy's loop across a port's approaches.
     - `lurk`: a pirate off the trade lanes, where merchantmen pass.
2. **navalAI:** the cruise branch asks the errand for its plan: `want`,
   `goal`, and `sails`, with the berth approach easing her way off.
   Hostility still decides first. A navy ship at her berth answers a
   pirate, and a merchantman flees from one. When the fight ends the
   errand resumes with a re-planned path.
3. **navalDirector:**
   - Errands are handed out at launch, by faction and waters.
   - A harbour roll stands a port's moored ships. It is seeded per port
     and per day, so every player in that port sees the same ships, and
     the ships come from a harbour budget apart from the sea's density.
   - Departures follow each ship's dwell, and arrivals take the free
     berths.
4. **navalHost:**
   - The harbour's traffic runs near a port even while the player is
     ashore. The sea's general traffic keeps its on-water gate.
   - `offsetAll` shifts the harbour and path points.
   - Handover (`adopt` and `rekey`) re-derives each errand.
5. **Tests:**
   - Run it all on a synthetic coast with a bay, a headland and a town
     rect.
   - Add a mutation list.
   - Write the docs: a Naval-Combat section, a Port-Ledger row, the
     Testing row and the patch notes.
