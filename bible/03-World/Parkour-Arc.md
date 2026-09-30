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
  nothing, or a wall set back (a sill's), over one meeting the face within the window of where it was expected. No such
  step is no lip: a wall running on through the window, or air. Then the top by a down ray just past the face, no
  steeper than 45 degrees and inside the window; the face under it, its normal within 30 degrees of the one expected
  (the hold follows a wall that curves and turns no corner on its own); and the hang, the body off the face by its radius
  and 0.04, the lip 1.8 over its feet (the eye - `EYE_HEIGHT` 1.7 - 0.1 under the lip), fitting there standing. A 10 cm
  sill on a tall wall is a hold; a 5 cm one is not; a lip with the floor too near under it holds the hands but not the
  body.
- **The grip** (`gripSeconds`): a fresh hold lasts 6 s at Climbing 0 and 30 s at 100, times 0.35..1 over the body's
  Fatigue (its current over its most - "grip on Fatigue"). It is spent whole hanging, shimmying and climbing, at half
  held still on the wall with the feet on it; it comes back from nothing in 2.5 s standing on the ground; under 25% it is
  failing (the HUD's short colour, and "Your grip is failing." once a hold); under 5% it takes no new hold. Spent, the
  hands let go.
- **The pace**: the shimmy 0.6 m/s at Climbing 0 to 1.4 at 100 (`shimmySpeed`); the free climb the classic climb's own
  (Speed / 3, doubled under the Climbing spell - `climbing.js climbingSpeed`) times 0.7..1.3 (`freeClimbSpeed`); Forward
  held against a wall starts one after 0.6 s at 0 to 0.3 s at 100 (`freeStartSeconds` - the classic start is 0.77 s and
  a roll).
- **The pack** (`parkourReach(skill, load)`, `load` the pack's weight over what the body can carry): nothing to half a
  pack, 0.3 m of reach less at a full one. The chest (1.2 m, where a hang begins) stays under the shortest air reach.
- **Corners** (the motor's, on these laws): the other face square to the lip within 30 degrees; round an inner one the
  body comes 0.1 m off the first face; round an outer one the hands take the other face 0.25 m past the edge and the body
  swings round it 0.1 clear; the corner's path is proven as a move's (`moveClear`), at the shimmy's pace (`planCorner`).
  A lip that merely ends is no corner: past a gap the body does not fit round the edge, and where the wall runs on in the
  same face the other side's hold is sought inside the solid and is none.
- **The free climber's wall** (`wallContact`): level rays from the axis into the wall at 0.8, 0.4 and 0.2 of the body's
  height, the nearest face within the radius and 0.15 (a face with |ny| over 0.7 is a floor or a ceiling, no wall).

**In the motor** (`_parkourStep` and `_wallStep`):
- **The catch in the air** (Jump held, the fall one the skill holds, the grip not spent): Forward held climbs onto or over
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
  corner after corner the same way.
- **The hang** (`_hangStep`): the hold is asked again where the body hangs each step (gone, the hands let go). Forward, or a fresh Jump, climbs up
  - onto the top or over a thin one, the whole way proven; a lip with neither (a sill under a window) holds, and Forward
  held asks no more until it is let go or the hands move. Back climbs down the face (the free climb, reaching for the
  wall under a sill as far as the grab's own 0.5 m until the hug presses the body to it). Left and Right shimmy: the lead
  hand must find a hold a span (0.25 m) ahead - the lip ends, or breaks, and the hands stop - and the body must fit where
  it hangs next; each step's hold is the lip's own, its height and its face's turn followed. Stopped, a corner is asked
  (`_pkCorner`): an INNER one is a wall across the lip with a lip of its own at this height; an OUTER one is the lip
  ending (its end found to a centimetre) with the other face's lip round the edge. A corner is a move (`corner`,
  unbilled) that ends in the hang on the other face.
- **The free climb** (`_freeClimbStep`): Forward up, Back down, Left and Right across, at the skill's pace on the classic
  climb's, pressed into the wall as the classic hug is. Going up, a lip come to the hands (1.8 over the feet) is held -
  and with Forward still held climbed over at once, the top-out Mac's call asked for. Across the wall the body goes as
  far as it was asked and no further: the hug's press slid a body along a box's diagonal seam (a climb down went 2.8 m
  sideways before this was stripped). A move the wall does not go on under is not made (its side edge; its top where no
  lip was held). A floor under the feet ends the climb standing (a climb down; or a top the hug steps the body onto
  where no lip held it - the classic climb's own shove, kept as the fallback so what was climbable stays climbable).
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
a slot left of it (they never draw together), 50 px, bottom-anchored, surviving the large HUD as the breath does; the
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
| Sheer walls: Fatigue in place of the roll; skill sets speed and grip; ends in a mantle; what was climbable stays so | "Free-climb on grip" | Done: no roll; the band's Fatigue and the grip; the top held and climbed over; the hug's shove kept as the fallback | - |
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
- The free climb does not turn a corner; across a wall it stops at the edge.
- A crouched jump holds nothing.
- The grip is not spent across a catch or a corner (under a second each).
- Forward held still against anything the probe calls a wall for the start time starts a climb - a table's side
  included; the classic climb's probe reached the same (at 0.77 s and a roll).
- Terrain is not a wall (as CLIMB1). A save made on the wall loads the body where it hung, falling.
- Peers see the body held still or moving up the wall (CLIMB5).
- **Not yet seen on real ARENA2 geometry**, as CLIMB1.
