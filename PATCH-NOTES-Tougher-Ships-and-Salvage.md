# Patch Notes: Tougher ships, quicker repairs and salvage

## Tougher ships
- **Every ship takes 60% more punishment.** Hulls and sails are 1.6 times as strong, and crews lose men to cannon fire, fire and rams 1.6 times more slowly. This goes for your boats and for every pirate, merchantman and navy ship, so sea fights last longer and leave more time to manoeuvre, brace and board.
- **The odds of a fight haven't changed.** A ship that outguns another still does, by the same margin.
- **Fewer port trips to hire hands.** Your crew falls more slowly in a fight.
- **Your saved boats are as you left them.** A ship saved whole loads whole, and one saved half-holed loads half-holed.

## Quicker repairs
- **Your crew gets to work sooner and works faster.** The free patch-up starts 15 seconds after the last hit (it was 30) and runs twice as fast. Carpenter's Stores repairs also run twice as fast, so a wreck is whole in about a minute with a full crew.
- **No orders needed.** Once a fight is over, your crew uses the Carpenter's Stores in your hold to repair her to full on their own. They only use stores for damage the free patch-up can't fix (above half strength), so no store is wasted. Your First Mate says when she's sound or when the stores run out. To turn this off, go to Features > Naval Combat > **Crew repairs on their own**.
- **Damage control.** **Make repairs** is now the fast option: your crew uses stores from the first plank, and keeps working in the middle of a fight at about a third of the usual pace. Fires aboard keep burning while they patch, so you still have to deal with them.
- **The shipwright charges about the same.** He charges less per point because hulls have more points, so a wrecked Small Ship costs 5,728 gold to make whole (it was 6,000). Carpenter's Stores cost 314 gold (they were 336) and each one repairs more, so a wreck still takes thirteen.

## Salvage from sunk ships
- **A sunk ship leaves her wreckage afloat** beside her floating casks. It's larger and paler than a cask.
- **Sail through it to haul it aboard.** It gives Carpenter's Stores for your hold (2 from a sloop, 4 from a brigantine or a cutter, up to 6 from a pirate flagship) and powder that fills your stern's fire barrels.
- **Sink what you meet and you can keep sailing.** Salvage lets you repair to full and refill your fire barrels without making port.
- If you're swimming, the stores go into your boat if you're beside her, otherwise into your pack. If you fast travel or go through a door first, your crew stows wreckage from ships you sank, just as it does the casks.
- **Online:** everyone in the room sees the wreckage, and whoever reaches it first hauls it in. Players on an older version just don't see it.

---

## For developers
- TOUGHER-SHIPS: `SHIP_TOUGHNESS` 1.6 (`systems/naval/navalShips.js`); `HULL_BUILDS` hull and sail are `tough()` over the first build (`firstBuildOf`). A ball's men are `ballMen(gun.crew, roll)` (`navalDamage.js`), `FIRE_CREW_S` is 16, and ram men go through `ramMen` (`navalHost.js`). `strikeTime` divides men by the toughness, so every `odds` pairing is unchanged. `REPAIR_PRICE` hull 7 and sail 4; `STORE_POINTS` 64. Boat save records carry `maxHull` and `maxSail`; older records are rescaled by `savedHurts`.
- QUICK-REPAIRS: `FIELD_QUIET_S` 15, `FIELD_MEND_PER_S` 0.004, `SEA_REPAIR_PER_S` 0.016, `SEA_REPAIR_UNDER_FIRE` 0.3 (`navalYard.js`). `repairStep(b, s, d, { auto, underFire })`; `createShipDamage().repair(..., { douse })`. The pref is `naval-auto-repair` (setting `AutoRepair`).
- SALVAGE: `SALVAGE_LOT`, `salvageOf`, `SALVAGE_SHARE` 0.4, `SALVAGE_BARRELS` 2 (`navalPlunder.js`). Wreckage goes on the naval word's new `w` key (`navalWire.js`); it is never in `LOT_KEYS`, so older builds don't reject the word.
- Pins: test files that hardcoded hull points or yard prices now read the builds (`PIN MOVED (TOUGHER-SHIPS)`). Test hits larger than `NAVAL_HIT_MAX` are split into several hits. The SEA-REPAIR host test now expects damage control under fire. `auditnav2_captains` duels get `900 * SHIP_TOUGHNESS` s, and treat odds within `COIN_TOSS` (1.1) of even as a coin toss. In 32-duel samples the cutter beat the sloop 20-12 before this change and 16-16 after, against model odds of 0.95. New `test/tougherships.test.js`; `tools/mutants/tougherships.json` has 10 mutants, all killed.
