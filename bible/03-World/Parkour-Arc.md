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
| CLIMB2 | The catch becomes a HANG: shimmy along the lip, drop, climb up; grip on Fatigue; the free climb on grip (Mac's "Sheer walls"); encumbrance cuts the reach (a hard catch's hold came with the audit) | next |
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

**In the motor** (`_parkourStep`, above `_climbStep` - it is the climb's top-out). A move in flight owns the step and the
stance (a crouch pressed mid-move is ignored). Between moves three things start one:
- **Jump on the ground**, behind the jump's own 0.1 s grounded gate: a lip in reach is climbed onto, or over, or - with
  Forward held - vaulted, INSTEAD of the jump; no lip and the jump goes as ever. The Jump that started a move is spent:
  held through it, neither a jump nor another move fires until it is let go.
- **Jump held in the air**: a lip coming into reach is caught, if the fall so far is one the skill holds.
- **The classic climb** arriving under a lip: the top-out, no key.

Never from water, a saddle, levitation or paralysis. A climb (onto or over) asks Roleplay & Realism's gate first (below);
a vault does not. After a lip is found and every way refused, the air catch and the top-out rest 3 steps before asking
again: a refusal proves the whole path at up to ten tries (0.85 ms on a railing), and held Jump would ask it every step.

As a move begins, the classic climb it came out of stops, the walk input goes to zero (the arms, the body and the peers
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
ClimbingFatigueLoss.

Also `tools/mutants/disc8.json`'s held-frame record re-aimed, `test/climbing.test.js`'s census of the cached pair's
writers moved to four, DISC8-G's held frame reports no move, the Features counts, order and budget, and every cite into
the lines this moved re-mapped (`tools/citeShift.mjs`).
