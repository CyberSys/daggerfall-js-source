# Patch Notes: Bounty Boards

## Town bounty boards
- In every town with two or more notice boards, half of them are now **Bounty Boards**. Two boards give one, four give two, spread around the town. The other boards keep their rumours.
- Hovering one reads "Bounty Board". Pressing it opens the board window in the Enhanced Plus style (stone and brass), whichever UI you use.
- Every bounty board in a town posts the **same four hunts**, and every player sees the same four. The notices change each in-game day.

## The hunts
- Each open-ground notice sends you to a spot **4 to 10 map pixels from the town**, always on land, never on another location.
- The spot is marked on your map with a **black circle** (green is already used for party members), on both the Enhanced Plus map and the classic map.
- When you walk onto that spot outdoors, a pack of **4 to 8 monsters** appears 60 to 110 metres away. A message tells you how far and in which direction.
- The monsters depend on your level:

| Level | Monsters |
|---|---|
| 1–3 | Rats, Giant Bats, Spiders |
| 4–5 | Grizzly Bears, Sabretooth Tigers, Orcs |
| 6–10 | Centaurs, Orc Sergeants, Harpies, Skeletal Warriors, Zombies |
| 11–14 | Giants, Mummies, Giant Scorpions, Orc Shamans |
| 15+ | Gargoyles, Wraiths, Orc Warlords, Daedroths |

- **Dungeon bounties:** when a real dungeon lies 4 to 10 pixels from the town, one of the day's notices sends you into it ("the Orcs nesting in Castle Wightmoor"). With two dungeons in reach, two notices do. The dungeon gets the black circle, and the pack of **2 to 4** lairs deeper inside, where one of the dungeon's own monsters stands 25 to 90 metres from you. A message tells you roughly how far. Towns with no dungeon nearby keep all four hunts in the open.
- **Farmsteads:** a notice about a farm (an overrun granary, stripped orchards, stolen cattle, missing shepherds) puts a farm on its spot. The farm is a real Daggerfall farmstead, copied from one of the 8 nearest farms in the game (each notice picks its own, so neighbouring hunts get different layouts) and dressed for the local climate, with solid walls. The farm is placed on the flattest ground available on its pixel, and each building and fence sits on the ground under itself, so a hillside no longer swallows it. The pack waits in the farmyard, 10 to 18 metres from the farmhouse, and appears once you're within 150 metres. From farther away, a message tells you which way the farmstead lies.
  - **Who sees it:** you, and everyone in your party (they may come and help). Players outside your party see the monsters but no farm.
  - **When it disappears:** it's never saved. It comes down when its pixel unloads and is rebuilt if you come back while the bounty is still active. Once the bounty ends (paid, given up or lapsed), it stays until you're 200 metres away, so it never vanishes in front of you. Fast travel, entering a dungeon or building, and loading a save also clear it.
- **In your quest log:** held bounties appear under **Side Quests** in both the pause menu's Quests tab and the Chronicle (L). Each shows the notice, how many you've slain, where it is, the reward and a live timer.
  - **Abandon bounty** gives it up; click it twice to confirm, so a stray click doesn't cost you the hunt.
  - In a party, **Share with party** is there too.
- **Two groups:** an open-ground pack of 6 to 8 is hunted in two groups: first half the pack (rounded up), then the rest. When the first group falls you're told how many got away, and a clue names the way: "You find tracks leading away from the bodies: the rest of the Orcs fled 230 metres to the north." The second group waits at its own spot on the pixel (the same spot for every party member holding the bounty) and appears when you get within 150 metres. The clue is kept in the quest log. Packs of 4 or 5, and dungeon packs, are one group.
- **Tiers on every notice:** each notice shows its tier and the levels in it, like "Tier 2 (levels 4–5)". This appears in the board's list, on the notice itself, in your held bounties and in the quest log.
- You can hold up to **4 bounties** at a time. Each one lasts **24 in-game hours** from when you take it.
- A bounty you've claimed isn't offered to you again that day.
- If you walk away from a pack and it despawns, your kills are kept. Only the survivors come back when you return.

## Rewards
- Killing the last monster completes the bounty immediately. A reward notice appears and **pauses the game** until you close it.
- The notice tells a short story (a mysterious rider, a courier, a boy from town...) and then lists exactly what you received.
- **Gold** depends on the monster tier and how many monsters you had to kill. A full pack of 8 pays the tier's full purse, and each monster fewer takes 10% off, so a pack of 4 pays 60%:

| Tier (levels) | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|
| 1 (1–3) | 30 | 35 | 40 | 45 | 50 |
| 2 (4–5) | 45 | 53 | 60 | 68 | 75 |
| 3 (6–10) | 54 | 63 | 72 | 81 | 90 |
| 4 (11–14) | 60 | 70 | 80 | 90 | 100 |
| 5 (15+) | 150–160 | 160–170 | 170–180 | 180–190 | 190–200 |

  At level 15+ each monster past four adds 10, and up to 10 more is added for how strong the monster type is. A dungeon pack of 2, 3 or 4 pays like an open-ground pack of 4, 6 or 8, because dungeon fights are closer and harder.
- **Item:** one random weapon or armour piece.
  - Levels 1–3: white, at half condition.
  - Levels 4–5: three-quarter condition, with a 50/50 chance of white or blue (Magic).
  - Level 6 and up: full condition, with a 50/50 chance of white or blue (Magic).
  - Never higher than blue.

## Parties (online)
- **What each player sees on the board:** the same notices in the same places for everyone. The monster tier and the reward come from your own level: a level 2 player reads "Rats" where a level 12 reads "Giants" on the same notice.
- **Sharing works within a tier only.** **Share with party** gives the bounty to every party member in the same monster tier (1–3, 4–5, 6–10, 11–14, 15+) who has a free slot. Party members in another tier aren't given it and are told why. **The sharer is told too**, for example: "Bran (level 3) is too low level to take this bounty, but can still help you hunt." This also shows in the board window when you press Share. The same applies to **Join the hunt** on the board: it only offers hunts in your own tier.
- **Anyone can help.** A party member in another tier can still fight alongside the holder. They see the monsters (shared as always) and the farmstead, but they get no reward for a bounty they can't hold.
- **One hunt per notice per tier.** Party members in the same tier holding the same notice share one pack, share its kill count, and are all paid when it's cleared, as long as they took the bounty before it was cleared. Each is paid at their own level. On the same notice in two different tiers, each tier's holders get their own monsters and their own pay.
- **One farm per notice.** Everyone sees the same farmstead in the same place. The second group of a split hunt waits at the same spot for everyone in that hunt.

## Server
- The relay moves to **world125** (world123 on the branch; main's Overworld update took the numbers between): party updates carry a small list of the bounties each member holds (with the hunt's kills), and each member's level (so a sharer can be told who's in the wrong tier). The relay updates itself when this reaches the main build.
- Until then, bounties work solo, but sharing and shared rewards do nothing.

## Death penalty (online)
- Dying online now costs **a quarter of the gold in your purse**, rounded down (three coins or fewer lose nothing). Gold in the bank and letters of credit are safe.
- The death screen tells you how much before you rise, and exactly that is taken (never more than you carry). If a party member resurrects you, you lose nothing.
- Offline nothing changes: a death still ends the run.
