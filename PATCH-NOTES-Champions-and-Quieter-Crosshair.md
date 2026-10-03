# Patch Notes: More champions, a quieter crosshair

## Champions
- **Champions are a little more common.** About 7% of foes of level 3 or more now stand as a champion (it was 5%) - roughly one in fourteen, up from one in twenty. Every champion that stood before still stands where it did; this only adds more.

## The crosshair
- **Special foes are no longer named at the crosshair.** A hostile champion, elite or revenant shows no tooltip when you look at it, the same as any other foe. Its name and its trait ("Mighty Orc", "Elite Orc") appear on its health bar once you strike it.
- A special foe that isn't fighting you is still named at the crosshair as before: a sworn companion by its own name, and a beaten revenant still reads "- beaten" so you know to go and judge it.
- The line that tells you a champion's trait on your first blow is unchanged.

---

## For developers
- CHAMP-RATE: `CHAMPION_PER_MILLE` 70, was 50 (`systems/champions.js`). The hash is unchanged, so every mark under 50 stands as before; the golden marks in `test/loot7_champions.test.js` gain the new ones.
- HOVER-PLAIN: LOOT7-CHECK CHAMP-HOVER's exception is retired. `mobileEntityName(name, { hostile })` drops `champion`; `foeTitled` is deleted (`systems/foeTitle.js`); the four live arms (`exteriorFoes`, `worldModes`, `dungeonContext`, `cityGuards`) pass hostility alone. `liveEntityName` keeps `foeTitle`, so a foe at peace keeps its title; the street's and the dungeon's arms pass `!f.yielded` (the street's `!f._pupYield` too), since a kneeling revenant's motor stays hostile.
- Pins re-aimed in `loot7check`, `loot7_champions`, `elitefloor_foetitle` and `worldhover`; mutant records in `loot7check.json`, `loot7.json` and `worldhover.json` re-aimed (10, all dead). Line cites re-resolved.
