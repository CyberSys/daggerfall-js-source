# FIELD BUGS 2026-09-27d - the Discord batch after RISE-STUCK

Mac, with screenshots from the Discord's bug reports and suggestions. This page is the batch's record; each fix
has its own section below as it lands.

1. *"Potion seller restock instantly - You only have to close the shopping window and the potions are available to
   purchase again. I dont know if its a bug, but you could buy infinite amount of potions this way"* (Bagneres)
2. An Android thread (jessman212's; Triage on an AYN Thor): *"i can login get to the main screen but im unable to
   select online, load game anything. What is the chance of getting an actual android apk?"* - *"doesnt seem to let
   me change controller sensitivity either, i press the 1.0 to try and change it but it doesnt register"* - *"I
   luckily have a tiny, tiny space under the title I can use to scroll but it's quite annoying. I've managed to
   figure out resting, and spell casting but I haven't been able to remap the android "buttons" on the bottom right
   of the screen. I would much rather use a button to attack rather than the touchscreen personally."*

## GUILD-SHELF: a guild's Buy shelf is the day's (1)

The "potion seller" is a guild's Buy Potions service (the Temples' and the Mages Guild's), and the same law
stocks Buy Magic Items and Buy Soulgems. DFU mints each of those shelves on every open of the service - the magic
and soul gem shelves from the day's seed, so what was just bought is back at the next open, and the potions from
the walking random stream, a fresh lot at every open. Either way the shop never runs out. The port had recorded the
first as a quirk it kept, and seeded the potions on the day as well - which turned them into the first kind: close
the window, and every potion just bought was back.

Each service's shelf is now minted once a game day and kept on the building (`systems/shopStock.js` `dayShelf`,
`scenes/worldModes.js` `guildShelf`). The trade window buys out of that same array, so a closed window finds the
shelf as it was left, and it rides the scene cache beside the shop shelves' own stock - a walk out of the hall and
back, and a save and a load, keep what was bought gone. The next day restocks it. A world move clears the ordinary
scene cache, so a visit after one mints the day's shelf again, as a shop's shelves re-roll. Offline and online
alike; a recorded departure (Port-Ledger section A, GUILD-SHELF). Pinned: `test/guildshelf.test.js` (6),
`tools/mutants/guild_shelf.json` (9, all dead).

## SHORT-TOUCH: a short landscape touch screen keeps the two columns (2)

The taps registered. The coarse-pointer layout stacks the section screen's brand, pane and rail in one column -
right for a phone held upright - and a handheld held sideways is 393 to 411 CSS px tall: the logo spans the width
and stands about 250 px, the rail wraps to two rows, and the pane between them, where every Continue, Load, Begin
and Play online button lives, came to 5 px (0 on a 393 px screen). The title and the rail drew; each rail press
opened a pane nobody could see, and its sliver was the "tiny space" that scrolled. Where height is the constraint
and width is not, the desk's two columns come back - the rail down the side with 44 px rows, the pane the whole
height (`ui/enhancedStyle.js`, not the chargen wizard, whose phone strip is its own). The first visit's sign-in
window opened 270 px down the screen with its Close off the bottom and the menu under it; on a short screen it
takes the height now. Measured: `tools/shortTouchProbe.mjs` (four handheld viewports - 24 failures before, none
after: every door's pane shows the whole height and its first button can be reached). Pinned:
`test/shorttouch.test.js` (3), `tools/mutants/short_touch.json` (5, all dead).

## PAD-DOOR and PAD-SETTINGS: the front door answers a controller, and its speeds can be set (2)

The AYN Thor has its controller built in, and the game's pad layer (`ui/gamepadInput.js`) attaches with a scene -
so the intro, the menu, its sign-in window and the boot settings answered a finger or a mouse and never the pad.
`ui/menuPad.js` is the door's own small loop over the page's own controls: the d-pad or the left stick moves the
focus to the nearest control that way (the one in line before the one off to the side), A or Start presses it, B
is Escape - the menu's own back - and left and right step a list box or a slider. A control under something drawn
over it (the sign-in scrim over the home) is not a place the focus goes; a press that redraws the menu puts the
focus back on the control now standing where it stood. `main.js` starts it with the front door and stops it when a
game is chosen, before the scene's pad starts - the two never read one press. Walked in a real page with a fake
standard pad by `tools/menuPadProbe.mjs`: the intro, the sign-in window closed with B, the home walked to Load Game,
the rail walked to Online, into its pane, and back home.

The "1.0" was a readout. The four gamepad settings (Gamepad Look Speed, Cursor Speed, Movement Deadzone, Stick
Deadzone) went live at GP1 and never got a row in `ui/settingsLaw.js` NUMBER_LAW, so each fell through to the
honest readout for a number with no stated range - a bare value with nothing to press. They are numbers with
steppers now, over their consumer's own clamps (`systems/gamepad.js` controllerSettings - the range-equals-clamp
law), shown as x1.0 and percentages. Pinned: `test/menupad.test.js` (9), `tools/mutants/pad_door.json` (13, all dead).

## TOUCH-BUTTONS: the bottom-right corner is the player's, and Attack is one of its choices (2)

TI1 fixed the corner at two buttons - Jump and Ready Weapon - and took the sword away for the swipe (hold a finger
still, then stroke), and nothing on the Touch card could change either. The corner is three slots now
(`ui/touchButtons.js`), each any of nineteen actions or none, chosen with steppers on Settings > Controls > Touch
and re-laid live as soon as no finger holds a corner button; TI1's two stay the defaults. A HOLD slot keeps its
action's key down while the finger is, a TAP slot presses it once, and ATTACK swings through the swipe's own seam -
a readied spell fires first, as the swipe's press fires it, and the stroke is one of eight directions drawn at
random, the click-to-attack swing's. Every key is the registry's, so a rebind in Controls moves what the button
presses. A host with no attack (the fly-cam) is offered no Attack slot. The layout keeps TI1's default corner at the
16 to 280 px the HUD's model was drawn against (Jump and the F button where they stood), and the model now keeps
clear of the widest corner a player can choose. On a handheld with a controller, the pad's own attack (RT) works
in-game as it always did - the missing piece there was the front door (PAD-DOOR). Pinned:
`test/touchbuttons.test.js` (8), `tools/mutants/touch_buttons.json` (12, all dead); four older pins re-aimed at the
slots (TI1's held pair, SOC C9's F button, AUDIT 39 F127, RENOWN4b's corner).

**The Android app.** There is no APK and none is planned in this batch: the game is a web app, and on Android it can
be added to the home screen from the browser, where it opens fullscreen (`public/manifest.webmanifest`). A store
package (a Trusted Web Activity or a wrapper) is Mac's call.
