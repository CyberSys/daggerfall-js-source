# FIELD BUGS 2026-10-02 - the rocks that held a ship, the sea that read as land, the crew's words over each other

Mac, testing sailing: *"I notice ships get stuck in the world of daggerfall ocean rocks, your ship can get stuck at sea
in place, your crew mates speaking sometimes seems like gibberish"*. Each was reproduced on the real modules before it
was fixed, pinned by tests that fail on the code as it stood, and mutation-proven.

> **Audited** the same day (FIELD BUGS 2026-10-02b, Mac: "Audit this" - `01-Overview/Field-Bugs-2026-10-02b.md`).
> SEA-SHOAL below is STRUCK: Deep Waters' real carve never took the lifted sea, so it changed nothing; the sea is kept
> at the flatten now (SEA-LEVEL). ROCK-FREE's nine-ray sweep, its `pass`, and the host's "beneath" rule are gone - the
> sphere is swept exactly, a keel line stands for the rule, an overlap counts once, and a boat never holds; each sweep
> reaches her own end (ROCK-REACH). CREW-SAY merges only what is sung or shouted, keeps a stack's order and eases it
> down, and draws no lifted bubble off the screen's top. The record below stands as it was written.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "ships get stuck in the world of daggerfall ocean rocks" | the hull's sweep read a pixel's whole ground as ONE collider: a ledge under her answered the zero point and hid every other rock of the pixel, so she sailed into the rock ahead; inside it, both faces of its walls held her for good; and every rock in her sweep, ahead or astern, held her to a metre a second even as she sailed away from it | fixed (ROCK-FREE, ROCK-AWAY) |
| 2 | "your ship can get stuck at sea in place" | World of Daggerfall levels a site's ground after the tiles are read, lifting its whole pixel's sea over Come Sail Away's 34 m line: with Deep Waters on, every node read land and she was beached at sea; a beached boat's nodes are never read again; and a bow run onto a shore could not back off it | fixed (SEA-SHOAL, BEACH-READ, ASTERN) |
| 3 | "your crew mates speaking sometimes seems like gibberish" | the lines over the crew's heads stood over each other - the chorus up to six deep, each copy behind its own name; a talk's two lines side by side; a bubble's foot over a mate's name - translucent, the farther painted over the nearer | fixed (CREW-SAY) |

## ROCK-FREE: a rock is met from outside, collider by collider (1)

**Reproduced first** (`test/fb1002_rocks.test.js`: Come Sail Away's runtime over the vendored hulls, the real `Collider`,
world.js's own `csaSphereCastAll` lifted from its source; a Small Ship under sail, the wind astern). A shelf 3 m under the
sea's line, under her where she starts, and a rock standing out of the sea 80 m ahead, both of one pixel: in 90 s she
sailed through the rock and on, 855 m, to (22.1, 1055.7); without the shelf the rock held her off at (99.3, 245.8). A hull
standing inside a rock - a 120 m one or a 300 m one, closed or open beneath - was still inside it after 90 s, sailing on,
turning or backing.

**Why.** CheckCollision sweeps the hull collider's half-beam sphere along her length both ways (SphereCastAll). The host
answered it off `Collider.sphereCastAll`, Unity's SphereCastAll over a BUCKET as one collider - and a static bucket is a
pixel's whole ground, every World of Daggerfall rock of it in one. A collider the sphere overlaps where the sweep starts
answers Unity's zero point and nothing more (CSA-D's kept bug: the push is a direction from the scene's origin), so a
shelf under her made the whole pixel answer that one zero point: no ray was cast at the rock ahead. And the collider reads
no winding (both faces of every triangle are met), so from inside a rock every ray met its inner walls and pushed her
back in, where Unity's sweep reads no back face.

**The fix.** `player/collider.js` `hullSweepAll`, which the host now asks (`scenes/world.js` `csaSphereCastAll`). A
bucket's PARTS are its colliders - each `addMesh` one, as a World of Daggerfall object or a model is its own MeshCollider
(CreateDaggerfallMeshGameObject) - and each answers once, as Unity's SphereCastAll answers a collider:
- a part her sphere OVERLAPS where the sweep starts answers at its overlap, where it touches - the nearest point of its
  faces her whole sphere reaches - never the zero point, and nothing more (so a shelf she rides over is never met again
  as a rock ahead when the swell pitches her sweep onto it);
- a part that holds her sphere's CENTRE answers nothing (`partsHolding`: a line straight up crosses a closed skin an odd
  number of times from inside it, its crossings at one height once; a rock open beneath, as a model standing in the
  ground is, holds what is under its crown) - she leaves as she likes;
