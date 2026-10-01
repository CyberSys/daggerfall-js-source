# Enhanced Climbing - the ledge, the mantle, the leap (CLIMB1-CLIMB5)

Mac, 2026-09-30: *"I want to talk about building enhanced climbing. A proper and detailed climbing system that feels
so much better. My reference is for the assassins creed and dying light games. Being able to latch, mantle, jump from
one location to another ledge. Almost parkour like. What can we do?"* Four calls, from the options put to Mac (the
recommended one each time):

| | The question | Mac's call |
|---|---|---|
| Controls | How should the parkour controls work? | *"Jump is the grab"* - Dying Light's: Jump near a ledge catches or mantles, Jump held keeps catching in the air, Forward climbs up, Crouch drops. No new key |
| Skill | How much should the Climbing and Jumping skills matter? | *"Skill scales it"* - every move from the start; the skill sets reach, speed, grip time and whether a hard catch holds. No move is gated |
| Sheer walls | What happens on a wall with no ledge in reach? | *"Free-climb on grip"* - any wall stays climbable, draining Fatigue in place of the classic roll every 0.8 s; the skill sets speed and grip; the climb tops out in a mantle |
| Leaps | Daggerfall's jump is 0.5-1.1 m high. How far should parkour leaps go? | *"Parkour leap, skill-scaled"* - a leap from a hang or a sprint off an edge has its own longer, flatter arc scaled by Jumping; the plain jump is unchanged |

The same message put the rest of the shape: the enhanced lane only, behind a Features row (the classic climb untouched);
on by default and on for everyone online, so nobody crosses a rooftop a way another cannot; first person first, the
third-person poses and the wire last.

## Where climbing stood (measured on the code, 2026-09-30)

`player/climbing.js` is DFU's ClimbingMotor, classic path, ported whole in M3 (Player-Arc.md): hold Forward against a
wall for 14 system-timer units (0.77 s), pass a base-70 skill roll, crawl straight up at a third of the walk, re-roll
every 15 units (0.82 s) or slip, let go and fall. **It has no idea what a ledge is.** DISC21 keeps the wall probe alive
down to the capsule's lower cap so the upward hug shoves the body over the lip instead of dropping it back into the
pit - but that is a shove, not a climb. DFU's own `AdvancedClimbing` (the hang, the rappel, the corner wraps, WallEject)
is Ledger A off-road by name and stays so: it is the same wall-crawl underneath, and not what was asked for.

What the port already had to build on: the collider answers every question a ledge sensor asks (`raycastHit` with the
face's normal, `surfaceHit` for the ground's floor, `penetrationAt`, the capsule and sphere casts); the motor's step
already hands itself to a mode that owns it (`_climbStep`'s `return true`); the Morrowind arms and a hand-authored pose
over them (`combat/heldPose.js`, the held map's) for hands on a lip in first person.

## The arc

| Slice | What | Status |
|---|---|---|
| CLIMB1 | The ledge sensor; the MANTLE (a jump pressed at a lip, a lip caught with Jump held in the air, the classic climb's top-out), the CLAMBER over a thin top and the VAULT; the switch; the tick's bill | **SHIPPED** 2026-09-30, **AUDITED** the same day (AUDIT CLIMB1) |
| CLIMB2 | The catch becomes a HANG: shimmy along the lip (and round its corners), drop, climb up and down; grip on Fatigue; the free climb on grip (Mac's "Sheer walls"); encumbrance cuts the reach (a hard catch's hold came with the audit) | **SHIPPED** 2026-09-30 |
| CLIMB3 | LEAPS: up, sideways and back off the wall from a hang, the wall run-up, the running jump off an edge caught at the far side (Mac's "Leaps", Jumping-scaled) | |
| CLIMB4 | The feel: the arms on the lip (heldPose deltas), the camera's dip and pitch, the sounds | |
| CLIMB5 | Online and third person: the move on the wire, the peers' and the rig's poses | |

## CLIMB1 (2026-09-30): THE LEDGE SENSOR, THE MANTLE, THE CLAMBER AND THE VAULT - SHIPPED

As amended by AUDIT CLIMB1 the same day (below) - this section says what the code does now; the audit section says
what it did before and why it changed.

**The law** is `src/player/parkour.js`, pure (the collider handed in, and no motor constant read at its top level - the
motor imports this file, so such a read would meet the import cycle's TDZ; the two numbers it shares with the motor
are restated and pinned equal).

- **The skills the moves read**: the Climbing skill as the classic chance's own arithmetic (`parkourSkill`: live
  Climbing, +30 for a Khajiit, doubled under the Climbing spell) held to 0..100, and the Jumping skill for a vault's pace
  (`jumpingSkill`). **The reach** - the lip height over the feet a standing body's hands take - runs 1.5 m at 0 (the
  chest) to 2.1 m at 100 (the arms at full stretch over a 1.8 m capsule); in the air or on a wall +0.15. **The pace**:
  a mantle takes `(0.25 + 0.22 x rise) x (1.3 - 0.5 x skill/100)` seconds - a 1.5 m lip 0.75 s at Climbing 0, 0.46 s
  at 100; a vault `(0.22 + 0.12 x rise) x (1.2 - 0.3 x Jumping/100)`. **The hold**: a catch in the air holds a fall
  of at most 5 m at Climbing 0 (DFU's own fall-damage threshold - nothing it saves could have hurt) to 15 m at 100;
  past that the lip is not caught and the fall is billed (`parkourCatchHold`).
- **The sensor** (`senseLedge`), from the feet along the look:
  1. *the wall* - level rays from the axis every 0.1 m up the band (the step offset to the reach on the ground, 0.25
     in the air): the lowest to meet a face within the capsule's side + 0.5, whose normal is within 30 degrees of
     level and which the look meets within 50 degrees (`scanFace`). A slab thinner than a rung (a table top, a shelf)
     is found from above instead - down rays just ahead, from a height a level ray found open, and the edge just
     under the top they meet (`scanSlab`);
  2. *the open* - the scan climbs on until a rung meets nothing within 0.08 m farther than the face (a face leaning
     back up to ~38 degrees goes on; a 45-degree roof's rise is 0.1 a rung). None one rung past the reach is a wall
     that runs on above it;
  3. *the lip* - a ray straight down 0.03 m past the face from THAT height - never from a fixed height, which in a low
     room starts inside the ceiling - finds the top at the edge: within 45 degrees of level, inside the band, the face
     running up to it (a level ray 0.02 under it meets the face). On the ground, the floor just in front of the face
     must be the body's own (within 0.15 of the feet): a tread standing higher between the body and the face is a
     stair, and the face a riser (`riser`);
  4. *the top* - down rays walk it away from the face every 0.1 m to 1 m; it ends where a ray finds nothing within
     0.1 under the lip, and a bisection finds that edge to a centimetre (`topProfile`, the `depth`);
  5. *the landing* - the radius + 0.12 past the face, or the middle of a top between 0.28 and 0.52 deep; the surface
     there must be the lip's own (on the plane the lip's slope draws, give or take 0.1 - a flat tread a riser up is the
     next stair), and the feet stand `r/cos - r` over a slope so the capsule's round foot rests on it rather than in
     it. The body fits there standing, else crouched; failing both, the same slid 0.15 and 0.3 along the face either
     way (an inner corner, a taller wall beside the ledge); and the WHOLE path to it proven (below). A refusal names
     the stage it reached: `no-top`, `no-room`, `no-room-up`.
  A lip with no landing on it is still a lip (`mantle: null` with the reason) - a thin top is the clamber's or the
  vault's to answer.
- **What fits**: `capsuleFits` asks two questions, because `penetrationAt` reports only how far the resolve PUSHED the
  body, and the resolve will not depenetrate a body up into a ceiling - it reverts it - so a standing body passing
  through a slab reads clear there (measured: 0.000 for a standing capsule on a 1 m top under a 0.3 m slab at 2.3).
  The ray up the axis to the head is the headroom.
- **The path, proven** (`pathClear`): the body fits at every point of the move at least every 0.08 m, at the height it
  will have there - a crouched move is crouched from its first step. That is under a quarter of the radius, so
  whatever the path crosses is within the radius of some point's axis (a bar a centimetre thick through the middle of
  the body reads 0.35 deep).
- **Over a thin top** (`senseOver`): a top that ends within 0.9 m of the face, a floor behind it within the drop the
  move allows, and the body - the whole way proven - clearing the top by 0.08 to a point past its far edge.
  - **The vault** (`senseVault`): a lip at the waist or under (1.2 m), the drop behind no deeper than DFU's
    fall-damage threshold (5 m); the body leaves with its momentum along the wall's normal (the motor's speed, at
    least 3.5 m/s) and a 1 m/s rise.
  - **The clamber** (`planClamber`): any lip in reach whose top is too thin to stand on (a parapet, a railing's top
    rail, a fence), the floor behind no more than 1.5 m under the lip; the body steps off at 0.8 m/s onto it. A climb:
    it trains Climbing.
- **The path's shape** (`movePoint`): the feet eased up to `up` (the radius + 0.04 off the face, 0.04 over the lip; the
  rise never comes nearer the face than that), then over to the landing with a 0.03 arc (0.1 over a thin top); the rise
  takes 45-75% of the time, more the higher the lip.

