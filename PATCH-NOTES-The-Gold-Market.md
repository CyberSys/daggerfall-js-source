# Patch Notes: The Gold Market

## Market (online realm characters)
- **Trade in gold or Drakes.** You can now price a listing in **gold** as well as Drakes. On the Market tab, switch between **Drakes** and **Gold** next to the filters in Materials, Crafted and History. Each view shows one currency at a time.
- **Buying with gold.** The gold comes out of your purse first, then your letters of credit, then your bank account in the region of the board you're using. You always pay exactly the price shown. If the purchase is refused, the gold goes straight back.
- **Selling for gold.** In **My listings**, choose **Priced in gold** when you list a Stores material or a crafted piece.
  - There's no fee to list. Each sale pays 1% plus the usual 5% tax out of its price.
  - Your gold is held for you until you collect it. Press **Collect into your bank here** under My listings, and it goes into your account at that board's bank.
- **Couriers** cost 10 gold for every Drake a Drakes courier would charge.
- Buy orders, auctions and commissions are still in Drakes.
- Gold trading is for characters of the online realm. Other characters see the Drakes market as before.

## What gold buys stays gold's
- **Materials bought with gold** show in your Stores as "bought with gold". You can withdraw them to your pack or sell them again for gold. They can't be used at a Forge, Workbench or Loom, in a craft, for a Court or guild writ, in the guild Stores, to fill a buy order, or sold for Drakes.
- **A piece bought with gold** can only be listed again for gold.
- **Goods bought with Drakes** can only be sold again for Drakes.
- This keeps gold and Drakes apart, so the market can't be used to get around the Bank's daily limit and exchange rate.

## Good to know
- A character whose sales are holding gold can't be deleted until the gold is collected.
- Materials and pieces you gathered or made yourself can be sold for either currency.

---

### For the team: deploy order
1. Apply migration **`0040_gold_market.sql`** to production D1 and deploy the account service (**`acct39`**).
2. Then ship the client.

An older service refuses every gold listing and gold purchase. An older client with the new service keeps seeing the Drakes market as before. This PR doesn't change the relay.
