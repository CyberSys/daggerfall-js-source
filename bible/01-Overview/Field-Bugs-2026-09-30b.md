# FIELD BUGS 2026-09-30b - two screenshots: the immortal at zero, the respawn that still fell

Two #bug-reports threads of the same day, after the morning's batch (`Field-Bugs-2026-09-30.md`, PR #468) merged. Both
were root-caused on the real modules with a reproduction before anything changed; each fix is pinned red on the code
before it.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "If you cure a disease and die at the same time you will became immortal" (the HUD at HEALTH 0%, MAGICKA 0%, FATIGUE 3%) | Niwy | not the cure: the death was lost. The damage door raises a death once, on the blow that crosses to zero, and the death lives in its screen; a temple priest's Talk indoors closes into his service window by a raw write over the building's slot, and a player killed under the talk had their death screen replaced by it - the cure was bought at zero, and nothing ever raised the death again | fixed (DEATH-KEPT) |
| 2 | "Spawned in the air after dying. One time I died in a dungeon, and for some reason I respawned high enough in the air to kill me with fall damage." | BrixBlox | most likely the morning's RESPAWN-GROUND on a build from before it (the report is undated, and a tab left open keeps its code); but one road stood after it: the teleport's awaited build stepped the motor for a dungeon death, and a body stood over the new pixel at the dungeon's own height fell onto the models' colliders as each went in | fixed (RESPAWN-HELD) |

## DEATH-KEPT: a player at zero is dying, whatever took the screen (1)

**Reproduced first** (the real `hurtPlayer`, the plague, `statMods`, townTalk, the window stack, `DeathScreen` and
`buildCureDiseaseFlow`; the building's slot rules transcribed from `worldModes.js`, which needs ARENA2 to construct): a
plague-weakened player at the temple (HEALTH 16%, live STR/END 11/6), the priest's popup up, Talk pressed. Indoors the
popup comes down and the talk opens in townTalk's slot with a close that mounts the popup again. A blow lands under the
talk - a building's foes keep their clock under a window (WINFOE1) - and the building's presenter puts its `DeathScreen`
into its own slot, beneath the talk. The talk closed: its callback's `mountServiceWindow` writes the popup over the
screen, and the next reconcile replaces the stack's top with it. Cure Disease, Yes, "You are cured": the dialogs close
and play resumes at HEALTH 0%, MAGICKA 0% (the plague's drain), FATIGUE 9% (the cure lifted the STR/END drains, so the
maximum grew under the same fatigue - the screenshot's 3%). Ten 50-point blows, five more plague days to live STR/END 0
and six seconds of the stat-zero kill: no death.

**Why.** `hurtPlayer` raises a death on the TRANSITION (AUDIT 21 - a still-ticking effect re-presenting the screen
once per round was the fault it closed): once at zero, `wasAlive` is false for every later blow, and the stat-zero kill
and the exhaustion collapse both stand down at zero. So the death lived in its screen alone, and a screen is a window:
the popup's Talk callback writes the building's slot raw, and the stack's `reconcile` swaps its top in place without
asking `holdsTop` (RISE-STUCK's rule is the push's alone). Online the D12 gate reads the screen, not the health, so the
player at zero rejoined the room alive and no respawn ever came. DFU cannot be here: `PlayerDeath.deathInProgress` is no
window, and nothing but the reset clears it.

**The fix** (`scenes/world.js`, the frame; `characters/playerEntity.js` `presentPlayerDeath`): every frame, after the
video hold and above every mode gate, a player at zero with no death screen up - townTalk's or the mode's - and the
world not moving is presented again. The presenters already refuse a second screen over their own, so a death on
screen is untouched; a load restores the save's health under its latch and a respawn heals first, so neither is caught
mid-way. It covers every door that can take the screen, not only the priest's: the stack's replace, the surrender box
("O1 - the replace door", `Field-Bugs-2026-09-27c.md`), a journey's level-up box over a death on the road. `presentPlayerDeath`
is no blow - the saves, the shield and AvoidDeath were asked on the transition, once. `test/fb0930b_deathkept.test.js` (3).
`tools/mutants/fb0930b_deathkept.json` (8, all dead).

Found on the way, not changed: the doors themselves still take the screen for a frame, and the death presented again
starts its fall and (online) its minute over; closing them one by one - `mountServiceWindow` over a death, `reconcile`
honouring `holdsTop`, `townTalk.showOverlay` over a screen that holds the top - is the tidier half and touches every
host's slot, so it is left for its own slice. Stendarr's AvoidDeath restores `trunc(MaxHealth * 0.1)`, which is zero
below ten maximum (a werewolf's unsated urge floors it at 4): DFU leaves that player at zero until the next blow re-asks;
here the next frame presents the death.

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