- every other part is met by the sweep: nine spokes over the sphere's cross-section, the centre's to the sphere's front
  at the sweep's end and the rim's eight to the rim's own (the rim's had reached a radius past the swept sphere, so what
  else stood in the bucket - its box the sweep's cull - decided whether they met anything there).
A boat's collider is a mover and never holds a hull: its overlap answers. `raycastHit` takes `pass`, a bucket's parts to
pass through (the sweep's alone; no other caller). The host drops an overlap deeper under her centre than it is off it -
a shelf beneath her has no side to push her from (flattened, it is any way at all). After: over the shelf she is held off
the rock ahead exactly where open water holds her, frame for frame; out of either rock she sails as over open water.

**A departure** (the Port-Ledger row): an overlap's push is from where it touches, not from the scene's origin, for the
world's ground and its boats alike. CheckCollision itself (its two sweeps, the zero-point arm it keeps for the first)
is the C#'s still; the ground probe's own zero point at a carved floor (below) is untouched.

## ROCK-AWAY: what she met takes only her way into it (1)

**Reproduced first** (the same rig, ROCK-FREE in). Sailing off the shelf's far end, its face astern stood in her backward
sweep: she crawled at a metre a second for 20 s (310 to 330 m) and ended 90 s at 927 m, where open water ran to 1,350 m.

**Why.** LateUpdate's response (`systems/comeSailAway.js` `lateUpdateSailing`) projects her way off the CollisionVector
and adds it back at one metre a second - taking her way OFF what she met as well as into it. In a World of Daggerfall rock
field, with a sweep reaching a hull's length and more fore and aft, any rock astern of a ship under sail held her to a
crawl (at the oars, whose pace astern is that metre, it set her to it at once).

**The fix (a departure).** Under way away from what she met she keeps her way; at rest, or into it, the C#'s push. The
current is taken only where it carries her onto what she met. After: off the shelf, and backing off the rock, she keeps
open water's track frame for frame; rowing into a rock she is held off it as before.

## SEA-SHOAL: a carved sea is water (2)

**Reproduced first** (`test/fb1002_seaheld.test.js`: the sampler's own sea, World of Daggerfall's own flatten, Unity's
SampleHeight, world.js's `csaTerrainOf` mounted, the carve's floor read and the runtime). The open sea reads 33.994 m,
6 mm under the line (FIELD-CSA2). A headland standing 34 m over the sea in the pixel's far corner, with a site levelled on
it (`wodLocationLoader.js` `flattenForLocation`), lifted every sea point probed - 100 to 990 m from the site - to
34.229-34.523 m: land. A Small Ship there, Deep Waters on: all five nodes land, beached; the oars moved nothing. A site
7 m over the sea lifted them to 34.053 m; one 1.7 m over left the far sea at 33.994.

**Why.** LocationLoader.AddLocation runs after the tile's heights are pushed (WOD's "The flatten"): it lerps EVERY sample
of the tile from row 1 to 127 toward the site's mean by 1 / (distance + 1), so the tile's far corner moves about a 180th
of the way - and the sea is 0.4 of a heightmap step from reading land (579.105, held as 579; 580 is 34.053 m). Its tiles stay water (read before), so Deep Waters carves and
draws a sea there; Come Sail Away's node law, with Iliac Puddle No More on, reads `Terrain.SampleHeight` - the heightmap
under the hole - and read land.

**The fix.** `scenes/world.js` `csaTerrainOf`'s `sampleHeight` answers a carved cell's seafloor (DW-B's law: the host's
`heightAt` already stands every capsule, foe and probe on it), the heightmap elsewhere. The node law, the placing's and
the Overworld's probes and the lost-boat check read it: a boat set down near such a site is no longer packed as lost
under the ground. A sea Deep Waters has not carved reads its heightmap as before (the shore's law, FIELD-CSA2's).

## BEACH-READ: a beached boat is read again (2)

