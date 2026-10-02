# FIELD BUGS 2026-10-02 - the climb out of a dungeon's pit, the hunt under the foes, the net at the helm, the boat's loop; and the climb audited on Daggerfall's dungeons

Three #bug-reports threads relayed as screenshots, a line relayed under them, and Mac's own ask beside them:

> 1. Reports of audio cutting when taking helm of a ship
> 2. Enhanced climbing needs a further perfection audit

The rule of the last batches stands (`Field-Bugs-2026-09-30b.md` part two): every report root-caused on the real modules
with a reproduction before anything changed, each fix pinned red on the code before it and mutation-checked. Three
lanes read the hunt, the net and the loop while the climb was reproduced. The climb had never been run in a dungeon,
so this batch did that: on the reporter's own dungeon, then on 24 more, using the freeware ARENA2 (`tools/fetch-data.sh`).

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Stuck after Climbing Rework" - "A two blocks wall is too high for my character to climb up, so Im stuck in this hole. Luckily I have levitate. Its 'Ruins of Old Carololda's Farm'"; "I would have been able with old climbing mechanics" | Chilloutman | Daggerfall's dungeon walls are stacked in 3.2 m units. Where the unit above has a jamb a hand's width over the climber, the head met its underside 1.4 m up the first unit and the free climb stopped; the classic climb's resolve slid it out from under. On the same walls, three more faults the classic climb never had: the free climb's deep press slid it down along a big face's diagonal seam (at Climbing 0 it never left the floor); a 2.5 cm crack between stacked pieces read as a lip (hang, let go, fall, repeat); and a piece set back 20 cm over the one below stopped the climb at the step; in a narrow corner the start could take the side wall and climb on past the front wall's top | fixed (SEAM-STEP, HUG-TOUCH, CRACK-LIP, STEP-BACK, CORNER-TOP) |
| 2 | "Enemies attacking during travel events" - "when an event occurs while traveling (Track a group of animals type stuff) and you press YES, enemies can attack you while the result loads"; "During this enemies can still attack you" | Aru | the hunt's box holds the player's motor and WINFOE1 runs the foes under every window: a foe that came near during the ask or the 4-8 s search hit a player who could not move. At the turn to the result, the search's minutes went through the encounter tick and could stand a wanderer 10-20 m away, facing a player the result page still held | fixed (HUNT-FOES) |
| 3 | "New fishing context pop up clashes with come sail away!" - "Gets in the way especially when trying to aim bow guns" | Cruor | at sea the net's water is everywhere (`netHasWater`: the Ocean's climate, the sea region), so CAST-LOOK's cast stood under the crosshair at the helm and over the guns' aim, and E or a click there cast the net | fixed (HELM-NET) |
| 4 | "Reports of audio cutting when taking helm of a ship" | (relayed) | every crossfade of a boat's two loops played the loop it was fading out again, and the host restarts a played source from its first sample. The first stroke past the wake's threshold (0.5 m/s), and every slowing under it, cut the boat's sound. Separately, a boat placed while another's fade-in ran stopped that fade at nothing and left the loop playing silent | fixed (HELM-HUSH) |
| 5 | "Enhanced climbing needs a further perfection audit" | Mac | the climb on 25 real dungeons, Forward held square to every wall with a top at Climbing 100: every wall the classic climb topped, the free climb tops, apart from slopes past 50 degrees and a lip with no landing right behind its edge (Jump pushes off, Back climbs down, Crouch lets go) | audited (AUDIT CLIMB-DUNGEON), then audited again (the audit, below) |

## The report (1) - measured on the reporter's dungeon

