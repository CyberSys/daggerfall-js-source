# Patch Notes: Guild Halls, Heraldry and the Guild Board

## Guild halls (online realm characters)
- **Buy a hall for your guild.** A guildmaster whose guild has no hall can buy any house as the guild's hall. At the house's door, choose **Buy it for <your guild>**. Press it twice to buy it. On a touch screen, or where the door shows no list, the house's buy box offers the same choice.
  - The guild treasury pays the house's price plus half again. Only gold that realm characters put into the treasury counts.
  - A guild has one hall. The hall belongs to the guild, not to any character.
- **Who may walk in:** the guild's members, or anyone. The guildmaster and Officers choose, at the hall's door or on the Guild tab.
- **In the hall:**
  - Every cupboard is the **guild's chest**. For members it opens the guild Stores on the Guild tab.
  - Members may rest in its beds, use its crafting stations (forge, workbench and loom included) and cast spells in it.
  - The guildmaster and Officers can **decorate** the hall with pieces from the catalogue. Each piece is paid for from the gold of whoever places it. When a piece is removed or shrunk, half of what it cost goes into the guild treasury.
  - Your own items can't be placed in a hall, and nothing dropped in a hall stays there. Its yard and outside can't be customised yet.
- **Selling the hall:** on the Guild tab, the guildmaster presses **Sell the hall** twice. 85% of what the hall cost, plus half of what its pieces cost, goes back into the treasury.
- A guild with a hall can't be disbanded, and its last member can't leave or delete their character, until the hall is sold.
- The treasury ledger now shows what the hall's gold was for: bought, sold, or a piece's half back.

## Your guild's board
- **Notes for your guild only.** Every Notice Board has a new **Guilds** tab. It shows your guild's own board, which only its members can read.
  - Any member can pin a note for the guild. You can have 3 up at a time, apart from your notes on town boards.
  - You can take down your own notes. The guildmaster and Officers can take down anyone's.
- **Recruitment posters.** The Guilds tab also shows the guilds recruiting in that town, each under its banner.
- **A board in your hall.** Officers can place a **Notice Board** in the guild's hall from the decorator. For members it opens the guild's board.

## Your home, open to your guild
- Homes have a new setting under **Who may enter**: **My guild**. Members of your character's guild can then walk in.

## Heraldry
- **Every guild can raise a banner:** a field colour, a border colour and a device. There are 16 colours and 24 devices (wolf, bear, stag, dragon, tower, crown, sword, sun, rose and more).
  - Ash can only be used as the border.
  - The guildmaster chooses on the Guild tab, which shows the banner as you choose it.
  - The first choice is free. Each change after that costs **500 Drakes** from the guild's Drake treasury, and the Drake ledger shows it as a heraldry change.
- **Banners at the hall:** once your guild has heraldry, two banners hang either side of its hall's door, swaying in the wind.

## Fixes
- **Rented rooms:** a tenant can now sleep in the home they rent. They were told "You have not rented a room here."

---

### For the team: deploy order
1. Apply migrations **`0046_guild_halls.sql`** and **`0047_guild_board.sql`** to production D1 and deploy the account service (**`acct49`**, with the seats' migrations - `PATCH-NOTES-Seats.md`).
2. Then ship the client.

An older service refuses every hall and heraldry act, so the Guild tab reports those refusals. This PR doesn't change the relay.
