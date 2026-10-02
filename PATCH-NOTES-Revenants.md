# Patch Notes: Revenants

## Revenants
- **Elite and Champion foes (level 3+) that kill you become your revenant.** They get a name of their own and an epithet for what they did, e.g. "Grushnak the Butcher" or "Varis, Bane of Ayla".
- **They can also run.** Below 20% health, a special foe has a small chance (5%) to break and flee. If it gets away, it becomes a revenant too ("the Scarred", "Who Ran").
- **They come back.** One to three in-game days later, a revenant can turn up in place of a wilderness encounter. Only one comes at a time, the strongest first.
- **Stronger every time.** Each time a revenant kills you or escapes, it ranks up (up to rank 5) and earns a new epithet. Each rank adds health (+25%) and damage (+10%). Human foes also gain levels.
- **Spells and poison count.** A foe whose spell, lingering effect or poisoned blade finishes you becomes your revenant just like one that cuts you down.
- **They remember even if you reload.** Revenants are tied to your character and survive an offline death or loading an older save. Up to 5 can hunt you at once.
- Revenants follow the **Loot rarity** setting. Turn it off and no new ones are made.

## Personalities
- **Every revenant has a personality** that shapes everything it says: **Brutal, Witty, Humorous, Arrogant, Cold, Zealous, Unhinged, Honourable, Craven or Weary.**
- A revenant keeps its personality for good. What it is leans who it is: orcs tend brutal, liches cold, daedra arrogant, and a person can be anything.
- **Every moment has its own lines in each voice:** the taunt when it returns (different if it killed you, if it ran from you, or if it has come back three times), breaking to flee, being cornered, escaping, its last words, its gloat after killing you, begging or defying you when beaten, its last words before an execution, its oath when spared, and its words as your companion.
- **Beasts don't talk.** Their temperament shows in what they do instead ("Sinks low before you with a nervous whine, beaten").
- The card and the Revenants page show each revenant's personality.

## Kill or spare
- **A beaten revenant yields instead of dying.** It drops to its knees at the edge of death, says its piece in its own voice, and waits for your judgement. Nothing can hurt it while it kneels, and other foes leave it alone.
- **Walk up to it and use it to choose its fate.** The choice opens in the **loot window**, with its name, its plea and two choices:
  - **Kill.** This shows the exact weapon it will drop.
  - **Spare.** This says where it will go: to your side, or away if your companion slots are full.
- Click a choice, then confirm it. You can also press **K** or **S**, then **K**/**S** again or **Enter**. **Esc** backs out of a pick, or closes the window and leaves it kneeling.
- **Don't take too long.** If you leave it kneeling for 90 seconds, or walk away, it slips away. That counts as an escape: it ranks up, and it remembers your hesitation. The wait pauses while its window is open.
- A flying revenant kneels on the ground, so you can always reach it.

## Kill: the execution
- **Choosing Kill plays an execution.**
  1. It says its last words and the blow lands.
  2. Blood bursts out with a flash and the screen shakes.
  3. Its body burns away in embers from the feet up until nothing is left.
- **It counts as your kill**: Renown, and a soul for a Soul Trap or Azura's Star.
- **It drops a unique weapon** of its own, plus everything it carried, in a pile where it knelt:
  - **The right weapon for it.** It's the weapon it fought with, or one that fits what it was: an orc's axe, a lich's staff, a vampire's saber, a barbarian's claymore, an assassin's tanto.
  - **Named for it**, e.g. "Grushnak's Reaver" or "Varis' Requiem".
  - **A random rarity, never Common**: Magic, Rare or Legendary. The higher its rank, the better the odds.
- An executed revenant is gone for good. The Revenants page lists it among the Fallen as "Executed".

## Spare: your companions
- **Choosing Spare frees it and swears it to you.** It rises, steps into a portal and joins you as a **companion**. It never hunts you again.
- **Sworn revenants use the same companion system as your crew.** They follow you through every door and into buildings and dungeons, fight at your side, and keep up with you. Their health and spells carry over between places.
  - They fight with the strength of their rank and go by their own names.
  - Use one to open its pack and store items.
  - Each has a card on the party panel and a green health bar overhead.
- **Companion slots are limited: 3 at your side**, shared between sworn revenants and any ship's crew you've brought ashore. If your slots are full when you spare one, it waits **away** until you call it. If loading a game ever puts more than 3 at your side, the most recently sworn steps away. You can have up to **6** sworn revenants in total.
- **Knocked out, not killed.** A companion that falls is carried off through a portal to recover for 8 hours, then waits for your call.
- **A new Companions page** (pause menu, Stats rail):
  - **The slot strip.** Shows who stands in each of your 3 slots, crew included, and which are open.
  - **At your side.** Each companion's portrait, rank, personality and health, with **Send away**.
  - **Away.** Companions waiting or recovering, with **Call**. If it can't come yet (your slots are full, or it's still hurt), it tells you why.
  - **Release** frees a companion for good and hands you back its pack. It asks you to confirm first.
- **They talk in their own voice:** when they arrive, when sent away or released, when they fall, and now and then when they charge into a fight or finish a foe.

## Portals
- **Companions no longer pop in and out.** They step through a swirling violet portal:
  - when they arrive in a new place or come when called;
  - when they're sent away or carried off;
  - when they catch up to you after falling behind, through a pair of portals (one where they were, one where they reappear).
- The figure gathers out of the light as it arrives and burns into it as it leaves. This applies to your ship's crew ashore too.

## Online
- In online play, other players see your beaten revenant kneel, burn away when you execute it, or step into its portal when you spare it. The choice is yours alone.
- Other players see your revenant by its name.

## Fixes (from a full audit)
- **Nothing can hit a kneeling revenant**: no weapon, arrow or spell. Before, your weapon's poison and life drain still applied, and it trained your skills.
- **A revenant you've judged can't come back.** If its poison killed you after you executed or spared it, it no longer rose again or ranked up.
- **Saving while a revenant stands** no longer leaves a nameless copy of it behind.
- **Dungeon saves:** a revenant that escaped, was executed or was spared no longer leaves a lootable corpse after a load.
- **Companion packs** follow your save: loading no longer duplicates or loses the items you gave them.
- **A spared revenant** no longer appears twice for a moment while it steps into its portal.
- **Spells a companion carried** (like a poison) no longer come back with it after it recovers, is sent away, or you load.
- **The Execute button and confirmed Release** are edged in red. The kill choice shows the weapon's card on hover. The window fits on phones.
- **Rendering:** fixed a bug where every sprite could vanish after an execution in a dungeon. Elite glow no longer hangs in the air while an elite revenant burns away. A burning or arriving body no longer casts a full shadow.
- **Words:** a revenant that only ever ran no longer boasts about how often it killed you. Skeletons, zombies and atronachs are no longer "Witty". Every personality has more lines.

## Elites
- **Elites are rarer.** In the open world, 2% of foes (was 5%), and only one at a time: none while another elite is nearby, and none for about 15 minutes of play (3 in-game hours) after the last. A camp or a pack never brings more than one. Ordinary dungeons hold one 10% of the time (was 20%). Elite Dungeons keep their 3 to 4.
- **Elites no longer appear below foe level 3,** and never as city watch or allies (same rules as Champions).
- **Elites are named everywhere:** on hover, in death notices and on their corpses, not just the target bar. Champions, elites and revenants are now named on hover even while hostile.

## Notes
- The cards, the kill-or-spare window and the Companions page are Enhanced UI. On the Classic skin, the cards appear as text and the choice is a keyed box (K, S, Esc).
- The revenant card is a HUD piece like any other: unlock the UI (Alt+U) to move it.