**Reproduced first** (the same rig, the carve not yet come - DW-A's bake read on its worker, the floor built after it):
beached, and after the carve came she lay beached for good.

**Why.** LateUpdate reads the nodes only when the boat moved or turned, and a beached boat never moves.

**The fix (a departure).** A beached boat lying still has her nodes read again each frame, and her collision with them
the frame she comes off. Not where the player stands on no built terrain: nothing is read (the C#'s throw is a moving
boat's, kept). A beach stays a beach - on real ground every reading is land, every frame.

## ASTERN: back asks the stern's node (2)

**Reproduced first** (a straight shore north of her, her bow's node on it): back refused, forward allowed - the centre's
water rowed her on in.

**Why.** The oars ask the node one along (CSA-D's kept bug): back the BOW's.

**The fix (a departure).** Back asks the STERN's, the water she backs into: she backs off the shore (18 m in 20 s), and a
stern on a shore refuses back. Forward still asks the centre's; the strafes keep the C#'s nodes (below).

## CREW-SAY: the words never over each other (3)

**Reproduced first** (`test/fb1002_crewsay.test.js`: the real crew life, its tables' own lines, projected from the helm's
eye; the HUD's own layout and DOM). Nothing scrambles a crewman's words - every line is crewLife.js's and shipCrew.js's
English. Over ten minutes of two crews of sixty, two or more lines were up in 5,103 of 12,000 frames, and in 2,843 of
them bubbles stood over each other: the chorus is every hand at once (sung by two or more in 1,225 frames, up to six
deep), each copy behind its own name and so wrapped at its own words; a talk's two lines stood side by side over two
hands side by side; a bubble's foot, 6 px over the head point, covered a mate's name and health bar. At 0.62 of an opaque
ground, the farther painted over the nearer, they read through each other.

**The fix.** `ui/navalHud.js` `layoutCrewLines`, which `drawCrewLines` lays: a line said by two or more at once is laid
once, over the nearest of them and by no name (it is theirs together; world.js hands a speaker's first name beside his
line, never in it); a line said alone keeps its speaker's name; each foot CREW_SAY_LIFT (26 px) over the head, clear of a
mate's bar and the name over it by the sheet's own numbers; each farther bubble lifted over every nearer one it would
cover, CREW_SAY_GAP apart, in whole pixels; the nearest drawn over the rest. A bubble's box is read off its words
(`crewSayBox`): the sheet's content box - its words to max-width, its padding and ring outside them. After: none of the
12,000 frames has two bubbles meet.

## Said, not fixed

- **The crew's names** are DFU's own (NameHelper's banks: a Redguard crew's read strange to an English eye) - the port's
  names, unchanged.
- **The strafes' nodes** stay the C#'s (the right strafe the stern's, the left the starboard's, the port node never):
  a half-speed crawl sideways, held by none of the reports.
- **A node over the next pixel** reads the player's pixel's edge (CSA-J's clamp, Unity's GetInterpolatedHeight).
- **The ground probe at a carved floor** answers the zero point when the sweep starts under it (`DeepWaters_Seafloor` is
  no Terrain, so CheckCollision keeps it): not reproduced in the field, kept as it stood.
- **A turn beside what she met** is refused by the sign of the side it lies on (CanTurnLeft/Right), so one dead ahead or
  astern refuses whichever side its rounding leans to: the C#'s, kept.
- **In irons.** A ship turned head to wind under sail stops and her rudder with her (the mod's sail law; HELM-KEYS' tell
  says how out): seen in the reproduction, not a trap.
- **Cargo.** A ship's speed falls with her load (the Cargo modifier, its messages): the mod's law, and plunder is tens of
  kilograms against a hull's threshold.

## Found on the way, not changed

Re-judging every record the change can move (the four moved pins' and every record on `player/collider.js`,
`systems/comeSailAway.js` and `ui/navalHud.js`: 869 - 863 dead, 4 equivalent as recorded) left two survivors, and each
survives on this tree's base (d96bdc123) alike - older than this work, in code it does not touch, reported for their own
fix: `auditdisc28_motion.json` AUDIT-DISC28-MO2-rest-kills-PH1 (`player/collider.js` `lowOneWay`, PH1 at rest, against
`test/disc28_swim.test.js`) and `fb0929h_lostboat.json` LOST-BOAT-a-crewed-hull-packed (`systems/comeSailAway.js`
`recoverLostBoats`' crewed-hull exemption, against `test/fb0929h_lostboat.test.js`).

## The pins and the mutants

`test/fb1002_rocks.test.js` (6), `test/fb1002_seaheld.test.js` (3), `test/fb1002_crewsay.test.js` (3), each red on the
code before. `tools/mutants/fb1002_rocks.json` (25), `fb1002_seaheld.json` (4), `fb1002_crewsay.json` (20) - all dead.
PINS MOVED, each by content: `csa_sailing` (back asks the stern; the pin's title), `csa_close` (the sampler's clamp line),
`colliderkeys` (four cell lookups: ROCK-FREE's two), `perfcol1` (three module scratch Sets: the hull sweep's two, made
once), `livingcrew` (a bubble's transform). Records re-aimed by content, all
dead: `csa_close.json` CSA-J-host-terrain-unclamped, `field_csa2.json` FIELD-CSA2-host-reads-the-drawn-ground,
`csa_sailing.json` CSA-D-back-node-stern - now CSA-D-back-node-bow, the C#'s node ASTERN leaves -
`navaudit_frame.json` NAVF-sweep-box-unturned (by the comment only sphereCastAll's cull has), and `livingcrew.json`'s
SAY-every-line and SAY-never-hidden. Not seen in a browser.
