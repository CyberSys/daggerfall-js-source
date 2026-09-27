# FIELD BUGS 2026-09-27c - the death screen that would not rise, and a rest that aged nothing

Mac, with two screenshots from the bug-reports channel:

1. *"You can become a god with spell effects - So, when you rest, spell effects don't wear off. I found this out while
   training my magic skills. As such, you can stack them for thousands of rounds to last for long enough that you
   don't need to recast them actively ... I've acomplished permanent true invisibility, waterbreathing, regenerate
   health, etc. Anything that can be cast on oneself and has a spell effect can be stacked forever."* - and later,
   *"might be fixed"* (Double..., the name cut off in the screenshot)
2. *"Stuck on death screen - Was fast travelling while playing online and my character just decided to climb a wall
   that was in the way and died. I clicked "rise now" but the death screen didn't go away, so I waited for the timer
   and it still didn't go away when it reached 0."* (Ninilac)

## RISE-STUCK: the death screen keeps the top; a death ends the journey (2)

The screen's reset is one-shot, and online the rise REPLACES the top window with its line. A box pushed over the
screen buried it - the veil, DOM over the canvas, hid the box - and the rise replaced the box: the screen came back
with its reset spent and nothing could take it down. The box was most likely the journey's own. Travel Options'
autopilot runs under any paused window, so it kept its x60 and its arrival test through the death, and the respawn's
teleport moves the origin a whole build before it stands the player - a respawn at the journey's destination can read
as the arrival. A box pushed over a death screen now waits beneath it (all four hosts' stacks); a death sends the mod's
`pauseTravel`; a respawn that throws still takes the screen down. `06-Systems/Online-Arc.md` RISE-STUCK,
`06-Systems/Travel-Options.md` RISE-STUCK. The arrival as the box is inferred, not seen - see below.

## REST-ROUNDS: an online rest ages the effects (1)

Stacking is DFU's: an incumbent effect cast again adds its rounds. A rest that ages nothing is not. Offline a rested
hour is sixty rounds; online the clock is the world's, and the ticker's RaiseTime ran its real seconds - RESTX2's
sub-tick minute reached the dungeon's rounds and no other host's. Outdoors, in a building and in a party's mirrored
nap, a night now ages every effect by its minutes, claimed the dungeon's way; the shared clock is not moved. Offline
nothing changes. `06-Systems/Online-Arc.md` REST-ROUNDS.

## For Mac

- **What buried the death screen** is inferred, not reproduced (no ARENA2, no online session here): the journey's
  arrival fires under a paused window - pinned - and the respawn's teleport can read as it. Whatever the box was, the
  stack's half closes it: nothing can be pushed over a death screen now.
- **Why the journey climbed the wall** was not looked into. TRAVEL-NAV's steering means to stop short of a wall; a
  death on a journey is survivable now, but the climb is its own report and a probe on real data would show it.
- **Casting to stack is still DFU's law.** Recasting an incumbent effect adds its rounds, offline and online; what is
  gone is the rest that restored the magicka without aging them.

## Verification

`npm run check` green (lint, types, 12872 tests with 0 failing and the ARENA2-gated 244 skipped, the build); new pins
`risestuck` (7) and `restrounds` (5); re-aimed by content `world5`, `restx2_online_rest`, `camp1_groups`,
`exteriorfoes`, `partyrest1`, `restwhere`, `audit62_hosts`. Mutants `rise_stuck` 7 and `rest_rounds` 7 - all dead;
the records the change moved (`restx2camp`, `survtiers`, `survtiers3`) re-aimed by content and re-run with
`camp1rest`: 221 dead, 0 survived. Line cites re-resolved (tools/citeShift.mjs, 196) and seven on struck rows by
hand. Neither fix proven in a browser or with two players.
