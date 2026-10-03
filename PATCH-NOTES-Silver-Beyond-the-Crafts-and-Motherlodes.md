# Patch Notes: Silver Beyond the Crafts, and the Motherlodes

## Silver for defending towns (online, registered accounts)
- **A town you defend now pays silver.** When a raid you fought in is counted, **30 silver** is struck to your account,
  beside its Renown and the town's thanks. Your chat says so.
- **One daily limit for fighting.** Oblivion Gates and raids now share **150 silver a day**: three gates, five raids, or
  any mix. The gate used to stop at two a day. If a gate or raid would go past the limit, you are paid what is left
  of it, and anything after that pays no silver (it still counts on your record).
- The Bank's card shows how much combat silver you have earned today.

## Guild deeds
- **When three members of a guild defend the same town, or close the same gate, the guild's silver treasury earns 25.**
  Each must have been in the guild for **7 days**.
- A guild earns at most **4 deeds a day**. The member whose claim completes a deed is told in the chat, and the Guild
  tab's treasury list shows it. The Guild tab's silver treasury says how many deeds the guild has earned today.
- Each account counts once for each town or gate, for the guild of the character it claimed with.

## Guild contracts
- **A guild can pay fighters to defend a region.** On a Notice Board's **Work** tab, a Guildmaster (or an Officer, within
  the week's writ budget) can post a **guild contract**: 1 to 50 silver for each defender of a raid in that region, for
  up to 500 defenders. The whole amount is held from the guild's silver treasury.
- **Anyone who defends a town in that region is paid** as their raid is counted, less the market's 5% tax - every
  member of a party, however close together their claims arrive. Your chat says which guild paid you. A guild's own Officers and Guildmaster are not paid by its contracts. Its other members are.
- A contract stands for **7 days**. A guild can have **5** at once. Withdraw one on the Work tab, and what is left of its
  silver goes back to the treasury. The same happens when it runs out.
- Officers' contracts and writs share **one** weekly writ budget.
- A guild with a contract standing can't be disbanded until it is withdrawn.

## Motherlodes
- **Three Motherlodes break ground every day**, each in its own part of the day, on ground players have explored. Each
  stands for **two hours**, or until **20 miners** have struck it.
- **You are warned in the chat 10 minutes before one rises**, with its region and its ore. With the **Motherlode Sense**
  specialisation (Mining 100), the warning comes 30 minutes ahead. Motherlode Sense can now be chosen.
- **Find it on your compass** from anywhere in the open world, in Mining's colour. Close up it is a large, glowing heap of
  ore at a rock (where a town covers the middle of its ground, it stands at the nearest open spot outside the town).
- **Strike it with your Pick-Axe** like a vein, at its tier-6 difficulty. It needs **Mining 25**. The Watch must have
  seen you on its ground in the last few minutes - it marks those who move about, every two minutes. If it hasn't, you
  are told to walk about on it a moment.
- If its twenty miners have struck it, or it has gone, your first try tells you and the Motherlode is gone from your
  world - no more wasted swings.
- **Each strike gives 4 to 6 of its ore** (Adamantium, Ebony or Orichalcum - half again for a clean strike), Mining XP and
  **10 silver**. Each account can strike **one Motherlode a day**. It does not count against your 60 harvests.

## Behind the scenes
- Renown stays separate from silver: it still raises your health and magicka, opens sigil stages, founds guilds and
  counts toward a seat's influence.

---

### For the team: deploy order
1. Apply migrations **`0071_silver_ways.sql`** and **`0072_motherlodes.sql`** to production D1 and deploy the account
   service (**`acct71`**). The deploy workflow does both.
2. Then ship the client.

No relay change: Motherlodes use the relay's existing Watch receipt. An older service refuses contracts and Motherlode
strikes. An older client still claims raids and gates; it just doesn't say the new silver lines.
