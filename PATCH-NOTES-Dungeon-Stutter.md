# Patch Notes: Dungeon stutter

## Performance
- **Much less stutter in dungeons with lots of enemies.** Every enemy checks its line of sight to you and probes the walls in front of it many times a second. When one got stuck against a wall looking for a way around, it could make over a dozen of these probes at once. Each check went through every floor and ceiling stacked above and below it, so bigger dungeons with more levels and more enemies cost more. That is why the console filled with "requestAnimationFrame handler took" warnings and the CPU hit 100%. The checks now skip floors and ceilings the line can't reach and stop at the first wall they meet. On our test dungeon a sight check is about 6 times faster and a wall probe about 9 times faster. Enemies see and move exactly as before.

## Fixes
- **One set of female caster sprites no longer grows while casting.** Its casting frames are drawn a little larger, as in Daggerfall. That enlargement was applied again on every frame of the cast, so the sprite kept growing for the rest of the session.
