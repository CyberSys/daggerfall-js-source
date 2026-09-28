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
"every detail like weather patterns, should be 1:1" puts TV4 there. TV5 follows.

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
  `TravelView` action (KB1: appended, Windows group, shipped UNBOUND).

**The numbers, and why.**

| Law | Value | Why |
|---|---|---|
| Height band | 150-450 m, default 260 | Mac's call 1; 260 frames a town and its gates |
| Ceiling | cloud base (VC_PROFILE[weather].base) less 60 m, floor 40 m, none = 450 | "Below the clouds" - the deck the sky really draws; a lid weather still leaves a view |
| Tilt | 30-75 degrees down, default 52 | the design's 45-60 widened so a drag can look out to the far ring or straight down on a town |
| Clearance | 25 m over the ground under the eye AND over a ridge halfway to the traveller | the eye never inside a hill, the traveller never behind one |
| Focus | eased at rate 10; a move past 60 m taken whole | a fast travel or respawn is a cut, never a sweep over unbuilt leagues |
| Rise / fall | 1.2 s / 0.8 s, smoothstepped from the head's own eye | out of and back into the body's camera, whichever mwView answers |
| Flats | leaned back by HALF the tilt, pivoting on their centre; shadows upright | full tilt lies them face-up; half keeps a readable silhouette from 450 m |
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
  frame's real eye, which is now the raised one; the rain, the grass, the streaming and the
  weather sample stay on `cam.pos`, which never left the traveller. Grass is not drawn
  from the air (under a pixel at 150 m).

**The way in, and every way out.** In: the map's button, KeyO on the sheet, or the
`TravelView` key if bound. The gate (world.js `travelViewAllowed`): the enhanced lane, a
walking body in the open air, alive, above the water - each refusal said on the notice
line; a foe near refuses as the map's own travel does. Out: Escape (through the
registry, never reaching the pause), Return, the key again; a window opening, a door out
of the open air or a death CUTS it at once; a foe near brings it down.

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
`tools/mutants/tv1.json` (17 dead), and `tools/travelViewProbe.mjs` (20 checks in a real
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
today. The held map draws the same book - a smaller verdigris ring under the party's, and a
legend row.

**Being seen - decided as lead.** "Show me to travellers in my region" (`showToTravellers`),
ON by default, on the Mods screen's Other players card, the player's own say online (never
forced by the room). Off: only the party (its own marks) and players within the pose range
(their own eyes, as today) know where they are; they still see those who show themselves. Nothing is ever sent from inside a building or a dungeon.

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
thin at its rims (measured in real GL by the probe); fogged from the traveller; thinning to
nothing as the eye comes over it (the rain the traveller stands in is their own particles',
VC7c's `near`). The cells are `fieldCellsHere()` - the ones the clouds draw. One foreign pass
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

## TV5 - DESIGNED, MEASURED, NOT BUILT (2026-09-28) - and the stage for what comes next

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

## Open, for Mac

All three were DECIDED AS LEAD on 2026-09-28 (Mac: "Your the lead and this is your baby"),
each one line to change:

- **The name** - "Overworld" to the player, TRAVEL VIEW in the code (TV1).
- **Being seen** - the switch, on by default, nothing from indoors (TV3).
- **A second door** - the `TravelView` action, shipped unbound; the map stays the door (TV1).
