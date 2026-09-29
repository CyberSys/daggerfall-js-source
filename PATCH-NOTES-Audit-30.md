# Patch Notes: Audit 30 - Smithing, Carpentry and the Market

An audit of Smithing, Logging, Carpentry and the Market, with every problem it found fixed.

## The Market
- Marks can no longer be lost or made out of nothing by reusing a request: every purchase, fee, tax and held order now keeps its own record, and a request that was already spent is refused.
- The 5% sales tax is taken on everything a listing (or a buy order) has sold, so buying in small lots pays the same tax as buying all at once.
- Searching the Materials view now finds every listing of what you typed, not only among the hundred cheapest listings on the boards. A family and a tier filter work the same way.
- Listings run cheapest first **counting the courier**: a nearby seller can beat a cheaper one far away. A row's courier fee is for the amount you'd buy.
- Your Stores, the List form, the Fill button, the Work tab and the anvil update as soon as the market moves your goods, not the next day.
- Pieces that arrive while the Market tab is open are collected at once.
- Typing a number no longer redraws the whole tab, so your next click lands and the field keeps its cursor.
- If something you tried to buy has just sold or its price moved, the tab reads the market again straight away.
- **Your trades** now shows the Marks each trade actually moved: what you paid including the courier, or what you got after the tax.
- Your own buy orders show on the Orders view, with **Withdraw**.
- List, Post, the Weavers' counter and the stations' Craft buttons are greyed out, with the reason, when they would be refused: too few Marks or gold, 30 listings or 20 orders already up.
- While the market is busy with one of your actions, another press says so instead of pretending it worked.
- A listing or purchase waiting on a slow connection is kept through a sign-in or a busy minute, and is never put back in your pack while it is still listed.
- The Market tab comes back on its own if the market was closed for a while, and reads well on a phone.
- Pieces that can't be listed: arrows, pieces still on their way to you, furniture standing in a home, and pieces enchanted since they were made (the market would lose the enchantment). Buy orders for materials nothing yields yet are refused.
- A listing can be worth at most 10,000,000 Marks.
- "1 Mark", "1 hour left": one is one now.

## Smithing and Carpentry
- A craft whose answer was slow still pays the smith or furnisher when it lands, even a day later. A workbench's slow craft says so in its own words.
- The plane is drawn, not flicked: a quick flick across the board is no longer a clean pass, a pass only moves while you hold the button, and turning on Gentle acts sets the plane down.
- You can't pick another recipe while the heat or the plane is under way, and the act always makes the recipe you started.
- A station's fee your purse can't cover is shown, and the station waits until you can pay.
- Space and Enter typed in a field or on a button no longer strike the ingot.
- A maker's mark is part of the piece's signed record, and a name is only shown as a mark when it is one.
- The Repair Kit says "Silverthorn's Longsword is mended", not "The Silverthorn's".
- The Professions page lists the Spade at Smithing 10, where it opens.

## Logging
- A Lumberjack's prompt shows the reduced number of chops.
- A tree felled yesterday stands again the next day even while the professions are closed.
- A tree that falls just as its map square reloads no longer causes an error.
- A felled tree no longer leaves its shadow behind under a nearby lantern.

## Rollout
- The professions and the market stay open to the developers first. Offline, nothing changes.
