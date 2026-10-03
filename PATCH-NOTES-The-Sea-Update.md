# Patch Notes: The Sea Update

## Iliac Puddle No More (jet082) - new, on by default
- The Iliac Bay is a real sea. The seafloor falls away from every coast, down to 250 m at its deepest (the mod's "Maximum water depth" setting).
- You can see the water's surface from above and from below. Underwater the view fogs and takes the water's tint, and sound is muffled.
- Swim anywhere in open water, with your breath to watch. Hold Run while swimming for a burst of speed. Argonians never drown (a setting, on by default).
- The seafloor has weed, coral, rocks and the remains of sea life.
- Seven kinds of fish swim in schools, each at its own depth. Get close to a fish to take it as an item.
- Things live in the deep: slaughterfish, dreugh, lamia and nymphs nearer the surface, the undead and ice atronachs further down, and now and then a boss in the depths.
- Treasure lies on the seafloor: loose piles among a little rubble, and now and then a wreck - a field of debris with several piles of loot in it, guarded by the undead. The Treasure Cove setting makes both richer.
- Every part has its own settings: the depth, how many fish and creatures there are, the seafloor decorations, the fog, how clear the surface is, and your swim speed.

## There's a Hole in the Bottom of the Ocean (jet082) - new, on by default
- Out in the open sea, holes open in the seafloor: about one open-ocean map square in 48 has one (a setting). From the surface you see a blue-black hole under a column of purple mist.
- Swim down into the hole to reach a drowned dungeon: a real Daggerfall dungeon, flooded to its ceiling and renamed for the depths, its lights out and its fire creatures gone.
- The deep's own creatures take the dungeon over - slaughterfish, dreugh, lamia and the undead - and its treasure is better than a dry dungeon's.
- Take the dungeon's exit to rise back up to the hole you came down.
- A Recall anchor set inside brings you back to the drowned dungeon, and a save made inside loads back into it.
- Settings: how many holes there are, how big they are, the mist, and how dark and foggy the drowned dungeons are.
- Online, the holes are in the same places for everyone in a room. A death in a drowned dungeon wakes you at its hole.
- Needs Iliac Puddle No More.

## Come Sail Away (RedRoryOTheGlen) - new, on by default
- Own a boat and sail it. General stores and pawn shops sell the parts of a rowboat, which you carry in your pack, and deeds to bigger boats: the Large Boat, the Small Ship and the Large Galley.
- Use the parts to put the rowboat in the water in front of you. Use a deed near a port to put its boat in the water there.
- Take the helm to sail. Row with the movement keys, or raise the sails and let the wind carry you. Trim the sails yourself, or let them trim themselves.
- The wind changes with the hour and the weather. At the helm, a small picture on screen shows which way it is blowing.
- Waves break along the coasts. Your boat leaves a wake, rolls on the swell and is pulled by the current, and its sails, oars and rudder move as you sail.
- You can walk the deck and light the lanterns from the helm. The Small Ship and the Large Galley carry a crew, and a bed you can rest in when Roleplay Realism's bed sleeping is on.
- Load cargo into the hold, but the heavier the load, the slower the boat. A rowboat or a Large Boat can be packed back into your pack, cargo and all.
- At the helm you can speed time up, as much as thirty times, while no enemies are near.
- Find out where you are. At midday or midnight in clear weather, read your position on the travel map, and mark places on it.
- A boat stays where you leave it, and is saved with your game. A boat you put in a dungeon's water is lost when you leave the dungeon, unless its settings' Persistent Dungeon Boats is on.
- Every part has its own settings, including its keys.
- Works with Iliac Puddle No More's deep sea, and with Eye of the Beholder, whose camera follows the boat you sail.

## Warm Ashes - Ships (Kamer) - new, on by default
- A sea voyage can be ambushed. When a fast travel crosses the sea and you sail, there is a one-in-four chance that pirates attack.
- You're put on your ship's deck with your crew. Fight off the boarders and the ship continues to where you were going.
- If you don't own a ship, you're lent one for the fight.

## Detailed Ships (Cliffworms) - new, on by default
- The two ships you can buy have new decks and interiors: rigging, crates, barrels, rudders and railings on deck, and below it the captain's quarters, the crew's berths, a galley, a cargo hold, an armory and a shrine to Kynareth.
- Sailors stand aboard to talk to: three on the small ship, seven on the large.
- The containers aboard can be used for safe storage.

## Aquatic Sprites (Cliffworms) - new, on by default
- Three flooded dungeon areas gain the underwater plants and sea life Daggerfall ships with but never places.

## Water
- Puddles, docks and moats in towns no longer show as flat blue squares. The water now follows the shape painted on the tile, so a puddle looks like a puddle.
- Tiles whose art is sand or grass no longer get a square of water drawn over them.
- Grass grows on the dry part of those tiles instead of leaving a bare square.
- Where you wade is unchanged: it still covers the whole tile, as in Daggerfall Unity.

## Performance
- Rain, overcast and stormy skies no longer cost frame rate on weaker machines. The clouds' share of each frame now stays close to a clear day's in every weather, and the sky looks the same.
- If a machine still struggles in bad weather, set Features > Cloud quality to Low. In rain it costs about a quarter of Default.

## Online
- Iliac Puddle No More's sea, its depth, the creatures of the deep and its swimming rules are the same for everyone in a room. How the water looks (the surfaces, the fog, the fish and the seafloor plants) is each player's own choice.
- Detailed Ships is on for everyone online.
- Warm Ashes - Ships ambushes belong to your own voyage. Aquatic Sprites is each player's own.
- Come Sail Away's boats are each player's own. Others in your area see your boats, both where you left them and as you sail them, but can't board them.

## Fixes
- Online: auto-travel no longer crashes the game when it stops beside a spawned dungeon ("Error finding location ...").
- The sea at a distance no longer looks like large dark square panels with pale lines between them. It now fades into the distance haze the way the land does.
- Along the coast, the ordinary water no longer draws a second, shallower sheet inside the deep sea, or over the bits of shore the deep sea turns back into ground.
- Creatures under the sea, and anything dropped there, now fade into the water with depth when seen from above, the same as the seafloor around them.
- Opening a window (the inventory, the map) while underwater no longer lets your breath run out behind it.
- Swimming in dungeon water now makes the same swimming splashes as the open sea.
- Loading a save no longer carries the swim state of the moment before over into the loaded game.
- Clicking a bed to rest (Roleplay Realism's beds) now opens the rest window straight away, as in Daggerfall Unity. It used to show a waiting quest offer first.
- Travel Options: a journey started or resumed from the travel map runs at the speed its travel bar shows. It had been dropping to x1 the moment the map closed, with "Time scale set to 1." on screen.
- Placing a boat while swimming, or with water surfaces turned off, puts the boat on the water above where you pointed. It used to sink to the seabed out of sight, the deed or parts used up and only its creaking to be heard.
- Pointing out to sea past your reach no longer puts the boat far away out of sight: it says "Placement aborted!" and you keep the deed or parts.
- A boat you leave stays where you left it however you come back to it - walking round by another way, fast travelling, or waking at a temple after dying. It used to turn up somewhere else, or nowhere.
- Boats sail on the open sea. With Iliac Puddle No More on (the default), every boat put in the sea - a deed's beside its port, a rowboat from its parts - was taken for run aground: it would not row, and raising its sail said "Unable to raise sail. Boat is obstructed." Boats you have already placed sail from where they are.
