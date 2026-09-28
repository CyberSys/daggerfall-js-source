# Patch Notes: The Overworld

## A new way to look at the land (enhanced interface)
- Open your map and press **Overworld (O)**. The camera rises 150-450 m above you, always below the clouds, and you watch yourself cross the real world - the same ground, the same towns, the same weather.
- Drag to turn, wheel or pinch to zoom, your movement keys to walk (they walk the way the screen faces). Esc or Return brings you back down.
- Fog and shadows are yours, not the camera's: the valley you stand in stays clear in the rain, and the hills a league off are grey.
- You can also bind a key to it in Controls (it ships unbound). Press it again to come back down.

## Click to travel
- Click a town to walk there by the roads. Click open ground to walk straight to that spot. The route is drawn on the land, and towns you know wear name plates you can click.
- It is Travel Options' own journey - its speed, its stops for enemies, the sea and nearby places, and (if your map is set to travel cautiously) low health. Arriving is a line on screen, not a pop-up - unless you've already come back down.
- Water and places you cannot see yet are refused, with the reason. If Travel Options is set not to allow map coordinates, only towns can be clicked.
- The speed holds itself back while the land ahead is still loading, so you never watch a hole in the world. The travel bar shows it: "x20 / x40" (hover it for why).

## See other travellers (online)
- Other players in your region show on the Overworld and on your map, with their names, wherever they are in the region. One on a journey has an arrow. (Enhanced interface.)
- Someone off the edge of your screen is pinned to the edge, pointing the way.
- **Show me to travellers in my region** (Mods screen, Other players card) is on by default: while you're outdoors, where you stand is shared on your region's channel. Turn it off and only your party and players close enough to see you know where you are - your name still shows in your region's chat. Nothing is ever shared from indoors. The switch is saved on each device.
- This needs the server update that ships with it. Until then, nobody is shown and nothing breaks.

## Towns beyond the horizon
- Towns, cities and villages you've discovered up to about 20 km away show as name plates, with their distance. One off your screen is pinned to the edge, pointing the way. The nearest ten are shown.
- Click one to travel there by the roads.
- Plates pinned to the same edge no longer pile on top of each other: they stack neatly around the way they point, and each one can still be clicked.
- Towns and travellers behind you are no longer hidden under the Overworld's bar and your hotbar: they stand just above them, names over their arrows. Ahead, they stay clear of the compass and the travel panel.

## Smooth to fly
- The Overworld's name plates, markers and route cost almost nothing to draw: under half a millisecond a frame with 20 towns and 64 travellers moving, and next to nothing while the camera rests. (Before, 64 travellers could cost a third of a frame.)
- The Overworld no longer re-reads the ground under every marker, the route and the storms each frame - only when the land around you changes.

## Weather from above
- Storms stand where they really are: rain and snow hang in curtains under their clouds, and every player sees the same storm in the same place.
- Lightning from a distant storm strikes the ground, not the air.

## Fixes before release
- Going through a door with the Overworld up no longer leaves the street's fog on the room you walk into.
- The rain curtains fade in as the camera rises, instead of showing dark for a moment.
- A storm over a deep valley reaches the valley floor.
- If you are standing inside a storm, its curtain thins around you instead of standing like a wall between you and the camera.
- A key or mouse button you were already holding when you opened the Overworld no longer sticks down after you leave it.
- On touch, dragging the Overworld no longer also swings your weapon or moves you.
- Typing in chat over the Overworld (Escape included) goes to the chat. Closing the chat gives you your cursor back.
- Clicking Return or a town's name plate no longer counts as an attack or a use.
- If you had your cursor free before opening the Overworld, it stays free when you come back down.
- Another player who goes indoors or hides is taken off your map right away, even in a busy region.
- Going through a door or starting a video takes the Overworld down at once.
- Other travellers behind the camera are pinned to the screen's edge on their own side, not all in one corner.
- A player whose connection drops and comes back no longer leaves a copy of themselves on your map.
- The camera no longer jumps at high travel speed, never ends up inside a steep hill, and keeps your zoom after fog passes.
- Shadows reach across the whole Overworld view, not just a small circle around you.
- The sea floor, the Oblivion gate's fire and duel walls fog the same way as the land.
- Your own character faces the camera from above, and trees no longer pop at the edge of the screen.
- Resuming a road journey never sets off across the water the road goes around.
- A save made from the Overworld keeps your own camera.
