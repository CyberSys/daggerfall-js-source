# FIELD BUGS 2026-09-26 (b) — seven from the Discord's bug-reports

Mac, seven threads from the Discord's `#bug-reports`, sent as screenshots
the day the sixteen (`Field-Bugs-2026-09-26.md`) merged:

1. *"Floating sprites"* (Ilvi): *"I encountered a lot of floating sprites
   across Illiac Bay, and I thought if there is a way to drop all of them to
   0 z position in some script that will be added to them?"* - a screenshot
   of flats (a berry bush among them) standing over the grass by a ruin.
2. *"the mages kicked me out before my quest was done"* (KimNix, "Protect an
   Honored Mage": guard Perastyr Baerston at the Mages Guild for 3 hours):
   *"was it because I died or a bug I'm unsure"*; *"the assassins from the
   mission now attack me everywhere i go and spawn every few mins"*; *"the
   quest keeps resting its time"* (35 min left, then 4 days 22 hours).
3. *"Nothing is being credited to my account online"* (DragynDance): *"I
   didn't get credit for closing the oblivion gate in my profile, and I never
   got a founder title despite playing DFE before the cutoff and creating my
   account before the cutoff."*
4. *"Items with vanilla enchants buggy"* (DragynDance): *"Reloading a save
   with an enchanted item equipped makes you lose the enchantment until you
   take it off and put it on again."*
5. *"Rogue imp unable to kill hes in the floorboards"* (Triage, the Mages
   Guild of Wayrest's "Rogue Imp" in Palace of Vanlech Court): *"was able to
   fireball the floor, but it spawns in the floorboards"*.
6. *"quest monster in dungeon disspearing"* (Ashley): *"have to kill a giant,
   its disappearing after a basically random amount of time entering the
   dungeon"*; *"eventually got it after brute forcing it still didnt work
   tho, doesnt count as killed for the quest"*.
7. *"Nudity OFF still shows nudity in some areas"* (Twoddle): *"'show
   Nudity' off still has a few nude characters around, i dont know all the
   areas but temples of kynareth is one. This can be an issue for people
   wanting to stream."*

## ROGUE-IMP: a flying quest foe stands on a building's floor (report 5)

N0B30Y15 (`vendor/dfu-quests/Quests/N0B30Y15.txt`) places its imp - a
FLYING foe - at a QuestSpawn marker of a palace: `place foe _imp_ at
_palace_`. A building's marker is its flat's BASE on the floor
(`world/interiorLayout.js` - an RMB flat stands on its y; the people, the
quest items and the treasure piles all stand on theirs). The building's
marker stand handed it to the pool as a sprite CENTRE - the dungeon's RDB
convention, where a marker is the centre and a flyer's feet hang half its
idle sprite below it (the 2026-09-04 ceiling bats) - so the imp's feet went
half a sprite under the palace floor. A hovering flyer runs no collision, so
nothing lifted it; a blade's line to its middle crossed the floor, and the
quest's shield spells ate the rest.

The building's stand hands the marker over as FEET now, the pool's own
walker hair above it (`scenes/worldModes.js` the interior quest adapter's
standFoe, `INTERIOR_MARKER_FEET_LIFT`): a flyer hangs on the floor, where
DFU's controller recovery leaves it; a walker stands exactly where it did.
The dungeon's stand and CreateFoe's (true centres) are unchanged. The same
fix stands M0B00Y06's and Q0C0XY02's harpies (a house, a tavern).

A save made inside the palace before this keeps the sunk imp (the save holds
its feet); leaving and entering again stands it anew at the marker.

`test/rogueimp.test.js` (2); `tools/mutants/rogueimp.json` 4, 4 dead.
`test/interiorfoes.test.js`'s stand pin re-aimed.

## DEAD-CLOCK: the journal counts down a deadline, not a leftover clock (report 2, the time)

What the player met is N0B20Y02's own script (`vendor/dfu-quests/Quests/N0B20Y02.txt`):

- **The trap.** A click on the sleeping mage is `_S.04_`. It shows message 1012 ("Fool! ... Leave this guild hall now"), hides him, costs 10 reputation, and places a shielded hostile Mage in the hall. That message is the "kicked out". An online death inside the hall also sends a player to the town's edge (D-ONLINE1's respawn).
- **The punishment.** Killing that Mage is `_S.07_`. It creates Knights, Battle-mages and Assassins around the player wherever they are (DFU's `create foe` is never tied to a place) and starts `_S.09_`, seven days that end the quest failed. That is Daggerfall's script, faithfully run.

The port's part is the time. The journal's "Time remains" counts down the tightest running clock, and N0B20Y02 runs three:
- the trance's three hours (`_S.12_`);
- a day and three hours nothing reads (`_oneday_`: `variable _oneday_`, no `when`, no `until`);
- the punishment's seven days (`_S.09_`).

Between the trance and the punishment, the line counted the leftover down, so the time seemed to reset twice.

The line now counts only a clock whose end can change something (`systems/quest/clock.js clockCounts`): the task a finished clock sets (its own name) acts, or a `when` reads it, or an `until ... performed` waits on it. An action the registry could not read counts as an action (`scenes/questBridge.js questLog`).

Open: online, the punishment's seven days are game days PLAYED. The shared clock lets no rest and no travel skip them, so it is about fourteen real hours, with the waves themselves spent after about four. Whether to shorten it online, as Guard the Guild's watch was, is Mac's call.

`test/deadclock.test.js` (3, the real script parsed); `tools/mutants/deadclock.json` 8, 8 dead. Re-aimed: `test/questbridge.test.js` (MAC-K2's mount takes `clockCounts`, and pins a dead clock skipped) and `test/enhancedPause.test.js` (PX22).

## ENCHANT-LOAD: a load keeps what a worn item's enchantments give (report 4)

A quest reward or an item-maker piece carries Daggerfall's own enchantments. Their CONSTANT half is a fold (`systems/enchantments.js computeEnchantmentMods`): EnhancesSkill, StrengthensArmor and WeakensArmor, ExtraSpellPts, AbsorbsSpells, IncreasedWeightAllowance, ImprovesTalents, BadReactionsFrom. The fold is derived state and never saved. Equipping computes it, and so does the magic round.

A load rebuilt the equip table without it (`systems/equip.js rebuildEquipState` fires the listeners, not the enchantment hook), and re-made only the Cast-When-Held bundles (`restartHeldEnchantments`). DFU's constant pass runs every frame; the port's first came at the first magic round, a game minute of unpaused play, which never runs while a window is up. So a player who loaded and opened the sheet saw every such item bare, and taking it off and on was the one thing that folded it. The port's own rarity loot was unaffected: its affixes fold through an equip listener.

`restartHeldEnchantments` now folds the constant effects too, WITHOUT DFU's clamp of magicka to the new maximum. The fold runs before the world has the save's clock back, so an ExtraSpellPts condition (a season, a moon, the undead nearby) can read wrong for that moment, and a clamp there would cut the magicka the save holds. The first round's fold, at the live clock, clamps as DFU does.

Two more of the load's losses, found on the way and fixed with it:
- **Only an item's last Cast-When-Held power stood.** `assignHeldSpell` stripped every pin of the item before casting, once per ROW, so each power took the one before it off, on equip, reroll and load alike. DFU's AssignBundle strips nothing, and RerollItemEffects strips once per item before every row recasts. The port does the same now: the strip is the reroll's and the restore's, once per item.
- **The reroll clock.** `timeEffectsLastRerolled` is saved with the item, and DFU's load keeps it. The restore's recast stamped the host clock instead, read before the load sets the world's, so loading an earlier save held the six-hour reroll back by however long had been played since.

`test/enchantload.test.js` (5); `tools/mutants/enchantload.json` 10, 10 dead. Two SURVTIERS3 cite mutants re-aimed at the lines the cites moved to.
