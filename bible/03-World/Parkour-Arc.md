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
| CLIMB1 | The ledge sensor; the MANTLE (a jump pressed at a lip, a lip caught with Jump held in the air, the classic climb's top-out) and the VAULT; the switch; the tick's bill | **SHIPPED** 2026-09-30 |
| CLIMB2 | The catch becomes a HANG: shimmy along the lip, drop, climb up; grip on Fatigue; the free climb on grip (Mac's "Sheer walls"); encumbrance cuts the reach; a hard catch can fail | next |
| CLIMB3 | LEAPS: up, sideways and back off the wall from a hang, the wall run-up, the running jump off an edge caught at the far side (Mac's "Leaps", Jumping-scaled) | |
| CLIMB4 | The feel: the arms on the lip (heldPose deltas), the camera's dip and pitch, the sounds | |
| CLIMB5 | Online and third person: the move on the wire, the peers' and the rig's poses | |

## CLIMB1 (2026-09-30): THE LEDGE SENSOR, THE MANTLE AND THE VAULT - SHIPPED

**The law** is `src/player/parkour.js`, pure (the collider handed in, the motor's constants handed in - the motor
imports this file, so a top-level read of a motor constant here would meet the import cycle's TDZ).

- **The skill the moves read** is the classic chance's own arithmetic (`parkourSkill`: live Climbing, +30 for a
  Khajiit, doubled under the Climbing spell) held to 0..100. **The reach** - the lip height over the feet a standing
  body's hands take - runs 1.5 m at 0 (the chest) to 2.1 m at 100 (the arms at full stretch over a 1.8 m capsule);
  in the air or on a wall the arms are already up, +0.15. **The pace**: a mantle takes `(0.25 + 0.22 x rise) x (1.3 -
  0.5 x skill/100)` seconds - a 2 m lip 0.90 s at Climbing 0, 0.55 s at 100; a vault the same shape, quicker.
- **The sensor** (`senseLedge`), from the feet along the look:
  1. *the wall* - level rays from the axis every 0.2 m up the band (the step offset to the reach on the ground, 0.25
     in the air); the lowest to meet a face within the capsule's side + 0.5 whose normal is within 30 degrees of
     level and which the look meets within 50 degrees;
  2. *the open* - the scan climbs on until a level ray runs clear 0.25 m past the face, and the top is sought by a
     ray straight down from THAT height, 0.2 m past the face. Never from a fixed height: the first draft probed from
     reach + 0.3, which in a low room starts inside the ceiling's slab and meets its underside - a counter under a
     2.3 m ceiling was "too high". No clear height by the reach and a rung is a wall that runs on above it;
  3. *the lip* - a top within 45 degrees of level, inside the band; the face running up to it (a level ray 0.08 under
     it meets the face) and the edge open for the hands (one 0.1 over it meets nothing);
  4. *the room* - the body standing on the top (the radius + 0.12 past the face), else crouched, else none; risen in
     front of the face with its feet over the lip; the column over its own head clear to the risen head's height,
     and half way. The top under the landing feet is sought from 0.3 over the lip, not a body's height: a low lid
     over the top would hold a higher origin inside it.
  A lip with no room on it is still a lip (`mantle: null` with the reason) - a fence's top is the vault's to answer.
- **What fits**: `capsuleFits` asks two questions, because `penetrationAt` reports only how far the resolve PUSHED the
  body, and the resolve will not depenetrate a body up into a ceiling - it reverts it - so a standing body passing
  through a slab reads clear there (measured: 0.000 for a standing capsule on a 1 m top under a 0.3 m slab at 2.3).
  The ray up the axis to the head is the headroom. Every point asked about was reached through the open first, so a body buried in a thick
  solid is never asked about.
- **The vault** (`senseVault`): a lip at the waist or under (1.2 m) whose top ends within 0.9 m of the face - down rays
  walk it every 0.1 m - with the body fitting past the far edge. The body rises up the face, clears the top by 0.08,
  and is handed back to the fall past the far edge with its momentum along the wall's normal (the run's speed, at
  least 3.5 m/s) and a 1 m/s rise.
- **The path** is scripted, not physics - both reference games do it - and proven before it starts: `movePoint` eases
  the feet up to `up` (the radius + 0.04 off the face, 0.04 over the lip; the rise never comes nearer the face than
  that) and then over to the top with a small arc; the rise takes 45-75% of the time, more the higher the lip.

**In the motor** (`_parkourStep`, above `_climbStep` - it is the climb's top-out). A move in flight owns the step. Between
moves three things start one: **Jump on the ground** behind the jump's own 0.1 s grounded gate - a lip in reach is
mantled, or vaulted when Forward is held and the vault answers, INSTEAD of the jump; no lip and the jump goes as
ever; **Jump held in the air** - a lip coming into reach is caught; **the classic climb** arriving under a lip - no
key. Never from water, a saddle, levitation or paralysis. The move carries no velocity and no fall (a catch in the
air anchors any later fall at the catch, as the classic grasp does); a crouch-only top sinks the eye across the whole
move through the crouch action's own clock; the classic climb it came out of stops; the render eye rides the path,
not MAC1's stair filter; a recentre shifts the path and a placement cancels it. The frame's edge `parkoured` ('mantle'
| 'vault') rides beside `jumped`.

**The switch**: `scenes/shared.js parkourSwitchOn` - the Features row `enhanced-climbing` (`enhancedClimbing`, on by
default, forced on online) and `?parkour=off`, the kill door; read live, so the row takes effect at once. Offline the
classic skin climbs DFU's way whatever the row says. Online the skin is NOT asked: since OVH3 it is the player's own
look ("nothing the room agrees on reads the skin"), and a way over a rooftop is something the room agrees on - the
first draft gated on the skin there too, which would have left a classic-skin player online without the moves beside
players who had them. The three motor hosts (world, exterior, dungeon) hand `parkourDeps(playerEntity)`.

**The bill** (`systems/worldTick.js`): a mantle or a vault is one exertion - a jump's fatigue, on BALANCE1's scale - and
trains the skill it used: a vault Jumping, a mantle Climbing. The five activity reports carry `parkoured` beside
`jumped` (world, exterior, the interior ticker, the dungeon mode's report, the dungeon host's); the motor never raises
`jumped` for either, so neither is billed twice.

**Pins**: `test/parkour.test.js` (17) - the laws; the sensor on a real Collider's boxes (lips found and every refusal
reason, the counter under a low ceiling, the eave at the edge of reach only the head's column sees); the vault's
question; the path fitting at every hundredth; LIVE through PlayerMotor (the pressed mantle, the pace at 0 and 100, the
held catch at 100 and none at 0 or on a tap, the vault and the plain jump without Forward, the crouched top, the
classic climb's top-out over a 4 m wall, the switch off); the recentre and the placement; the tick's bill; the switch;
the hosts. Moved: `test/climbing.test.js`'s census of the cached pair's writers (three to four - `_parkourAdvance` is
the fourth zeroing return and writes it), DISC8-G's held frame (it reports no mantle either), the Features counts and
order, the notes' budget (+283, the row's own size).
**Mutants**: `tools/mutants/climb1.json`, 23, all dead (the 23rd the online arm's). The first run left two alive, both findings: the facing gate
(every oblique case missed the wall on distance, so the angle was never what refused it - now a look from 0.38 m
out at 45 and 60 degrees) and the head's column (an eave over the body at the edge of reach, which clears the risen
body and the half-way one, and which the rise would clip). `tools/mutants/disc8.json`'s held-frame record re-aimed.

**Not yet seen in a browser on real ARENA2 geometry** - the session had no ARENA2. What the boxes cannot tell: how
Daggerfall's facades, pitched roofs, thin walls and dungeon meshes read to the sensor, and whether the reach and the
pace feel right. That is the next gate; `tools/climbProbe.mjs`'s door-square stance is where a probe of it starts.

**Recorded limits** (each a later slice's, not an omission):
- The path passes through what moves: a door swung or a platform ridden into the path mid-move is not collided with
  (the move is under a second, and the settle at its end resolves what it lands in).
- A catch in the air negates the fall above it (CLIMB2 prices a hard catch).
- No arms on the lip, no camera dip, no sound (CLIMB4). Peers online see the body glide up (CLIMB5).
- The encumbrance does not read yet (CLIMB2, with the grip).
