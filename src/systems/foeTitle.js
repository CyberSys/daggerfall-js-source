// @ts-check
// FOE-TITLE (2026-10-02): WHAT A SPECIAL FOE IS CALLED - one home for every surface that names a foe (the HUD's target
// bar, the hover, the death line, the body's title). Before it, three copies spelt a LOOT7 champion's trait each their
// own way (ui/hudFoeTarget.js, systems/worldTooltips.js, systems/champions.js championName) and an ELITE FOE was named
// on the target bar alone.
//
//   - a NEMESIS (systems/nemesis.js) is called by its own name - "Grushnak the Kinslayer" - and nothing else;
//   - a LOOT7 CHAMPION by its trait before its kind - "Mighty Orc Warlord" (every trait's name is its id title-cased,
//     test/loot7_champions.test.js);
//   - an ELITE FOE by "Elite" before its kind - "Elite Orc Warlord" (a foe is an elite or a champion, never both).
//
// A LEAF: it imports nothing, so the HUD's leaves can ask it.

/** @param {any} entity @param {string | null | undefined} base the foe's own name (its kind's, or its career's) */
export function foeTitle(entity, base) {
  if (!base) return base;
  const nemesis = entity?.nemesis?.name;
  if (typeof nemesis === 'string' && nemesis) return nemesis;
  const c = entity?.champion;
  const named = typeof c === 'string' && c ? `${c.charAt(0).toUpperCase()}${c.slice(1)} ${base}` : base;
  return entity?.eliteFoe ? `Elite ${named}` : named;
}

/** Is this foe called by more than its kind (a nemesis, a champion, an elite)? The hover names such a foe even while
 *  it is hostile (systems/worldTooltips.js mobileEntityName's `champion` arm - LOOT7-CHECK CHAMP-HOVER, widened). */
export const foeTitled = (entity) => !!((typeof entity?.nemesis?.name === 'string' && entity.nemesis.name)
  || (typeof entity?.champion === 'string' && entity.champion) || entity?.eliteFoe);
