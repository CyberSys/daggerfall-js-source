# Patch Notes: Quieter seas, live travel settings, a clearer fatigue bar and a few graphics fixes

## Ships
- **Ship name tags no longer pile up.** Off a busy harbour, every ship's tag used to sit on top of the others. Now no tag is drawn over another: the ship you're looking at, then hostile ships, then the nearest ones get their tags first, and a tag with no room waits until there's space for it.
- **Other players' AI ships sail smoothly.** Online, ships run by another player's game jumped forward, sped up to more than twice their real speed and sometimes slid backwards, whenever the network was a little slow or quick. They now keep sailing at their own speed and catch up gently.
- **Only one ship shows its second line** (its class and where it's headed). That's the ship whose card is up, or else the one nearest your crosshair. Look at a ship to read it; the rest show just their name and health bar.

## Travel Options
- **Changing the Travel Options settings now takes effect straight away.** You no longer need to relog. Turn off the first dial, **Player Controlled Cautious Travel**, and a trip with Cautiously picked uses Daggerfall's fast travel the next time you open the map. The same goes for Only From Ports, Location Pause, Avoid Obstacles and the Acceleration Limit. A few things still wait for the next load: turning the whole mod on or off, its roads and junction-map options, and paid teleportation.
- **New dial: Player Controlled Inns Travel.** It sits under the cautious one in Features > Travel Options. With it on (the default), any trip that stops at inns is a journey you travel, including reckless ones. Turn it off and a trip that stops at inns uses fast travel. Reckless trips where you camp out are always journeys you travel, as in the original mod.

## HUD
- **The lost part of the fatigue, health and magicka bars is faint now.** When a bar drops, the part you just lost used to show as a pale, almost white strip. On the fatigue bar it looked like fatigue you still had. Now it's a dim strip of the bar's own colour.
- **That strip no longer gets stuck.** If a bar kept dropping a little at a time, such as fatigue during a long fight, the strip stayed at your starting level for the whole fight. Now it stays for at most about a second before catching up.

## Loading
- **Pressing a key while the world loads no longer shows a red crash message.** A volume key, F11, a gamepad button or anything else pressed during the loading screen used to put up an error that stayed for the whole session. Keys pressed during loading are now ignored until the world is ready.

## Swimming
- **Sinking into water no longer puts your view under the ground.** In water your view was only 0.2 m above your feet, and the bobbing while swimming took it lower still. In a moat, at a dock or by the shore you could end up looking at the underside of the ground, with the sky showing beneath you. Your view now sits where Daggerfall puts it, about half a metre above your feet.

## Graphics
- **Likely fix for dark boxes around sprites on Macs with Apple chips.** A change in the last update could draw a dark outline around people, enemies and other sprites on some graphics chips, and the texture filter setting didn't help. The sprite shader now reads its textures in a way every graphics chip handles the same. We couldn't test on an Apple chip ourselves, so if you still see the boxes, please tell us on the Discord.

