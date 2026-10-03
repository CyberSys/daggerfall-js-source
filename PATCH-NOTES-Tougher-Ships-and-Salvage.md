# Patch Notes: Tougher ships, quicker repairs and salvage

## Tougher ships
- **Every ship takes 60% more punishment.** Hulls and sails are 1.6 times as strong, and cannon balls, fires and rams thin crews 1.6 times more slowly. This goes for your boats and for every pirate, merchantman and navy ship, so sea fights last longer and leave more time to manoeuvre, brace and board.
- **The odds of a fight haven't changed.** A ship that outguns another still does, by the same margin. A fight costs about as many men as before; it just takes longer.
- **Floating casks last longer.** Casks and wreckage now float about 4 minutes (it was 2½), so loot from the first ship you sink is still there after the second.
- **Pirates break off at the same point in a fight.** A beaten pirate tries to run for about as long as before she has to strike, instead of 1.6 times as long.
- **Your saved boats are as you left them.** A ship saved whole loads whole, and one saved half-holed loads half-holed. A part-used Carpenter's Store keeps its work. A save made now also loads correctly in an older version.

## Quicker repairs
- **Your crew gets to work sooner and works faster.** The free patch-up starts 15 seconds after the last hit (it was 30) and runs twice as fast. Carpenter's Stores repairs run twice as fast too.
- **No orders needed.** Once a fight is over, your crew uses the Carpenter's Stores in your hold to repair her to full on their own, and your First Mate says when she's sound or when the stores run out. Damage below half strength is left to the free patch-up, so no store is wasted on work the crew does for free. A wrecked Small Ship is whole in about three minutes this way, on 7 stores. To turn this off, go to Features > Naval Combat > **Crew repairs on their own**.
- **A crewed ship repairs even when you're not aboard.** A boat with no crew (a Large Boat you sail alone) is only repaired with stores while you're on her.
- **Make repairs is the fast option.** Your crew uses stores from the first plank: a wrecked Small Ship's hull is whole in about a minute and her canvas half a minute later, on 12 stores.
- **Damage control.** With an enemy close by, **Make repairs** keeps your crew working at an eighth of the usual pace. That makes good about a third of the damage a ship your size deals you, at the cost of a store every minute or so. Fires keep burning while they patch, and a wreck stays crippled until the fight is over. With no enemy near, the order waits for any fire aboard to burn out, as before.
- **The shipwright charges about the same.** He charges less per point because hulls have more points, so a wrecked Small Ship costs 5,728 gold to make whole (it was 6,000). Carpenter's Stores cost 314 gold (they were 336) and each one repairs more, so a wreck still takes thirteen (a Carrack now takes eighteen, up from seventeen).

## Salvage from sunk ships
- **A sunk ship leaves her wreckage afloat** beside her floating casks. It's larger and paler than a cask.
- **Sail through it to haul it aboard.** It gives Carpenter's Stores for your hold (2 from a sloop, 4 from a brigantine or a cutter, up to 6 from a pirate flagship) and powder that fills your stern's fire barrels.
- **Sink what you meet and you can keep sailing.** Salvage lets you repair to full and refill your fire barrels without making port.
- If you're swimming, the stores go into your pack one at a time (or straight aboard, if you're alongside your own boat); whatever is too heavy to carry is lost, and you're told. If you fast travel or go through a door first, your crew stows wreckage from ships you sank, just as it does the casks.
- **Online:** everyone in the room sees the wreckage, and whoever reaches it first hauls it in. A ship sunk in a sea run by a player on an older version leaves no wreckage, and players on an older version don't see it.

---

## For developers
- TOUGHER-SHIPS: `SHIP_TOUGHNESS` 1.6 (`systems/naval/navalShips.js`); `HULL_BUILDS` hull and sail are `tough()` over the first build (`firstBuildOf`). A ball's men are `ballMen(shotMen(gun, zone), roll)` (`navalDamage.js`). A fire's man every `FIRE_CREW_S` (10 s) is 1/1.6 of a man carried in the damage's `wound`. Rams are `ramMen(dealt, roll)` (`navalHost.js`). On the wire a blow says its men *before* the toughness (`shotMen`, `ramMenSaid`), and the stander reckons it (`applyPeerHit`), so mixed builds agree. `strikeTime` divides men by the toughness, so every `odds` pairing is unchanged. `REPAIR_PRICE` hull 7, sail 4; `STORE_POINTS` 64; `FLOTSAM_LIFE` 240; `PIRATE_RUNS_AT` 0.3.
- Saves: boat records are written on the first build's scale with `maxHull`/`maxSail` (`savedRecord`) and read back by share (`savedHurts`), part-spent `credit` included.
- QUICK-REPAIRS: `FIELD_QUIET_S` 15, `FIELD_MEND_PER_S` 0.004, `SEA_REPAIR_PER_S` 0.016, `SEA_REPAIR_UNDER_FIRE` 0.125 (`navalYard.js`). The order works when quiet, or with a hostile near (`underFire`: no douse, no refloat). Auto repairs pay only past `FIELD_MEND_CAP` (`paidDamage`) and run for a crewed boat with hands, or the boat in play. The pref is `naval-auto-repair` (setting `AutoRepair`).
- SALVAGE: `SALVAGE_LOT`, `salvageOf`, `SALVAGE_SHARE` 0.4, `SALVAGE_BARRELS` 2 (`navalPlunder.js`). Wreckage goes on the naval word's new `w` key (`navalWire.js`); it is never in `LOT_KEYS`, so older builds don't reject the word.
- Pins: test files that hardcoded hull points or yard prices now read the builds (`PIN MOVED (TOUGHER-SHIPS)`). Test hits larger than `NAVAL_HIT_MAX` are split into several. The SEA-REPAIR host test expects damage control under fire. `auditnav2_captains` duels get `900 * SHIP_TOUGHNESS` s, and odds within `COIN_TOSS` (1.1) of even fail at 7 of 8 instead of 6 (in 32-duel samples the cutter beat the sloop 20-12 before this change and 16-16 after, against model odds of 0.95). Because the duels no longer stall, the galley's dead-zone station is now pinned directly by a new F24 test. New `test/tougherships.test.js`; `tools/mutants/tougherships.json` has 28 mutants.
