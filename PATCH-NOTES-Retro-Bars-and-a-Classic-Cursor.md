# Patch Notes: Retro mode's black bars, the classic cursor, steadier memory and a few field fixes

## Retro mode
- **The HUD, your weapon and your horse now stay inside the picture.** With Retro Picture Mode on and Retro Aspect set to 4:3 or 16:10, only the world used to be framed by the black bars. The health bars sat in the left bar, the compass and your weapon hugged the screen's right edge, and the docked large HUD stretched across the whole screen. Now the HUD, the large HUD, your weapon (and the Weapon and Shield Widget sprites), the spellcasting hands and the horse all sit inside the picture, as in Daggerfall Unity. The docked large HUD is the picture's width, so the view above it keeps Daggerfall Unity's shape. On the Enhanced Plus UI, the HUD, notifications, quest tracker and status line stay inside the bars too.
- Menus and windows such as the inventory still use the whole screen and can reach a little into the bars.

## HUD
- **Notifications you've moved now fade in where you put them.** If you dragged the notifications to a new spot (Alt+U), each new notification first appeared at its old place on the right and then jumped. Now it shows up at your spot from the first frame, and fades in and out there instead of sliding in from the side. Notifications you haven't moved still slide in from the right as before. Revenant taunt cards you've moved fade the same way.

## Classic UI
- **The classic UI now uses Daggerfall Unity's classic blue arrow cursor.** It shows from the very first screen, over every window and panel, and the gamepad cursor uses the same arrow. Text boxes still show the text cursor. Enhanced Plus keeps its gauntlet.

## Performance
- **Fixed a GPU memory leak in long sessions.** Each time you opened the map inside a dungeon or a building, the game created a new graphics context of 30 to 40 MB (more on a 4K screen) and never freed it. The map now reuses one. The game also releases all its graphics memory as soon as you close the tab, instead of waiting for the browser to get round to it. This mattered most on Firefox.

## Bounties
- **Bounty packs no longer spawn inside rocks.** A bounty's pack, a wilderness camp or a roaming band could stand inside one of the World of Daggerfall rock formations or mountains, where you couldn't reach them. They now always stand on open ground.

## Quests
- **The Bodyguard now finishes online once you're paid.** After you saved Evelara from the assassins and were paid, the quest stayed in your journal forever when playing online. It now closes a couple of minutes after the reward, like other finished quests. If it's already stuck in your journal, it closes on its own the next time you play. Offline, it closes the next day, as it always has.

## Weapon Widget and Shield Widget
- **Inertia now sways the sprites when you look around.** The Inertia module was getting your mouse look in the wrong units, so the sway from turning was about a fourteenth of what the mods intend. Walking and strafing swayed them, but looking around barely did. Turning now sways the weapon, shield and torch as in Daggerfall Unity. Turn the Inertia dials down if it's too much for your taste.
- **The Shield Widget's Recoil now kicks when an attack lands on your shield.** With the default armor rules (Physical Combat and Armor Overhaul), the game never told the shield which part of you was hit, so its default "Attack On Shield" recoil never fired. The Weapon Widget's Recoil already worked once its module is switched on.

## Guild halls
- **Clearer words when the guild treasury can't pay for a hall.** Buying a hall for your guild takes the house's price plus half again, paid from the guild's gold treasury (Social > Guild > Treasury). Only gold that realm characters put into the treasury counts. Gold in a bank account never pays for a hall. The old message ("put in by realm characters") didn't say which of these was the problem, and "realm" read like a place. There are now two separate messages: one when the treasury is short of the price, and one when it holds enough but not enough of that gold counts.
- **The Guild tab shows how much of the treasury can buy a hall.**
- **Deposit and Withdraw say "at most 1,000,000 at a time"** if you type more than one move allows, instead of failing after you press. A 1,274,880 gold hall takes two deposits.
