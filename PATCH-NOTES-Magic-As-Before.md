# Patch Notes: Magic and potions as before

## Magic (online)
- **The change to magic is undone.** The last update made resting refill magicka only to half your pool, and changed how Restore Power potions are sold and priced. That's reverted.
- **Resting refills your magicka fully again**, as does arriving from a cautious journey.
- **Restore Power potions are back to their old price and shops.** Alchemists and the Mages Guild no longer carry them; temples and the Dark Brotherhood sell potions to their members as before.
- Offline, nothing changed either time.

---

## For developers
- MANA-HALF and MANA-SHOP (FIELD BUGS 2026-10-01 part two, #6) are reverted: `systems/rest.js`, `scenes/shared.js`, `scenes/world.js`, `systems/shopStock.js`, `systems/tradeModes.js` and `scenes/worldModes.js` are back to their law before #498. `systems/restorePower.js`, `test/fb1001_mana.test.js` and `tools/mutants/fb1001_mana.json` are deleted. The pins and mutant records they re-aimed are put back, and line cites are re-resolved.
- Record: `bible/01-Overview/Field-Bugs-2026-10-01.md` part two.
