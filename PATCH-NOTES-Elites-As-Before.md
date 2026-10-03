# Patch Notes: Elites as before

## Elites (online)
- **Elites are back to their old numbers.** The last change made them rarer; that's undone.
- **In the open world, 5% of foes stand as elites again** (it had been cut to 2%). There's no longer a limit of one at a time or a wait after the last one, so a camp or a pack can bring more than one, and a summoned squad can too.
- **Ordinary dungeons hold an elite 20% of the time again** (it had been cut to 10%). Elite Dungeons keep their 3 to 4.
- Champions are unchanged (they were never made rarer): about one foe in twenty of level 3 or more.
- Offline, nothing changed either time.

---

## For developers
- ELITE-RARITY (4b72f69a) is reverted: `ELITE_FOE_OVERWORLD_CHANCE` 0.05, `ELITE_FOE_NORMAL_DUNGEON_CHANCE` 0.2 (`systems/eliteFoes.js`). `overworldEliteAllowed` and `ELITE_FOE_OVERWORLD_GAP_MINUTES` are deleted, and `scenes/exteriorFoes.js` no longer keeps `_lastEliteAt` or refuses a `loose` stand.
- Pins: `test/elitefloor_foetitle.test.js`'s three ELITE-RARITY tests are now ELITE-RATES (the old odds, no gate, the pool online stands every winner); `test/revenant.test.js`'s spawn sweep reads the bare roll. `tools/mutants/eliterarity.json` is now `tools/mutants/eliterates.json` (6 mutants, 6 dead). Line cites into `exteriorFoes.js` re-resolved.
