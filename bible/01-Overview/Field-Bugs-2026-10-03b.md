# FIELD BUGS 2026-10-03b - the trees on the hills drawn, the Aetheric pieces the maker refuses

The Discord's bug reports of 2026-10-03, handed over as screenshots: *"Floating trees in Tamhope"* (Rissa), *"Bugged
Quest"* (RyuDouro: "the NPC to deliver no longer exists in the same shop"; TutucoGOD: "the NPC doesn't exist on the
location provide"), *"Spiders aren't spawning for shared exterminator quest"* (Starempire42), *"I need some help from
a..."* (Shortstori: "the Totem of tiber Septim isnt here ... daggerfall Castle will Never reset with 300+ people"),
*"Not sure if intentional or not, buuut: Enchanting Aetheric sets"* (Cruor: "You can enchant Ruhn's gear, lol") and,
from #general, Regi's "i got into my boats interior and then got out and i'm in the void". Every fix below is pinned
by tests that fail on the record's own code (14cd193b1), the new pins mutation-checked.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Floating trees in Tamhope" (Rissa) | six Beautiful Villages blocks stand TEXTURE.504's trees on the RMB Resource Pack's hills at the author's heights, and the port's stand-in mounds are a fraction of the pack's size - 121 of 130 trees hung more than 1.5 m over what is drawn | TREES-SEATED |
| 5 | "You can enchant Ruhn's gear, lol" | an Aetheric piece carries no DFU enchantment, so DFU's one item refusal (IsEnchanted) never met it: the maker listed the Regalia, the Broker's ware and the raid sets as plain Daedric and spent their whole budget over their powers | AETHERIC-MAKER |

## TREES-SEATED (1)

`world/townStandIns.js` drawnHillStandIn, blockHillSeat, seatNatureFlat; `world/rmbFlats.js` isNatureArchive,
NATURE_FLATS_Y; `scenes/world.js` buildPixelNow's block flats; `scenes/exterior.js` the same flats;
`tools/rmbrpHills.mjs` (new). Tamhope is Beautiful Villages' `location-18-157` (Glenpoint); its edit swaps one cell to
a new GENRAS04, which places no hill, and the rest of its grid is MAPS.BSA's. Six of the mod's blocks - RESIAS08,
TVRNAS00, TVRNAS01, TVRNAS03, TEMPASH3, WEAPAS02 - stand TEXTURE.504's trees as misc flats on the RMB Resource Pack's
hills (52xxx): 130 of them a metre to 13 m over the plane, at heights the author read off the pack's own meshes
(measured against those meshes, 128 of the 130 lie within 0.75 m of the hill's surface). DFU stands each where it is
authored (AddMiscBlockFlats, RMBLayout.cs:326-380, reads no terrain and swaps no archive) - on the pack's hill, and
floating without it. The port draws its own mounds there (`RMBRP_HILLS`, the catalogue's Small/Medium/Large as 3, 6
and 10 m), and 121 of the 130 hung more than 1.5 m over what is drawn. While a block's hills are drawn as the port's
stand-ins (customModelFor, the door the pipeline asks first), every flat of that block in the nature range now stands
on the higher of the drawn ground (NATURE-GROUND's `groundOffPlane`) and the stand-ins' top under it, read off the very
triangles the pipeline builds. The range is 500-511 because a misc flat keeps the archive it names, so these 504s are
not the pixel's archive in winter or in another climate. A block with no hill drawn as ours - every classic one -
keeps the plane and NATURE-GROUND's lift, byte for byte; a hill the port does not draw as its own leaves the block as
DFU stands it. All four hosts: the streamed world (world.js) and the one-location exterior (exterior.js) seat; the
interior host (worldModes.js) and the dungeon (dungeonContext.js) stand no RMB exterior flat (pinned). Port-Ledger's
NATURE-GROUND row and Beautiful-Towns' hills row narrowed. NOT SEEN ON A GPU: driven over the pack's own six blocks with
the stand-ins the pipeline builds. `test/fb1003b_trees.test.js` decodes the six blocks from the vendored pack (their
records are carried whole - no game data) through blockFromJson, layoutRmbBlock, collectBlockFlats and RMBRP_PIECES,
and measures with a ray of its own; `test/natureground.test.js`'s pins re-aimed (`tools/mutants/natureground.json`'s
lift-dropped record with them).

**Said, not fixed.** The mounds themselves. Measured on the pack's published files (`node tools/rmbrpHills.mjs <a
clone of drcarademono/rmb-resource-pack>` reads each prefab, its .blend and the scale it stands at - 0.01 Large, 0.005
Medium, 0.0025 Small; nothing of the pack is committed), the pack's hills are mostly 3-4x wider (1.7-4.5x across the
23 ids) and 2-7x taller than the stand-ins: 52548 is 41.2 x 36.7 m in half-extents and 7.82 m high (stand-in radius
10, 1.6 high), 52058 41.5 x 41.7 m and 16.03 m (10, 3.5), 52703 11.6 x 11.2 m and 8.99 m (3, 1.4). So a tree authored
on a slope the stand-in does not reach now stands on the ground beside a smaller mound, not on a hill. Resizing them
is the DFU-faithful half; a smooth mound at the measured size still leaves about a quarter of the trees more than
1.5 m off the lumpy real hill (a measured radial profile: median 0.18 m, 34 of 130 over 1.5 m), so the seat stays
either way. Whether Tamhope's own grid holds one of the six blocks needs the player's MAPS.BSA
(`maps.getLocationByName('Glenpoint', 'Tamhope').exterior.exteriorData.blockNames`); the cause is the six blocks'
wherever they stand (TVRNAS0x are the roadside taverns' too). The far ring's stride-4 ground is not re-read, as for
NATURE-GROUND.

## AETHERIC-MAKER (5)

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

Mutation lists: `tools/mutants/fb1003b.json` (AETHERIC-MAKER, 3, 3 dead), `tools/mutants/fb1003b_trees.json`
(TREES-SEATED, 18, 18 dead).
