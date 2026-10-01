# FIELD BUGS 2026-10-01b - the camps' shrubs in the air, the journey's hold on enemies, the party's ready

Three lines from Mac, the same day as `Field-Bugs-2026-10-01.md`: *"World of daggerfall bush props float above the
ground in bandit camps"*, then *"Also when party readying up, the ui element is hidden. We also need to reduce the
distance at which overworld enemies slow the user down"*.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | the bush props float in bandit camps | the mod's own heights, read off the author's ground, in the band the mod only eases toward the site's level | fixed (WOD-BUSH) |
| 2 | the ready-up element is hidden | (open) | open |
| 3 | overworld enemies slow the traveller too far out | the port's own warning (OW6), 1.2 s since OW6-NEAR | fixed (OW6-HALF) |

## WOD-BUSH: World of Daggerfall's shrubs stand on the ground (1)

World of Daggerfall stands every object of a site at the site's average height plus the author's own height
(`LocationLoader.cs:232-252`, `world/wodLocationLoader.js` `placeObjects`). It levels the ground to that average only
inside the prefab's rect; past it, every sample is lerped toward it by `1 / (distance + 1)` - half one sample out, a
third two out (`flattenForLocation`). The layouts ring their sites with one shrub model, 60610 - 202 placements across
the layouts, every bandit camp among them, never inside the rect - in that band, at heights the author read off the
ground of the one place they were laid out (posY from -27 to +15 at scales of 3 to 10). Where a camp's ground falls
away past its rect, the shrubs hung in the air; where it rises, they sank. DFU does the same: nothing in the mod reads
the terrain after the flatten.

The shrub now stands on the DRAWN ground: its mesh's foot (its transformed box's bottom) goes to the lowest ground under
the middle half of its footprint (`world/terrainSurface.js` `lowestGroundUnder`, `scenes/world.js` `buildPixelNow`),
read at the footprint's corners, its centre lines and every sample line that crosses it, so no quad under it is
skipped, and held to the pixel (the neighbour's ground is not this pixel's to read). The middle half, because a shrub's
foot is its middle: the whole box would bury a wide one deep on a slope for corners that are empty air. The matrix
moves before the shrub is batched and its collider filed, so what is drawn is what is struck. Every other object keeps
the mod's height: the rocks are embedded on purpose, and a tent, a fire or a wall stands on the levelled rect. A
Ledger A row records the departure.

That 60610 is the shrub is read off the layouts (the only non-rock nature model in them, ringing every site with
uneven scales and random tilts; the camps carry no nature-archive flat at all), not off ARCH3D, which this container
does not hold. NOT SEEN ON A GPU.

`test/wodbush.test.js` (5); `tools/mutants/wodbush.json` 7, 7 dead.

## OW6-HALF: the journey's hold on enemies begins half as far out (3)

The slowdown is the port's own (OW6, `06-Systems/Travel-View.md`): the time scale is held so the traveller has
THREAT_WARN_S real seconds before the nearest enemy's reach, and the lead-in is reach + THREAT_WARN_S x (own pace + the
enemy's chase) x the scale. Mac named no figure; the warning is halved, 1.2 -> 0.6, the one knob that shortens the
lead-in for every threat without moving any band's, raider's, ship's or camp's sight or chase - which would also change
when they spot the traveller. A rider at x40 is held from 384 m short of a band's sight, not 768; on foot 84 m, not
168. The reach is still met at walking pace. The third "too early": 5 -> 2 (OW6-LATE), 2 -> 1.2 (OW6-NEAR), 1.2 -> 0.6.

`test/ow6_slowdown.test.js` re-derived (each threat that would no longer hold at x40 stands nearer, so its pin still
means what it did); `tools/mutants/ow6s.json` 27, 27 dead.