**In the motor** (`_parkourStep`, above `_climbStep` - which on this lane never runs since CLIMB2: the free climb takes
its place, below). A move in flight owns the step and the stance (a crouch pressed mid-move is ignored). Between moves
three things start one:
- **Jump on the ground**, behind the jump's own 0.1 s grounded gate: a lip in reach is climbed onto, or over, or - with
  Forward held - vaulted, INSTEAD of the jump; no lip and the jump goes as ever. The Jump that started a move is spent:
  held through it, neither a jump nor another move fires until it is let go.
- **Jump held in the air**: a lip coming into reach is caught, if the fall so far is one the skill holds. CLIMB2: a lip at
  the chest or higher is HELD - a hang - unless Forward is held, which climbs straight on over it as here.
- **The climb** arriving under a lip: at CLIMB1 the classic climb's top-out, no key; since CLIMB2 the free climb's - the
  lip is held, and with Forward still held climbed over.

Never from water, a saddle, levitation or paralysis. A climb (onto or over) asks Roleplay & Realism's gate first (below);
a vault does not. After a lip is found and every way refused, the air catch rests 3 steps before asking
again: a refusal proves the whole path at up to ten tries (0.85 ms on a railing), and held Jump would ask it every step.

As a move begins (the climb it came out of has let go), the walk input goes to zero (the arms, the body and the peers
read it), and a crouched move flips the stance while the eye sinks across the rise on the crouch's own clock. The move
carries no velocity and no fall: a catch anchors any later fall at the catch, as the classic grasp does. A move onto
what moves - a boat's hull - rides it (`collider.bucketPose`, `carryMove`), and a deck's carry (`carryBy`) and the
world's recentre shift it. A placement - `spawn`, `pinFeet`, the freeze that follows a teleport or the helm - cancels
it. The render eye rides the path, not MAC1's stair filter. The frame's edge `parkoured` ('mantle' for a mantle or a
clamber, 'vault') rides beside `jumped`. `mantling` reads true in flight: the motion bag's `climbing`, the three hosts'
`camera().climbing` (the torch stows, the shield hides) and the `__climb` probe carry it.

**The switch**: `scenes/shared.js parkourSwitchOn` - the Features row `enhanced-climbing` (`enhancedClimbing`, on by
default, forced on online - the lane asked with the page the switch is handed) and `?parkour=off`, the kill door; read
live, so the row takes effect at once. Offline the classic skin climbs DFU's way whatever the row says. Online the skin
is NOT asked: since OVH3 it is the player's own look ("nothing the room agrees on reads the skin"), and a way over a
rooftop is something the room agrees on. The kill door still works online - it takes the moves away from whoever types
it and from nobody else. The three motor hosts (world, exterior, dungeon) hand `parkourDeps(playerEntity, say)`.

**Roleplay & Realism** (`systems/rrInstall.js`, `rrRealism.js rrParkourRefusal`): under the mod's `climbingRestriction`
- on by default, and its own row promises "no climbing with a weapon out" - a drawn weapon that is not bare hands
refuses a mantle and a clamber with the mod's line, said once a press; the press is a plain jump.

**The bill** (`systems/worldTick.js`): a move is one exertion - a jump's fatigue, on BALANCE1's scale - and trains the
skill it used: a vault Jumping, a mantle or a clamber Climbing. The five activity reports carry `parkoured` beside
`jumped` (world, exterior, the interior ticker, the dungeon mode's report, the dungeon host's); the motor never raises
`jumped` for a move, so neither is billed twice; and the dungeon's tick spends both edges after billing them.

**Pins**: `test/parkour.test.js` (17) and `test/auditclimb1.test.js` (20 - below). **Mutants**:
`tools/mutants/climb1.json` (21) and `tools/mutants/auditclimb1.json` (35), all dead.

**Not yet seen in a browser on real ARENA2 geometry** - no session so far has had ARENA2. What the boxes cannot tell:
how Daggerfall's facades, pitched roofs, thin walls and dungeon meshes read to the sensor, and whether the reach and the
pace feel right. That is the next gate; `tools/climbProbe.mjs`'s door-square stance is where a probe of it starts.

**Recorded limits** (each a later slice's or a decision, not an omission):
- The path passes through what the collider does not hold: foes and other players are not in it, so a mantle can end
  beside - or in - a foe standing on the top. A door swung into the path mid-move is not collided with (the move is
  under a second, and the settle at its end resolves what it lands in).
- Terrain is not a wall: a hillside's face is never sensed (the level rays meet meshes only); a mesh wall with a
  terrain top is.
- A save made mid-move loads the body where it was on the path, and it drops back to the wall's foot (the move is not
  saved; the fatigue and the tally were billed when it began). The season's hold release cancels a move the same way.
- A move is allowed while wading (a mantle out of the shallows onto a jetty) and under a slow fall, where the classic
  jump is refused - decisions, recorded.
- No arms on the lip, no camera dip, no sound (CLIMB4). Peers online see the body walk up the wall - their `mv` is
  measured off its displacement (CLIMB5 puts the move on the wire).
- The encumbrance does not read yet (CLIMB2, with the grip). The vault's own lip is found at the Climbing skill's reach
  (it is under the lowest reach, 1.5 m, at any skill).

## AUDIT CLIMB1 (2026-09-30): "perfect and 1:1 with what I want"

Mac: *"let's do an audit on this. I want to ensure it's perfect and 1:1 with what I want."* Four lenses on PR #483:
fidelity to the ask and the four calls (in the conversation), an adversarial read of `parkour.js` and the motor, the
sensor against hostile geometry, and the hosts and the records. Every finding below was pinned RED on the CLIMB1 code
first (`test/auditclimb1.test.js`, 20 tests; the scenes are boxes and the body's overlap with them is measured EXACTLY -
a capsule against an axis-aligned box - never through the collider's resolve, which reads a head through a slab as
clear). The mutation run then found five survivors; each was a finding too (the last table).

### Fidelity - CLIMB1 against the ask and the calls

