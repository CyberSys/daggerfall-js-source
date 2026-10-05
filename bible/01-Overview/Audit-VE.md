# AUDIT VE - Vanilla Enhanced, shipped and on by default, 2026-10-05

Mac: *"Audit this. Ensure this is on by default. And performance isn't affected"*, of PR #621 (VE1-VE4,
`07-Rendering/Vanilla-Enhanced.md`): carademono's Vanilla Enhanced shipped under Port-Doctrine's one exception, the
texture-mod door given DFU's load order and terrain import, the Texture Overhaul card. Four lenses:
- **the default:** Mac's call;
- **performance:** measured, in Chromium on this session's machine and in node;
- **the door against DFU:** an independent adversarial review of a snapshot of the pushed head, with the DFU C# beside
  it, and this session's own reading;
- **the tests' own honesty:** fresh mutants on every new line.

Every finding was re-run before it was fixed and is pinned by a test that fails on the code as it stood:
`test/auditve.test.js` (D1, P1, P2, and the review's R findings), with the moved pins in `ve1_vanillaEnhanced`,
`ve4_vanillaEnhancedShipped` and `overhauls` each carrying a `PIN MOVED` note. Mutation-proven: `tools/mutants/auditve.json`,
and every older record the fixes moved re-aimed and killed again (`ve1.json`, `ve4.json`). Each fix carries an
`AUDIT VE` comment.

## The default (Mac's call)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Mac's call | **Vanilla Enhanced shipped off until worn** (VE4 departure 7): a fresh game drew Daggerfall's own textures. | **The shipped Base is ON by default** (`vanillaEnhancedPack.js` `ON_BY_DEFAULT`), as a mod in DFU's Mods folder is, and Replace Game Artwork is on by default (DFU's own default) - a fresh game wears Vanilla Enhanced. Its add-ons (Masked Roads, Snowless Swamps and Jungles) ship off until picked on the card. A shipped mod's switch is now the player's CHOICE either way (`dfmodShipped`, `{ key: on }`), so Classic's off is kept through every boot after; a key with no choice reads the mod's default. Classic stays one choice away on the card. |

## Performance (measured)

Chromium (Playwright) on this session's machine, through the port's own decode path; node for the registration. The
world itself cannot be drawn here (no ARENA2, SwiftShader only), so the frame is reasoned from the renderer, not timed.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | Major | **The shipped pack decoded on the main thread.** An attached .dfmod decodes in its bundle worker; the shipped PNGs' readback (drawImage + getImageData, about 1.7 ms a 256-pixel tile) and the texture detail's box filter (86 of its pictures are bigger than 256 - trees up to 726x941) ran on the page's thread while the world streams. Measured over one ground set (56 tiles) and every flat and wall (390): **worst main-thread stall 29-39 ms, 5-16 stalls over 16 ms** - dropped frames - in two runs. | **The decode is a worker's** (`vanillaEnhancedDecodeWorker.js`, two of them): the fetch, the decode and the fit run off the main thread and the pixels come back moved, not copied; the same pixels as the page's own path (checked equal in Chromium, a fitted tree included). A browser with no OffscreenCanvas in a worker decodes on the page's thread instead, and a worker that dies is never asked again - an ask after its death is the page's at once, never a wait for ever. **After: worst stall 8-10 ms, none over 16 ms;** the ground set 139-144 ms (was 165-171), the 390 flats and walls 1.08 s (was 1.25-1.40 s). |
| P2 | Minor | **The ground cache kept every decoded tile set for the session.** A set stands on the GPU once uploaded; the door's copy only spares a re-decode when PLACE-LRU lets the array go - and it was kept for every archive ever drawn: 14.7 MB a set at Vanilla Enhanced's 256 pixels, eleven archives 162 MB. | **Bounded to three** (`GROUND_CACHE_SETS`), the least recently asked let go - a junction of climates still re-enters at once; an older set is decoded again if asked (off the main thread, P1). |

Measured and holding:
- **Registration:** putting the Base's 1,238 names on the doors takes 3.4 ms, a boot's registration 2.9 ms, the card's
  reads 16 µs; with the pack switched off, 0.04 ms.
- **The download:** the JavaScript grows by 73.6 KB (15.3 KB gzipped - 0.34% of the whole), the game page's entry chunk by
  0.1 KB; the index rides the lazily loaded chunks and the worker is its own. The pictures come only as they are drawn
  (a ground set 1.24 MB), from the browser's cache after the first visit.
- **The frame:** unchanged in kind. The ground's tile array is mipmapped with a nearest magnifier (GRAIN1), so a 256-pixel
  tile costs what a 64-pixel one does at distance; flats are uploaded per record, not packed into fixed atlas pages, so
  larger flats add no draw calls.
- **Memory, the honest cost of four times the texels:** a resident ground archive is 19.6 MB of GPU memory (mipped)
  where Daggerfall's is 1.2 MB, and PLACE-LRU frees one no place holds; an area's flats decode to about a megabyte an
  archive (all 390 flats and walls, every climate, 17.2 MB). The DFMOD3 budget bounds the decoded pictures as it does any
  texture mod's; Classic is one choice away on a low-memory device.
- **A new climate's first load** awaits its ground set (0.11-0.14 s here, through the worker; longer on a slow first
  download). Only the first pixel of a climate pays it; moving it earlier would reorder all four hosts' loads for little.

## The door against DFU (the review)

An independent adversarial reviewer is reading a snapshot of the pushed head (`d1c38864`) against DFU's own C#
(ModManager.cs, TextureReplacement.cs, TextureReader.cs) - the load order, the walk, Mod.Enabled, the terrain import,
the shipped mods' state, the other texture tiers and doors, the card. Its findings land in this section, each
reproduced before it is fixed and pinned as the ones above are.

## The tests' own honesty, and the record

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | Nit | **The VE4 commit carried a stray build stamp:** `npm run build` writes HEAD's sha into `src/buildTag.js` (`scripts/buildTag.mjs`, at prebuild), and the run before the commit put `3194de87f6b3` over main's value - a change to a tracked file that is no part of the work (the CI build stamps its own at every deploy). | Restored to main's value: the PR no longer touches the file. |

Every new line has a mutant, and every mutant dies: `tools/mutants/auditve.json` (14), `ve4.json` (22) and
`ve1.json` (35) killed again - the records this audit's lines moved re-aimed (`VE4-detail-not-honoured` to the page's
fallback fit, `VE4-fit-not-a-mip` to `formats/resample.js`, where the mip rule now lives once for the page and the
worker), and VE4's two on the old switch (`VE4-shipped-on-by-default`, `VE4-shipped-switch-on-the-attached-shelf`)
replaced by `AUDITVE-*` on the new one. The browser half, `tools/overhaulsProbe.mjs`, reads the card as a fresh game sees
it - Vanilla Enhanced in use - and the decode worker made and used in Chromium.
