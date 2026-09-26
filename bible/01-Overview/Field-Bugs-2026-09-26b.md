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
