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
  (`uFocus`, w 1 set, w 0 the camera) that the fog and the sun's cascades measure from.
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
  take the same focus - one uniform, not two.
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

**The input.** While up the view owns the canvas on the window's CAPTURE phase: a click
is a pick (TV2's seam: `onPick(x, y)`), a drag orbits and tilts, the wheel zooms, the
right button and the context menu never reach the host. The look keys turn the view,
not the traveller. Movement keys walk the traveller camera-relative (the traveller
turns toward the input at 6 rad/s the short way) while no journey drives. The DOM
beside the canvas keeps its own events.

**Proof.** `test/tv1_travel_view.test.js` (17), the heldmap door pin (+1),
`tools/mutants/tv1.json` (11 dead), and `tools/travelViewProbe.mjs` (20 checks in a real
browser on a synthetic valley - CI has no ARENA2 - including the fog and shadow
discriminations read off pixels, real pointer events, and the bar on a phone).

**Decided as lead (was "Open, for Mac").**
- **The name:** "Overworld" to the player (Mac's own word); TRAVEL VIEW in the code, so
  it never collides with the code's `overworld` (the map pixel grid, U61's retired
  scene).
- **A second door:** the `TravelView` action exists and ships unbound; the map stays the
  front door. A player who wants a direct key binds one in Controls.
- **Being seen:** decided at TV3 (below), with the switch on by default as proposed.

## Open, for Mac

- **The name** on the button and in the Controls.
- **Being seen.** Region-wide marks show strangers where a player is travelling, and
  today a stranger is only seen within 2.5 km. Proposed: a "Show me to travellers in my
  region" switch, on by default, with the party always seeing each other as now. Also
  proposed: nothing sent from inside a building or dungeon.
- **A second door.** Proposed: the travel view is reachable only from the map, so it
  stays "a map mode"; a direct key from play is available if wanted.
