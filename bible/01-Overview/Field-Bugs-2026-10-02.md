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
| 1 | "Stuck after Climbing Rework" - "A two blocks wall is too high for my character to climb up, so Im stuck in this hole. Luckily I have levitate. Its 'Ruins of Old Carololda's Farm'"; "I would have been able with old climbing mechanics" | Chilloutman | Daggerfall's dungeon walls are stacked in 3.2 m units. Where the unit above has a jamb a hand's width over the climber, the head met its underside 1.4 m up the first unit and the free climb stopped; the classic climb's resolve slid it out from under. On the same walls, three more faults the classic climb never had: the free climb's deep press slid it down along a big face's diagonal seam (at Climbing 0 it never left the floor); a 2.5 cm crack between stacked pieces read as a lip (hang, let go, fall, repeat); and a piece set back 20 cm over the one below stopped the climb at the step | fixed (SEAM-STEP, HUG-TOUCH, CRACK-LIP, STEP-BACK) |
| 2 | "Enemies attacking during travel events" - "when an event occurs while traveling (Track a group of animals type stuff) and you press YES, enemies can attack you while the result loads"; "During this enemies can still attack you" | Aru | the hunt's box holds the player's motor and WINFOE1 runs the foes under every window: a foe that came near during the ask or the 4-8 s search hit a player who could not move. At the turn to the result, the search's minutes went through the encounter tick and could stand a wanderer 10-20 m away, facing a player the result page still held | fixed (HUNT-FOES) |
| 3 | "New fishing context pop up clashes with come sail away!" - "Gets in the way especially when trying to aim bow guns" | Cruor | at sea the net's water is everywhere (`netHasWater`: the Ocean's climate, the sea region), so CAST-LOOK's cast stood under the crosshair at the helm and over the guns' aim, and E or a click there cast the net | fixed (HELM-NET) |
| 4 | "Reports of audio cutting when taking helm of a ship" | (relayed) | every crossfade of a boat's two loops played the loop it was fading out again, and the host restarts a played source from its first sample. The first stroke past the wake's threshold (0.5 m/s), and every slowing under it, cut the boat's sound. Separately, a boat placed while another's fade-in ran stopped that fade at nothing and left the loop playing silent | fixed (HELM-HUSH) |
| 5 | "Enhanced climbing needs a further perfection audit" | Mac | the climb on 25 real dungeons, Forward held square to every wall with a top: every wall the classic climb topped, the free climb tops, apart from slopes past 50 degrees and a top with something standing right behind its edge (Jump pushes off, Back climbs down, Crouch lets go) | audited (AUDIT CLIMB-DUNGEON) |

## The report (1) - measured on the reporter's dungeon

