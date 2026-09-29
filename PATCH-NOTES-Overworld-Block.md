# Overworld Block

Built on the updated source. Covers the Overworld UI, the enemy sprites, attacking enemies from the map, a later start to the enemy slowdown, and the missing nearby-dungeon messages.

## One compact block, bottom right
- The Overworld's controls are one compact block in the bottom-right corner, so the rest of the screen stays free. From top to bottom: where you are, your journey, the Path switch and Map, the filters, and Return.
- It is always shown while you are in the Overworld. Standing still, the journey section says "Not travelling". Travelling, it shows the destination, time left, the time controls, Camp and Exit.
- The trip line under your location also shows "Travelling at ×N" while you travel with the movement keys.
- The block has no compass of its own. The HUD's compass at the top of the screen already shows the heading.
- The movement hints moved into a tooltip on the block's top line.
- On touch screens the block sits at the top right, clear of the touch buttons.

## No more flash of the old travel bar
- Starting a journey while standing in the Overworld no longer flashes the old travel bar at the top of the screen for a moment before it moves into the block.

## Notices stay clear of the block
- While the Overworld is up, the notices on the right side stack upward from just above the block instead of being centred over it. On touch screens, where the block sits top-right, they start just below it.
- A marker at the right edge under a notice fades while the notice is showing.
- Outside the Overworld, notices are where they always were.

## Roads or Free
- The **Path** switch is remembered between sessions.
  - **Roads** (default) prefers road travel. Clicking near a town travels to the town.
  - **Free** walks across country and still goes around mountains and across water the same way. Clicks near a town go to the exact spot. If there is no free route, it takes the roads and says so.
- In either mode, once you are next to a town, or while holding Shift or Alt, every click goes to the exact spot.

## Filters
- A **Show** section with Towns, Distant, Dungeons, Enemies and Travellers. Each switch shows how many markers it holds, and the settings are remembered.
- Enemies covers roaming bands, camps and raiders.
- Always shown regardless of filters: your destination, anything chasing you, and your party.

## Markers at the screen edges
- Markers held at the top or bottom edge now sit right at the edge. They only step inward where a HUD piece is actually in the way: the compass at the top, the hotbar and bars at the bottom. Before, the tallest piece pushed every marker along that edge inward across the full width.
- A marker that would appear behind the hotbar or compass is held at its edge instead of being hidden under it.
- A marker in view whose location falls on the compass or the hotbar is drawn faint there, so the compass letters and the slots stay readable. It is still clickable and returns to full strength once the camera moves it clear.
- Markers on the side edges keep clear of the block, and of the quick-slot area if shown.

## Enhanced Plus face for POIs
- Under Enhanced Plus, the Overworld's place plates, labels and distances use the Plus pixel face with its hard one-pixel shadow, matching the block, the hotbar and the player names. The classic Enhanced look is unchanged.

## Enemy sprites
- Near a roaming band (inside about 420 m) its lead monster's animated sprite fades in over the land, sized like your own sprite. It is fully visible inside about 240 m. Hiding Enemies hides these too.

## Enemy slowdown starts later
- Fast travel still slows as enemies get close, but it starts much later. The game used to guarantee 5 real seconds before you reach an enemy's sight range; it now guarantees 2 (`THREAT_WARN_S` in `systems/travelThreat.js`, one number to tune).
- A rider at ×40 now starts slowing about 1.3 km before a band's sight range instead of about 3.2 km. On foot at ×40 it's about 280 m instead of 700 m.
- You still reach the enemy's sight range at walking pace.

## Nearby-dungeon messages show again during travel
- "You see a dungeon ... metres to the ..." (said once when you enter the map pixel holding a generated dungeon) now stays up for 5 seconds at any travel speed.
- HUD lines count down in game time. The Overworld's other lines already stretch their time by the travel speed (AUDIT OW5 G2), but this one did not, so at ×35 it was on screen for about 1/35 of a second and, being said only once per pixel, was effectively never seen.

## Attack an enemy from the map
- Double-click a band or camp marker in the Overworld to be asked: "Attack the Zombie band (2)?", "Attack the Orc camp (4)?", "Attack the Lich?"
- The question appears in the Overworld itself, over the map; the view stays up. Its Yes / No buttons are the block's own (the same as Roads / Free).
- Enter or Y answers Yes, Escape or N answers No. Clicking the map dismisses it.
- **Yes:** you travel straight toward them at full travel speed. That enemy no longer slows you down (a band's chase included; for a camp, every member). Any other enemy along the way still does. Meeting them starts the encounter as usual.
- **No:** nothing changes.
- A single click on an enemy marker still walks to that spot, as before. Clicking anywhere else, or a town, cancels the attack.
- As with any journey, you can't set out while enemies are already close and aware of you.

## Free path walks straight
- In **Free** mode a journey no longer bends at pixel middles on the way (it used to go diagonally, then straight, and read as being pulled toward the road or a place first). The route is pulled taut: it goes straight to the spot wherever the way is clear, and only bends where water or mountains force it to.

## Enemies spawn closer
- Roaming bands (the red markers) are now born in three cells out of four by day and nine in ten by night (`BAND_CHANCE_DAY` 0.45 -> 0.75, `BAND_CHANCE_NIGHT` 0.6 -> 0.9 in `systems/travelBands.js`), so the nearest one is about a quarter closer. The grid and life stay as they were, so the shared ids and the online law are unchanged.
