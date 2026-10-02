# Stats Card: the paperdoll's flip side

The enhanced pack's paperdoll card now has a **Stats** button at the bottom centre of the card, in the figure's own column (it no longer sits on the right weapon's slot). Pressing it turns the card over
on a 3D hinge (lift, shadow, content rising in) to a combat page; the button then reads **Paperdoll** and
turns it back.

## What the back shows
- **Damage** (min-max and average), **hit chance**, **critical chance** and what a critical does, **backstab chance**,
  and the expected damage of an average swing.
- A table per **swing direction** (sideways, thrust, down-right, down-left, overhead; a bow shows its release).
- **Breakdown**: weapon roll, material, Strength, proficiency, race, your attack term, the foe's armour and dodging.
- **Defence** (overall armour, the seven part numbers, dodging, biography, health), **attributes** with their effects,
  and the skills in play.
- The hit and damage are scored against a foe of your level in four real armour classes (chips at the top): **Soft / Tough / Armoured monster** (armour value 6 / 0 / -10, as the bestiary stores them) and a **Human foe** in mail.

## Numbers are the game's own
`src/combat/combatStats.js` reads the formulas the combat core rolls and replaces the dice by their exact expectation.
Both cores are modelled: DFU's stock FormulaHelper and the Physical Combat And Armor Overhaul (whichever is in force).
Weapon, material, condition, Strength, Agility/Speed/Luck, weapon skill, Critical Strike, Backstabbing, Dodging,
proficiency, race, affixes, sigils and enchantments all feed in, so equipping something changes the page at once.
Damage is shown before the foe's armour reduces it.

## Files
- NEW `src/combat/combatStats.js`, NEW `src/ui/statsCard.js` (card, page and its CSS, injected once), NEW `test/combatStats.test.js`
- CHANGED `src/ui/enhancedFrame.js`: the stats card's parts join the kit's role lists (panel, button, tile, chip, well, headerRule, rule, qrow), so every Plus theme dresses them. See `enhancedFrame.diff`.
- CHANGED `src/ui/enhancedInventory.js`: one import and one line (`wrap.append(statFlip(map, deps.entity))`).
  The exact change is in `enhancedInventory.diff`.

## Tests (small)
`node --test test/combatStats.test.js`: 40000 seeded swings through the real roll code match the model (hit rate and
mean damage) for both cores; plus strength/swing/material arithmetic, bare hands, bows, and a DOM-stub check of the button.

## Notes
- Enhanced skin only; the classic canvas window is untouched.
- `prefers-reduced-motion` gets a crossfade instead of the turn.
- If the card ever throws, the pack falls back to the plain paperdoll.

## Enhanced Plus look (fix)
- The page wears the window's pixel face (`PIXEL_STACK`: Pixelify Sans, Silkscreen's 5), not Barlow / Cormorant.
- Colour and bevel come from the stone-and-brass kit by role, so Slate, Stone, Iron, Ember, Forest and Night all restyle it; `statsCard.js` writes only border width/style, geometry and word colours. Stone gets brighter words for contrast.

## Fixes, round 3
- **The shimmer is gone**: the light sweep across the card while it turns is removed (the turn, lift, shadow and rising content stay).
- **The hit chances were far too high.** The old reference foes were a hybrid: a class (human) foe's armour numbers (100 = unarmoured) with a monster's +40 (overhaul +50) bonus to be hit, so a bare foe read 97% whatever your skill. They are now the real thing: monsters carry `armorValue x 5` (the bestiary runs -12..7, so 30 / 0 / -50 on each part) with the monster bonus; the human is a class foe with no bonus, and the overhaul reads the flat 60 it reads off every class foe (`pcaaoArmorToHit`). Damage figures were right and are unchanged.
- Tests updated to the four foes (soft, armoured and human checked against the real roll code in the classic core; the overhaul core against `pcaaoSuccessfulHit`).
