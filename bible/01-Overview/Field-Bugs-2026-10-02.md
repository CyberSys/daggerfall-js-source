# FIELD BUGS 2026-10-02 - the shards over Hadus

A #bug-reports thread through Mac (a screenshot, 2026-10-02): maya, *"Insane glitched geometry over at Hadus"* -
*"yea.."* under a frame of dark, faceted slabs hanging in the sky over the desert east of the town - and Ashley:
*"yeahhh mountains be buggin rn"*.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Insane glitched geometry over at Hadus"; "mountains be buggin rn" | WOD-BUSH (2026-10-01) stood every placement of World of Daggerfall's model 60610 on the drawn ground, taking it for the camps' shrub; 157 of its 202 placements are the rock fields' boulders, set into the outcrops on purpose, and it raised them as dark shards up to 377 m tall | fixed (ROCK-SUNK) |

## ROCK-SUNK: a rock field's boulder keeps the mod's height (1)

**Reproduced first**, on the game's own data and the real renderer (SwiftShader): the streamed world at Hadus
(Myrkwasa, map pixel 295,427), standing just north of the town and facing east (pixel-local 330, 650, 84 degrees),
draws the report's frame - a giant dark slab over the left of the view with sky under it, another over the right,
darker shards over the outcrops between.

**What it was not.** Not the mountains: no `WOD_Mountain_` site stands within nine pixels of Hadus; the outcrops are
World of Daggerfall's rock fields (`WOD_Rocks_Large_03`, `_04r2`, `_00r1` and the smaller fields), ARCH3D pebbles
scaled hundreds of times into piles hundreds of metres across. Not WOD-ROCK's retexture (`Field-Bugs-2026-10-01.md`
part five): the same views with the models' own UVs draw the same shards. Not the port's reading of the mod: the
transform is `LoadObject`'s T * R * S in Unity's frame, the meshes are `MeshReader`'s (X, -Y, Z) * 0.025, every
layout's tags read one to one, the pebbles decode as whole rocks, and a layout stood alone on flat ground is a coherent
pile with its spire rising out of it. Not the terrain or the roads: Hadus stands on a 310-330 m plateau with a 140 m
escarpment to the south-east, but as the mod places them - and after ROADS-CLEAR takes the pieces over a road - every
piece round the town touches the ground or the rocks it is set into.

**Why.** The shards are model 60610, whose texture (41.0) is the darkest grey in the frame. WOD-BUSH
(`Field-Bugs-2026-10-01c.md`) stood that model's mesh foot on the lowest drawn ground under it, taking all of its
202 placements for the shrub - read off the layouts, without ARCH3D, and never seen on a GPU. 45 are the shrub: the
bandit camps' 29, the nature spot's 14 and two ruins', at 1.7 to 14.6 times the model and never deeper than 28 m. The
other 157 are the rock layouts' boulders - 150 in the fields the 'Rocks' instances stand (34 of them at 81 to 95 times
the model) and 7 in the cave layout no instance names - scaled 5.6 to 95 and set into the outcrops, 63 of them more
than 50 m deep (as deep as 346 m). Standing them on their lowest corner raised 86 by more than 50 m and 70 by more
than 100 m (as much as 510), each then standing its whole height, up to 377 m, out of a pile meant to bury most of it.
WOD-BUSH reached main with #513 at 21:50 (UTC-4) on 2026-10-01; the thread is from the same night.

**The fix** (`world/wodLocationObjects.js` `isWodShrub`, `WOD_ROCK_SITES`; `scenes/world.js`, the WoD loop): only the
shrub is stood - a 60610 of a site the mod names 'Rocks' or 'Mountains' keeps the mod's height, as every other rock
piece does. The mod's own site names part the layouts exactly (every 'Rocks' or 'Mountains' instance stands a
`WOD_Rocks_` or `WOD_Mountain_` layout, and no other instance does), and Mining's rock pieces (PROF2's `rockPick`) read
the same list. Seen on the real renderer at the reporter's place: the sky over Hadus is clear and the outcrops stand as
the mod lays them.

`test/fb1002_rocksunk.test.js` (5; the lift off the real mesh with ARENA2_PATH); the source pins of
`test/wodbush.test.js`, `test/roadsclear.test.js` (the shrub's block between a piece's box and its road test) and
`test/prof2_client.test.js` (`rockPick`) re-aimed; `tools/mutants/fb1002_rocksunk.json` 5, 5 dead;
`tools/mutants/wodbush.json` re-aimed, 7, 7 dead. World.js is line-neutral: no cite moves.
