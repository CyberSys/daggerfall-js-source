# Patch Notes: Alchemy and Enchanting

## Alchemy (online)
- **The alchemy station.** Brew potions at any **Alchemist's** shop (50 gold a brew), or at the **alchemy station** in your own home. Open your **Stores page**: **The Alchemy Station** lists Daggerfall's own twenty potions and what each needs. Your potions go to your pack, and they are Daggerfall's own potions - they stack, drink and sell as any other.
- **Your ingredients come from your Stores:** herbs you picked, metals and gems from the veins, the Pearl from the sea, a body's parts from Hunting. The rest - Werewolf's Blood, Fairy Dragon's Scales, Unicorn Horn, Ectoplasm, Troll's Blood, Snake Venom, Mummy Wrappings, Saint's Hair, Small Tooth, Pure Water, Rain Water, Orc's Blood, Elixir Vitae, Nectar, Ichor and Ivory - are sold at the new **Apothecaries' counter** on the Notice Board's Market tab, beside the Weavers', and at the station whenever a recipe is short of one (1 to 40 silver a measure).
- **Ranks by price:** the cheapest potions (Orc Strength, Stamina, Healing, Water Walking) from rank 0, the resistances and Restore Power from 10, up to Invisibility at 70 and Purification at 90.
- **More potions as you rise:** one a brew, two from Journeyman, three as a Master.
- **Potent potions.** From Expert a brew may come out **Potent** - +25% to every magnitude, and named so ("Potent Potion of Healing"). 10% at Expert, 20% at Master, and **+5% for each herb you picked unbruised** with the Sickle's steady hand. A Potent potion stacks only with Potent ones and is worth a quarter more.
- **XP** comes with every brew by the potion's rank, and +500 the first time you brew each one (not for a potion made only of the Apothecaries' goods).
- **Daggerfall's potion maker** (with the ingredients in your pack) is unchanged, and still earns nothing toward Alchemy.
- **Specialisations:**
  - **Brewer** (50): three potions a brew at Journeyman.
  - **Distiller** (50): +10% Potent chance.
  - **Master Alchemist** (100): Potent potions are +40%, not +25%.
  - **Transmuter** (100): at the alchemy station, turn three of a metal and a Mercury into one of the next up - Tin to Copper, Copper to Silver, Silver to Gold, Gold to Platinum.

## Enchanting (online)
- **Cheaper enchanting.** The item maker now costs less gold as your Enchanting rises: 10% off from Journeyman, 20% as a Master, and the **Efficient** specialisation takes 5% more.
- **Disenchanting.** At an enchanting station - a **Mages Guild** hall (50 gold a piece) or the **enchanting station** in your own home - a crafted piece in your pack comes apart into **Arcane Essence** in your Stores: one for every 100 enchantment points it carried (a Gold Ruby Ring gives 21). Press twice: the piece is gone. Only a piece a crafter made online can be disenchanted - never loot. A **Disenchanter** gets twice the Essence.
- **Enchanting XP** comes from every piece you disenchant.
- **Arcane Essence** sells on the market like any Stores material.

---

### For the team
- Deploy the account service (**`acct69`**), with migration **`0070_alchemy.sql`** (`prof_unbruised`, `prof_brews`, `prof_disenchants`). No relay change. Then ship the client. The account deploy's path filter now also lists `src/net/alchemyLaw.js`, `src/systems/potionRecipes.js` and `src/characters/itemTemplates.json`, which the service bundles for Daggerfall's potion recipes and enchantment points. The Apothecary is open (Seats-Arc 7.5) - see `PATCH-NOTES-Seats-Finished.md`.