"Ruins of Old Carololda's Farm" is the Daggerfall region's location 383. Its thirteen blocks are B0000007, B0000002,
B0000008, B0000009, N0000090, W0000015, N0000035, B0000012, B0000014, N0000085, B0000010, B0000014 and B0000002. The
collider was built as `scenes/dungeonContext.js` builds it (every placement and every enabled action door, at each
block's origin). From every floor point 1 m apart, every wall within 1 m that has a top between 2.4 m and 16 m with
standing room was climbed. The climber held Forward square to the wall and 8 degrees either side, at Climbing 100 so
the grip could not decide the result. Each failure was run again on the classic lane with every roll passing.

The reporter's "two blocks" is two dungeon units, 6.4 m. On N0000035's and N0000090's 6.4 m walls the free climb
stopped with the feet 1.42 m up, while the classic climb went over. Sectioned (`seam.mjs`, rays every 2 cm across the
body's width), the wall above 3.2 m has an opening beside the climber whose jamb, a single face across the wall, stands
0.10 m inside the 0.35 m body. The head's sphere met the jamb's lower edge. The collider's resolve pushed the body out
along the wall, as it does for the classic climb, and the free climb's across clamp
(`_fcMove`: "across the wall the body goes as far as it was asked and no further") put it straight back.

## SEAM-STEP: stuck going up, the hands move along the wall to where the body rises (1)

`player/motor.js` `_fcSidestep`. When the free climb is stuck going straight up (Forward held, no Left or Right), the
nearest place along the wall where the body fits 0.1 m higher with the wall still at its hands is searched, every
5 cm both ways out to `PARKOUR_SIDESTEP_MAX` (0.45 m, a hand's width past a body's half). The hands go there along
and up at the climb's diagonal pace, and the climb carries on from it. The way and the distance are kept until the
climb has risen `PARKOUR_SIDESTEP_CLEAR` (0.3 m) past where it stuck, so one obstruction moves the hands that far at
most, and a long slope cannot walk the climber along the wall. With nothing that near (a slab over the whole width,
the top of a shaft) the climber stays where it is, as under any top it cannot take.

## HUG-TOUCH: the free climb presses to the face, not through it (1)

Found when the probe was run at Climbing 5. On N0000090's 25 m by 3.2 m wall (two triangles, the seam running from the
floor at one end to 3.2 m at the other) the free climb took hold and never left the floor. `_fcMove` pressed the body
into the face by the classic hug's whole step (Speed x dt, 7 cm a step at Speed 50). The resolve then pushed it out
along the nearest feature, and where that is the seam between two coplanar triangles the push leans along the face:
1.3 cm a step lost going up, more than Climbing 0's pace there. The box test climb2 already pinned showed the same
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

`player/parkour.js` `faceGoesOn`: an opening with the face going on `PARKOUR_CRACK` (3 cm) above it, at the depth it
had below, is a crack. `plainGrip` takes no lip there, `scanFace` scans on past it, and `senseGrip`'s plain-wall test
counts a rung through a crack as the wall's.

## STEP-BACK: going up, a face set back from the hands is reached for (1, the audit)

The Mordywyr Mines' and the Convocation of Elona's N0000033: a lower piece to 5.75 m, the piece above set 0.2 m back.
Its top is too shallow to stand on, so it is no ledge. The free climb's contact (the radius and 0.15 m) ended at the
step and the climb stopped there. Going straight up, a face that steps back from the hands, turned within the hold's
30 degrees, is reached for out to the grab's reach (0.5 m), as Back reaches for the wall under a sill (`w.seek`), and the
press brings the body to it. A face turned across the wall (a corridor's side) is not reached for.

## AUDIT CLIMB-DUNGEON (5)

The probe above (`pits.mjs`), on the reporter's dungeon and on 24 more picked across the realm with no two having the
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
| topped | 7,946 | 8,059 |
| failed where the classic lane topped | 81 | 33 |
| the reporter's dungeon: topped / failed where the classic topped (402 climbs) | 267 / 5 | 284 / 0 |

The climbs that neither lane topped and that never took hold within 1 m of where they started (1,461 after) are
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
height is its pace times its grip. Climbing 5 at Fatigue 34% (the reporter's screenshot shows 34%) holds about 3.8 s at
1.2 m/s, roughly 4.5 m. Fresh, it holds about 6.6 s, roughly 8 m. Climbing 30 at Fatigue 34% holds about 7.5 s, roughly
10 m. So a 6.4 m dungeon wall is out of reach only for a near-untrained climber who is also tired. The classic climb
had no grip, only a roll every 0.82 s that, when it failed, slipped the climber down the wall.

**Not run:** the hang's shimmy, the leaps and the catches on dungeon walls (the probe holds Forward only), and a wall
approached in a narrow corner. In one hand-traced corner (N0000090, 13.75, 6.4, -70.65, at 5.49 radians) the start took
the side wall, which runs on past the front wall's lip, and the climb stopped under the ceiling. At 5.5 radians it took
the front wall and topped out. The square and 8-degree runs never took the side wall.

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
(`onClosed`), including when the slot is taken from under a given result, before the beast stands. The world host's
`huntFoesNear` counts a foe that sees the player (`areEnemiesNearby`) or a foe still loading
(`exteriorFoes.pendingFeet()`: `spawnFoe` is async, and the frame's encounter roll runs before the hunt's). It feeds
both the roll and the box.

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
target volume, or stopped if it was fading to nothing. Before, it was left where it stood, and a boat placed (a load,
a launch, a reposition) while another's fade-in was at its first step left that loop playing at volume 0.

## Pins and mutants

- `test/fb1002_climb.test.js` (6): SEAM-STEP (the jamb on either hand; a slab it cannot step out from holds it in
  place), HUG-TOUCH (Climbing 0 up the real wall's two triangles, at its pace), CRACK-LIP (the climb past a 2.5 cm
  slot; no grip and no ledge at the slot; a 10 cm sill still a hold), STEP-BACK (over a 20 cm step; a face turned
  across the wall not reached for), the four by source, and the reporter's two walls on ARENA2.
- `test/fb1002_fieldbugs.test.js` (8): HUNT-FOES (the ask, the busy page, the result left alone, the minutes at the
  close and under a dropped box, by source), HELM-NET (a deck fishes, the helm does not; by source), HELM-HUSH (both
  crossfades leave the playing loop alone; a second boat placed under the first's fade).
- Red on the code before, every test. `tools/mutants/fb1002_climb.json` (11) and `tools/mutants/fb1002_fieldbugs.json`
  (11), all dead.
- PIN MOVED: `climb2.test.js` (HUG-TOUCH, above); `surv6_hunting.test.js`'s composed hunt (the minutes at the close)
  and its source pin (`huntFoesNear`).
