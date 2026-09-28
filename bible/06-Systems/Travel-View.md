# Travel View - THE DESIGN, before any code (TV0, 2026-09-27)

Mac: *"So now I want to talk about expanding travel options to something a lot more
player friendly. My idea is a sort of zoom out to an overworld style that utilizes
travel options. Not a large scale zoomout, but something that fits. Allowing the player
to traverse between towns, through the environment, being able to see other players
traveling also. Even adding the option to tap/click to move to a specific location.
This is something ive wanted to do for a really long time and I want to do it justice
as it opens the door for a lot of possibilities. When opening the map, there should be a
toggle to go to the overworld style map. Every detail like weather patterns, should be
1:1 in this mode."*

**The working name is TRAVEL VIEW.** "Overworld" already means the exterior streaming
world in the code (`net/remotePlayers.js`, `11-Multiplayer/Multiplayer.md`'s "billboard
pass in the overworld"), and U61's retired relief map was called THE OVERWORLD; a third
meaning would be one too many. The name on the player's screen is Mac's to pick.

## Mac's four calls (2026-09-27)

Asked, with the trade-offs laid out:

1. **Height: below the clouds** - about 150-450 m up, tilted. The clouds stay overhead,
   so the sky, the fog and the rain stay the real ones with the least rework.
2. **Click to move: both, by target** - a town or a marker routes along the roads; open
   ground walks straight, Travel Options' own steered walk.
3. **Speed: capped to what loads cleanly** - a limit where the world streams without
   holes and the others see smooth movement, the same online and offline.
4. **Other players: region-wide from the start** - a new low-rate relay feed, so the
   first release shows travellers across the region, not only the ~2.5 km the pose
   reaches.

## What it is, and what it is not

**It is the real world, seen from above.** The streamed terrain, the real locations, the
real weather field, the real Travel Options journey - the player's own body walking or
riding across real ground, with a camera lifted over it. Nothing is a stand-in.

**It is not U61 again.** U61's OVERWORLD (`10-UI/UI-Arc.md`, 2026-08-26) was a SECOND
world - a WOODS relief at one vertex per map pixel, climate tints, a painted cloud veil
hiding the swap, and a camera that flew the route while the clock jumped. MAP1 retired
it for the held sheet (`10-UI/Held-Map-Arc.md`); no complaint about its look or speed is
recorded - the change was one of direction - but its record carries the lessons: 5,658
draw calls at rest, drawn mirrored in its first cut, never shown correct on real data.
Travel View draws no second world, so there is no swap to hide.

**Enhanced lane only.** DFU has no raised travel camera; the classic lane keeps DFU's
own map and fast travel whole. The Port-Ledger's "Ledger A (continued)" row THE TRAVEL VIEW
names the departure (TV1, 2026-09-28).

## The seams it stands on (measured 2026-09-27, four read-only lanes)

- **The journey exists.** `systems/travelOptions.js` runs Travel Options' Update in its
  own order: the autopilot (`systems/travelAutopilot.js`) turns and drives the real
  motor, `systems/travelSteer.js` casts three feelers round obstacles (TRAVEL-NAV),
  `systems/timeScale.js` scales the step, and a journey stops for enemies, a window, a
  disease, the ocean, arrival (`interruptTravel` keeps the destination for the resume
  prompt). The held map already starts a walked journey at a bare pixel
  (`beginTravelToCoords`, MAP2).
- **Roads exist; a route planner does not.** Hazelnut's four 500,000-byte masks, one
  compass byte per map pixel (`vendor/roads-hazelnut/`, `systems/travelPaths.js`), and
  the follow key walks junction to junction; a named trip goes straight
  (`Travel-Options.md` TO-FIELD: "The mod does not route along roads to a named
  destination and never did"). The pieces for a planner are in the tree:
  `ui/overworldModel.js traceChains` (1,508 road chains, 4,289 track chains) and
  `world/roadNetwork.js route()` (a pixel-grid A* that refuses water and prices climbs).
- **The raised eye exists.** The render eye (`mwv.eye`) is already separate from
  `cam.pos` (`scenes/world.js`), and `cam.pos` is what streaming, the ±500 m vertical
  re-centre, the weather sample, rain, grass and the wind follow. The travel camera is a
  RENDER eye; `cam.pos` stays on the player, so the world keeps streaming and the
  weather keeps being read where the player is. The tap ray unprojects through the last
  frame's projection and view, so a click works from any camera.
- **The weather is a field.** WEATHER3's `weatherAt(x, z, minute)`
  (`systems/weatherMap.js`): 400-700 systems born, drifting, growing and dying over the
  bay, calibrated to DFU's odds table. A player query is 0.12 ms, the sky's 40 km read
  0.2 ms. Cloud shadows (VC4) are already a world-space map that reads correctly from
  above.
- **The ground it can hold.** Enhanced land view is radius 5 by default (121 pixels,
  about 4.1 km guaranteed each way), 6 at most; the far ring reaches 48 pixels at true
  height (`render/farRing.js`). From 450 m at a 45 degree tilt that is enough land.

## The constraints, named before they bite

1. **Streaming cannot keep up with Travel Options' top speed.** At the default limit a
   horse makes about 650 m/s - a map pixel every ~1.3 s, where the builder completes
   well under one a second (PERF-EXT24: 3-6 ms of build a frame). At ground level fog
   hides the edge; from above the unbuilt pixels are holes. Hence Mac's call 3: the cap
   is MEASURED (TV2), not guessed, and the builder may take a bigger slice while the view
   is up (no combat, no HUD work).
2. **Online the clock cannot be sped up.** WORLD5: the clock is computed from wall time
   and nobody keeps it. Offline the cap speeds the calendar too (Travel Options' law);
   online it speeds the body only, as TO-ONLINE's journey already does. At the cap a pose
   moves under the 102.4 m snap, so the others see a rider, not hops.
3. **Everything that draws weather assumes a ground-level eye.**
   - **Fog:** plain distance from the eye, no height term (`render/fogGlsl.js`); from
     400 m in rain the ground below shows at about 30%.
   - **Clouds:** marched from `(x, 0, z)` and composited behind the world
     (`render/volumetricClouds.js`).
   - **Rain and snow:** a 42 m box round `cam.pos` (`render/precipitation.js`).
   - **Shadows:** cascades of 12/48/240 m round the eye (`render/shadowPass.js`).
   - **Grass:** a 300 m disc round `cam.pos`.
   - **Billboards:** turn about the vertical only, so from above they go edge-on.
   - **The far ring:** skipped under any exponential fog and carries no locations.

   Below the clouds (call 1) keeps the cloud march and the sky dome sound; each of the
   others needs an altitude-aware version.
4. **A far player is invisible today.** A pose reaches peers within `RANGE_PIXELS` = 3
   (about 2.5 km), inside 16-pixel cells. Only the party pose travels world-wide (the
   hub, once a second at most). Call 4 needs a new feed.

## The slices

**TV1 - THE VIEW.** A button on the held map's foot row, beside Ports, and a registry
key (KB1: a new action, drawn in Controls). The EM1 tab strip is a 2D-sheet contract and
this is a camera, not a sheet. The sheet lowers the way it always does (MAP-FIELD7) and
the camera rises from the player's eye to its band:
- about 150-450 m, clamped under the local cloud base, tilted 45-60 degrees;
- wheel or pinch to zoom within the band, drag to orbit, recentring on the player;
- the player's own body drawn with a ring and a heading so it reads from 450 m.

Outdoors only; a door, a dungeon or a building closes it. Escape, the same key, or any
Travel Options interrupt (enemies above all) drops the camera back to the eye.

The altitude-aware passes land with TV1, because the view is not 1:1 without them:
- **Fog:** density keeps DFU's value at the ground and thins with height, so rain still
  greys the valley and the ridge stands out.
- **Billboards:** tilt to face a raised eye in this view only.
- **Shadows:** cascades centred on the ground point the camera looks at, not the eye.
- **Grass:** stays with the player; from 450 m it is not drawn.
- **Precipitation:** a column over the player's own ground.
- **Cloud march:** its origin at the eye's height.

Pins run on the pure pieces: the camera band and clamp, the fog law, the billboard
basis. The frame is proven by a probe on the fixture rig, not by eye.

**TV2 - CLICK TO MOVE, AND THE CAP.**
- **Open ground:** a click starts Travel Options' walked journey to that point
  (`beginTravelToCoords`, finer than a pixel centre).
- **A town, a dungeon or any marker:** routes along the roads. A planner over
  Hazelnut's masks: roads cheaper than tracks, tracks cheaper than the open, water
  refused. It is built from `traceChains` and `route()` rather than a third copy.
- **The route as it runs:** drawn on the terrain as a line, and the journey follows it
  pixel by pixel through `travelPaths.js`' own path walk.
- **The speed cap:** measured on a probe that rides a long road at rising acceleration
  and counts unbuilt pixels in view. The cap is the highest rate that shows none, less a
  margin. The builder's budget while the view is up is measured the same way.
- **Controls:** the Travel Options strip (speed, camp, exit) rides along, the spinner
  clamped to the cap.

**TV3 - THE TRAVELLERS, REGION-WIDE.** A new directed-to-the-region frame on the
region channel the client already holds (`chat:region.N`), under the relay's discipline
end to end.
- **The frame:** a TRAVELLER MARK `{px, py, fx, fy, h, m, tv}` - the map pixel, a
  byte-fraction within it, a heading byte, the mode (foot, horse, cart, ship) and
  whether a journey is running. At most once per 5 s while moving and on each pixel
  crossing, once per 60 s standing, nothing indoors.
- **On the relay:** kept on the socket's attachment (under the 2 KiB budget) and fanned
  to the region room at a room-wide and byte budget. A late joiner gets the current
  marks in the welcome.
- **Trust:** the name comes from the verified token (`badged`), never the frame. The
  shape law is `validTravellerMark` in `net/wire.js`; a new RELAY_VERSION past world121
  with a `TRAVELLER_RELAY_MIN` gate; the SLAM8 row appended; the client's inbound gate;
  pins and mutants on both ends.
- **Drawing:** within the pose range the traveller is their real body, as today. Beyond
  it, a marker with their name set on the ground at WOODS height, and an edge arrow for
  one outside the view. The held map draws the same marks, in `partyMapMarks.js`' shape.
- **Cost:** every frame wakes the region's object - measured against RELAY-H1's free-tier
  figure before merge.

**TV4 - THE WEATHER, SEEN FROM ABOVE.** The field is already there; this slice draws
it where it is.
- Cloud shadows over the whole view (VC4's map).
- Rain and snow curtains standing under the systems `weatherAt` reports raining inside
  the view, not only round the player.
- Lightning striking where the storm really is (WEATHER3d's distant strikes, per
  DISC20-D).
- The far ring kept under light weather with its haze.

The one rule: nothing is invented - every curtain, shadow and strike answers
`weatherAt` for its own ground at the shared minute. So two players in the view see the
same storm in the same place.

**TV5 - THE GROUND AT DISTANCE.** Far-ring silhouettes for the locations beyond the
grid (a town is a cluster of roofs at its real pixel before its blocks build), and
whatever the TV2 probe says the builder still needs.

**Release gate: TV1-TV4.** Call 4 puts the travellers in the first release, and Mac's
"every detail like weather patterns, should be 1:1" puts TV4 there. TV5 follows. *(TV5 as
built: edge markers, Mac's call - see "TV5 - SHIPPED".)*

## TV1 - SHIPPED (2026-09-28)

Mac, 2026-09-28: "Your the lead and this is your baby." The open items below were decided
as lead and are recorded as such; each is one line to change if Mac calls otherwise.

**The pieces.**
- `src/player/travelCamera.js` - the camera's LAW, pure: the band, the ceiling, the eye,
  the ground clearance, the wheel, the drag, a frame's easing, the rise and fall, the lean.
- `src/scenes/travelView.js` - the HOST'S MACHINE: `createTravelView(deps)` owning the
  state (`off` / `rising` / `up` / `falling`), the input while up, and every way out. Its
  header is THE FOUR HOSTS RULE's record.
- `src/ui/travelViewHud.js` - the READOUT: the traveller's ring and chevron on the
  projected feet, the compass, the bar (title, place, hints, Return). Keyed marks
  (`marks`) are its seam for TV2's route and TV3's travellers.
- `src/render/fogGlsl.js` `FOCUS_GLSL` + `renderer.setFocus` - THE FOCUS: one uniform
  (`uFocus`, w 1 set, w 0 the camera) the fog measures from; the shadow pass renders its
  cascades about the same point and hands the receivers `uSunOrigin` to pick them by.
- `src/player/mwView.js` `mwViewHoldThird` - the body held third-person for the view, and
  handed back as it was found.
- The door: `Overworld (O)` on the held map's foot, KeyO on the sheet, and the
  `TravelView` action (KB1: appended, Windows group, shipped UNBOUND). The held map is the
  Enhanced map: a player who turns it off has DFU's own map windows, which carry no door -
  the bound key is their way in (AUDIT DEEP2 F7; said in the patch notes).

**The numbers, and why.**

| Law | Value | Why |
|---|---|---|
| Height band | 150-450 m, default 260 | Mac's call 1; 260 frames a town and its gates |
| Ceiling | cloud base (VC_PROFILE[weather].base) less 60 m, floor 40 m, none = 450 | "Below the clouds" - the deck the sky really draws; a lid weather still leaves a view |
| Tilt | 30-75 degrees down, default 52 | the design's 45-60 widened so a drag can look out to the far ring or straight down on a town |
| Clearance | 25 m over the ground under the eye AND over a ridge halfway to the traveller | the eye never inside a hill, the traveller never behind one |
| Focus | eased at rate 10; a move past 60 m taken whole | a fast travel or respawn is a cut, never a sweep over unbuilt leagues |
| Rise / fall | 1.2 s / 0.8 s, smoothstepped from the head's own eye | out of and back into the body's camera, whichever mwView answers |
| Flats | leaned back by HALF the tilt, pivoting on their FOOT (BB_VS anchors a flat there - AUDIT DEEP R-10: this row said centre); shadows upright | full tilt lies them face-up; half keeps a readable silhouette from 450 m |
| Click | a press that moves under 6 px is a pick | a drag is an orbit and picks nothing |

**What departed from the TV0 design, and why.**
- **The fog does not thin with height.** A thinning law invents a density DFU never had.
  Instead the fog is MEASURED FROM THE TRAVELLER'S HEAD (`uFocus`): every fragment is
  fogged exactly as the traveller standing there sees it - DFU's own density, DFU's own
  distance, from DFU's own eye. The ground at the feet is clear in a rain fog; the hills
  a league off are grey. The probe reads it off pixels.
- **The shadows stand about the traveller, not the look point.** The traveller is the
  look point by construction (the eye stands back along its heading), so the cascades
  are rendered about the same focus; the receivers pick a cascade about `uSunOrigin`, the
  point the pass itself rendered about, so the pick and the maps can never disagree.
- **The cloud march and the rain need no change.** The volumetric deck marches from the
  traveller's head (`sky.use({ pos: player.pos })` - AUDIT DEEP R-10: this said the frame's
  raised eye; from 30 degrees down or more little sky is in the picture either way); the rain, the grass, the streaming and the
  weather sample stay on `cam.pos`, which never left the traveller. Grass is not drawn
  from the air (under a pixel at 150 m).

**The way in, and every way out.** In: the map's button, KeyO on the sheet, or the
`TravelView` key if bound. The gate (world.js `travelViewAllowed`): the enhanced lane, a
walking body in the open air, alive, above the water - each refusal said on the notice
line; a foe near refuses as the map's own travel does. Out: Escape (through the
registry, never reaching the pause), Return, the key again (AUDIT DEEP X-2: it only ever
entered until then); a window opening, a door out of the open air, a video or a death CUTS
it at once (AUDIT DEEP X-1: the door and the video are cut by the host above the returns
that skip the exterior frame - `allowed()` alone waited for the heartbeat); a foe near
brings it down.

**The heartbeat.** Every frame the host draws re-arms a 600 ms timer (the world plaque's
own law, AUDIT-WH2 L3-F2). Frames that stop - a throw downstream, a video holding the
frame - bring the view down and hand the input back; a loop a later boot killed is left
quietly (the listeners and the readout, never the successor's cursor); a hidden tab keeps
the view. So P0's one unwind line in the host stays the plaque's alone.

**The input.** While up the view owns the canvas on the window's CAPTURE phase: a click
is a pick (TV2's seam: `onPick(x, y)`), a drag orbits and tilts, the wheel zooms, the
right button and the context menu never reach the host. The look keys turn the view,
not the traveller. Movement keys walk the traveller camera-relative (the traveller
turns toward the input at 6 rad/s the short way) while no journey drives. The DOM
beside the canvas keeps its own events.

**Proof.** `test/tv1_travel_view.test.js` (18), the heldmap door pin (+1),
`tools/mutants/tv1.json` (17 dead), and `tools/travelViewProbe.mjs` (17 checks in a real
browser on a synthetic valley - CI has no ARENA2 - including the fog and shadow
discriminations read off pixels, real pointer events, and the bar on a phone).

**Other pins, re-aimed because their law grew (never loosened).** The sky's and the flats'
anchors now read the view's spelling - `sky.draw(tvf ? tvf.yaw : cam.yaw, ...)` and
`drawBillboards(..., camRight, bbUp)` - in PERF2, PERF-ZONE2, EV8, DW-C, WATER1,
INVIS-LOOK, SHADOW-REACH and BLOOD1a, every ordering they assert unchanged; DISC14-A's
gate is the walk block's AND not the view's; AUDIT 58's cursor guard ORs the view in on the
world host; I1 and QS2 count the appended, unbound `TravelView`; LA-COST1 classes `_focus`
as an input and counts the two new uploads (+2 on each first call); AUDIT SOC C10/D5 reads
the foot row with the Overworld button after Ports; U42 counts the readout's module.
Every spelling P0, FPS-CAP1, PERF1, AUDIT 39 and AUDIT-WH hold on the frame's first lines,
and the mwViewFrame call's length AUDIT-EOTB F3b reads, is kept as it was.

**Decided as lead (was "Open, for Mac").**
- **The name:** "Overworld" to the player (Mac's own word); TRAVEL VIEW in the code, so
  it never collides with the code's `overworld` (the map pixel grid, U61's retired
  scene).
- **A second door:** the `TravelView` action exists and ships unbound; the map stays the
  front door. A player who wants a direct key binds one in Controls.
- **Being seen:** decided at TV3 (below), with the switch on by default as proposed.

## TV2 - SHIPPED (2026-09-28)

Mac's calls: **"Both, by target"** and **"Cap it to what loads cleanly"**.

**A click, from the air.** The press the view takes as a pick (under TV_CLICK_SLOP) is a ray
from the view's OWN eye through the frame's own matrices (`player/tapRay.js`
rayDirFromScreen, the canvas's pixels) met with the BUILT ground by a march and a
bisection (`player/travelPick.js` groundHit - nothing in the tree met a slanted ray with
the terrain: the collider answers meshes, and outdoors the ground is not one). What it
lands on decides the journey (`classifyPick`):

| Under the click | Journey | Said |
|---|---|---|
| a known place (its rect grown 1.5 blocks) | by the roads, to the place | the trip line: "To X, by the road" / "across country" |
| open ground | straight there | "To the marked spot" |
| the water | none | "You cannot walk out onto the water." |
| ground not yet built | none | "That lies beyond what you can see from here." |
| the sky | none | - |

A place is only a place once DISCOVERED - DFU's own law, the travel map's
(`checkLocationDiscovered`): an undiscovered town is walked to as the ground it stands on.
The known places about the traveller wear PLATES (the grid's own radius, rebuilt on a pixel
change), and a plate's click is the same journey as a click on the town. No Travel Options
(the mod switched off) is said, not silently ignored; foes near refuse it in the mod's words.

**By the roads** (`systems/travelRoute.js`). A* over the 1000x500 grid on Hazelnut's bytes -
the very bytes Travel Options' follow key walks - with a step ON the road only where both
ends carry the edge; a road 1, a track 1.6, the open 3.5 (x sqrt 2 diagonally); the sea
refused (roadsProducer's WATER_BYTE); a straight run on one kind of ground folded into one
leg. It walks roads; `world/roadNetwork.js route()` lays them - two laws, one compass.

**The journeys are Travel Options'.** Two of the port's own (Ledger A, "THE TRAVEL VIEW'S
JOURNEYS"), built from the mod's parts: `beginTravelAlongRoute` (each leg a pixel's middle,
the SAME autopilot re-aimed leg after leg - BeginPathTravel's own InitTargetRect - a road leg
reckless, a track or the open cautious, the last leg the place itself with the arrival
buffer; a NAMED journey, so LocationPause and the resume prompt know it; interrupted, it
resumes from the nearest leg ahead) and `beginTravelToPoint` (a path's width about the spot).
Every stop the mod's Update makes still stops them. Under the view the arrival is SAID on the
notice line, not boxed: a box is a window, and a window brings the view down.

**The cap, measured live** (`systems/travelGovernor.js`). TV0 planned a probe riding a long
road for the highest clean rate; the probe needs ARENA2, CI has none, and one machine's
number is wrong on every slower one. So the measurement runs on the player's machine, every
journey: while the view is up over a running journey the host counts the pixels inside the
view's reach (where the picture's top edge meets the ground, never past the grid) that are
not built. Any for 0.25 s halves the clock (to the spinner's step of five); clean for 4 s it
climbs a step back; walking pace is the floor; the spinner stays the player's and the
travel panel reads `×20 / ×40` while held. Governed BEFORE the frame reads its scale, and
handed back whole when the view comes down or the journey ends.

**The way, drawn.** The route's line is an SVG path through its points (each leg sampled
four times on the ground), broken behind the eye, under the plates and the destination flag
- a readout, never occluded by the hills it crosses (a world-space line would need a line
pass the renderer does not have; handheldTorches.js says the same).

**Proof.** `test/tv2_click_to_move.test.js` (17), `tools/mutants/tv2.json` (20 dead),
`tools/travelViewProbe.mjs` (TV2's four checks: the plate's click is a journey and not a
pick, the route drawn, the trip in the bar, the held clock on the panel).

## TV3 - SHIPPED (2026-09-28) - needs a relay deploy (world122)

Mac: "being able to see other players traveling also"; his call **"Region-wide from the
start"**.

**The frame.** A TRAVELLER MARK `{px, py, fx, fy, h, m, tv}` - the map pixel, where within it
to a 256th each way (3.2 m), the heading to a 256th of a turn, the way (foot, horse, cart,
ship), and whether a Travel Options journey drives them - told on the REGION's channel every
online client already holds (`chat:region.N`). `validTravellerMark` refuses anything else
whole, an eighth key included. The name is the relay's, off the verified token (`badged`).

**The relay** (`server/src/index.js`, world122). The region's channel alone
(`isRegionRoom` - the world channel's mark is junk); its own cooldown per socket
(`travHubGate`, half the client's floor); the latest kept on the attachment (`tm`, stamped -
~70 bytes of the 2 KiB) or taken out by a null; fanned to the room under its own budget
(`TRAV_ROOM_HZ_MAX` 20 a second - over it the mark is kept, not fanned); and a joiner's
welcome carries the fresh ones (`tr`, at most 256, none older than TRAV_STALE_MS). A leave
takes a traveller off every screen through the room's own `leave`.

**The client.** The session (`net/online.js`) sends only through a relay at world122 or
later (an older one closes the socket on the frame), only in a region's channel, never
sooner than TRAV_SEND_MIN_MS (10 s); the welcome's marks REPLACE the book, a mark in is
gated at the room's own budget and never my own. The host (`scenes/world.js`,
`systems/travellerMarks.js`) sends when it is due: the first mark, a pixel crossed, a
change of way or journey, a refresh every 2 minutes standing - never from indoors, never
with the switch off, and NEVER WHILE ALONE in the region (the session's count; the room's
join says when someone arrives, and the new mark goes then).

**Drawn.** In the view, a traveller beyond the pose range is a mark with their name at their
ground (the far ring's height where the grid has not built), a party member in the party's
green, one on a journey arrowed, and one outside the picture HELD AT ITS EDGE pointing their
way (`edgeHold`). Inside the pose range they are their own body, named over their head, as
today. *(Named by a marker under the view since OVERWORLD NAMES below: the names over the heads
could not be seen from the view's eye.)* The held map draws the same book - a smaller verdigris ring under the party's, and a
legend row.

**Being seen - decided as lead.** "Show me to travellers in my region" (`showToTravellers`),
ON by default, on the Mods screen's Other players card, the player's own say online (never
forced by the room). Off: only the party (its own marks) and players within the pose range
(their own eyes, as today) know where they are; they still see those who show themselves. No traveller mark is ever sent from inside a building or a dungeon (the party's own pose rides from indoors, as it always has - AUDIT DEEP2 C5).
AUDIT DEEP T3-4/T3-7 - what the switch really promises, now in its own words: the mark goes
to the REGION'S CHANNEL, and the relay cannot know which region a socket stands in, so a
modified client that joins another region's channel reads that region's marks too (the
welcome's `tr`); the name stays in the region's chat roster with the switch off; and the
switch is kept per device (browser storage), so a new device shows the player again until
they say no there. The classic skin sends no mark at all (AUDIT DEEP X-4: it can neither
draw one nor reach the switch). T3-8, recorded: a peer id is the client's own, so a player
who learns a party member's id can hello into a region that member is NOT in under it and
be drawn in party green, under their own name - there is no cheap fix at the relay.

**THE COST, measured against RELAY-H1's figure.** RELAY-H1 priced a room awake for an hour at
~460 GB-s (the free tier's 13,000 GB-s a day was ~7 player-hours at ~4 rooms each). A mark
wakes the region's object, and the object stays in memory for the runtime's idle window
after it (taken here as W = 10 s). With N players in one region each sending at rate r, the
object is awake a share of about 1 - e^(-N r W):

| Who is in the region | Rate per player | Region awake | GB-s per player-hour | vs ~1,840 a player's 4 rooms |
|---|---|---|---|---|
| one player, alone | none (alone law) | 0% | 0 | +0% |
| 2 walking | a pixel per ~100 s | 18% | 42 | +2% |
| 5 walking | a pixel per ~100 s | 39% | 36 | +2% |
| 10 walking | a pixel per ~100 s | 63% | 29 | +2% |
| 2 on fast journeys | the 10 s floor | 86% | 198 | +11% |
| 10 standing | the 2-min refresh | 56% | 26 | +1% |

The lone traveller - the common case at today's population - costs nothing; a busy region
costs a few per cent on top of what its players already cost; the worst case (everyone on a
fast journey) is bounded by the 10 s floor at about a tenth. The constants are named
(`TRAV_SEND_MIN_MS`, `TRAV_KEEPALIVE_MS`) and can be raised in one line if the bill says so.

**What departed from the TV0 design** (AUDIT DEEP2 F15): TV0 sketched a mark every 5 s on the
move and every 60 s standing; as shipped, a 10 s floor (`TRAV_SEND_MIN_MS`) and a 2-minute
refresh (`TRAV_KEEPALIVE_MS`) - the cost table above is what set them.

**Deploy.** The relay deploys from main (`.github/workflows/relay-deploy.yml`), and a deploy
drops every connected player for a moment. Until world122 is live every client sends no mark
and draws none - nothing closes.

**Proof.** `test/tv3_travellers.test.js` (15, over a real Room through `test/fakeRoom.mjs`),
`tools/mutants/tv3.json` (20 dead), the SLAM8 row for world122 in
`test/relayversion.test.js`.

## TV4 - SHIPPED (2026-09-28)

Mac: "Every detail like weather patterns, should be 1:1 in this mode." The one rule held:
nothing is invented - every curtain, shadow and strike answers the weather map for its own
ground at the shared minute, so two players in the view see the same storm in the same place.

**The curtains, stood in the world** (`render/rainCurtains.js`). VC7c hangs a veil under
every falling cell - into the SKY MAP, composited on far-plane pixels alone. From 450 m the
ground fills the picture, so a storm three leagues off was a dark patch in the deck with
nothing under it. Now the same veil stands in the world under the view: VC7c's own constants
(CURTAIN_SHARE of the cell's radius, CURTAIN_EXT a metre at the cell's grown fall,
CURTAIN_STREAKS, CURTAIN_INTO), a cylinder from under the traveller's ground (the world's
depth cuts its foot where the hills stand) up into the base; its optical depth the CHORD the
line of sight takes through the solid cylinder, so it reads dense through its middle and
thin at its rims (measured in real GL by the probe) - measured across the GROUND plane
(AUDIT DEEP2 D9: from a steep eye the true path is longer by 1/cos of its elevation, so a
veil reads a little thinner from high over it than it would; weighed and kept - the foot and
the fog already bound it); fogged from the traveller; thinning to
nothing as the eye comes over it (the rain the traveller stands in is their own particles',
VC7c's `near`). The cells are the ones the clouds DRAW - `sky.drawnCells()`, picked by importance and capped by the cloud quality (AUDIT DEEP2 D3: the field's every cell once stood veils under a sky that drew none of them), the field's where the volumetric clouds are off. One foreign pass
on the world host, drawn only under the view: at the eye the sky map's curtains already
stand on the horizon, and drawing both would be the storm twice.

**The cloud shadows over the whole view - measured, unchanged.** The clouds' shadow map is a
13.1 km square on the traveller's pixel (SHADOW_EXTENT), its nearest edge 6,144 m off. The
view's fog ends at most 4,800 m out (the linear rows at the furthest grid) and the eye
stands back at most 779 m (450 m at 30 degrees): 5,579 m, inside the square. Under an exp
fog nothing is seen past the edge at all. So every shadow on the ground in the view is
already the clouds' own; the pin holds the arithmetic.

**Lightning where the storm is - the strikes were already placed there** (WEATHER3d's
distant storms, DISC20-D, from the weather map's thunder systems). What was wrong was the
view's: `stormLights.frame` measured a strike's column from the frame's eye, so under the
view every channel's foot hung 448 m above the ground. It measures from the traveller's head
now (`eye: tvf ? cam.pos : mwv.eye`); the bolts are still DRAWN from the view's own eye.

**The far ring under light weather - measured, unchanged.** The ring stands under the linear
rows (sunny, cloudy, overcast) with its haze, as ever. Under an exp row its nearest edge at
the default grid (4 km) is already fog (rain: e^-12), so its gate hides only fog.

**Pins amended, their laws grown.** BOLT wired (the strikes stand round the eye the view is
built from - and under the travel view round the traveller's head; the ribbons still face the
view's eye); EV6 and PERF2 count the world host's foreign seams at twelve; AUDIT 39r counts
seventeen host call sites across thirteen passes.

**Proof.** `test/tv4_weather_above.test.js` (8), `tools/mutants/tv4.json` (12 dead),
`tools/travelViewProbe.mjs` (TV4's four checks).

## AUDIT TV - the lead's audit before the arc closed (2026-09-28)

Four read-only lanes, one a slice, each finding re-read in the source before it was
fixed; every fix pinned and every pin made to FAIL (`tools/mutants/tv1.json` 30,
`tv2.json` 25, `tv3.json` 25, `tv4.json` 18 - all dead).

**TV1 - the view (B1-B9).**
- **B1 (high) the focus leaked.** `setFocus` was set by the exterior frame alone, so a door
  taken while the view was up left the street's focus on the renderer: the interior's (a
  dungeon's) fog measured from outside. The focus is now a FRAME'S: the host sets it every
  frame BEFORE `beginFrame` (whose lane replay and sun maps read it), and a `beginFrame` no
  `setFocus` came before clears it (`render/renderer.js` `_focusArmed`). Proven in a browser
  too: `tools/travelViewProbe.mjs` draws the view's frames and then a host that never sets
  the focus - the street's fog came through (139,134,128 against the camera's 109,115,128)
  until the fix.
- **B2 a refused hold stuck.** `mwViewHoldThird(true)` answers false when no body can leave
  the head (a mount) but keeps an empty hold; the view released only a hold that answered
  true, so every later ask was refused for good. The view now releases what it ASKED.
- **B3 touch.** The view takes pointer events; `ui/touch.js` listens to TOUCH events on the
  same canvas, so a drag that orbited the view also swung the weapon or walked the stick. The
  view takes a canvas `touchstart` in the capture phase while up - the START only, so a
  finger down before the rise ends as the touch layer's own and its stick lets go.
- **B4 stuck keys and buttons.** The view swallowed every release of a look key or a canvas
  button - including one the HOST saw pressed before the rise, which then stayed held in its
  Set (the traveller turned on after the view was gone). A release is the view's only when
  its press was (`keysTaken`, `buttonsTaken`).
- **B5 the chat relocked.** A chat opened over the view clears the free cursor; its close
  asked for the lock, under the view. Closed over the view, it gives the cursor back to it.
- **B6 one frame from the sky.** `mwViewFrame` was handed last frame's view eye; the frame a
  window CUT the view in drew from 450 m with the head's look - the pause's backdrop. A frame
  without the view draws from the body's own eye (`ownEye`).
- **B7 typing.** Escape in the chat box took the view down (and the arrows turned it); a key
  typed into a box is the box's.
- **B8 the readout's presses.** Return and the plates are DOM, and the host's window
  `mousedown` counts any press as Mouse0 - an activation or a swing on every click. The
  readout stops its presses.
- **B9 the small ones.** A `pointercancel` is no pick; the cursor is handed back as the view
  found it (a player who freed it keeps it free); a view caught falling rises without asking
  the body or the cursor twice.

**TV2 - click to move (A1-A5).** The trip's line one point a LEG, so `route.i` cuts it where
the traveller is (A1); the governor holds under what the MOD asked - a ring walk's own x15,
never the spinner's x30 (A2, `travelAsked`); a road journey resets the ring walk's
path-crossing watch that stopped it at the first pixel middle (A3); every other journey
clears the view's route, and a stopped SPOT journey is over (A4); a click in a town's margin
that falls on the neighbour pixel still takes the town (A5, the 3x3 asked).

**TV3 - the travellers (C1-C6).** A welcome resets what the relay holds of me - a new socket's
attachment holds nothing (C1); a CLEAR is always said, even over the room's budget, or a
player who went in stood on every screen for `TRAV_STALE_MS` (C2); a party mark asks the
hub's account for the peer (C3); never a mark into the region just LEFT, which the Region
link holds for `CHAT_REGION_HOLD_MS` after a crossing (C4); offline, the book is emptied
(C5); the welcome's `tr` is read below the halo's `else` it had split (C6).

**TV4 - the curtains (D1-D3).** The rise faded the curtains' LIGHT at full opacity - black
veils over the land while the camera climbed; it fades their opacity (D1). A traveller inside
a veil with the eye still outside was seen through the whole cylinder's chord; the veil fades
for the traveller as it does for the eye (D2). The foot stood 300 m under the traveller's
ground, so a storm over a deeper valley hung in the air; it reaches 40 m under the lowest land
at the veil's centre and rim - the grid's, the far ring's past it (D3, `lowestGround`).

## AUDIT DEEP - the whole arc, five reviewers (2026-09-28, Mac: "Let do a deep audit on everything so far")

Five read-only reviewers, one lane each (the view and its input; click to move; the
travellers, the relay and privacy; rendering; the seams, the evidence and the docs), each
told what AUDIT TV had already fixed. Every finding was re-read in the source before it was
fixed; each fix is pinned and each pin made to fail. The Proof lines above are each slice
AS SHIPPED; the arc's evidence now: `test/tv1_travel_view.test.js` 26,
`tv2_click_to_move` 20, `tv3_travellers` 18, `tv4_weather_above` 10; `tools/mutants/tv1.json`
63, `tv2` 40, `tv3` 37, `tv4` 29 - all dead; `tools/travelViewProbe.mjs` 26 checks, B1's
street-fog leak among them.

**The view (T1, X).**
- **T1-1 (high) travellers behind the eye all stood in one corner.** `projectToScreen`
  answers (0,0) for a point behind the camera, and the edge hold turned THAT round: every
  traveller in the rear half was held at the bottom-right with one arrow. The view asks
  for the mirror (`projectToScreen(..., behind = true)` divides by the negative w); the
  pin projects through the host's own mirrored lens.
- **X-1 a door, a teleport, a load inside or a video left the view up** for its heartbeat
  (the readout over the room, a click a pick, Escape the view's, the traveller turned by
  the keys): its only cut read the host's mode inside the exterior frame, below the
  returns that skip it. The host cuts it above the mode's return and on the video hold's
  own return.
- **T1-3 a fast journey snapped the focus** frame after frame (past ~650 m/s the eased
  lag passed TV_FOCUS_SNAP): a jump is the FEET's now, and the lag is held to the snap
  distance. **T1-4 a slope steeper than the tilt put the eye inside the hill** (two lifts
  never caught it): lifts until clear, then the view steepens (`clearView`), the camera
  keeping the player's tilt. **T1-8** one frame of fog lost the player's zoom for good.
  **R-8** the fall from a half-round orbit rolled through the pole: the look blends by its
  angles.
- **T1-5** coming down under an open chat locked the pointer under it; **T1-7** a look key
  let go in a text box kept the view turning; **X-9** one long task (a quicksave) took the
  view down - a second silent beat does now; **X-2** the bound key only entered; **T1-9**
  the enhanced crosshair stood at the centre of a camera 450 m up; **T1-10** in the
  Morrowind lane the rise began at the borrowed third-person camera and the fall snapped
  back (`mwViewHoldChanged`); **T1-12** the hint said WASD and Esc whatever was bound;
  **X-3** a save under the view recorded the borrowed third person, and a load under it was
  overridden when the view let go (`mwViewSaveCamera`; a load cuts the view first).

**Click to move (T2, X).** **T2-1** a road journey's resume aimed at the nearest leg in a
straight line - across the bay the road goes round, into the mod's ocean stop, again and
again: the leg it aimed at, or a later one reached over dry ground. **T2-2** the governor
counted the grid's outermost ring, queued anew at every crossing and fogged, and learned a
ceiling of x1 from walking pace: never that ring, nothing learned at x1. **T2-3** a view
journey was always reckless, so low health never stopped it: the player's own map choice.
**X-7** the arrival was a line even after the player came down: asked AT the arrival.
**T2-4** the plates outlived a load; **T2-5** the planner swam a corner of the sea; **T2-6**
the panel counted to the next bend; **T2-7** the planner walked the port's generated roads
with Basic Roads off; **T2-8** the mod's coordinate targeting was ignored, the climb went
1, 6, 11, a new click kept the old ceiling. **X-6** the held rate's reason was written and
never shown (the panel's title now).

**The travellers (T3, X).** **T3-1** the client gated clears with the marks, so in a busy
room the one frame over budget was the clear and the player who went in stayed drawn;
**T3-2** the relay fanned a clear from a socket that never marked, on the marks' budget
(a flood cost no strike and starved the marks): a clear takes out a mark that is THERE, on
its own budget; **X-8** a clear waited the 10 s floor: it goes at once (the relay takes it
past the cooldown - one a mark); **T3-3** a reconnect that replaced its own socket said no
leave, and its old mark stood five minutes: a join takes it out; **T3-5** `travOk` outlived
the socket; **T3-6** a welcome's marks were stamped fresh: rows carry their age. **T3-9** the
held map drew a party member twice; **X-4** the classic skin shared a position it could
neither show nor switch off. The relay's changes ride world122, still undeployed - its
law row rewritten in place.

**Rendering (R).** **R-1** the Deep Waters seabed, decorations and fish, the gate's fire and
the duel wall fogged from the raised eye (a fogged sea beside a clear beach): they upload
the focus, and a law test names every fogged program and who sends it. **R-2** the
traveller's own sprite went edge-on as the view orbited: its quad turns to the view.
**R-3** the sun's cascades stopped 216 m round the traveller: x4 under the view
(`SHADOW_VIEW_SCALE`, radii and depth), the maps redrawn on a scale change - the probe's
block now casts a real shadow from the air. **R-4** a storm off a coast hung 300 m of veil
through clear water: the foot stands on the lowest land, the sea's surface over water.
**R-5** the traveller's own storm vanished from the air: thinned to `CURTAIN_OWN_ALPHA`.
**R-6** veils past the fog's end or their storm's disc: not stood. **R-7** leaned tree tops
popped at the screen's edge: the cull sphere grows by h sin(lean). **R-11** the red storms
stood round an orbiting camera, and each peer showed the traveller's picture, not the
view's.

**Left, on purpose (each weighed):**
- The curtain's chord ignores ground inside the cylinder (a line of sight that meets a hill
  inside the veil is given the whole chord): the pass has no depth to read; a depth-aware
  chord is TV5-sized work.
- Blood decals z-fight past ~130 m from the air (a pixel or two): a larger near plane under
  the view would fix it, but every pass that reads the projection would have to be proven
  first - not worth two pixels.
- The per-frame costs (the heartbeat's re-arm, a score of small arrays, the route's path
  string, the marks' styles): measured small; left for a profile that shows them. *(Since
  profiled - PERF-TV below: the marks' styles were not small.)*
- The governor's reach assumes flat ground at the traveller (a ridge over a valley may see
  a pixel it does not count) - plausible, unmeasured.
- Mac's call 3 as TV0 records it includes "the others see smooth movement": the poses snap
  102 m a tick past about x94 at POSE_HZ 10, which the governor does not address - a
  departure, recorded here, for the relay's own arc.

## TV5 - DESIGNED, MEASURED, NOT BUILT (2026-09-28) - and the stage for what comes next

*Superseded the same day: Mac chose **edge markers** over these silhouettes ("TV5 - SHIPPED"
below). The ring-span design stays here as the record, should town shapes on the horizon be
wanted later.*

**The measurement that decides it.** The design said far-ring silhouettes for the places
beyond the grid. The world pass cannot draw them: its linear fog is EV4's `2400 x TD/3` metres
from the traveller, and the grid's edge is `TD x 819.2` - at every Land View of 3 or more the
fog ends 100 m INSIDE the grid (TD 5: fog 4,000 m, grid 4,096 m). Whatever stands past the
grid is fog in the world pass, from the eye or from the air. The far ring shows the province
past it only because it is its own pass with its own haze (EV8: its own projection out to
~60 km, `RING_HAZE_HOLD`), drawn after the sky at the far plane (`gl_FragDepth = 1`).

**So TV5 is a ring-span pass, and it needs one thing the ring does not have: depth.** A town's
roofs drawn in the ring's span would show through the ring's own hills, because the ring
writes the far plane for every fragment. The build, in order:
1. **The ring writes its OWN depth** in its own projection (a second depth attachment, or the
   ring's fragments at a depth mapped into the far slice the world never reaches), so
   anything else drawn in that span is occluded by the ring's hills. Pinned by the EV8
   tests that hold its far-plane law today (`test/farring.test.js`, `test/perf2.test.js`).
2. **The towns**: for every location whose pixel lies between the grid's edge and
   `RING_RADIUS`, a cluster of boxes in its own rect (`locationWorldRect`), seeded by its map
   id, its block count its footprint, the climate's roof colour, lit by the frame's sun, in
   the ring's haze - a DISCOVERED place's plate on it under the view (TV2's plates).
3. **Measured**: the draw calls at the ring's full radius (one instanced call; the ring
   already builds its vertex grid off the same pixels).

**What the arc leaves ready for later content** - each a seam that exists now, named:
- **Journeys that leave from the air.** `beginTravelAlongRoute` takes any list of legs;
  a party's journey (PARTY-TRAVEL) or a ship's could hand it one, and the view's line and
  flag draw whatever `tvTrip` holds.
- **Marks for anything placed on the map.** The readout's keyed marks (`marks`, `pick`,
  `edge`) take a world point and a kind: quest targets, a party leader, a world boss's omen
  (WB1's ring), a hub (HUB1) can be marks the same way the places and travellers are.
- **Travellers who say more.** The TV3 mark is seven keys and the relay refuses an eighth -
  on purpose. A later field (a guild tag's colour, "looking for company") is a new relay
  version and a new key, never a squeeze into these.
- **The weather forecast from the air.** `forecastAt` (WEATHER3) is a pure function of place
  and minute; the view could hang a system's next hour under its curtain.
- **Encounters seen coming.** The governor's unbuilt-ground count is per pixel; the same
  window could carry the foes a Travel Options journey will meet (its `enemiesNearby`).

## TV5 - SHIPPED (2026-09-28): the far places, marked at the edge

Mac, choosing between the ring-span silhouettes above and a mark: **"Edge markers"**. The
measurements behind the call: at the default tilt (52 degrees) and field of view (65) the
view's top edge meets the ground about 531 m ahead, and the horizon is in the picture only
at a tilt of FOV/2 or less - so a town's roofs past the grid would mostly be drawn where the
camera cannot see them. A mark can be seen wherever the town lies.

**What the player sees.** Every DISCOVERED settlement (a city, a town or a village - DFU's
town trio; not a dungeon, a temple or a farm) beyond the streamed grid and within
`TV_FAR_RANGE` (24 map pixels straight-line, about 20 km every way - AUDIT DEEP2 F8: it was a square, its corners 28 km off), the nearest `TV_FAR_MAX` (10) of them, as a
plate: in the picture, on the town; outside it, held at the screen's edge with an arrow
pointing its way. Its distance hangs under the name (tenths of a kilometre under ten, whole
kilometres past - the tenths would only flicker). A click on it is a journey there by the
roads - TV2's own planner and route; the journey's own end wears the flag, not a plate.
The grid's own places keep TV2's plates on the land; the far places start where the grid
ends, so no town is marked twice.

**How** (`systems/travelFarPlaces.js`, pure): `settlementPixels` gathers the world's
settlements once from the host's pixel index; `farPlaces` picks them by Chebyshev distance
(beyond the grid's radius, within the range), keeps the discovered ones (`tvPlaceSummary`,
DFU's discovery law: an undiscovered place has no name to go to), nearest first. The host
(`travelViewFarPlaces`) rebuilds the list only when the traveller's pixel or the grid's
reach changes, and a load empties it (BOOT-TDZ: declared above its readers). One pixel is
`PIXEL_KM` = 0.8192 km (MapsFile.WorldMapTerrainDim x GlobalScale).

**EDGE-DECLUTTER (2026-09-28, Mac: "Just #1").** Two towns - or a town and a rider - in much
the same direction were held at the same spot on the edge, one plate over the other and over
its click. Now the marks held at each edge keep their order along it and slide apart just
enough: down a side by their boxes' heights, along the top or the foot by their widths (the
click boxes, so no two clicks overlap). Each run of touching marks is centred on where its
marks would stand, so no arrow drifts far from its town, and each arrow still points its own
way. More than an edge holds (about ten plates down a side): spaced evenly along it, on
the screen. Measured: the readout stays inside PERF-TV's budgets (0.44 / 1.02 / 0.04 ms).

**EDGE-FURNITURE (2026-09-28, Mac: "Fix this bug").** A mark behind the camera is held at the
FOOT of the screen - and the foot is where the view's bar stands, drawn over the readout's
canvas, over the game HUD's vitals and hotbar (the HUD stays up under the view); its name hung
below its arrow, off the bottom. Roughly half of all directions are behind the camera, so many
far towns and riders were unseen (TV3's riders since TV3). At the top they sat on the compass
and, on a journey, under the travel panel (AUDIT DEEP2 E14: the stacking said right). Now the readout MEASURES what stands in the top and the
bottom half (`.hud-top`, `.hud-bottom`, `.travelpanel-bar` and its own bar; a layout read, so
at most twice a second and again each time the view opens - never per frame or per mark) and
`edgeHold` holds marks inside that clear room: a point under the furniture is held at its edge
as one off the screen is. At the foot the name and distance stand ABOVE the arrow and the click
box with them; down a side, a low mark's label is kept off the bar. The pieces' classes are
pinned against the style sheet, so a rename cannot leave a mark under one unseen. Measured in
the browser probe against the real bar - and since AUDIT DEEP2 against the HUD's real vitals
too; the readout stays inside PERF-TV's budgets. (AUDIT DEEP2 grew the measure: below.)

**Proof.** `test/tv5_far_places.test.js`, `tools/mutants/tv5.json` (the TV5, EDGE-DECLUTTER and
EDGE-FURNITURE records), `tools/travelViewProbe.mjs` (a far place held at the right edge, its
plate on the screen, a click on it a journey).

## PERF-TV - the Overworld's own frame cost, made golden (2026-09-28)

Mac: "I also want to ensure performance is golden." Measured in a real browser
(`tools/travelViewPerf.mjs`, Chromium): the update's JavaScript plus the style and layout it
owes, forced inside the timer so nothing hides in the next paint. The frame is 16.7 ms at
60 Hz; the view's own share must be a rounding error.

| The readout, a frame | Before | After | Budget |
|---|---|---|---|
| 20 places + 64 travellers, moving | 5.8 ms | 0.38 ms | 0.60 ms |
| 20 places + 256 travellers, moving | 35.7 ms | 0.91 ms | 1.50 ms |
| 20 places + 64 travellers, at rest | - | 0.05 ms | 0.15 ms |

**What was slow.** Every mark was a DOM node moved by style each frame, and each mark held
at the edge read the screen's size AFTER the previous mark's writes - a forced layout per
held mark. 256 travellers cost two frames.

**What changed.**
- **One canvas.** Every mark - dots, plates, edge arrows, the destination's ring - is drawn
  on the readout's one canvas (`ui/travelViewHud.js` `drawMarks`); each label is a sprite
  drawn once and reused (`SPRITES_MAX` 512, dropped when the display face arrives). The
  screen's size is read ONCE a frame, before any write. A picture that did not change (a
  camera at rest) is not drawn again - the frame's signature is compared first.
- **Clicks by position.** The canvas takes no pointer; a plate's click is found where it was
  drawn (`travelViewHudPickAt`, the one on top), asked by the view before it picks the
  ground. A plate held at a side edge keeps its whole box on the screen.
- **The world host keeps what did not move.** The ground's generation (`tvGroundGenNow`:
  a pixel built or dropped, the floating origin re-anchored, and every half second besides)
  keys: the marks' scene points (`tvSceneKept`), the route's legs past the one being walked
  (hundreds of terrain reads a frame on a long road), the cap's unbuilt count, and the rain
  curtains' lowest land. The curtains ask the land only under the veils kept
  (`CURTAINS_MAX`, not every raining cell in reach), and a veil is asked again only when its
  centre drifts into a new `CURTAIN_MEMO_M` (32 m) cell.

**Proof.** `tools/travelViewPerf.mjs` (the budgets; exits 1 on a blown one),
`test/tv5_far_places.test.js` (the screen read counted, the redraw skipped at rest and taken
on a move, the click boxes, the curtains' samples counted), `tools/mutants/tv5.json` (the
PERF-TV records).

## AUDIT DEEP2 - the whole branch again, six reviewers, before the merge (2026-09-28, Mac: "Do another deep audit on everything before we decide to merge")

Six read-only reviewers, one a lane (the view and its input; journeys; the region's
travellers online; rendering under the raised camera; the readout, TV5 and PERF-TV; the
records), each finding verified by reading and most reproduced in a scratch script, the
browser's among them. About sixty findings; every one below fixed, pinned, and each pin made
to fail (`tools/mutants/tv1.json`..`tv5.json`), or weighed and left, said why.

**The one HIGH (E1).** The Overworld's own bar sat ON the HUD's health, magicka and fatigue at
every screen size - same layer, built after them, so it painted over them: the vitals could
not be read while the view was up. And on a phone the touch layer's buttons stood over its
Return (E2). The bar is now LIFTED clear of what stands under it - a band across its middle
(the vitals, the buttons mid-foot) and anything under its Return; never a corner block its far
end only reaches (on a narrow phone that put it mid-screen) - measured with the rest of the
furniture (`measureFurniture`), and it takes its own clicks (E13: a press missing Return by a
hair walked the traveller to ground hidden under the bar). The probe now stands the HUD's own
vitals up and checks both. On a narrow portrait phone the bar still covers the quick-slot
diamond's lower cells - weighed: the alternative was a bar mid-screen over the picture.

**The readout** (E3-E15, F11): the furniture grew to the quick-slot block, a journey's junction
disc and a phone's buttons, sorted into BANDS (middle third: the marks at that edge stand clear)
and CORNERS (a side third: the marks along that edge stop short; a side's own marks stand over
it); the two bands of an axis shrink together only past three quarters of the screen (E6: a
per-band cap put the marks ahead inside a phone's travel panel); a bar whose words change is
measured again the next frame. EDGE-DECLUTTER's lone mark is clamped before it is weighed (E3,
a regression of EDGE-FURNITURE's); a mark on the top or the foot whose box reaches a side's
line stands on that side (E4: the corners were never parted); every run's boxes stay in their
stretch (E8). The arrow is notched (E5: a near-equilateral head read the same turned a third);
a far town in the picture wears its distance above its dot (E9); labels in the --data face
(E11); the sprite cache drops its oldest one at a time (E12: a clear redrew every label in one
frame, 3-4 ms); a lifted finger leaves no hover (E10); the drawn places are said in words to a
screen reader (E15, a visually hidden list, written when the set changes); a NaN mark is placed
nowhere; the screen is read once, before the frame's writes (F11). The Plus gauntlet stays the
one cursor over a plate (E10 - Plus's own law; the plate lights brass instead).

**The view's input** (A1-A9): the travel panel's own presses stop there (A1: a click on + or
Exit also activated what stood before the traveller's head); a pad is a cursor under the view
and the world's activation and swing are never pressed from under it (A2); an enhanced overlay
over the view (the Tab dial) has the keys, and the fall never relocks under it (A3); the wheel
zooms by its size (A4: a trackpad crossed the whole band in a flick); the key never repeats,
nor Escape past the fall (A5); a repeat of a key held before the rise is the host's (A6); a lost
focus holds nothing (A7); the bound key answers indoors (A8); a live duel refuses the view and
its clicks (A9/B-4).

**Journeys** (B-1..B-6): a far town's journey keeps its destination - the flag is held at the
edge with its distance, and a click on it takes the journey up again after a stop (B-1); the
governor counts every ring of the grid but its edge, always, and a second cut waits 2 s
(`TV_GOV_SETTLE_S`) for the first to show (B-2 - reviewer B's toy of the host's own queue: the
reach measured down the top edge's middle missed the corners, and one pixel building took x40
to x1 inside a second; V2 at 2 s left no hole on the screen at 0.4, 0.6 and 1.0 s a build, the
best clean average of the variants tried); the place caches key on what is discovered (B-3);
water is where the click landed, against the sea's own height (B-5); the planner widens its box
until no route outside it could be cheaper (B-6: 6.6% of real trips cost more than they should).

**Online** (C1-C5; relay world122 rewritten in place - still undeployed): a clear with no mark
behind it is metered as a mark (C1: a free flood); a clear over the room's budget is OWED and
said on its next pass (C2), a new mark or a leave making it moot; the client's gate takes twice
the room's burst (C3: a bunched room dropped honest marks); a Region link that moves empties the
book (C4); the switch's words say the region's channel, not the party's pose (C5); a welcome
never lists a socket already closing.

**Rendering** (D1-D9): the veil stands in its storm's own outline and weighs its front's clip
across the rim, as the sky's does (D1: a circle, and a clip that shrank a storm to a 50 m
column); the view follows the floating origin (D2: a lurch at every pixel crossed, 37 m at
400 m/s); the veils stand under the cells the sky draws (D3); the sea clamps a veil's foot at
every point (D4); an undrawable veil takes no slot (D5); the riders and walkers take the view's
eye (D6); the cascades grow half way up, not on the rise's first frame (D7); a door resets the
flats' lean (D8); the chord's plane is said (D9).

**The records** (F1-F15, E14): probe counts, test titles and rows, four mutant notes, the
patch notes' promises (the band, the shadows' reach, "only when the land changes", the Enhanced
map's door, the 20 km), the stacking claim, the memo's step, TV3's cadence - each said true.
Five order pins that passed on a missing line (`indexOf` of -1) now demand both lines.

**Left, on purpose (each weighed):**
- Marks are not refused off the room's region (a lying client can put its mark anywhere on the
  bay): the name is the token's, so no harm beyond a wrong dot was shown; the receiver could
  filter by the political map later.
- The book can grow past the welcome's 256 in a very busy region (to the channel's 2048): PERF-TV
  measured 256; a draw cap waits on a region that busy.
- Id squatting in a region's channel (a peer id read off the world roster) predates this arc
  (CHAT1); its own slice.
- `clearView`'s lift on a 70-degree face 2 km tall doubles the face's height (A-S1): no real
  Daggerfall face is that long at that slope.
- The chord across the ground plane (D9), and the air's haze marched from the raised eye (D-S3,
  estimated three display levels or fewer).

**Proof.** `test/tv1_travel_view.test.js` 30, `tv2_click_to_move` 21, `tv3_travellers` 21,
`tv4_weather_above` 11, `tv5_far_places` 16; `tools/mutants/tv1.json` 80, `tv2` 47, `tv3` 45,
`tv4` 36, `tv5` 61 - all dead; `tools/travelViewProbe.mjs` 35 checks (the HUD's vitals among
them); `tools/travelViewPerf.mjs` inside its budgets.

## OVERWORLD NAMES - every player named as in play (2026-09-28, Mac: "Full, like in play")

Mac asked whether players' names, titles and party names show in the Overworld as they do in
play. Read off the code, they did not, in two ways:
- **The players nearest had no name at all.** TV3 left a player within the pose range
  (`RANGE_PIXELS`: 3 map pixels, floored to the pixel - up to about 3.3 km along an axis) to their
  body, "named over their heads" - but the names over the heads are culled past `NAME_RANGE` (60 m)
  from the frame's EYE, and the view's eye stands 40-780 m back from the traveller (its height over
  the tilt's tangent; about 200 m as it opens). So a party travelling together - the common case -
  was, but at the steepest and lowest, a handful of unnamed specks.
- **The far ones wore a bare name.** The relay stamps a traveller's mark with the title, the
  glyphs, the Renown and the guild's tag (`badged`), but the client's door read the title and the
  glyphs alone (`readBadge`), and the marker drew the name alone.

Now EVERY player drawn here - within the pose range, their bodies standing, the concealed and the
veiled never (`online.drawable()` less `_hiddenPeers` and `_veils`, as this frame's `onlineFrame` sifted
them) - is a marker over their head as the region's travellers are, held
at the edge off the picture; the names over the heads STAND DOWN while the view is up
(`drawPeerNames`: one name a player, never two - and with them the chat bubbles over the heads:
under the view a line said nearby reads in the chat log alone); and every player's marker is their name as it
reads in play (`badgeSprite`, off `ui/playerBadge.js`, `net/renown.js`, `net/guildLaw.js` - the
same law both name faces read): the title its own line ABOVE in its own colour (a gradient title
across its letters; never the party's green - ACC3), then one row centred - the Renown in its amber
box, the name (my party's in `PARTY_GREEN_CSS`, a stranger's the bone), the guild's tag in steel,
the glyphs in theirs. The traveller frame now reads the Renown and the tag at the door
(`readRenown`, `readGuildTag` - a bad one is nothing) and the book keeps them. A badge that changes
at rest is drawn again (the picture's signature carries it). The held map keeps names alone.

**The audit (AUDIT NAMES, 2026-09-28).** Four more, each pinned and each pin made to fail:
- **N2-1 - the badge never reached the readout.** `drawHud` (scenes/travelView.js) rebuilt each
  mark field by field and left `badge` behind, so in play every marker was the bare name; the
  readout's own test had called `updateTravelViewHud` directly. It carries the badge now, and the
  test drives the real `createTravelView` through `drawHud`.
- **N2-2 - THE SWITCH HOLDS.** A player within the pose range is named wherever they stand only
  when they are of my party or the region already has their mark (they share where they are with
  it). One who shares nothing ("Show me to travellers in my region" off) is named only as close as
  play names them - `NAME_RANGE` from where I stand - and never held at the edge: the switch's
  words ("only your party and players close enough to see you know where you are") stay true.
- **N2-3 - the invisible share nothing.** The region's mark was sent while I was concealed
  (invisible, blending, a shade), though within the pose range no concealed player is marked; the
  switch's gate (`shown`) now reads `concealBits`, and the clear goes the frame it takes.
- **The journey's arrow** - a player on a journey who comes within the pose range keeps the arrow
  their region mark wore (its `tv`).

And the marker's face, measured in a browser with the real fonts (N1):
- **N2-4 / N1-7 - over the head, and clear.** A player's name in the picture stands OVER their
  head (NAME1: never across the body it names - it hung under the point, over the body), its foot
  `NAME_ABOVE` (8 px) up; and a party side by side (heads 1.5 m apart are 2-7 px at 1080p) wears
  its names STACKED, each moved up past the ones drawn before it (`clearOfNames`, in the marks'
  own stable order) - they printed one over another.
- **N1-1 - no stall.** A busy region's first frame (or a font arriving, which lets every image go)
  made every badge at once, 70-175 ms at 256; now `BADGE_BUILDS_PER_FRAME` (16) a frame, the rest
  their bare name meanwhile, and the picture drawn again until all are made.
- **N1-5 - the box is the badge drawn.** The layout estimated a badge's width 30-75% wide: a
  titled player ahead on a phone was sent to a side, two that fitted were spread evenly across
  each other. The badge is made (or found) before the layout and its own size is the box.
- **N1-6 - the corners.** The top and the foot are spread first, and a side's run starts under the
  top's labels (ends over the foot's) that reach into it - a titled label at the top lay across
  the side's first name.
- **N1-2/N1-3/N1-4 - the face as in play.** The gradient title (Shadow Fang) is painted as the DOM
  face paints it (`titlePaint`, AUDIT A4/A5) - no blurred shadow, an edge of its own colour and
  black under the gradient - where "Sh" was unseen on dark ground; the wolf's red eye
  (`GLYPH_DETAIL`), the stroked glyphs at the name face's 1.6, the Renown under the row's shadow;
  and the badge in the face names wear in play (`PIXEL_STACK`).
- **N1-8 - memory.** The kept images are capped by their pixels (6 M, ~24 MB) as well as their
  count: 512 badges at a phone's dpr 3 came to ~95 MB.
- **N1-10** - the region's travellers' party colour asks `isPartyPeer`, as play's names do: my
  own other tab is never my party's green.

Measured after: 64 moving 0.33 ms, 256 moving 1.39 ms, 64 at rest 0.05 ms (budgets 0.60 / 1.50 /
0.15; `tools/travelViewPerf.mjs`).

**Proof.** `test/tv3_travellers.test.js` (the wire, the book, the host's marks and the names
standing down), `test/tv5_far_places.test.js` (the marker's face: the title above in its colour,
the Renown amber, the party's green, the tag's steel, a stranger's bone, a title won at rest
redrawn); `tools/mutants/tv3.json` and `tv5.json` (the OVERWORLD-NAMES records).

## Open, for Mac

All three were DECIDED AS LEAD on 2026-09-28 (Mac: "Your the lead and this is your baby"),
each one line to change:

- **The name** - "Overworld" to the player, TRAVEL VIEW in the code (TV1).
- **Being seen** - the switch, on by default, nothing on the region's channel from indoors (TV3; the party's own pose still rides from indoors, as it always has - AUDIT DEEP2 C5).
- **A second door** - the `TravelView` action, shipped unbound; the map stays the door (TV1).
