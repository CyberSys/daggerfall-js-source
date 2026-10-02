# Patch Notes: Cooking

## Cooking (online)
- **Cook at any fire.** Stand by a lit fire - a campfire (yours or anyone's), a hearth or a brazier, in the wilds, a town, a building or a dungeon - and open your **Stores page**: **The Fire** lists what you can cook. No fee. Your dishes go to your pack.
- **Four dishes**, from what you gather into your Stores:
  - **Hunter's Stew** (from rank 0): 2 Raw Meat, 1 Mushroom, 1 Root Bulb. **Endurance +5 for 2 hours.**
  - **Fisherman's Supper** (from rank 0): 2 Raw Fish, 1 Egg, 1 Green Leaves. **Agility +5 for 2 hours.**
  - **Orchard Tart** (from rank 10): 2 Apples, 1 Egg, 1 Yellow Berries. **Your stamina lasts a fifth longer for 4 hours.**
  - **Feast of the Hearth** (from rank 70): 4 Raw Meat, 4 Raw Fish, 2 Apples, 2 Oranges, 2 Mushrooms, 2 Eggs. **Strength, Endurance and Willpower +5 for a whole day - for you and every party member in your area.**
  - Northern and southern herbs both work.
- **The pan.** Each dish is cooked in three pans (a feast five). Each pan heats from raw to burnt - take it off while it is in the window (Space, Enter or the button). Take every pan off at the right moment for a clean dish and half again the XP. A **Skillet** in your pack widens the window. Quick cook skips it.
- **Eating a dish** fills you up like a meal (with Climates & Calories on) and gives its bonus. Eating the same dish again refreshes the bonus - it does not stack. Dishes spoil like other food.
- **XP follows your rank**, and you get +500 the first time you cook each dish.
- **Dishes sell on the market** (a new **Dishes** category) and can be asked for in commissions.
- **Specialisations:**
  - **Cook** (50): every dish makes two servings.
  - **Field Cook** (50): lighting a Campfire Kit uses none of its charges.
  - **Chef** (100): your feasts last half again - a day and a half, for whoever eats them.
  - **Provisioner** (100): your dishes, and the food you take out of your Stores, never spoil.
- **The Professions page** lists Cooking as practised.
- Cooking a Raw Fish over a fire from your pack still works as before - it is a plain meal and gives no Cooking XP.

---

### For the team
- Apply migration **`0069_cooking.sql`** to production D1 and deploy the account service (**`acct67`** - `acct66` is another branch's fix, deployed first or with it). Then ship the client. No relay change.
