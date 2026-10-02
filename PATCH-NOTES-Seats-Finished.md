# Patch Notes: The Seats, Finished

## The crowns' castles (online)
- **Crown sieges at the castle.** At Daggerfall, Wayrest and Sentinel, the Throne, the Gatehouse, the defenders' camp and the Palace square now stand at the **castle's entrance** in the city, not the palace door.
- **The Royal Tourney's ring** stands in the castle's square.
- **Two more banners** hang either side of the castle's entrance, in the holder's colours.

## Heraldry everywhere (online)
- **Guild tags in their colours.** A player's `<TAG>` over their head now sits in a frame edged in their guild's colour, with the guild's shield beside it - for your own guild and every guild that holds or fights for a seat.
- **The siege HUD shows both banners.** The defenders' shield stands at the left of the battle bar and the challengers' at the right.
- **The Chronicle wears its arms.** Each line of a seat's Chronicle on the Notice Board sits under the shield of the guild it is about, and the Hall of Records book now ends with a **Roll of Arms** naming each guild's heraldry.

## Moderators (online)
- **`/siege void <seat>`.** A Moderator can now void a seat's battle of the week when it was won by an exploit found after it - a siege, a Tourney or a revolt. The Chronicle says so: "The siege of X was voided by the Moderators."
- **Before its result:** the battle is called off and every Sellsword's fee goes home to the guild that offered it. The challenger's Right of Siege is spent - it does not carry to next week.
- **After a capture:** the Charter goes back to the guild that held it, at the Standing, Tithe and Legacy it had before the battle; the walls and works the capture knocked down stand again, and anything the capturer started building falls.
- **After a hold:** the holder keeps the seat but loses the Standing and the next-defence bonus the battle gave it, and the challenger's bar from the seat is lifted.
- **Rewards already claimed stay claimed** - Honours, silver, Renown and Spoils are never taken back - but no new ones can be claimed from a voided battle.

## Standing and Festivals (online)
- **Standing's trend.** A seat's board now says which way its holder's Standing moved since the last Turning - "Standing 55, up 7 since the last Turning."
- **A Festival you can hear and see.** While a Festival rules in a town, its streets play the tavern's songs, the holder's banners hang at the taverns' doors and over the bounty boards too, and a lantern glows before every banner after dusk.

## Your guild hall's outside (online)
- **Paint your hall.** A guild's Officers and its guildmaster can now choose the hall's outside - its walls, windows, roof and door - from the **Exterior** tab of the yard's decorator, just as you paint your own home. It costs nothing, and everyone walking past sees it.
- **Furnish its yard.** Stand on the hall's lot and press Decorate: the same catalogue as a home's yard, up to sixty pieces, each paid in gold by whoever places it (from their purse, then the region's bank).
- **The guild gets the half back.** Take a yard piece down, or shrink it, and half of what it cost goes into the guild's treasury - never into the pocket of whoever took it down. Sell the hall and its yard goes with it, half of each piece's cost paid back to the treasury along with the hall's own share.
- **Members and visitors look, they don't touch.** Ranks below Officer, and anyone outside the guild, see the hall's colours and its yard but cannot change them.

## Fixes
- **Voiding a revolt before it is fought no longer saves the Charter.** It now lapses, exactly as it would have at the Turning had nobody put the revolt down.
- **A voided capture gives back the holder's building projects.** Anything the defenders were building when their seat fell starts again where it was, with the materials it held taken back from the seat's stockpile - the silver they spent on it is no longer lost. A voided revolt that stood does the same, and brings back the holder's Edict for next week.
- **A guild that gave up its seat before the siege no longer gets it back from a void.** The capturer loses the seat, and it stands unheld, as it did before the battle.
- **Voiding a held siege fought before this update leaves the holder's Standing alone** instead of taking off more than the battle gave.
- **A void can no longer land after the Turning.** Once a battle's week has been reckoned, `/siege void` says so: "That battle's week is settled - its Turning has reckoned it, and it can no longer be voided."
