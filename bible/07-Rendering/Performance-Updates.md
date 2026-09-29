# PERF-UPD — "performance seems to be worse after some updates" (2026-09-29)

*Mac: "Can we look into increasing performance? I'm recieving reports after some updates, performance seems to be
worse and I want to be detailed in my approach to fix everything".*

The reports this answers, as the field pages recorded them: SCRIPT-SPLIT's two counters outdoors (09-26, script 107.5
and 203.6 ms), FIELD 2026-09-26c's "ship encounters you drop to 1 fps", Regi's "FPS are TANKING when my character loads
into the outdoors" (`01-Overview/Field-Bugs-2026-09-28e.md`, in frame 63.8 ms) and Skeptikali's dungeon at 99.9% CPU
(`01-Overview/Field-Bugs-2026-09-28f.md` DISC29-D). The updates they followed, by the merge that put each on `main`:

| merged | PR | what |
|---|---|---|
| 09-24 18:17 | #373 | Retro mode |
| 09-25 17:42 | #390 | the Sea Update's deep sea (Iliac Puddle No More, the fish, the sunken loot), Warm Ashes - Ships |
| 09-28 12:02 | #413 | Come Sail Away, There's a Hole in the Bottom of the Ocean |
| 09-28 12:39 | #419 | the Travel View (the Overworld) |
| 09-28 15:37 | #421 | Raiding Parties |
| 09-29 09:02 | #437 | Improved Interior Lighting (only with its `.dfmod` attached), texture mods |

## How the pass was run

The REAL game, measured - not a harness. Headless Chromium (the provisioned chromium-1194) on SwiftShader, over the
freeware ARENA2 (`sh tools/fetch-data.sh`, outside the tree), driven by probes in the session's scratch. Every scene is
the world host with the player standing (`?world&...&shot&play` - `?shot` alone turns the motor off, and with it every
system gated on walking), the settings a fresh profile's, 480x270.

- **Script time is measurable here, the frame rate is not.** SwiftShader draws a frame in about a second, so the frame
  rate is the software GPU's; the main thread's JavaScript is the game's, and it is what these numbers are. What the
  counter calls `before` is NOT the game's here: every JS callback outside the host's frame totals ~0.2 ms (the FPS
  counter, the draw watchdog, audio callbacks; the music pump is ~3.6 ms a SECOND), and the rest of `before` is the
  headless compositor's own readback (SCRIPT-SPLIT's audit names it).
- **Three instruments.** A CPU profile per scene (V8's sampler, 0.2 ms), attributed per function and per caller; an
  exact CENSUS of every WebGL call, `URLSearchParams`, `localStorage` read and DOM creation a frame (counts are
  machine-free, so they are what the pins hold); and a sampled heap profile for the allocations a frame.
- **Two probe-only transforms, the tree untouched.** The stream's build slice (6 ms a frame) paces the BOOT at ~1 fps,
  so the probes serve `buildBreather.js` with a 250 ms slice - a settled scene streams nothing, so no measured frame
  changes. And the grass field fills 2 cells a frame by design: a ~3 s transient at 60 fps that at ~1 fps ran through
  every measurement window (it read as 1.2 ms a frame of grass in a town that was still filling - no evictions, no
  invalidations, no frees: 280 of 394 slots and 80 cells still wanted). The probes let it fill at once and wait for it.

## PERF-URL — the page's query, parsed once a search

**Measured.** The census of a settled town (Knightstale, rain, 15:00) counted **84 `URLSearchParams` minted a frame**:
54 by the online lane's `isOnlinePage` (every `getPref` asks it for the forced keys, every `modSetting` once or twice),
24 by the skin's `skinOverride` (whatever draws asks `isEnhanced()`), and one or two each by the combat visuals', the
wind audio's, the blood marks', the wisps' and the first-person lighting's kill doors. A parse is ~4.5 us in headless
Chromium on a quiet CPU; 84 of them are ~0.4 ms of every frame, for an answer that cannot change while the page is open.

**Why it kept coming back.** PERF-SUN (2026-09-19) paid this exact cost for ONE door - `swayDisabled` in
`systems/windDrive.js` keeps its answer until the search string changes (`cullDisabled`'s shape) - and every door
written since was written the old way again, because the fix lived in one file. There was no shared parsed view of the
page's query to reach for.

**The fix.** `systems/pageQuery.js`, the one home: `pageParam(name, search?)` and `pageHas(name, search?)` over one
parse, keyed on the search string they READ. Not a latch: the boot publishes the params it decided to the URL
(`publishBootParams`, MAC-N3) before the world boots, and a latch read before that would answer the menu's URL for the
whole session - the bug MAC-N3 fixed. Every other change to the URL in this port is a navigation, which starts a new
page. The parsed object never leaves the module, so no reader can edit what the next reader is served (`main.js` keeps
its own `URLSearchParams` for the boot, which it does edit). Twenty-four reads in nineteen files go through it - the online lane, the skin,
the UI pack, the air and contact doors, the shadow cache, the light clusters, the lighting, haze, volumetrics and
exposure doors, the ground tier, the water, the wisps, the wind audio, the blood marks, the first-person lighting, the
combat visuals, the lighting mod's test door, the dungeon map, the fonts, the window motion and the world's grass door.

**Held by count, and by a sweep.** `test/perfurl_doors.test.js` (4): a thousand reads of one search mint one parse;
eight of the frame's doors a hundred times each off one search mint one; the boot's published URL is the answer the
moment it lands; a window's own search is read, not the page's; and `new URLSearchParams(` appears in `src/` only at the
home, `main.js`'s boot params, `realmBootSearch`'s builder, PERF-SUN's own sway memo and the once-a-page latches
(`renderScale.js`, `weatherSim.js`'s four), each allowance counted so a stale one reddens. `tools/mutants/perfurl.json`:
8 mutants, all dead. After it the census counts 0 parses a frame in the same town, and the same 4,486 GL calls - nothing
drawn changed.

Recorded with it: BOOT2's static-reach ceiling (`test/boot2.test.js`) had been reached exactly (60) by the renderer's
own growth since 2026-09-20; `pageQuery.js` is a leaf that imports nothing and makes it 61, and the ceiling moves to 64
with the reason beside it - the hub laws, which are what the ceiling was for, are untouched. And the grass probe hook
`window.__grassStats` had been answering without `cells` and `slots` since at least 2026-09-24: a comment sat in the
middle of its object literal (`scenes/world.js`, beside `labGrassField.update`) and the two keys were inside it. They
are code again, held by `test/perf2.test.js` through `codeOnly` (red on the old line).
