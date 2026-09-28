# Patch Notes: The Overworld

## A new way to look at the land (enhanced interface)
- Open your map (the Enhanced map) and press **Overworld (O)**. The camera rises about 150-450 m above you - lower in fog and sandstorms, higher over steep hills - kept under the clouds, and you watch yourself cross the real world - the same ground, the same towns, the same weather.
- Drag to turn, wheel or pinch to zoom, your movement keys to walk (they walk the way the screen faces). Esc or Return brings you back down.
- Fog and shadows are yours, not the camera's: the valley you stand in stays clear in the rain, and the hills a league off are grey.
- You can also bind a key to it in Controls (it ships unbound) - with the Enhanced map turned off, the key is the way in. Press it again to come back down.

## Click to travel
- Click a town to walk there by the roads. Click open ground to walk straight to that spot. The route is drawn on the land, and towns you know wear name plates you can click.
- It is Travel Options' own journey - its speed, its stops for enemies, the sea and nearby places, and (if your map is set to travel cautiously) low health. Arriving is a line on screen, not a pop-up - unless you've already come back down.
- Water and places you cannot see yet are refused, with the reason. If Travel Options is set not to allow map coordinates, only towns can be clicked.
- The speed holds itself back while the land ahead is still loading, so you never watch a hole in the world. The travel bar shows it: "x20 / x40" (hover it for why).

## See other travellers (online)
- Other players in your region show on the Overworld and on your map, with their names, wherever they are in the region. One on a journey has an arrow. (Enhanced interface. On the map, names alone.)
- Someone off the edge of your screen is pinned to the edge, pointing the way.
- Every player shows with their name as it reads in play - their title above, their Renown in its box, their guild tag and their glyphs - and your party in green. That includes your party travelling with you and the players around you, whose names over their heads couldn't be seen from the Overworld's height - each name stands over its player's head, and a group standing together has its names stacked neatly, never one over another. A player who has turned off **Show me to travellers** is only named when they're close to you, as in play. Invisible players are never shown, near or far - and while you're invisible, your region doesn't see you either. Chat bubbles don't show from up there; what's said reads in the chat.
- **Show me to travellers in my region** (Mods screen, Other players card) is on by default: while you're outdoors, where you stand is shared on your region's channel. Turn it off and only your party and players close enough to see you know where you are - your name still shows in your region's chat. Nothing goes on the region's channel from indoors (your party still sees where you are, as it always has). The switch is saved on each device.
- This needs the server update that ships with it. Until then, nobody is shown and nothing breaks.

## Towns beyond the horizon
- Towns, cities and villages you've discovered up to about 20 km away show as name plates, with their distance. One off your screen is pinned to the edge, pointing the way. The nearest ten are shown.
- Click one to travel there by the roads.
- Plates pinned to the same edge no longer pile on top of each other: they stack neatly around the way they point, and each one can still be clicked.
- Towns and travellers behind you are no longer hidden under the Overworld's bar and your hotbar: they stand just above them, names over their arrows. Ahead, they stay clear of the compass and the travel panel.

## Smooth to fly
- The Overworld's name plates, markers and route cost almost nothing to draw: under half a millisecond a frame with 20 towns and 64 travellers moving, and next to nothing while the camera rests. (Before, 64 travellers could cost a third of a frame.)
- The Overworld no longer re-reads the ground under every marker, the route and the storms each frame - at most twice a second, or when the land around you changes.

## Weather from above
- Storms stand where they really are: rain and snow hang in curtains under their clouds, and every player sees the same storm in the same place.
- Lightning from a distant storm strikes the ground, not the air.

## First update
- The map's "Resume your journey?" question no longer comes back forever: it has a **Forget it** answer that ends the journey.
- The Overworld's bar, Return button, compass and town plates follow your Enhanced Plus theme.
- Your character is drawn much larger from the Overworld, so you can always find yourself at a glance.

