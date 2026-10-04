# FIELD BUGS 2026-10-04b - the Qualifying Examination's robes: the press reaches what stands on furniture, a shelf that does nothing is no target, every door onto a loot row clicks the quest, the robes named where they stand, and a party's resync keeps the pickup

Balcony on Discord, "THE QUALIFYING EXAMINATION - Quest bug", with the beggar's letter and the pack in screenshots:
*"my letter says for me to steel priests Robes from Hawkton residence and i did it.. i should give me another letter
with were should i go to bring the quest item and go on, but the didn't get the letter and nothing changed in quest
dialog.. so i can't do my Class guild promotion quest."* The letter reads "Steal the Priestess Robes from The Hawkton
Residence in Moorham Manor if you desire to join us. You have 91 days."

O0A0AL00 (the Thieves Guild's initiation) stands `_clothing_` at an item marker of a `house1` and hands the next step
over on the CLICK: `_S.03_ task: clicked item _clothing_ say 1018 / get item _note_` - "As you pick up the Priestess
Robes you hear the soft rustle of paper", and the note naming the guild's man and his building. The quest machine was
ruled out first: the vendored script on the real QuestMachine, the robes clicked and ticked, says 1018 and gives the
note every time. So the fault was in how a click reaches it. DFU sends a quest item's click from two places only -
the stand in the world (QuestResourceBehaviour.DoClick) and the loot list's row (DaggerfallInventoryWindow.cs
:2027-2037) - and the port had four ways for "robes in hand, no click" to happen. Which one Balcony met cannot be told
from the screenshots (whether the robes in the pack are the quest's own is the question to ask); the first is the one
an unshared, solo visit to a residence walks into, and all four are fixed.

| | What it was | Done |
|---|---|---|
| 1 | The press raced whole-model BOXES for a building's furniture - every wardrobe, chest, dresser, bed and shelf - where DFU's ray meets their MESH (PlayerActivate.cs:314). An item marker on a mattress under its headboard, on a dresser under its mirror or on a shelf's board stands inside that box, and the box's entry beat the robes on every press: the bed offered a rest, the wardrobe its private property, and a residence's shelf - which DFU leaves as geometry - did nothing at all. The robes could not be picked up, while every wardrobe in a house rolls clothing (robes among it) | ROBES-PRESS |
| 2 | Both hosts' quest-stand namers read `res.daggerfallItem ?? res.item`, fields no quest resource has, so every quest item in the world stood NAMELESS (the Totem alone, named by hand, read) - the robes a bare pile of cloth beside a wardrobe that said "Wardrobe" | ROBES-NAME |
| 3 | Three doors took a quest item off a loot row without the click: quick loot (on by default - the plaque's E, P's take-all), and the enhanced skin's right-click/long-press/pad-Y menu and its pad's X | ROBES-CLICK |
| 4 | A party's resync (`updateSharedQuest`) restored every Item from the partner's copy - their click (none) and their stand (not picked up) - so one landing between a pickup and the next tick took the click back and stood the robes again | ROBES-SHARE |

## ROBES-PRESS (1)

`player/activate.js` nearestActivatableHit; `scenes/worldModes.js` interiorActivationTargets, shelvesAct. Two laws,
both DFU's:

THE SURFACE LAW. A target marked `surface: true` - a model whose triangles stand in the collider's SHARED bucket, so no
key names them - is struck where the first surface the ray meets lies, and only when that surface is inside its box
(a triangle's home is its own AABB). It is CASTLE1's law for a box the eye stands in and DISC19-E's for a box whose
model owns its bucket, given to the third case: a box merely entered, over geometry nobody's key names. A ray that
crosses the box and meets nothing of it never struck it; one that meets the headboard behind the robes struck the bed
there, past the robes, which win - as DFU's ray meets the item's trigger sphere first (GameObjectHelper.cs:1158). The
mattress itself is still the bed, struck at the mattress. A building's containers, beds and shelves carry the mark;
nothing else does (doors, ladders and action objects keep their boxes; a dungeon's furniture is no target - its loot is
piles, which are flats).

THE SHELF. AddFurnitureAction (DaggerfallInterior.cs:791-819) gives a shelf-set model a component in a shop, a
Library, GuildHall or Temple, and an owned house (a container - HC1); in a plain residence it gets nothing and is
geometry. The port made it a `shelf:` target in every building and `openShelf` answered its press with a silent
return. It is a target now only where it acts - `shelvesAct`, openShelf's own three arms asked as one question (the
port's Hall of Records the third) - and elsewhere it is the collider's, which blocks what is behind it as DFU's mesh
does.

The four hosts: building furniture is `scenes/worldModes.js`'s alone (interiorContext builds it, this host races it);
`scenes/world.js` and `scenes/exterior.js` stand no building furniture, and `scenes/dungeonContext.js`'s RDB has no
containers, beds or shelves (its piles are flats). The plaque reads the same pick, so it names what the press presses.

## ROBES-NAME (2)

`systems/worldTooltips.js` questStandItem; both namers in `scenes/worldModes.js` (the building's and the dungeon's).
World Tooltips names a quest item stand `ResolveItemLongName(((Item)qrb.TargetResource).DaggerfallUnityItem, false)`
(.cs:509) - the Item resource's own `daggerfallUnityItem` (quest/item.js). One reader, both namers; the robes read
"Priestess Robes" where they stand.

## ROBES-CLICK (3)

`systems/itemTransfer.js` sendQuestItemClick - "Send click to quest system", the FIRST act of
RemoteItemListScroller_OnItemClick, ONE home; the right click is the same member (:2070-2073). Its callers: the native
skin's one remote handler (`ui/nativeInventory.js` _pickRemote, which had it inline), the enhanced skin's loot row
(inline before), its menu on a loot row (a right click: the click goes first, a menu closed unused included, as a look
counts) and its pad's quick act (`ui/enhancedInventory.js` openMenu, inventoryQuickAct), and quick loot's take
(`systems/quickLoot.js` takeThrough - the row's click with no window around it, sent before the plan as DFU sends it
before CanCarryAmount, and once per quest item for P's take-all). Every quickLootTake call (seven, in the four hosts)
already carried the quest resolver (QL-WEIGHT1). Not changed, and why: a body holding only arrows is taken whole with no click, as DFU's
(PlayerActivate.cs:948-952); GivePc/GetItem hand items straight to the pack, as DFU's.

## ROBES-SHARE (4)

`systems/quest/machine.js` updateSharedQuest. An Item's click and pickup are THIS world's - the player's own act on the
stand or the row - and the resync keeps them as it keeps a Foe's injury: OR'd back after the restore. An Item is hidden
only by that pickup (no action un-hides one, DFU's or the port's), and the click is spent by the tick's own PostTick,
never by a partner; a partner's own pickup still hides this copy's stand, as before. Not changed: the resync's
ping-pong while one member stands in the mansion and the other does not (`pc at _mansion_ set _S.02_` toggles a
task's trigger, which the share signature watches) - each re-trigger restarts `_S.02_`'s Mage waves; that is the
share's design to answer, recorded here for it.

## Pins

`test/fb1004b_robes.test.js` (12): O0A0AL00 on the real QuestMachine, its own robes and note - the click says 1018 and
gives the note, no click no note; the one home answers nothing for a plain item, a quest gone, a symbol not held or no
resolver; quick loot's E and P take the robes and the note comes; the enhanced skin's menu Take and pad X, driven on the
mounted pane over a pile, and the note comes; no inline copy of the send in either skin or quick loot; the robes named
from the real resource, a person or foe not; both namers through the one reader; a real Collider bed - the robes on the
mattress win in either list order, the box law alone loses them, the mattress is the bed, air over it and the wall
past it are not; the three furniture families marked and the shelf gated on openShelf's arms; a resync between the
pickup and the tick keeps the note coming and the stand down, and makes no click up. `test/quickloot.test.js`'s quest
corpse take now carries the real resource's click and asserts it; `test/enhancedInventory.test.js`'s two row pins read
the one home. `tools/mutants/fb1004b_robes.json` (20, all dead); the ten lists aimed at `player/activate.js` re-run
beside it (499, all dead).

## For the player

If the robes in Balcony's pack came out of a wardrobe, they are not the quest's (the classic window draws a quest item
on DFU's quest background, itemScroller.js questItemBackgroundColor; the enhanced skin marks none): the
quest's own stand at the Hawkton Residence can be picked up now, on whatever it stands on, and the note comes with
it. If they ARE the quest's own and the note never came, the click is spent and `_S.03_` cannot fire again - the
quest can still be finished by carrying the robes to the guild's man, but nothing in the journal names him.
