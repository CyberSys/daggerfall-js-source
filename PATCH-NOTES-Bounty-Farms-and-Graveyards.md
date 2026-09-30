# Bounty Farms and Graveyards

Merges the graveyard bounty fix with a farm bounty fix.

## Graveyard hunts (from graveyard-bounty-fix)
- A board's hunt at a graveyard stands in the open air outside it, never in the crypt; graveyard notices get their own stories and show "graveyard" on the board.
- world.js: the graveyard wiring (`_bountyGraveyardPixels`, `graveyardAt`) re-applied onto the CURRENT world.js (the fix zip carried an older world.js that would have reverted Loan Amnesty, Deed-Port, Strike-Shared etc.).

## Farm bounties (new)
- BOUNTY-FARM-CLEAR: foes could stand inside the farmhouse (or barn) and could not be reached. The farm pool now records every building's footprint; `_standCampEncounter` takes an optional `spotOk` and the farm pack's anchor and every member are refused inside (or within 1.5 m of) any farm building. The farmyard ring widened 18 -> 24 m to leave room.
- BOUNTY-FARM-GROUND: farms no longer stand on mountainsides. A spot whose ground rises more than 8 m across the block is refused; with no flat spot the farm fails and the pack stands as an ordinary hunt.

Files: src/scenes/bountyFarms.js, src/scenes/bountyHost.js, src/scenes/world.js, src/systems/bountyBoard.js, src/ui/bountyWindow.js

## Bounties on the Overworld (new)
- BOUNTY-OVERWORLD: every bounty you hold now shows on the Overworld at its hunt's pixel: a BLACK ring (the maps' own circle) with a pale rim so it reads on dark ground, labelled "Bounty: <foes>" (and the place, for a dungeon/graveyard hunt) and its distance. Off screen it is held at the edge with an arrow pointing the way, like the journey's end. It is never hidden by the Show filters, and it goes when the bounty is paid, dropped or lapses.
- Files: src/scenes/world.js (travelViewMarks), src/ui/travelViewHud.js (the bounty look and colour).


## Click a bounty to walk to it (new)
- BOUNTY-SNAP: clicking a bounty's ring (or its edge arrow) on the Overworld walks you to the hunt: a dungeon's or graveyard's entrance, a farm bounty's yard about 20 m short of the farmhouse, otherwise the middle of the hunt's pixel.
- The click area is small on purpose: 10 px around the ring or arrow, never the label. A click just beside it is an ordinary ground click, so walking near a hunt never snaps by accident (BOUNTY_SNAP_PX in ui/travelViewHud.js).
- Files: src/scenes/world.js, src/ui/travelViewHud.js, src/scenes/bountyHost.js (mapMarks carries what the click walks to).

## No field hunts in the mountains (new)
- BOUNTY-GROUND: a board no longer sends an open-ground (or farm) hunt to a mountain pixel - the same mountains the Overworld refuses to walk into. Dungeon and graveyard hunts are unchanged (they go to the place's door). File: src/scenes/world.js (the board's siteOk).