| Promise | Source | Now | Where it lands |
|---|---|---|---|
| Mantle | the ask | Done - a press, a held catch, the top-out, and a clamber over a thin top | - |
| Latch (hang on a ledge) | the ask | Not built: a catch goes straight to a mantle | CLIMB2 |
| Jump from ledge to ledge | the ask | Not built | CLIMB3 |
| Jump near a ledge catches or mantles; Jump held keeps catching | "Jump is the grab" | Done | - |
| Forward climbs up, Crouch drops (from a hang) | "Jump is the grab" | Not built (no hang) | CLIMB2 |
| Everyone can vault, mantle and hang from the start | "Skill scales it" | Vault and mantle, nothing gated; no hang yet | CLIMB2 |
| Skill sets reach and speed | "Skill scales it" | Done (a vault's pace now the Jumping skill's) | - |
| Skill sets whether a hard catch holds | "Skill scales it" | Done by the audit (F6): 5 m at 0, 15 m at 100 | - |
| Skill sets grip time | "Skill scales it" | Not built (no grip) | CLIMB2 |
| Sheer walls: Fatigue in place of the classic roll every 0.8 s; skill sets speed and grip | "Free-climb on grip" | Not built - the classic rolls still run on the enhanced lane | CLIMB2 |
| Sheer walls: the climb ends in a mantle; what is climbable stays climbable | "Free-climb on grip" | Done | - |
| Parkour leap, Jumping-scaled | "Parkour leap" | Not built | CLIMB3 |
| On by default, forced on online; the classic lane untouched | the stated defaults | Done (online skin-blind) | - |
| Khajiit, the Climbing spell, the tally | the proposal | Done | - |
| Roleplay & Realism's no climbing with a weapon out | the proposal | Done by the audit (F10) - CLIMB1 ignored it | - |
| Heavy packs cut the reach; Fatigue for hanging | the proposal | Not built | CLIMB2 |
| Magnetism, a late jump, a buffered jump; hands, camera, sound | the proposal | The path squares to the wall; the rest not built | CLIMB3/4 |
| Online state and third-person poses | the proposal | Not built | CLIMB5 |

### Findings - the code, the geometry and the hosts (each pinned red, each fixed)

| # | Finding | Fix |
|---|---|---|
| F1 | A crouch-only top ran and SETTLED a standing body: the crouch's clock ran out a frame after the move, so a counter under a 2.0-2.15 ceiling ended with the player standing ON the ceiling slab (y 2.30), and a lid over the top left the feet 0.54 m inside the block. Two lenses found it | The stance flips as the move begins; the eye sinks over the rise on the crouch's clock; the move owns the stance (a crouch press mid-move ignored) |
| F2 | Only the path's two ends were proven: a mantle walked through a balcony's rails, a 0.15 m slot in a thin wall and a window's lintel (252 of 4903 random moves swept > 3 cm into a box) | The whole path proven every 0.08 m at the move's own height (`pathClear`) |
| F3 | A down ray that starts inside a solid reads "past the far edge": a step with a wall at its back was vaulted INTO the wall, and a platform against a hollow shell into the building | The path proof crosses the wall's face and refuses it |
| F4 | `pinFeet` (Come Sail Away's boarding) and the helm's freeze left a move in flight: the player was dragged 63 m back onto the old path | Both cancel it |
| F5 | `carryBy` (a boat's deck) did not carry a move, and a mantle onto a moving hull landed where the deck had been | `carryBy` shifts it; a move onto a mover rides the bucket's pose (`collider.bucketPose`, `carryMove`) |
| F6 | Every air catch held and cancelled the fall above it: Jump held falling 30 m past a ledge billed 0.07 m | Mac's "Skill scales it": the hold is the Climbing skill's, 5-15 m; past it no catch, and the fall is billed |
| F6b | A refused lip was re-proven every step while Jump was held (up to 1.35 ms) | A 3-step rest after a refusal |
| F7 | Jump held through a move hopped on arrival (the patch notes told players to hold it) | The Jump a move started is spent until let go |
| F8 | The dungeon's tick reads a bag only `reportActivity` writes, and a street-slot window over a world-hosted dungeon holds that report while the tick runs: one mantle billed 60 times a second. The `jumped` edge had carried the same fault since C6 | The tick spends both edges after billing them |
| F9 | A move left the walk input standing (the Eye Of The Beholder body walked in the air, peers saw a run cycle), and nothing read it as a climb: the torch and the shield came back mid-top-out. The dungeon host's torch read `climbing` off the motion bag, which never carried it - no torch ever stowed on a dungeon wall | The walk input zeroed; `climbing` in the motion bag; the hosts' `camera().climbing` and `__climb` read `mantling` |
| F10 | The mantle ignored Roleplay & Realism's climbing restriction (on by default) | `registerParkourGate`, the mod's own rule and line |
| F11 | The switch read the shelf, not the lane, for the page it was handed (right in a browser, untestable in node) | `onlineForcedPref(key, search) ?? getPref(key)` |
| G1 | Pitched roofs of 33-44 degrees were refused: the lip was read 0.2 up the slope, and the level lip ray met the rising roof | The lip found 0.03 past the face; the face "ends" where a rung meets nothing within its lean; the foot lifted onto the slope |
| G2 | An inner corner, and a ledge beside a taller wall, were refused though a body fitted a few centimetres aside | The landing slides 0.15 and 0.3 along the face |
| G3 | Fixed insets: a wall top 0.3-0.45 deep was never stood on; a fence thinner than 0.2 was never vaulted (the one down ray missed it); a parapet's roof was never reached | The top's profile; the middle landing; the clamber |
| G4 | A table top thinner than a 0.2 m rung was found only when a rung landed in its edge | 0.1 m rungs, the lip confirmed 0.02 under it, and `scanSlab` |
| G5 | Near a staircase's head, Jump became a mantle onto the landing two treads up | The footing check on the ground; the landing on the lip's own plane |
| G6 | A vault over a railing above a 10 m drop threw the player into it | A vault asks for a floor within DFU's fall-damage threshold behind the top |
| R7 | A vault trained Jumping but read the Climbing skill for its pace | The Jumping skill |

### Records corrected

- "At a run": the vault needs Forward held, not a run - the Features row, the patch notes, the ledger row, this page
  and the code's comments said a run. Now "moving forward" everywhere.
- "Table": thin table tops were never mantled (G4) - true now, and pinned at 4-12 cm and 0.8-1.2 m.
- "Forced on online / on for everyone": true of the row; the kill door works online for whoever types it - said so.
- "A 2 m lip 0.90 s at Climbing 0" could never happen (the reach at 0 is 1.65 m) - a 1.5 m lip's numbers now.
- "Peers see the body glide up": they see it walk (their `mv` is its displacement) - said so.
- "The eave at the edge of reach only the head's column sees" was wrong: the audit's mutation run found the column
  refusing paths that were clear - the real path leaves the column as it rises, and the path's own points see the eave
  (9 cm deep, measured exactly). The column is gone; the eave now gives a crouched mantle, which passes under it.

### The mutation run's own findings

| Survivor | What it showed | Now |
|---|---|---|
| The edge's steep-top check | No pin named the refusal's reason at 50 degrees | G1 pins `steep-top` |
| The reach bound on the lip | The scan's last rung is a rung past the reach: a lip 5 cm past it passed without the bound | Pinned at 1.85 m against a 1.8 m reach |
| The head's column | Redundant with the proven path, and over-strict (above) | Removed |
| Riding a mover | The first fixture's hull was wide and slow enough that a landing where the deck had been still met it, and the check read the move's last step before a missed landing had dropped | A narrow hull at 2-3 m/s, read half a second later |
| The depth's bisection | A 0.2 m fence lands its edge on the midpoint of two steps by chance | Pinned on a 0.13 m fence |

Found on the way and NOT this PR's (reported, not fixed - each is the classic lane's): the interior ticker
(`worldModes.js`, `interiorTicker.tick`) passes no `climbing`, so a climber indoors pays the walking fatigue band, not
ClimbingFatigueLoss. (CLIMB2 fixed it - its free climb and hang are billed on that band - below.)

Also `tools/mutants/disc8.json`'s held-frame record re-aimed, `test/climbing.test.js`'s census of the cached pair's
writers moved to four, DISC8-G's held frame reports no move, the Features counts, order and budget, and every cite into
the lines this moved re-mapped (`tools/citeShift.mjs`).

## CLIMB2 (2026-09-30): THE HANG, THE SHIMMY, THE GRIP AND THE FREE CLIMB - SHIPPED

Mac, after AUDIT CLIMB1 was put to him ("Shall I start CLIMB2 (hang, shimmy, drop, grip time, and free-climb on
grip)?"): *"Yes"*. What it answers: "Jump is the grab" (Jump held keeps catching in the air; Forward climbs up, Crouch
drops), "Skill scales it" (the grip's time, the climb's and the shimmy's pace), "Free-climb on grip" (any wall stays
climbable, Fatigue in place of the classic roll every 0.8 s, the skill setting the speed and the grip, the climb ending
in a mantle) and the proposal's own lines - "Catch / hang: hands on the lip, body hanging below", "Shimmy: A/D while
hanging, follows the lip and stops at gaps", "Climb up / drop: W or Jump / Crouch", "hanging and climbing drain it
[Fatigue], which gives you Dying Light's grip stamina", "Heavy packs cut your reach".

