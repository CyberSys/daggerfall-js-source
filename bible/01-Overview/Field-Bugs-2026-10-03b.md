# FIELD BUGS 2026-10-03b - the Aetheric pieces the maker refuses

The Discord's bug reports of 2026-10-03, handed over as screenshots: *"Not sure if intentional or not, buuut:
Enchanting Aetheric sets"* (Cruor: "You can enchant Ruhn's gear, lol"). Every fix below is pinned by tests that fail
on the record's own code (14cd193b1), the new pins mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "You can enchant Ruhn's gear, lol" | an Aetheric piece carries no DFU enchantment, so DFU's one item refusal (IsEnchanted) never met it: the maker listed the Regalia, the Broker's ware and the raid sets as plain Daedric and spent their whole budget over their powers | AETHERIC-MAKER |

## AETHERIC-MAKER (1)

`systems/enchanting.js` itemMakerRefuses, AETHERIC_TAKES_NO_ENCHANTMENT, enchantDecision; `ui/itemMakerWindow.js`
itemMakerFilter. DFU's maker refuses an item by what it carries - `AddFilteredItem` (:419-422) skips
`item.IsEnchanted`, `HasLegacyEnchantments || HasCustomEnchantments` - and has no artifact or quest-item check:
an artifact is out because it is enchanted. An Aetheric piece (`aetheric.js` mintAetheric) is the port's own tier,
and its header says it outright: it carries no DFU enchantment, its affixes and its sigil are its powers. So the
filter read it as a plain Daedric piece - the Gatecleaver's Battle Axe a Daedric 1575 points - and the maker laid
the player's enchantments over it (the report's card: the Regalia's +40% damage, +15 Strength and +30 Axe, then
Vampiric Effect, Potent Vs Daedra, Cast When Strikes and the rest). The port's other services already refuse it
(`reforge.js` salvageRefusal answers `'aetheric'`, reforgePrice null). Now the maker does too: an Aetheric piece is
out of every tab, and `enchantDecision` answers `{ kind: 'refused', text }` before DFU's ladder - so a selection
that never came off the list (a window open across the change, a probe) lays nothing on, renames nothing and takes
no gold. The line is the port's own. Every other item is DFU's: a Legendary, an Exalted, a signature drop and an
artifact are out because they carry enchantments, a crafted piece of jewellery keeps PROF10 J2's door.
`test/fb1003b_aethericmaker.test.js`, every fixture from its producer (the gate boss's spoils, the Sigil Broker's
Regalia ware, a raid's thanks).

**Said, not fixed.** A piece enchanted before keeps its rows - stripping a player's item on load is Mac's call
(`lootRarity.js` repairRarityNames is the precedent if it is wanted) - and AUDIT SET D3's fading rule
(`rarityTier.js` stampedTier) still answers for it. The wire's `validSetMarks` does not refuse an enchanted Aetheric
piece, for the same reason: it would make those pieces unreadable to the room.

Mutation list: `tools/mutants/fb1003b.json`.
