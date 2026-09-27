# Patch Notes: Enhanced Lighting, steadier shadows

## Fixed
- **Sun shadows no longer crawl while you stand still.** Their edges slid a little every frame as the sun moved, more in some places than others. They hold still now.
- **Shadows no longer jump at midday.** Around 11:28 and 12:32 the edges of every sun shadow shifted at once. Gone.
- **No more ring of popping shadows around you.** Shadows used to change sharpness at fixed distances from the player, so a ring of popping swept along as you walked. The distances now blend. Faraway sun shadows fade out gently instead of stopping at a hard edge.
- **Dungeon torches cast shadows.** Only the eight nearest did before. The rest lit straight through walls and floors, and rooms lit up or went dark as you walked. Every torch in reach now has its shadow, as taverns and shops already did.
- **Distant lanterns no longer pop on and off.** At night the game lights the nearest 48 lanterns, and a big town has more. Walking used to switch far-off pools of light on and off. They now fade in and out smoothly.
- **Town lanterns keep their own flicker.** Streaming in new parts of the town made many lanterns jump in brightness at once. Each lantern now keeps its own gentle flicker.

## Faster
- Dungeon torch shadows are no longer redrawn every time a torch flickers. Standing still in a dungeon used to redraw them several times a second.
