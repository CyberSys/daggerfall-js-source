# FIELD BUGS 2026-10-01 - the rain in a puddle, the sprinkle, the square clouds, the sea from under it, the slow frames, the Overworld's weather and its players

Two lists through Mac, the second added while the first was being worked: eight lines on the rain, the clouds, the
sea and the frame rate, then three on the Overworld. The batch's rule is the one Mac set on 2026-09-30 ("I dont care
about DFU. We're our own thing now"): each report root-caused on the real modules, and fixed wherever it failed the
player - three of the fixes are departures from Iliac Puddle No More's own presentation and are in the Port-Ledger.
Eleven reports; every fix pinned red on the code before it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "When sinking into a puddle rain isnt shown and disappears from screen" | the port swims wherever the drawn water is under the feet (MAC2), a puddle record's whole tile among it, and DW-D stood the rain, the snow and the sand down for any swimmer outdoors - the mod's UpdateWeatherParticles - so a body sunk in a puddle, its eye 0.2 m over the water, lost them while the rain loop played on | fixed (PUDDLE-RAIN) |
| 2 | "Rain shouldnt always be a downpour, should sometimes sprinkle" | WX2 rolled a rain's peak in 0.25..1, and on the weather map's lane the place's intensity (0.2..1 over a system's core) was the roll, so no rain drew under ~0.4 of the profile; and whatever fell, the world wore the downpour's row - its fog, its sun, its grass | fixed (RAIN-SPRINKLE) |
| 3 | "Clouds in the distance sometimes look square" | the volumetric clouds' sky map, a third of a degree a texel (6 to 23 screen pixels), read by ONE bilinear tap, each texel marched from its own jittered start: a far cloud a few texels across was soft squares and diamonds | fixed (CLOUD-SQUARE) |
| 4 | "Underwater should have a water look to it, not as clear" | under Iliac Puddle No More's sea the mod's distance fog leaves a pixel at the eye untouched and takes ~2% of its red a metre over a 66.5 m vision; the world fog is a thin neutral grey; nothing tints the water body | fixed (UNDER-LOOK) |
| 5 | "Underwater should have sun rays that dynamically show through the water" | nothing draws any | built (UNDER-RAYS) |
| 6 | "Sometimes performance issues when along the coastline" | see below | see below |
| 7 | "Sometimes performance issues when looking at AI ships" | see below | see below |
| 8 | "Culling performance issues when using the morrowind model and around a large group of players" | after WB9h's budget: a body the view swung onto past the 2 m margin was skinned in the draw, outside the budget (a crowd turned onto, posed whole in a frame); every pose walked its skin for a sphere nothing read; a stand-in built per body per frame; a weapon drawn rebuilt the body, and a lingering body's rig was thrown away | fixed (MW-CROWD); the sprite pass per body left open |
| 9 | "Also in the overworld, weather is weird, it only happens around the player at small scale" | the rain's, the snow's and the sand's boxes (42-70 m) and the wind's wisps wrapped round `cam.pos` - which under the Overworld stays on the traveller's head while the view stands 150-450 m up and back: a little cube of weather round the sprite, seen from outside it | fixed (OW-WEATHER) |
| 10 | "Your sprite doesnt rotate based on direction" | the keys turned the body to the VIEW's heading and walked it camera-relative from there, so it showed its back whatever was held - S walked it backwards at the camera, A and D sideways - and the sprite's eight views and the Morrowind body never turned | fixed (OW-FACE) |
| 11 | "and you cannot see other player's sprites" | the traveller's own body is grown with the eye's distance (OW-BIG); every other player stood at their own size - a speck at 330 m under the name that stood over them | fixed (OW-PEERS) |

Pins: `test/fb1001_{puddlerain,rainsprinkle,cloudsquare,underwater,overworld}.test.js`, each file red on the code
before (the four that import what this batch exports fail to load; `puddlerain` fails both tests on the old gate).
Mutants: `tools/mutants/fb1001_*.json`. PIN MOVED, each by content: `dwc_fog` (the gate's line), `weatherfront`
(four seeded floors of 0.1 restated against the episode's own peak - a seed may roll a sprinkle now - the hosts'
terms line, and the Rendering entry's and the Ledger row's quoted ranges), `wind3_windworld` and `weather2d_sandstorm`
(the world host's weather eye), `mwbody1`, `htwaistback`, `hitflash1`, `werewolf1` and `disc23b_eotb_sprites` (the
peer layers' option lists and the body hook's).

## PUDDLE-RAIN: what falls is hidden by the water over the eye (1)

**Reproduced first** (the real `exteriorSurfaces`, `exteriorSwimming` and Deep Waters' `fogPresentation`; the frame's
gate lifted off world.js and run): every puddle record (`SHALLOW_WHOLE`, 8 23 33 34 35 36) answers Swimming under
the feet anywhere on its tile (WATER-PUDDLE kept the feet on DFU's whole tile), the motor sinks the body (the eye
0.20 over the feet), a sunk body is IsPlayerSwimming, and the sea's own fog says an eye 86 m over the sea inland is
not under the water. The old gate - `_dwAirOff || (dwPlayer && walkMode && isPlayerSwimming && !waterWalking)` -
answered "hide" for it; the rain and the sand stopped drawing, the rain loop kept playing (the ear never read the
gate). The classic lane without the sea mod never hid it, and the fixed-city host (`exterior.js`) has no such gate.

**The fix** (`scenes/world.js`): `_dwPrecipOff` is `_dwAirOff` - the distance fog's "under" (the water over the
eye), which already took the wisps and the bolts. Under the sea the rain is still hidden, swimmer or not; a swimmer
with the head out of the sea sees the rain, as does a body in a puddle. A departure from the mod (Port-Ledger).
`test/fb1001_puddlerain.test.js` (2), `tools/mutants/fb1001_puddlerain.json` (4, all dead).

