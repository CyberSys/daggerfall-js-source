# Patch Notes: Fishing

## Fishing (online)
- **Fish with the net.** Carry a **Fishing-Net**, stand in water, swim, or stand at sea, by daylight (07:00-17:59). A prompt appears: **Cast the net**.
  - **Hold E** to wind the net, then let go to throw it. The longer you hold, the farther it goes (3 to 12 metres).
  - **Wait** for a bite. The fish bite faster in the first and last hours of daylight, and slower in a thunderstorm.
  - **When the floats dip, press E** (or attack) straight away. On a phone with haptics on, it buzzes.
  - **Haul it in:** hold E to raise the band, let go to lower it. Keep the net's weight inside the band until the net is full.
- **What you catch:** 1-2 Raw Fish go to your Stores. The message names the fish, for example *"+2 Largemouth Bass, as Raw Fish"*.
  - A **full net** gives more.
  - A missed tug or a slipped net still gives a plain catch, never nothing.
- **Schools:** two schools rise in the water of each area every day. You'll see the fish on the surface, or the prompt tells you where, for example *"a school rises 14 m north"*. Cast into one for an extra fish.
- **At sea:** on ground other players have confirmed, you can sometimes catch a **Pearl** (1 in 50) or a **Slaughterfish** (1 in 100). A Slaughterfish gives its scales and an extra fish.
- **Trophies:** about 1 haul in 200 brings up a trophy fish, which goes straight into your pack.
- **Daily limit:** 40 hauls a day per account.
- **XP follows your rank.** Each haul gives XP as if it were the highest tier your rank has unlocked. Fishing now levels like the other gathering skills: a Novice earns 15 XP a haul, a rank 55 angler 75.
- **Specialisations:** Angler (a longer tug window) and Netter (+2 fish from a school, not +1) at 50; Deep-Sea (the sea's Pearl and Slaughterfish chances doubled) and Pearl Diver (Pearl chance tripled) at 100.
- **The Professions page** now lists Fishing as practised, shows your hauls today, and explains how to fish.

## Good to know
- Pearls can be withdrawn from your Stores as Daggerfall's own Pearl, and sold on the market.
- Fishing doesn't work in dungeons or settlements. If you can't fish yet, the prompt tells you why.

---

### For the team: deploy order
1. Apply migration **`0042_fishing.sql`** to production D1 and deploy the account service (**`acct41`**).
2. Then ship the client.

An older service refuses every haul as a bad node. This PR doesn't change the relay.