## Travel is the Overworld now
- Pick a place (or a spot) on your map and you go straight up into the Overworld and set off - by the roads to a town, round the hills to a spot. Bring the view down yourself and the journey stops; the map offers to resume it.
- Journeys no longer run beside a road: you walk to the road first, then along it.
- Mountains can't be crossed on foot any more - journeys go round them or over the passes the roads take, and a spot among the peaks is refused. No more grinding into a cliff face at speed.

## Dungeons on the Overworld
- Every dungeon within about 20 km shows on the Overworld. Ones you haven't found yet are a red "?" where they lie - you know something is there, not what.
- Pass within a kilometre of one and you find it: "You have found <name>." From then on it has a name plate with its distance, on the Overworld and on your map, and a click travels there.

## Enemies on the road
- Bands of enemies roam the wilderness, and you can see them from the Overworld: a red mark with what they are and how many ("Orc, 4").
- They're Daggerfall's own encounters for the land and the hour - more of them at night, none in towns - and every player sees the same bands in the same places.
- Online, everyone nearby sees the same chase: a band hunting a friend is seen running at them, and a band someone has fought is gone for everyone.
- A band that spots you gives chase. On foot they'll catch you; on horseback you can outrun them. If one reaches you, the camera comes down and you fight exactly the band you saw coming. A band chasing you from off-screen is pinned to the edge, pointing at it.

## Fixes before release
- Your health, magicka and fatigue stay readable while the Overworld is up - its bar sits above them now. On phones its Return button is no longer under the touch buttons.
- A journey to a far town keeps the town on screen: its flag is pinned to the edge with its distance, and clicking it takes the journey up again after a stop.
- Towns and travellers near a corner of the screen no longer overlap, and none sit on the quick-slot block, the compass or the travel panel. The arrows point more clearly.
- The speed holds back sooner while land is loading (you never see a hole at the screen's corners), and no longer drops to walking pace in a second while one piece of land builds.
- A click on the sea near a coast is refused, and a click on the beach walks you there. A road just outside the direct line is found and taken.
- A trackpad zooms smoothly. Holding the Overworld key (or Escape) no longer flickers. A gamepad no longer attacks or uses things from under the Overworld. The Tab dial works over it. Clicks on the travel panel no longer use what's in front of you.
- The Overworld can't be opened, or a journey clicked, in the middle of a duel.
- Rain and snow curtains now follow each storm's real shape, stay inside the storm's front, and only stand under clouds you can see.
- No more small camera hitch every time you cross into new land on a fast journey.
- Going through a door with the Overworld up no longer leaves the street's fog on the room you walk into.
- The rain curtains fade in as the camera rises, instead of showing dark for a moment.
- A storm over a deep valley reaches the valley floor.
- If you are standing inside a storm, its curtain thins around you instead of standing like a wall between you and the camera.
- A key or mouse button you were already holding when you opened the Overworld no longer sticks down after you leave it.
- On touch, dragging the Overworld no longer also swings your weapon or moves you.
- Typing in chat over the Overworld (Escape included) goes to the chat. Closing the chat gives you your cursor back.
- Clicking Return or a town's name plate no longer counts as an attack or a use.
- If you had your cursor free before opening the Overworld, it stays free when you come back down.
- Another player who goes indoors or hides is taken off your map right away - in a very busy region, a moment later.
- Going through a door or starting a video takes the Overworld down at once.
- Other travellers behind the camera are pinned to the screen's edge on their own side, not all in one corner.
- A player whose connection drops and comes back no longer leaves a copy of themselves on your map.
- The camera no longer jumps at high travel speed, never ends up inside a steep hill, and keeps your zoom after fog passes.
- Shadows reach far across the Overworld view (about 900 m), not just a small circle around you.
- The sea floor, the Oblivion gate's fire and duel walls fog the same way as the land.
- Your own character faces the camera from above, and trees no longer pop at the edge of the screen.
- Resuming a road journey never sets off across the water the road goes around.
- A save made from the Overworld keeps your own camera.