Found on the way, not changed: a puddle still SWIMS the body (MAC2's coverage law on DFU's shallow records) - no rest
there, no encounter roll, the swim's speed and tally, SWIM-SPENT's drain; that a puddle should not sink the player at
all is MAC2's call and Mac's to make.

## RAIN-SPRINKLE: a rain drizzles at its edge and pours at its heart, and looks like it (2)

**Measured first** (the real front, `rollPeak`, the weather map's band law): over a rain system's core, sampled
evenly by area, the drawn share at the wander's mean never fell under 0.32 of the 26,000-drop profile; the seeded
lane's floor was 0.25 x 0.6. And `blendTerms` crossed to the rain row whole once the front was in - exp fog 0.003
(half the land gone at 230 m), the sun at 0.45, the grass at 0.6 - for a sprinkle as for a storm, which is what
read as a downpour whatever the count.

**The fix** (`systems/weatherFront.js`; both exterior hosts): the ranges are rain 0.05..1.0 and snow 0.05..0.85
(a storm 0.6..1.0 and a sandstorm 0.5..1.0 as they were), the roll placed by u^skew (rain 2, snow 1.5) - on the map's
lane the place's intensity is the roll, so a system's edge drizzles and its heart pours: over the core, by area,
nearly half the ground falls under 0.3 of the profile and a quarter under 0.15, and a downpour (0.65 and up) is its
heart, an eighth of it. And `fallTerms`: under FALL_LOOK
(0.05..0.6 of the profile) a rain's or a snow's fog thins to a quarter of its row's density (the mode kept, so no
switch on the screen) and its sun and grass come up to an overcast sky's; any other word is handed back as it came.
Enhanced only, as WX2 is; the classic lane still draws DFU's cap on the sim's word. `test/fb1001_rainsprinkle.test.js`
(2), `tools/mutants/fb1001_rainsprinkle.json` (7, all dead).

## CLOUD-SQUARE: the sky map read through a B-spline (3)

**Seen first** (the sky lab in a real browser, `?clouds=lo`, a cloudy row at the horizon, before and after, the
horizon band magnified four times and stretched): the one tap's texel grid - diamonds and squares along the far
band - and the B-spline's rounded field over the same marched texels. The composite's own function run in JS over a
hardware-bilinear stand-in: the one tap's slope jumps by 2 a texel at a texel's centre (one bright texel in a dark map); the
B-spline's by a thousandth of that, there and everywhere across the cloud.

**The fix** (`render/volumetricClouds.js` `COMPOSITE_FS`): `mapBicubic`, a cubic B-spline over the map in four
bilinear taps, wrapping in azimuth and clamping at the rows as the one tap did. `test/fb1001_cloudsquare.test.js` (2),
`tools/mutants/fb1001_cloudsquare.json` (3, all dead).

Investigated, not changed: a weather cell's column in front of the deck spends part of the march's 24 km budget, so
behind a cell the deck is walked a shorter way than beside it. Measured with the march's own functions (test/
cloudSky.mjs), a cell's own profile replaces the deck's over its disc, and walking the cell's metres on top of the
budget moved the deck's colour behind it both ways - closer to the bare sky in one case, further in others - so it is
not the square, and it stays as SLAB-SPAN left it. The variation channel's 512 m texels (`VARIATION_M`, read at
level 0) were not changed either: nothing showed them as the square.

## UNDER-LOOK and UNDER-RAYS: the sea looks like water from under it (4, 5)

**Why it read clear** (the mod's numbers at its sliders' defaults, `world/deepWaterLook.js`): a 66.5 m vision; ~2.7%
of the red absorbed a metre; a grey at 0.5 kept as (0.44, 0.47, 0.47) at 5 m; nothing at the eye; the world fog a
thin neutral grey (0.02); the sun's key light untouched under the water. No caustic, no shaft anywhere in `src/`.

**The fix** (`world/underwaterLook.js`, `render/deepWatersRender.js`, `world/deepWaterLook.js`, `scenes/world.js`):
- THE MURK: the mod's vision distance times `UNDERWATER_MURK` (0.55) - `distanceFogUniforms`' new `murk` (1 is the
  mod, number for number), so the absorption and the scatter a metre, the bands and the sky's distance all follow and
  the sliders scale it as before.
