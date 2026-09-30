# FIELD BUGS 2026-09-30b - two screenshots: the immortal at zero, the respawn that still fell

Two #bug-reports threads of the same day, after the morning's batch (`Field-Bugs-2026-09-30.md`, PR #468) merged. Both
were root-caused on the real modules with a reproduction before anything changed; each fix is pinned red on the code
before it.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 2 | "Spawned in the air after dying. One time I died in a dungeon, and for some reason I respawned high enough in the air to kill me with fall damage." | BrixBlox | most likely the morning's RESPAWN-GROUND on a build from before it (the report is undated, and a tab left open keeps its code); but one road stood after it: the teleport's awaited build stepped the motor for a dungeon death, and a body stood over the new pixel at the dungeon's own height fell onto the models' colliders as each went in | fixed (RESPAWN-HELD) |

## RESPAWN-HELD: an arrival holds the motor while its destination builds (2)

**Reproduced first** (the real StreamingWorldState, Collider, PlayerMotor, floorLanding and applyFallLanding, the host's
heightAt and the RESPAWN-GROUND eye lines lifted): a dungeon at 300,250 whose entrance keep (18 units) stands at the
location's centre, the exterior carrying a vertical recentre (`compensation[1]` -150 - ResetStreamingWorld keeps it
across `state.init`), the body revived at 60 of 120. The keep's collider goes in 0.6 s into the build and the pixel
publishes at 2.2 s: the body, stood on the new pixel's centre at the dungeon's height (-3.5, 31.5 above the roof), falls
onto the roof at 1.67 s - a 28.5-unit fall, 117 health, dead. Held, the same respawn lands on the ground with nothing
billed. Died 16 units into a fall in the dungeon: 44.5, 197 stepped; nothing held.

**Why.** The frame steps the motor unless an overlay or the season's re-skin holds it, and bills every landing. An
outdoor death's screen is townTalk's and stays up for the whole of the respawn's await (AUDIT CONTRIB A6), so its motor
was held; a dungeon's (or a building's) is the mode's own, and `respawnOnlinePlayer` leaves the mode - its screen with it -
before it awaits `_teleportToPixel`. The next overlay goes up only at the tail. For the build's frames nothing held the
body: RESPAWN-GROUND's eye fix stands it over the pixel's centre (the location's, where its models are) at the
interior's own height, a location model's collider is added between breathing frames before the terrain publishes, and
wherever that height stood above a roof in the new world's vertical frame the body fell onto it and the frame billed
the fall before the landing's `player.spawn` re-anchored it. Where it stood below the ground (no recentre carried) the
body fell unseen under the half-built world and the landing stood it up - the common case, which is why the morning's
fix read as whole.

**The fix** (`scenes/world.js`, the frame): the motor is held while the arrival's latch (`_seasonStraightening`) is up -
`_teleportToPixel` raises it before its first await and drops it in the build's `finally`, and nothing is awaited
between that and the landing, so the latch is exactly the build's frames. A held frame steps nothing and bills nothing
(`holdFrame`); the landing's `player.spawn` re-anchors the fall, so a death mid-fall carries none of it across. It
covers every teleport's build - the respawn, Recall, the cemetery, a quest's teleport, the court's release, fast travel
and the loads - none of which walks the player during it. `test/fb0930b_respawnheld.test.js` (2); `seasoncalendar`'s
hold pin re-aimed (PIN MOVED). `tools/mutants/fb0930b_respawnheld.json` (2, both dead).

Found on the way, not changed: a checkpoint (the two-minute realm checkpoint, the page-hide save) is not refused while
the world moves, so one composed during a build records the body where it waits - over the pixel's centre at the old
place's height - and a later load stands it there (with FALL-KEPT's fall, if one rode). Held, the body no longer falls
in the wait, but the height is still not the ground's. FALL-KEPT chose not to refuse the quiet saves in the air (a
refusal loses their progress); refusing them mid-move is the same trade and is Mac's call.