"Ruins of Old Carololda's Farm" is the Daggerfall region's location 383. Its thirteen blocks are B0000007, B0000002,
B0000008, B0000009, N0000090, W0000015, N0000035, B0000012, B0000014, N0000085, B0000010, B0000014 and B0000002. The
collider was built as `scenes/dungeonContext.js` builds it (every placement and every enabled action door, at each
block's origin). From every floor point 1 m apart, every wall within 1 m that has a top between 2.4 m and 16 m with
standing room was climbed. The climber held Forward square to the wall and 8 degrees either side, at Climbing 100 so
the grip could not decide the result. Each failure was run again on the classic lane with every roll passing.

The reporter's "two blocks" is two dungeon units, 6.4 m. On N0000035's and N0000090's 6.4 m walls the free climb
stopped with the feet 1.42 m up, while the classic climb went over. Sectioned (level rays every 2 cm up, across the
body's width), the wall above 3.2 m has an opening beside the climber whose jamb, a single face across the wall, stands
0.10 m inside the 0.35 m body. The head's sphere met the jamb's lower edge. The collider's resolve pushed the body out
along the wall, as it does for the classic climb, and the free climb's across clamp
(`_fcMove`: "across the wall the body goes as far as it was asked and no further") put it straight back.

## SEAM-STEP: stuck going up, the hands move along the wall to where the body rises (1)

`player/motor.js` `_fcSidestep`. When the free climb is stuck going straight up (Forward held, no Left or Right), the
nearest place along the wall where the body fits 0.1 m higher with the wall still at its hands is searched, every
5 cm both ways out to `PARKOUR_SIDESTEP_MAX` (0.45 m, a hand's width past a body's half). The hands go there along
and up at the climb's diagonal pace, and the climb carries on from it. Still stuck there, the search goes on the
same way within what is left of the 0.45 m. The way and the distance are kept until the climb has risen
`PARKOUR_SIDESTEP_CLEAR` (0.3 m) past where it stuck, so one obstruction moves the hands that far at most, and a long
slope cannot walk the climber along the wall. With nothing that near (a slab over the whole width, the top of a
shaft) the climber stays where it is, as under any top it cannot take, and the failed search is kept, not asked
again every frame, until Back, Left or Right, or 0.3 m of rise.

## HUG-TOUCH: the free climb presses to the face, not through it (1)

Found when the probe was run at Climbing 5. On N0000090's 25 m by 3.2 m wall (two triangles, the seam running from the
floor at one end to 3.2 m at the other) the free climb took hold and never left the floor. `_fcMove` pressed the body
into the face by the classic hug's whole step (Speed x dt, 7 cm a step at Speed 50). The resolve then pushed it out
along the nearest feature, and where that is the seam between two coplanar triangles the push leans along the face:
there, 1.3 cm a step lost going up out of Climbing 5's 1.8 cm, and the climb rose 2 cm and stood. The loss is the
press's, not the pace's, so the slowest climbers lost the most. The box test climb2 already pinned showed the same
seam in reverse: its climb ran 0.5 cm a step fast as it came up to the diagonal (2.995 m where the box gave 3.07 at the
same step). The across half of this slide was found before (the clamp above, after "a box's diagonal edge took a climb
down 2.8 m sideways"). Its up-and-down half was not.

The press is now the gap to the face plus `PARKOUR_HUG_PRESS` (1 cm), and never more than the classic step. The gap
is the wall contact's own distance, read each step (`w.gap`). PIN MOVED: `climb2.test.js`'s "up past the face's own
seam" climbs 165 steps, not 150, at the honest pace.

## CRACK-LIP: a crack between a wall's pieces is no lip (1, the audit)

The Pit of Sahoth's N0000008: the climb took hold, rose 0.4 m, and fell back, every 0.5 s while Forward was held.
Daggerfall's stacked wall pieces stand a unit apart (2.5 cm: 21.425 to 21.450 there). A level ray passes through the
slot over the lower piece's own top. The free climb's `senseGrip` read it as a lip, the climb switched to a hang, and
the hang asked the hold again from the new height, found nothing and let go. Where the rungs missed the slot, the
eave law (AUDIT CLIMB-FIELD E1: "not over a plain wall") saw a rung that was not on the face and reached out to an eave
that is not there.

`player/parkour.js` `faceGoesOn`: the slot is measured, its top (level rays 2.5 mm apart, up to `PARKOUR_CRACK`,
3 cm, at the depth the face had) and its foot (within the rung below). A slot no taller than 3 cm and two of those
steps is a crack. `plainGrip` takes no lip there, `scanFace` scans on past it, and `senseGrip`'s plain-wall test
counts a rung through a crack as the wall's. A 6 cm slot is a hold.

## STEP-BACK: going up, a face set back from the hands is reached for (1, the audit)

The Mordywyr Mines' and the Convocation of Elona's N0000033: a lower piece to 5.75 m, the piece above set 0.2 m back.
Its top is too shallow to stand on, so it is no ledge. The free climb's contact (the radius and 0.15 m) ended at the
step and the climb stopped there. Where the step-back runs high (0.2-0.3 m back at 2.4, 3.0 or 5.75 m, the wall going
on to 9 m) the climber hung from the step, found no way up, let go and fell, over and over. Going up (straight, or
across with Left or Right held too), a face that steps back from the hands, turned within the hold's 30 degrees, is
now climbed on to the way CLIMB3 climbs past a sill: the step's top is found (`_fcFaceTop`, level rays 2 cm apart), the body rises straight past it unpressed
(`w.past`), and then the grab's reach (0.5 m, `w.seek`) brings it to the face above. A face turned across the wall (a
corridor's side) is not reached for.

AUDIT of the batch (the review, before it was finished): the first cut reached for the face at once, and its press
lifted the body onto the step's edge while it was still below it. Strafing there lifted it too, and Back then left it
standing on the edge, off the floor. The climb past, unpressed, closed both. Climbing down past a step it passed now
stops on the wall above it, as it does above a window sill (CLIMB2: "A ledge too narrow to stand on ... stops you on
the wall above it"). Crouch lets go and Jump with Back pushes off. From under the step's top, Back climbs down to the
floor (the audit, B2).

## CORNER-TOP: in a corner, the top the look is turned to (1, the audit)

N0000090's pit, traced by hand at 5.49 radians: the start took the side wall, which runs on past the front wall's lip
to the ceiling, and the climb went on up it under the front wall's top and stopped at the ceiling. At 5.5 radians it took
the front wall and topped out. The reporter's pit is a narrow shaft. Going up, with the look turned 20 degrees or more
along the held wall as the hands took it, a face on that side within the climber's contact is the corner's other wall,
and its top in reach is climbed onto as the held wall's is (`_fcCornerSide`, `_fcCornerWall`, `PARKOUR_CORNER_LOOK`).
The side is read once per hold (the audit, A1): a view turned during the climb asks nothing. How square that face must
stand is the ledge sensor's own law (50 degrees), asked by the top-out along it.

## AUDIT CLIMB-DUNGEON (5)

The probe above (`tools/climbDungeonProbe.mjs`), on the reporter's dungeon and on 24 more picked across the realm with no two having the
same set of N/W/S blocks: Castle Lhishen, The M'ell Graveyard, The Pit of Sahoth, Ruins of Old Vyctyn's Place, Ruins
of Tach Manor, Ruins of Old Glerpja's Place, Ruins of Old Evelabyth's Shack, The Mordywyr Mines, Sekthrac, The
Convocation of Elona, Castle Kingwing, Castle Faallem, Copperwing's Hold, Gaerwing's Guard, Ruins of Old Evelolda's
Hovel, The Hold of Buckingsmith, Theodastyr Laboratory, The Citadel of Woodford, Ruins of Tower Darhtin, The Assembly of
C'ircba, Thercrn's Hold, The Fortress of Verpe, The Abbey of Baleusulla and The Haunt of Viscount Lithovon. Square and
8 degrees either side, at Climbing 100.

| | Before | After |
|---|---|---|
| walls with a top in reach (25 dungeons) | 3,214 | 3,214 |
| climbs (each wall square and 8 degrees either side) | 9,642 | 9,642 |
| topped | 7,946 | 8,062 |
| failed where the classic lane topped | 81 | 33 |
| the reporter's dungeon: topped / failed where the classic topped (402 climbs) | 267 / 5 | 284 / 0 |

The climbs that neither lane topped and that never took hold within 1 m of where they started (1,458 after) are
approaches that slid along the wall, a top that was not what the probe guessed (a slope, a void behind a thin top), or
a start in a void outside the level. The classic lane, with every roll passing, failed them too.

**What still stalls, and why it is no trap.** A top past 50 degrees: N0000014's and N0000011's 53-degree ramps over
their walls (Castle Lhishen, the Abbey of Baleusulla, Thercrn's Hold) and N0000041's sloped faces (Gaerwing's Guard).
This is AUDIT CLIMB-FIELD's own limit (`PARKOUR_TOP_MIN_NY`, chosen to take in Daggerfall's 45-48.7 degree roofs). The
classic climb ends up standing on such a slope only because Unity's controller grounds a body on a steep slope. The
other stall is a lip with no landing right behind its edge: Castle Kingwing's N0000034 (a pillar's corner 0.5 m
behind it) and Castle Faallem's N0000026 (a thin top with a gap behind it). The climber hangs there and can shimmy
along. In every case Jump pushes off, Back climbs down and Crouch lets go.

**Approaches 20 degrees or more off square** slide along the wall, on both lanes (the classic start's 0.12 m horizontal
tolerance and the free start's are the same), and start no climb. That is not a fault.

**The grip, at low skill and tired** (recorded, not changed, because it is Mac's "Free-climb on grip"). The free climb's
height is its pace times its grip (`gripSeconds`, `freeClimbSpeed`, Speed 50). Climbing 5 at Fatigue 34% (the reporter's
screenshot shows 34%) holds 4.1 s at 1.08 m/s, 4.4 m. Fresh, it holds 7.2 s, 7.8 m. Climbing 30 at Fatigue 34% holds
7.5 s at 1.30 m/s, 9.8 m. So a 6.4 m dungeon wall is out of reach only for a near-untrained climber who is also tired. The classic climb
had no grip, only a roll every 0.82 s that, when it failed, slipped the climber down the wall.

**Not run:** the hang's shimmy, the leaps and the catches on dungeon walls (the probe holds Forward only). Corners were
traced by hand only (CORNER-TOP above).

## HUNT-FOES: a foe come near closes the hunt (2)

**Reproduced first** (`test/fb1002_fieldbugs.test.js`, on surv6's composed hunt): the box opens, a foe comes near, and
the box stays. On Yes the search runs its 4-8 s with the player frozen. At the turn to the result, `onSearched` called
`advanceMinutes`, whose encounter tick (`world.js` `runEncounterTick(feet, true)`) replays 30-60 minutes of wanderer
rolls at once and stands a hit 10-20 m away, facing the player (`_standEncounterFoe`), while the result is on screen.
`scenes/hunting.js`'s own header already said the beast stands "when the box closes" for this reason. The encounter
wanderer was the case it missed.

**The fix.** `createHunting` takes the host's `enemiesNear`, and the window's `interruptWhen` asks it on the ask page as
well as the busy page (FORAGE4's door, which the hunt had never used). A foe coming near ends either page as a No:
nothing searched, nothing charged, no minute passed, the player's hands back. The result page is left alone, because
its outcome is already given and is the player's to read. The search's minutes pass when the box closes
(`onClosed`), before the beast stands. A box taken from under a given result (a death screen, a load) spends them
quiet: the clock alone, no encounter roll, and no beast (the audit, C1). A load closes the box before the save is
read. The world host's `huntFoesNear` counts a duel's foe (`duelEnemyNear`, a peer in no pool), a foe that sees the
player (`areEnemiesNearby`), or a foe still loading within 30 m (`HUNT_PENDING_NEAR_M`; `exteriorFoes.pendingFeet()`: `spawnFoe` is async, and the frame's encounter roll
runs before the hunt's). It feeds both the roll and the box. The first cut counted every foe loading anywhere, and the
review found that a site's garrison streaming in far away closed the box. The encounter's own stand is 10-20 m off.

**Not changed.** WINFOE1 (Mac: "enemies should still be able to do damage") and QUEST-POPUP-PAUSE ("Pause them offline",
a quest box only). The hunt's box does not pause the foes. It gets out of the player's way instead, offline and
online alike.

## HELM-NET: no cast while the hands are the ship's (3)

`scenes/fishHost.js` `looseNodesOf`: the kind's host gives a `busy` check, and while it holds there is no cast, so no
plaque, no E, no click and no Fishing-Net's Use there. The world host's is
`csaRuntime.isSailing() || naval.aiming || naval.boarding`. An act already running when the player takes the helm ends
with the act's "stopped" line, because the gathering host asks for the cast again every frame. A deck stood on still
fishes (Professions-Arc's "stand at sea on a boat or pier"). This is narrower than taking the helm out of the gathering
host's `active`, which would have hidden every profession node from a helm. HELM-KEYS' `choice` gate is kept.

## HELM-HUSH: a playing loop goes on; a stopped fade lands (4)

**Reproduced first** (the CSA runtime harness, `test/csaScene.mjs`): place a boat, let its fade finish, take the helm
and get under way. `PlayFast`'s crossfade calls `audioPlay` on the slow loop, which was already playing, and that
counts a new play. The host's `csaAudioFrame` reads a changed `plays` as "from the clip's start", stops the channel
and starts a new one. Slowing under 0.5 m/s does the same to the fast loop. No music, ambience, master gain or
listener change happens at the helm (the helm lane ruled each out).

**The fix** (`systems/comeSailAway.js`, a Ledger A departure). `audioPlay` counts a play only from silence: a source
already playing goes on where it is (Unity's `AudioSource.Play` restarts it). The one `fading` handle is every boat's
(kept), but when a new fade stops the running one, the stopped fade now lands where it was going: played at its
target volume, or stopped if it was fading to nothing. A stopped crossfade lands too: the loop it was bringing up
heard whole, the other stopped (the audit, C3). Before, it was left where it stood, and a boat placed (a load,
a launch, a reposition) while another's fade-in was at its first step left that loop playing at volume 0.

## The audit (Mac: "Audit this")

Four lenses over the batch as committed (2bbbc12c), each against the base (66e98091) on its own snapshot, nothing
changed while they read: A the climb's mechanics, traced on boxes; B the climb on real geometry in the modes the
Forward-only probe never ran (8 dungeons and 551 walls, 3 town blocks and 241 walls, about 30 scripted runs a wall a
tree: Back from every height, strafes, jump catches, leaps, the hang's shimmy, 15-45 degree approaches, Climbing 5
tired, and Back pressed every 0.15 m up the wall); C the hunt, the net and the loop, read; D the records and their
pins. Every finding was reproduced on the code first, fixed, pinned red in `test/fb1002_audit.test.js` and its mutant
killed.

| | Finding | Fix |
|---|---|---|
| A1 | CORNER-TOP read the look every step. A view turned 20 degrees during a climb, toward a crate, a 1.6 m garden wall or a lower side wall within contact, mantled the climber sideways onto it on the next frame (the held wall ran on to 12 m); toward a 1.2 m fence it clambered over into the next yard | the side is the look's as the hands take the wall (`w.look` at `_wallBegin`, `w.corner` read once) |
| A2 | SEAM-STEP asked a failed search again every frame while stuck: 18 places, each a body's fit and a wall's. Under Carololda's slabs, 311 collider calls and 1.05 ms a frame, against the base's 59 and 0.27 ms | the failed search is kept until Back, Left or Right, or 0.3 m of rise |
| A3 | A save in STEP-BACK's pass loaded holding at contact, not at the grab's reach: the hands let go and the climber fell 5.84 m, or stood on the step's edge | `_pkRetake` reaches as the grab does (`w.seek`) |
| A4 | Forward with Left or Right at a step-back fell, caught, fell, on both trees (STEP-BACK asked for straight up) | the step is passed on the across climb too |
| A5 | (the audit's own, found fixing A2) A jamb over the body's middle: the search's fit admitted the touch of its edge, the resolve refused it, and the climb stood 0.2 m along | still stuck where the search said, it searches on the same way within what is left of 0.45 m |
| B1 | The Pit of Sahoth's N0000008, 15-45 degrees off square to an 11.5 m wall whose top rolls back into a 68-degree lean: the base topped it (its 7 cm press shoved it up the lean); the batch let go at 10.96 m (about 29 HP), and again with Forward held. The contact switched to the corner's sloped other face, and the next check along that face missed | the hold turns to a new face only when that face is met along its own normal (`PARKOUR_TURN_HOLDS`); else it keeps the face it had. It now stalls under the lean, no fall: a top past 50 degrees, the stall below |
| B2 | Back just past N0000033's step-back (Elona, Mordywyr) froze at 5.27 m until the grip ran out, or let go 5.45 m up: 6 of 338 runs. The profile is a 12 cm recess 0.25 m deep under an 11 cm band; the lowest contact ray, the one still on the wall, crossed the recess and met nothing | climbing down reaches as the grab does (`w.down`, for the contact and for the move's hold). From under the step's top Back reaches the floor; from over it the climb stops on the wall above the step (CLIMB2) |
| B3 | A strafe into a narrow face set at 43 degrees (Sahoth, 1 of about 1,100 dungeon strafes) let go 3.8 m up | B1's turn law: the strafe stops at the face, held |
| B4 | Climbing 5 at Fatigue 34% ran out of grip 0.17 m short on two marginal walls (Castle Kingwing, Tach Manor) that the base mantled with 1% grip left, on the old press's boost at the start and at the 3.2 m seams | not changed: the honest pace (HUG-TOUCH) and the grip are Mac's. 2 worse, 7 better, 165 more runs higher. At Climbing 5 fresh, grip-outs above the 5 m damage line went from 16 to 33: walls that stalled low are climbed to about 7.8 m before the grip ends (about 14 HP) |
| C1 | F11 works under any overlay, and the load never emptied the slot: a result left open across a quickload charged the loaded save the search's minutes and replayed 30-60 minutes of wanderer rolls at the loaded spot. A death under the result rolled them over the corpse | a load (quickload, classic import) closes the box before the save is read; a box taken away spends its minutes quiet (`advanceMinutes(n, { quiet })`: the clock alone) |
| C2 | `huntFoesNear` missed a duel: every other "enemies near" gate in world.js asks `duelEnemyNear()`. Mid-duel the hunt could open and hold a duellist the peer kept hitting | it asks the duel first |
| C3 | HELM-HUSH's "a stopped fade lands" covered fades, not crossfades: a boat placed during a 2 s crossfade left both loops playing part-way (0.75 and 0.25), and the wake asks only for a silent loop, so never again (as on the base) | the crossfade lands too |
| D | The records: the grip figures (3.8 s at 1.2 m/s; 6.6 s fresh), HUG-TOUCH's "more than Climbing 0's pace", "four faults" over a five-row table, the Ledger CLIMB row's audit text in its Approved-via cell, Climates-Calories' loading foe without its 30 m and a corrected sentence left standing (also Foraging and huntWindow.js's header), the STEP-BACK pin's claim of the top it never asserted, Faallem's gap left out, the patch notes' overclaims, and a probe cited (`pits.mjs`, `seam.mjs`) that was in no tree | each made true; the probe is committed (`tools/climbDungeonProbe.mjs`) |
| D | Survivors of new one-site mutants: the ask page's busy gate (an unanswered ask ran its wait, searched and turned to the result by itself, unpinned), the sidestep's diagonal pace, its 5 cm probe, the crack's 3 cm probe height (slots to 13 cm read as cracks), CORNER-TOP's face test, STEP-BACK's "straight up" | the busy gate, the pace and the probe pinned; the crack slot measured (below); the face test left to the ledge sensor's law; the across climb passes (A4) |

**The crack, measured.** The first cut read a slot as a crack by where its rung fell: slots to 4 cm always, 4-9 cm
on some frames. `faceGoesOn` now measures the slot's top and foot (CRACK-LIP above): a 2.5 cm crack is no lip
wherever it is asked; 6 and 8 cm slots are holds.

**Changed and right (CRACK-LIP).** Castle Kingwing's N0000034: the hang's shimmy stops where a 1.1 m parapet stands
flush on the lip, where the base shimmied 6.4 m along the 2.5 cm gap under it and round two corners. A side leap at
the Mordywyr Mines no longer catches the gap at the 3.2 m seam and pushes off instead (1.8 m down).

**What still stalls, with no fall.** B1's leaning top (past 50 degrees). The niche 2 m tall and 0.4 m deep (lens A):
the climb goes up its back wall and hangs with the head on the lintel, 0.2 m over the niche's floor, where the base
fell and caught over and over; neither mantles into it from the hang. Back, Crouch or Jump get off.

**Better than the base** (lens B, before A-C's fixes): Forward at Climbing 100 topped 529 walls against 515, Climbing 5
fresh 499 against 356, jump catches 517 against 503, 45-degree approaches 59 against 43, Back from the top hang
reached the floor 504 times against 498, and 25 heights where Back froze on the base now climb down. Equal: Back from
mid-wall, the stalled climb's ways off, the shimmy, Jump with Back or a side, and the town blocks. 67 freezes on Back
near N0000008's floor are on both trees.

**Not covered.** The world host's 30 m law and HELM-NET's `busy` wiring are pinned by source only (the host is not
composed in a test). Leaps were run from mid-wall only, at Jumping 50.

Pinned: `test/fb1002_audit.test.js` (12), the last on ARENA2 (CRACK-LIP on N0000008, STEP-BACK on the Mordywyr
Mines' N0000033, CORNER-TOP in the reporter's pit, and no fall at B1's three yaws). `tools/mutants/fb1002_audit.json`
(19), all dead.

## Pins and mutants

- `test/fb1002_climb.test.js` (7): SEAM-STEP (the jamb on either hand; a slab it cannot step out from holds it in
  place), HUG-TOUCH (Climbing 0 up the real wall's two triangles, at its pace), CRACK-LIP (the climb past a 2.5 cm
  slot; no grip and no ledge at the slot; a 10 cm sill still a hold), STEP-BACK (past 0.2 and 0.3 m step-backs to the
  top of a 9 m wall with no let-go; the reach never lifts the body onto a step's edge; a face turned across the wall
  not reached for), CORNER-TOP (either hand, 45 and 60 degrees), the laws by source, and the reporter's two walls on
  ARENA2.
- `test/fb1002_fieldbugs.test.js` (8): HUNT-FOES (the ask, the busy page, the result left alone, the minutes at the
  close and under a dropped box, by source), HELM-NET (a deck fishes, the helm does not; by source), HELM-HUSH (both
  crossfades leave the playing loop alone; a second boat placed under the first's fade).
- `test/fb1002_audit.test.js` (12): the audit's (above).
- Red on the code before, every test. `tools/mutants/fb1002_climb.json` (15), `tools/mutants/fb1002_fieldbugs.json`
  (12) and `tools/mutants/fb1002_audit.json` (19), all dead. After the audit's changes the eight lists its code touches
  (those three, `surv6`, `csa_time`, `forage4`, `climbfield`, `climb3`) were run again on the final code: 208 dead,
  3 equivalent as recorded, none stale; the records the audit moved re-aimed by content (fb1002_climb's SEAM-STEP
  three, CRACK-LIP two and CORNER-TOP two, HUNT-FOES-the-minutes-lost-with-the-slot, CLIMB3-sill-pass-held-short and
  the two free-climb-jump records back to their text on the base, SURV6-the-minutes-never-pass).
- PIN MOVED: `climb2.test.js` (HUG-TOUCH, above); `surv6_hunting.test.js`'s composed hunt (the minutes at the close)
  and its source pin (`huntFoesNear`). Mutant records re-aimed by content on the moved source: `climb3.json`
  (CLIMB3-sill-pressed-into, CLIMB3-sill-pass-held-short), `climbfield.json` (E1-no-eave, E1-eave-up-every-wall),
  `csa_time.json` (CSA-G-play-no-restart), `forage4.json` (FORAGE4-3), `prof8.json` (PROF8-kind-dry-land),
  `surv6.json` (SURV6-the-search-runs-every-tick-after, SURV6-the-minutes-never-pass); all dead. The cites the change
  moved were re-resolved (`tools/citeShift.mjs --base 66e98091`, 122, and seven struck ones by hand). Four real-data
  tests fail on the base as well as here (audit18 social F2, court's AUDIT 21 F1 and F8, field_csa2's Bay): not
  this change's.

## Found on the way, not changed

- Using the Fishing-Net from the hotbar at the helm finds no cast and says Foraging's general line about where nets
  work, which tells a player already at sea to stand at sea. A helm-specific line would be polish.