- THE BODY: over every pixel the world drew while the eye is under the sea, c x keep + body - keep (0.66, 0.86, 0.88)
  at the surface to (0.26, 0.48, 0.55) at 40 m, a touch less by night; the body's light (0.016, 0.075, 0.085) by day,
  a fifth of it by night, less deeper.
- THE SHAFTS: the sun bent at the surface (Snell, n 1.333), and each point along the view out to 24 m (or the surface)
  lit by the surface point its light came in at, through a drifting two-octave pattern of the surface's focus -
  fainter with distance along the view and with depth, by e over 28 m of the eye's depth, scaled by the frame's sun
  (the weather and a cloud over the sun in it), none by night.
One full-screen triangle drawn twice (multiply, then add, alpha kept) after the arrows and before the weapon and the
HUD, on either skin; no depth is read (no program of every lane can), so the shafts are the near water's. Seen in a
real browser over a synthetic seabed: the blue-green body, the far floor closed sooner, the shafts leaning with a
morning sun, converging looking up, moving between t 0 and t 4. `test/fb1001_underwater.test.js` (5),
`tools/mutants/fb1001_underwater.json` (12, all dead).

Not in it: dungeon water (DFU's own UnderwaterFog, dense already) and the wilderness's lakes (no exterior submersion
exists - the eye never goes under them).

## OW-WEATHER, OW-FACE, OW-PEERS: the Overworld (9, 10, 11)

**OW-WEATHER** (`scenes/world.js` `wxEye`): the sand, the rain, the snow and the wisps wrap round the eye the view is
drawn from - `mwv.eye`, the view's own under it, the head's on the ground - so the air in front of the camera is full
of what falls, as it is when you stand in it. The streaming, the weather sample and the grass stay on `cam.pos`.
Travel Options' AllowWeather (off by default) still hides the rain and the snow on a journey, as the mod does.

**OW-FACE** (`player/travelCamera.js` `keysHeading`, `axesToward`; `scenes/travelView.js` `steer`; `scenes/world.js`):
the steer turns the body toward the way the keys point from the view, and the host turns the keys' vector onto the
body before the motor reads it - the walk is the keys' way from the view at every facing (TV1's camera-relative law,
unchanged), at the keys' own speed, straight ahead once turned. The sprite's eight views, the Morrowind body's walk,
the chevron and the pose sent to the others follow the heading. A journey or the autopilot drives as before.

**OW-PEERS** (`scenes/world.js` `peerGrow`; `net/peerRiders.js`, `net/remotePlayers.js`, `net/peerBodies.js`): every
other player is grown by the traveller's own law at their own feet (`tvOwnGrow` of the view's eye to them) - riders,
beasts and walkers (size, offset, reach), dolls and class sprites, Morrowind bodies (`drawThird`'s `grow` and the
view's lean, culled by their grown reach); names over the grown heads; no giant's shadow; no walker's lantern.

`test/fb1001_overworld.test.js` (5), `tools/mutants/fb1001_overworld.json` (12, all dead).

## The frame rate (6, 7, 8)

### MW-CROWD: the crowd's bodies, turned onto (8)

**Read on the code after WB9h** (no GPU here to measure; `07-Rendering/Performance-Rig.md` MW-CROWD carries the
numbers): WB9h held the crowd's skins to SKIN_BUDGET (4) a frame and culled them by the view, deciding on the LAST body
pass's view with a 2 m margin - about 11 degrees of lead at 10 m. A body the view swung onto past it arrived stale and
was posed in the draw, outside the budget: at 300 degrees a second and 30 frames, a crowd turned onto posed whole in one
frame, a CPU skin and a whole re-upload each - the hitch of turning round in a crowd. Beside it, every pose walked the
skin twice for a sphere only the shadow recorder reads (the sprite target never casts); every stepped body built a whole
stand-in entity every frame for the weapon it holds; a weapon drawn tore the body down and built it again; and a body
whose peer mounted or left the list a moment was thrown away and built again on its return.

**The fix** (`net/peerBodies.js`, `render/renderer.js`, `combat/fpArm.js`): the margin leads the turn
(`turnLeadMargin` - the angle the view turned last frame, three frames of it at the body's distance, capped), so the
bodies about to come into view are skinned on the budget before; the third-person mesh has no sphere to walk
(`bounds: false`); the weapon asked of a look is one object; a person's body key is its look less its weapons (the
hand is `setWeapon`'s); a lingering body is kept as a spare. `test/fb1001_mwcrowd.test.js` (4),
`tools/mutants/fb1001_mwcrowd.json` (8, all dead). PIN MOVED: `wb9h_crowd_bodies` (the lingering body kept),
`audit_wb9` (an armor change rebuilds, a weapon no longer does), `werewolf1` (the person's key); `wb9h.json`'s
WB9h-the-linger-spared retired (it is the law now; MW-CROWD-the-lingering-body-unloaded is its inverse), nine older
records re-aimed by content.

Still open: the sprite render is one offscreen pass a seen body a frame - batching every seen body into one bind of
the target, or keeping each body's picture across frames, is the next slice, and it needs a GPU (above all a
tile-based one) to measure. For the reporter, `?perf=cpu`'s `online` and `bodies` spans and `?perf=zones` say which.

(#6 and #7: in progress)