**The law** (`player/parkour.js`, its second half):
- **The hand-hold** (`senseGrip`): a lip near an expected height on a face through a known point. Level rays from where a
  hanging body's axis would be, into the wall, every 0.05 m down a window of ±0.15 about the expected lip: the lip is
  where the wall steps OUT toward the body by the grip's depth (0.08 - the face's own lean, CLIMB1's) - a rung meeting
  nothing, or a wall set back (a sill's), over one meeting the face within the window of where it was expected - or
  where a top no steeper than 45 degrees rises from the face (an eave; its depth read up the rungs it rises through, a
  rung's height back a rung - AUDIT CLIMB2 C1). No such step is no lip: a wall running on through the window, or air. Then the top by a down ray just past the face, no
  steeper than 45 degrees and inside the window; the face under it, its normal within 30 degrees of the one expected
  (the hold follows a wall that curves and turns no corner on its own); and the hang, the body off the face by its radius
  and 0.04, the lip 1.8 over its feet (the eye - `EYE_HEIGHT` 1.7 - 0.1 under the lip), fitting there standing - the
  whole body, between the collider's spheres too (`bandsClear`, AUDIT CLIMB2 G2). A 10 cm
  sill on a tall wall is a hold; a 5 cm one is not; a lip with the floor too near under it holds the hands but not the
  body.
- **The grip** (`gripSeconds`): a fresh hold lasts 6 s at Climbing 0 and 30 s at 100, times 0.35..1 over the body's
  Fatigue (its current over its most - "grip on Fatigue"). It is spent whole hanging, shimmying and climbing, at half
  held still on the wall with the feet on it; it comes back from nothing in 2.5 s standing on the ground or treading
  water (AUDIT CLIMB2 H2); a catch's, a corner's and a reach's moves spend it as the hang does (H4); under 25% it is
  failing (the HUD's short colour, and "Your grip is failing." once a hold); under 5% it takes no new hold. Spent, the
  hands let go.
- **The pace**: the shimmy 0.6 m/s at Climbing 0 to 1.4 at 100 (`shimmySpeed`); the free climb the classic climb's own
  (Speed / 3, doubled under the Climbing spell - `climbing.js climbingSpeed`) times 0.7..1.3 (`freeClimbSpeed`); Forward
  held against a wall starts one after 0.6 s at 0 to 0.3 s at 100 (`freeStartSeconds` - the classic start is 0.77 s and
  a roll).
- **The pack** (`parkourReach(skill, load)`, `load` the pack's weight over what the body can carry): nothing to half a
  pack, 0.3 m of reach less at a full one. The chest (1.2 m, where a hang begins) stays under the shortest air reach.
- **Corners** (the motor's, on these laws): another face turned past the hold's 30-degree follow, at whatever angle - a
  building's square corner, an octagonal tower's 45, a hexagon's 60 (AUDIT CLIMB2 G5: the first cut took only corners
  within 30 degrees of square); round an inner one the body comes 0.1 m off the first face, its apex within the old
  reach (no corner across a gap); round an outer one the other face's turn is read 0.1 m past the edge, the hands take
  it 0.25 m on and the body swings round the edge 0.1 clear; the corner's path is proven as a move's (`moveClear`), at the shimmy's pace (`planCorner`).
  A lip that merely ends is no corner: past a gap the body does not fit round the edge, and where the wall runs on in the
  same face the other side's hold is sought inside the solid and is none.
- **The free climber's wall** (`wallContact`): level rays from the axis into the wall at 0.8, 0.4 and 0.2 of the body's
  height, the nearest face within the radius and 0.15 (a face with |ny| over 0.7 is a floor or a ceiling, no wall).

**In the motor** (`_parkourStep` and `_wallStep`):
- **The catch in the air** (Jump held - or since AFTER AUDIT CLIMB2 a tapped Jump's press, armed for its jump - the fall
  one the skill holds, the grip not spent): Forward held climbs onto or over
  the lip (CLIMB1); a lip at the chest or higher is otherwise HELD - `planCatch`, 0.15 s into the hang, the way proven;
  a lower one is stepped onto (CLIMB1); where no hang fits, the lip is climbed onto as at CLIMB1. A crouched jump holds
  nothing (the hang is the standing body's). With Forward held and no lip to take, the hands take the wall itself - a
  free climb, billed as a catch.
- **Forward held against a wall** - still, within the classic start's 0.12 m, on the ground or in the water - for the
  skill's start time: a free climb. On this lane the classic climb never runs (`_step`'s `!this._pkOn`), a classic climb
  the switch catches under way ends, and nothing rolls.
- **On the wall**: the hold rides what it holds (`collider.bucketPose`, `carryHold`); Roleplay & Realism's gate refuses
  the hold (a weapon drawn on the wall lets go, as the classic climb's next roll fails); Crouch lets go (the render
  frame's press, taken by `_heightAction`'s wall arm - no stance toggles, and the body is stood); the grip is spent; the
  Climbing skill is tallied at the classic climb's continue cadence (15 system-timer units); Left and Right are the
  look's, along the wall, decided when the key goes down and kept while it is held - so a hold carries the hands round
  corner after corner the same way (never into the next hold: a new wall asks the look afresh - AUDIT CLIMB2 A3). A body
  the hands hold is out of the water: never sunk, its Crouch its own (C2).
- **The hang** (`_hangStep`): the hold is asked again where the body hangs each step (gone, the hands let go). Forward, or a fresh Jump, climbs up
  - onto the top or over a thin one, the whole way proven; a lip with neither (a sill under a window) holds, and Forward
  held asks no more until it is let go or the hands move. Back climbs down the face (the free climb, reaching for the
  wall under a sill as far as the grab's own 0.5 m until the hug presses the body to it). Left and Right shimmy: the body
  must fit where it hangs next, and the lead hand must find a hold a span (0.25 m) on from there, along that hold's own
  face (AUDIT CLIMB2 G5: asked along the face the body held, a tower's curve stopped it) - the lip ends, or breaks, and
  the hands stop; each step's hold is the lip's own, its height and its face's turn followed. Stopped, a corner is asked
  (`_pkCorner`): an INNER one is a face across the lip with a lip of its own at this height; an OUTER one is the lip
  ending (its end found to a centimetre) with the other face's lip round the edge. A corner is a move (`corner`,
  unbilled) and the same hold going on round it - its warning, its tally and the climb's flag kept (AUDIT CLIMB2 C7).
- **The free climb** (`_freeClimbStep`): Forward up, Back down, Left and Right across, at the skill's pace on the classic
  climb's, pressed into the wall as the classic hug is. Going up with Forward held, a lip coming within the hands' reach
  is climbed onto or over - CLIMB1's top-out, the one Mac's call asked for (AUDIT CLIMB2 H5: the first cut topped out
  only at the hang's height, and stuck under a wall lower than that); a lip with no way onto it is climbed on to until
  it is at the hands (1.8 over the feet), and held; under a cornice that stops the head before then, the hands reach
  round it to the lip by a catch's proven move (AUDIT CLIMB2 G4). Across the wall the body goes as far as it was asked
  and no further: the hug's press slid a body along a box's diagonal seam (a climb down went 2.8 m sideways before this
  was stripped). The climb never steps: the hug's press read to the collider's step ladder as a walk into a stair and
  lifted a body 0.375 m into an eave (G1). A move the wall does not go on under is not made (its top where no lip was
  held), nor one into what the collider's spheres pass between (G2); at the side edge the way up is asked alone (G6).
  The floor within ClimbingMotor's own 0.12 under the body's centre - the terrain's too (C6) - ends the climb of a
  climber not going up, standing (A1); a sill under the feet's rim is no floor, and the body is held on the wall over it
  (C3). (The first cut also ended the climb on any ground the move met, "the classic climb's own shove": with no step
  ladder that is A1's, a step later, and it is gone.) A crouched body takes no wall it cannot stand up on (G3).
- **Letting go** (`_wallEnd`): Crouch, the grip spent, the gate, the hold gone, the switch turned off, levitation,
  paralysis, a placement. A Jump still held catches nothing until it is pressed afresh (it would take back the lip just
  let go of); the next step reads as a climb just ended (`climb.wasClimbing`, so a Jump on the floor goes at once, as off
  the classic climb). The body falls from where it let go - a hang's fall is billed from the hang.
- **What reads it**: `climb.hold()` sets the classic climb's own flag while the hands hold a wall - the fatigue band's
  climbing arm (ClimbingFatigueLoss, "draining Fatigue"), the bob, the torch and the shield (`camera().climbing`), the
  motion bag - with none of that machine's rolls. `hanging`, `onWall` and `gripShown` are the motor's; the render eye
  rides the climber (MAC1's stair filter would trail a climb by its speed times its time constant); the recentre shifts
  the hold, a deck's carry re-reads its mover, and a mover's remembered pose moves with the world (the same latent
  fault in CLIMB1's move: a recentre under a mover was carried twice).

**The hosts**: `parkourDeps` hands the Fatigue over its most (`statMods.js maxFatigue`), the pack over what the body can
carry (`inventory.js carriedWeight` over `formulas.js entityMaxEncumbrance`) and the Climbing tally (`climbingDeps`'
own). THE GRIP ON THE HUD: `drawHud`'s `grip` (`{ amount, low }`), handed by the world, exterior and interior hosts and,
for the dungeon context, by its hosts' `reportActivity`. The classic HUD draws it in the breath bar's likeness and art,
a slot left of it (both may draw at once - a grip coming back while its swimmer holds breath), 50 px, bottom-anchored, surviving the large HUD as the breath does; the
enhanced HUD a "Grip" meter beside "Breath". The interior ticker's bag carries `climbing` (AUDIT CLIMB1's reported,
unfixed finding - PlayerEntity.cs:405-408 asks it wherever the body is - fixed here, since the band is how a climb costs
Fatigue). The `__climb` probe carries the hold and the grip.

**What changed from CLIMB1, and the pins it moved**: a lip caught in the air at the chest or higher without Forward is
held, where CLIMB1 climbed onto it (`test/parkour.test.js`'s air catch holds Forward for its mantle, and asserts the
hang without it); AUDIT CLIMB1 F6b's fixture's pit is shallow (the hang is refused there too); the census of the cached
pair's writers is five (`_wallStep`, `test/climbing.test.js`); A6's freeze pin finds the classic climb's call off the
enhanced lane; the HUD's foot has the grip beside the breath (`test/renown4.test.js`, `test/ui3_status.test.js`); the
Features note says the hang, the shimmy, the let-go, the free climb and the grip (+97); `_parkourBegin`'s stop of the
classic climb was dead (every way into a move has let go first) and is gone - its mutant re-aimed at `_wallEnd`, with
seven more CLIMB1 records re-aimed at the lines CLIMB2 reshaped.

**Fidelity - the ask and the calls, now**:

| Promise | Source | Now | Where it lands |
|---|---|---|---|
| Mantle | the ask | Done (CLIMB1) | - |
| Latch (hang on a ledge) | the ask | Done: a catch at the chest or higher is held | - |
| Jump from ledge to ledge | the ask | Not built | CLIMB3 |
| Jump near a ledge catches or mantles; Jump held keeps catching | "Jump is the grab" | Done | - |
| Forward climbs up, Crouch drops | "Jump is the grab" | Done (and a fresh Jump climbs up, the proposal's "W or Jump") | - |
| Everyone can vault, mantle and hang from the start | "Skill scales it" | Done, nothing gated | - |
| Skill sets reach, speed, grip time, whether a hard catch holds | "Skill scales it" | Done | - |
| Sheer walls: Fatigue in place of the roll; skill sets speed and grip; ends in a mantle; what was climbable stays so | "Free-climb on grip" | Done: no roll; the band's Fatigue and the grip; the top climbed over as it comes in reach (AUDIT CLIMB2 H5), a lip with no room held | - |
| Shimmy, following the lip, stopping at gaps | the proposal | Done, and round corners | - |
| Heavy packs cut the reach | the proposal | Done | - |
| Hanging and climbing drain Fatigue - grip stamina | the proposal | Done: the band while on the wall, the grip on the Fatigue | - |
| Every catch trains the skill | the proposal | Done: a catch and a grab bill a jump's exertion and tally Climbing; the wall tallies at the classic cadence | - |
| Parkour leap, Jumping-scaled; leaps from a hang | "Parkour leap" | Not built | CLIMB3 |
| Magnetism, a late jump, a buffered jump | the proposal | Not built | CLIMB3/4 |
| Hands on the lip, camera, sound; the view turning with a corner | the proposal | Not built | CLIMB4 |
| Online state and third-person poses | the proposal | Not built | CLIMB5 |

**Pins**: `test/climb2.test.js` - the laws; the hand-hold against boxes (a sill, a thin sill, no room, a steep top,
a turned face, the window); every move live through `PlayerMotor` (the catch and the hang, up by Forward and by a fresh
Jump, the drop and its bill, a sill's hold and the climb down under it, the shimmy's pace and its stops, the corners
round a whole building and into an L, the grip's six seconds and a tired third and its return, a spent grip, the free
climb's start and pace and top-out, down and across and held still, from the water, the grab, the switch both ways,
Roleplay & Realism three ways, the pack, placements, the recentre and a moving hull, a crouched jump, the tally's
cadence); and the hosts by source - 25 in all. **Mutants**: `tools/mutants/climb2.json` (59), all dead, and every CLIMB1
and AUDIT CLIMB1 record re-run (eight re-aimed at the lines CLIMB2 reshaped), all dead.

**The mutation run's own findings** (the first run: 61 records, 15 survived; each was a finding):

| Survivor | What it showed | Now |
|---|---|---|
| The hang's per-step re-placing | Redundant: a mover's lip is carried with the body; the step only needs to ask that the hold is there | Removed; the hold is asked, and gone the hands let go |
| The corner's "the wall runs on" check | Redundant: where the face runs on, the other side's hold is sought inside the solid and is none; past a gap the body does not fit round the edge | Removed |
| The hold's top no steeper than 45 degrees; the lip inside the window | No pin reached them: the top's ray is a rung and a little long, so a steep top or a far one fell past its end | Pinned on a 50-degree knife edge and a curb's plate read 18 cm under the window |
| The catch's path proven | The fixtures' catches were short and square to the wall | A pole beside the pull toward the wall: no catch, climbed onto round it |
| A walkable ramp is no wall | No free-climb fixture stood on a ramp | `wallContact` on a 40-degree ramp, and a 60-degree face that is one |
| A spent grip takes no hold; the free start asks the grip | The pins read the state at the end, after the hold had let go | Read at every step |
| The hold keeps the fall at the wall | The climbs began on the ground, where the fall's start was already there | The wall taken in a fall: the drop billed from the wall |
| Letting go spends a held Jump | The drop's Jump had been spent by the catch before it | Let go of a free climb with Jump held: the lip above not taken back |
| Forward on a sill asks once | The count read a probe the ask barely spends | The top rays counted (one a step for the hold, one ask's worth) |
| A corner's path proven | No fixture put anything on the path | A downpipe on the corner's diagonal |
| The seam's slide stripped | The climb down began below the face's seam | Climbed past it first |
| A placement ends the hold | The body was placed away from any lip, and the hold's own ask let go | Placed a metre along the same wall, where the hands could take the lip again |

**Recorded limits** (each a later slice's or a decision):
- Leaps - from a hang (up, sideways, back), the wall run-up, a running jump caught at the far side - are CLIMB3's; Jump
  on a free climb does nothing yet. A hang on a sill under a climbable wall cannot go on up it (CLIMB3's up-leap).
- The view does not turn with a corner (CLIMB4, the camera); Left and Right stay the look's as the key went down.
- The free climb does not turn a corner; across a wall it stops at the edge (and goes on up it - AUDIT CLIMB2 G6).
- A crouched jump holds nothing.
- Forward held still against anything the probe calls a wall for the start time starts a climb - a table's side
  included; the classic climb's probe reached the same (at 0.77 s and a roll).
- Terrain is not a wall (as CLIMB1). A save made on the wall keeps the hold and the grip (AUDIT CLIMB2 H1); if the world
  has changed under it so the hold is gone, the body falls from where it was put.
- Peers see the body held still, or walking as it moves along or up the wall - their `mv` is its displacement (CLIMB5).
- **Not yet seen on real ARENA2 geometry**, as CLIMB1.

## AUDIT CLIMB2 (2026-10-01): "ensure its perfection before we merge"

Mac: *"Hey audit this and ensure its perfection before we merge."* Four lenses on PR #483 (CLIMB1 and CLIMB2):
fidelity to the ask and the four calls, an adversarial read of the code, the climb against hostile geometry (a battery
of 44 hand-built scenes under 11 input scripts, rotated, and 12,000 random scenes, the body's overlap measured exactly),
and the hosts and the records. Every finding below was pinned RED first (`test/auditclimb2.test.js`, 22 tests; the
scenes are boxes and prisms, the body's overlap with them measured EXACTLY - never through the collider's resolve or
`penetrationAt`, which the audit found blind between the collider's spheres, G2). The mutation run then found
survivors; each was a finding too (the last table).

### Fidelity - CLIMB1 and CLIMB2 against the ask and the calls

| Promise | Source | Now | Where it lands |
|---|---|---|---|
| Latch, mantle | the ask | Done - and a roof's eave is a hold now (C1), round any tower or room (G5) | - |
| Jump from one location to another ledge | the ask | Not built | CLIMB3 |
| Jump near a ledge catches or mantles; Jump held keeps catching | "Jump is the grab" | Done - and since Mac's answer to the question below, a tapped Jump catches too (AFTER AUDIT CLIMB2) | - |
| W climbs up, Crouch drops | "Jump is the grab" | Done - over deep water too (C2), and Jump held through the drop catches nothing (M1) | - |
| Everyone can vault, mantle and hang; skill sets reach, speed, grip time, hard catches | "Skill scales it" | Done; a catch and a corner spend the grip as the hang does (H4) | - |
| Any wall climbable on Fatigue, skill sets speed and grip, the climb ends in a mantle | "Free-climb on grip" | Done: the top-out at reach (H5), under a cornice by a reach (G4), outdoors on terrain (C6), never stepping into what it climbs (G1, G2) | - |
| Everything climbable stays climbable | "Free-climb on grip" | Done - a save on the wall keeps the hold (H1); a crouched body under a slab is the one refusal (G3), and the classic climb stands that body up into the slab | - |
| Parkour leap, skill-scaled | "Parkour leap" | Not built | CLIMB3 |

**Open question, put to Mac**: a *tapped* Jump at a ledge above standing reach does not catch it - the catch asks for
Jump held (the patch notes say so). "Jump near a ledge catches" could be read to mean a tap arms a catch for that
jump. Not changed without his word. **Answered** (*"Take care of the what is left including a jump catching a
ledge"*): it does now - AFTER AUDIT CLIMB2, below.

### Findings (each pinned red, each fixed)

| # | Lens | Finding | Fix |
|---|---|---|---|
| A1 | fidelity | A free climb begun at the floor and let go of held the body on the wall, feet on the floor, until the grip ran out | ClimbingMotor's own "ground directly below too close" (0.12 under the centre) ends a climb not going up |
| A3 | fidelity | Left and Right kept while the key is held carried into the next hold - Right moved left on the next wall | A new wall asks the look afresh; only a corner keeps the way round |
| H1 | hosts | A save on the wall recorded no fall and no hold: a quicksave twelve metres up a tower loaded into a twelve-metre fall | `fallSnapshot` keeps the hold (or a move's end, bounded by `HOLD_CARRY_MAX`) and the grip; the load takes it again (`_pkRetake`) |
| H2 | hosts | The grip came back only on the ground - a swimmer with a spent grip could never climb out (the free climb is this lane's only way out of the water) | It comes back treading water too |
| H4 | hosts | A catch and a corner spent no grip - a corner at Climbing 0 was two free seconds | Every move that ends in a hang spends it |
| H5 | hosts | The free climb topped out only at the hang's height: a wall lower than that (a plinth, a garden wall) was never topped, the climber stuck under its lip with Forward held | CLIMB1's top-out: a lip in reach is climbed onto or over |
| H6 | hosts | A running catch kept the run latched on the wall (the Running tally, the peers' run cycle) | The hold clears it |
| H7 | hosts | The standalone dungeon host passed parkour no `say` - the grip's warning and a refused climb said nothing there | `parkourDeps(playerEntity, (l) => ctx.hudSay?.(l))` |
| C1 | code | A pitched roof's eave was no hold: two rungs on the roof passed the face test, and above about 32 degrees no rung pair receded the grip's depth - 0 of 25 heights held from 35 to 44 degrees; a free climb under such a roof stuck at the eave | The face rung is one the rung under it does not stand out from; a top rising from it is read up the rungs (a rung's height back a rung); the face under an eave is the rung's under the lip |
| C2 | code | Over deep exterior water the hosts' flag sank a hanging body to the swimmer's 0.3 m and swallowed the Crouch that lets go; a climb out of the water under a low roof was planned for the 0.3 m body and ended 0.35 m inside the quay | A held body is out of the water: unsunk the step it takes the hold, never sunk on it |
| C3 | code | Climbing down past a 12 cm window sill stood the body on the sill, and Back walked it off into a 5.3 m fall | Only a floor under the body's centre ends the climb |
| C4 | code | A recentre under a hold on what stands again at its new place (the parked wagon, a gate, an action object) carried the body back the whole recentre - 819 m | `bucketPose` answers no pose for a bucket that does not move with one |
| C5 | code | A catch or a corner in flight left its hang behind a vertical recentre (the hang sought 500 m away) and a turning hull (50 degrees off at 25 deg/s) | `offsetMove` and `carryMove` carry the move's hang |
| C6 | code | A1's floor was the meshes' only - outdoors on terrain it never fired; the classic climb's own probe had the same latent fault | The probe is `surfaceHit` (the terrain's too), for both climbs |
| C7 | code | Each corner let go and took a new hold: the grip's warning said again at every corner, a pillar's Climbing tally never reached, the climb's flag down (the fatigue band billed a walk) for every corner | A corner is the same hold going on |
| G1 | geometry | The hug's press into the wall read to the collider's step ladder as a walk into a stair: a climb across under an eave was lifted 0.375 m in one step, 0.34 m into the wall, and held there | The climb's move never steps (`collider.move`'s `noStep`) |
| G2 | geometry | The proofs used `penetrationAt`, whose capsule is a chain of three spheres reaching 0.22 m from the axis between them: a moulding, a rail or a cornice there sat up to 0.16 m inside the body - the shimmy, the catch, the corners and the free climb all walked into one (about 230 of the 12,000 random scenes) | `bandsClear` asks the bands between the spheres (in `capsuleFits`, the free climb's every move and its start) |
| G3 | geometry | A crouched body under a low slab started a free climb, was stood up 0.43 m into the slab, and flicked on and off the wall without end | A crouched body takes no wall it cannot stand up on |
| G4 | geometry | Under a cornice standing 0.12-0.15 out the head stopped with the lip 1.9 over the feet, past the hang's 1.84: Forward did nothing until the grip ran out | A climb that can go no higher reaches round to the lip by a proven catch's move, the hold going on |
| G5 | geometry | The shimmy stopped on the first bend of every tower and room that was not round or square: the lead hand was asked along the face the body held (a curve turned it past the follow), and a corner had to be within 30 degrees of square (an octagon's 45, a hexagon's 60, a 12-gon's 30 fell between) | The lead hand from the body's next hold; a corner at whatever turn, its inner apex in reach |
| G6 | geometry | Forward with Right at the wall's side edge reverted the whole move, the way up with the way across: the climb froze there | The way up is asked alone |
| M1 | mutation | Letting go spending a held Jump was pinned only through the corner's old let-go | A fresh Jump pressed as Crouch lets go: let go, not caught again |
| M2 | mutation | The fit's headroom ray lost its pin to the bands, which see a slab through the body's middle | A body pinned between slabs at its feet and its head reads clear to the collider and the bands: the ray refuses it |

### Records corrected

- The patch notes: the reach is shoulder height at Climbing 0; the vault's limit is about 1.2 m; the hang starts about
  1.2 m above the feet; the top-out, the grip treading water, the meter with the breath bar, corners spending the grip,
  saving on a wall, and now eaves, towers, sills, cornices and the crouched start (H3).
- The HUD: the grip and the breath may draw at once - "they never draw together" was wrong (H8).
- The ledger and Active-Arcs: a catch holds (CLIMB1's catch went straight to a mantle), the free climb tops out at
  reach, and Roleplay & Realism's gate covers the catch, the grab, the free start and the hold (H9).
- Moved pins: AUDIT pre-merge S2 (`test/squeeze1.test.js`) reads `collider.move` with G1's `noStep` after
  `keepFloor`, and the climb's own call passing it `false`; CLIMB2's records re-aimed where the audit moved their lines.
- This page: the free climb's "the classic climb's own shove, kept as the fallback" is gone (with no step ladder the
  move's own ground was A1's, a step later - the arm was dead and is removed); the corners, the lead hand and the grip's
  return say what the audit made them.

### The mutation run's own findings

Two runs: the audit's own records (29 at first, 46 at the end - `tools/mutants/auditclimb2.json`) and every CLIMB1,
AUDIT CLIMB1 and CLIMB2 record again, the lines the audit moved re-aimed. Each survivor was a finding:

| Survivor | What it showed | Now |
|---|---|---|
| C2: the hold unsinking the swimmer at once | The frame's own unsink came a step later and the pins read the state after it - but a crouched move begun in a frame of several steps would be stood up under the roof by it | Pinned: the swimmer is whole on the step the wall is taken |
| C2: the plan's sunk height | Dead behind that unsink: no plan is made while sunk | Removed |
| C1: the depth walk across any rise | A moulding 6 cm deep, its wall set back a further 4 cm a few centimetres up, read as a roof at some heights and not others | The walk asks a rung's height of recession a rung (a 45-degree top, the rays' scatter less - `PARKOUR_RAY_SCATTER`); pinned at eleven heights |
| C1: the step's inset | Equivalent: the scan is top-down, and the rung above is asked first | Recorded |
| G1: the climb's `noStep`, and the ladder's own check | Behind G2's whole-body proof, a rung landed in the eave is refused anyway; beside a block the collider's resolve gives the same path (measured on 0.8-1.0 m plinths) | Recorded equivalent: a climber never steps |
| G2: the free start's own check | A climb taken inside a rail leans out on its first move | Recorded equivalent |
| G2: the rail (found pinning the start) | A climber under a rail sat stuck, every move pressed back into it, and the collider's sphere turned a move up into one down | The climb leans out past it (`PARKOUR_LEAN`, the hug let go of, then 2, 5, 10 cm out); pinned at 8 and 12 cm. (A move the collider turned back was refused too, until the finer bands below caught the rail first and made that check dead - AFTER AUDIT CLIMB2) |
| G4: the reach's path proven | Equivalent: a straight 10-16 cm between two bodies each proven to fit | Recorded |
| G5: the lead hand from the next hold | The new corners took a 20-gon round anyway - by swinging eight corners | The lead hand felt in two halves; a round tower is followed with no corner swung (pinned) |
| G5: the 30 degrees | A small 12-sided room (R 1.5) still stopped: its 30-degree bends fell between the follow and the corner, and the corner's ray passed the next wall's end | The follow takes its 30 degrees with the rays' scatter; pinned |
| CLIMB2: letting go spends a held Jump; the top's arrival. CLIMB1: the fit's headroom ray | The climbing records never ran the audit's pins, and the audit's changes took their old kills (the corner no longer lets go; the top-out at reach; the bands catch a slab through the middle) | Every climbing list runs `test/auditclimb2.test.js`; pinned by M1 (a fresh Jump at the let-go), G4 (the sill held as the hands come to it) and M2 (a body pinned between slabs at its feet and head, which only the ray sees) |
| CLIMB2: the free climb's floor arm | Dead behind A1 with no step ladder | Removed |

At the end: 155 dead, 5 recorded equivalent, none surviving. Against the audit's own instruments: the hand-built
battery (44 scenes, 11 scripts, 3 spawns, 2 skills) has no failing run (126 before), the shimmy goes round every tower
and room it was tried on, and 6,000 random scenes leave overlaps of 4.6 cm at most (16 cm before) - the fit's own
resolution between its samples, recorded below.

**Recorded limits** (both closed AFTER AUDIT CLIMB2, below): between the fit's samples (every 0.275 m up the axis, a
contact's 3 cm inside the body) a thin feature could still sit up to about 5 cm in. A tapped Jump did not catch (the
open question above).

Found on the way and NOT this PR's (reported, not fixed): standing up from a crouch under a low eave sinks the body
0.29 m into the floor with the enhanced climb off too - the stand-up's own (DFU's CanStand clears the camera's rise
and lets the head clip, AUDIT 64 F5), not the climb's. And on a dense mesh (one collider mesh of 11,500 triangles) a
free climb's top-out step costs about 13.5 ms (39 `penetrationAt` calls inside the ledge's proof) and a corner's up to
7.3 ms, once each; a steady climb's 2.0-2.4 ms a step is the collider's own move (walking along the same wall costs
the same). Daggerfall's models are a few hundred triangles; plain geometry stays under 0.5 ms a step in every state.

## AFTER AUDIT CLIMB2 (2026-10-01): what was left

Mac, on the audit's report (its open question, its two recorded limits): *"Take care of the what is left including a
jump catching a ledge."*

**THE TAP CATCH** (`motor.js _parkourStep`, `PARKOUR_ARM_GRACE_S`). A fresh press of Jump arms the air catch for the
jump it makes, as if the key were still held, until the body is down again. A press on the ground that leaves it no
jump (the grounded gate's) lapses after 0.05 s, since the jump it would have made takes off on the press's own step.
A move spends it (a tapped mantle or vault), and so does a let-go: only a fresh press catches the lip let go of. A
press in the air while falling past a lip arms it just the same. What a tap catches is a CATCH: a lip at the chest or
higher, held, or climbed onto with Forward. It never steps the body onto a low lip in the air, which would make a
staircase tapped all the way up a string of mantles (AUDIT CLIMB1 G5's "Jump on a staircase is a jump"; the first cut
of the tap broke that pin at once). Nor does it grab a sheer wall: a tapped jump at a wall with Forward held is a
jump. Both of those still ask the key held, as they always have. A refused climb's line (Roleplay & Realism) is said
once a jump, armed or held.
- **Moved pins**: CLIMB1 LIVE's tapped jump at the 2.3 m lip (`test/parkour.test.js`) now catches and hangs; the
  Features note says "Jump at a high ledge to catch it" (-3 characters, inside the budget).

**THE FIT, FINER** (`parkour.js bandsClear`). The bands are asked every 0.1375 m (`PARKOUR_FIT_BAND`, half the first
cut's), by spheres 2 cm inside the body (`PARKOUR_BAND_SLACK`, a centimetre less than the first cut's 3). A thin
feature between two samples now sits no further in than a contact's 3 cm (2.7 cm at the worst point between them). A
wall the body leans on stays 2 cm clear of the sphere, and a 45-degree roof it stands on 1.5 cm.
- **Measured** with the hostile-geometry audit's own instruments:
  - The same 6,000 random scenes flag 2 seeds, down from 54. One is a mantle 3.1 cm in, a millimetre over the line and
    seen by the collider's own measure. The other is a ground/air flicker after the climb had ended, which is the walk's.
  - The hand-built battery still has no failing run.
- **The price**: plain geometry is unchanged (every state under 0.3 ms a step). On a 1,700-box brick wall the free
  climb's one top-out step costs 18.9 ms where it cost 13.9, and the steady climb about 0.8 ms more a step. Daggerfall's
  models are a few hundred triangles.
- **Pinned**: two rods 3.3 cm into the body, one midway between the first cut's samples and one midway between today's,
  are refused; a rod 1.5 cm in is a touch.

**REAL GEOMETRY** (`test/climbreal.test.js`). Still no session has had the game data. The measure for one that does
climbs every side of the first 24 building-sized ARCH3D models (5-25 m across, 3-15 m tall). On each side it runs the
free climb from the foot of the wall, its top-out or its hang, and the hang's shimmy. It measures the body's depth in
the model's own triangles EXACTLY: the capsule's axis against every triangle near it, never through the collider. The
harness is proven on every run against three synthetic buildings: a house under a 30-degree roof and an octagonal
tower, every side topped out, and a house under a slab, every side hung from and shimmied along. Its measure agrees
with the box measure to a millimetre. The real models run where `ARENA2_PATH` names the game's data, as every
real-data test in the suite does.

**Mutants**: `tools/mutants/auditclimb2.json` grows to 56: the tap (its arming, the held-only mode, the landing, the grace,
the low lips, the grab, the line said, the move and the let-go spending it) and the fit's spacing and slack. Every
climbing list re-run: 165 dead, 5 recorded equivalent, none surviving. The survivors on the way were findings:
- the grace's pin pressed on the spawn's own step, still in the air;
- the let-go's pin dropped half a metre to the floor, which ended the arm before a catch could;
- the free climb's "turned back is no move" check was dead behind the finer bands, and is removed;
- the finer bands also took the headroom ray's pin, so M2 now pins the case only the ray sees: a plate through the
  shins under a ceiling at the head.

Still open: `test/climbreal.test.js`'s real half has never run, because no session has had the game data.

**MAIN #498's CLIMB-PAST, CARRIED** (the merge of 2026-10-01). FIELD BUGS 2026-10-01 #7 ("Running jumping climbing dint
work passed 100") gave a mastered Climbing's points past 100 to the classic climb's speed: `climbing.js climbingSpeed`
times `skillSoftcap.js overcapClimbSpeed` of the LIVE skill, x1.4 at 200. This lane's pace read the 0..100 skill
alone, and online, where the row is forced on and the classic climb never runs, that would have taken the fix away
from every climber. Now the free climb's pace is the classic climb's own with the live value (`freeClimbSpeed`'s
`live`), and the shimmy and its corners take the same multiplier (`shimmySpeed`, `planCorner`; the motor hands the
deps' `climbing` down `_hangStep`, `_pkShimmy` and `_pkCorner`). The reach, the grip and the catch's fall stay the
0..100 law's, as CLIMB-PAST left the classic check's.
- **Pinned**: `test/climb2.test.js` "CLIMB2 x CLIMB-PAST", red on the merge: the laws, and live at Climbing 200 the
  climb up the face, the shimmy along the lip and a corner's move each x1.4.
- **Mutants**: `tools/mutants/climb2.json` grows to 67, nine for the carry (each law capped, each hand-down dropped);
  the three records on the lines it reshaped are re-aimed. All twelve dead.
- **The merge's own fault**: `scenes/shared.js` imported `isOnlinePage` twice (CLIMB1's switch and MANA-HALF each
  added it, and git merged both lines cleanly), so the module did not load; one import now. #500 has since reverted
  MANA-HALF, and the next merge took its side: the import is CLIMB1's alone again.

## CLIMB-NODE (FIELD BUGS 2026-10-01) - THE FREE CLIMB HOLDS AT A NODE

Found answering "minig is broken doesnt work" (`01-Overview/Field-Bugs-2026-10-01.md` part four): a vein stands at its
rock's foot (PROF2), and the free climb's walk-in start (Forward held against a face for `freeStartSeconds`) climbed the
rock under a player who walked into it to reach the ore - the target and the act lost. Asked, Mac: *"Hold it at
nodes"*. While a profession's node is under the look (the gathering host's target, its prompt up) or an act plays, the
walk-in start is held (`player/motor.js` _freeStart, `pk.hold` - `scenes/shared.js` parkourDeps' third argument, the
world host's), and its count begins again when it lets go. A jump's grab, a mantle, the hang and the shimmy are not
held. `test/fb1001_climbnode.test.js` (4); `tools/mutants/fb1001_climbnode.json` (6, all dead).

