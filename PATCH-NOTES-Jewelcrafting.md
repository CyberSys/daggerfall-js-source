# Patch Notes: Jewelcrafting

## Jewelcrafting (online)
- **The jeweller's bench.** Make jewellery at any **Pawn Shop** or **Gem Store** (50 gold a piece), or at a **jeweller's bench** in your own home (a new home station, 50,000 gold). Open your **Stores page**: **The Jeweller's Bench** lists what you can make. Your pieces go to your pack.
- **Eight pieces** - Daggerfall's own rings, marks, bracelets, bracers, amulets, torcs, cloth amulets and wands:
  - **Ring:** 1 Silver, Gold or Platinum, and a gem if you like.
  - **Mark:** 1 metal and 1 gem.
  - **Bracelet:** 2 metal.
  - **Bracer:** 2 metal and 1 Cured Leather.
  - **Amulet:** 2 metal and 1 gem.
  - **Torc:** 3 metal.
  - **Cloth Amulet:** 1 Linen and 1 gem.
  - **Wand:** 2 Ironwood or Ghostwood Planks and 1 gem.
  - The gems are the eight a vein gives (Ruby, Emerald, Sapphire, Diamond, Jade, Turquoise, Malachite, Amber) and the sea's Pearl.
- **Ranks:** Silver pieces and Cloth Amulets from rank 0, Gold from 25, Platinum from 55, Wands from 70.
- **Enchantment points.** A crafted piece holds more than a found one: **Gold +10%**, **Platinum +20%**, and **+10% for a set gem**. The item maker reads them when you enchant it. A gemmed piece is worth its gem as well.
- **Quality.** Pieces come Crude to Masterwork, as smithing does - a Superior or a Masterwork rolls a magic property, and a Masterwork carries your name.
- **The facet.** Each piece is cut in three facets (five with a gem). The stone turns slowly along the dial - stop it where it catches the light (Space, Enter or the button). Catch every facet for a clean piece, one quality step better. Willpower and Luck widen the window; so does your rank. Quick craft skips it.
- **XP** comes with every piece by its tier, and +500 the first time you make each one.
- **Jewellery sells on the market** (a new **Jewellery** category), goes to auction as a Masterwork, and can be asked for in commissions.
- **Specialisations:**
  - **Gemcutter** (50): a set gem adds +20% enchantment points, not +10%.
  - **Goldsmith** (50): your Silver pieces hold Gold's points and worth.
  - **Master Jeweller** (100): Masterwork chance +5%.
  - **Lapidary** (100): set a Siege-cracked Gem (a Spoil of War) as any gem the piece asks for.
  - What a Gemcutter or a Goldsmith gave a piece stays with it, whoever owns it.
- **The Professions page** lists Jewelcrafting as practised.

---

### For the team
- Deploy the account service (**`acct68`**). No migration (a piece's jeweller's hand rides `0069`'s `products.hand`), no relay change. Then ship the client. The account deploy's path filter now also lists `src/systems/itemTemplatesData.js`, which the service bundles for Daggerfall's Jewellery list.
