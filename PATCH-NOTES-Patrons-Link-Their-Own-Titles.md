# Patch Notes: Patrons Link Their Own Titles

## Patreon titles, automatically
- **Link your Patreon.** Open your account card (the profile mark on the main menu). Under **Patreon**, press **Link Patreon**. It opens Patreon in your browser: press **Allow**, then press **Link to (your username)** on the page that follows.
- **Your tier is your title.** Disciples and Heralds get their tier's title and glyph beside their name while their pledge is active. Wear the title from **Title** on the account card, as any other.
- **It keeps up by itself.** Change tier on Patreon and your title changes with it. End your pledge and the title goes. Nobody has to hand anything out.
- **Back in the game,** the card reads your account again, so you see your new title as soon as you return.
- **Refresh** asks Patreon again if your title looks out of date. **Unlink** takes your Patreon off this account.

## Herald, a new title
- **Herald** is new: the Patreon tier between Disciple and Hierophant. The title is in azure, and its glyph is a herald's trumpet with a banner hanging from it.
- Herald patrons get it as soon as they link their Patreon.

## Good to know
- Linking needs a registered account (a username and a password). A guest account can't link.
- One Patreon account links to one game account. Linking it to a different game account moves it there - the page tells you which account had it.
- The page after Patreon always names the game account you're linking. If it isn't yours, close the page and nothing is linked.
- If your card is declined, the title pauses until Patreon says the payment went through.
- Titles already given by name stay as they are. Hierophant is custom and is still given by name.

---

### For the team: deploy order
1. Deploy the relay first (**`world138`**): the token's titles and glyphs gain `herald`, and an older relay refuses a token that carries it. A relay deploy drops everyone online once.
2. Apply migration **`0045_patreon.sql`** to production D1 and deploy the account service (**`acct45`**). The deploy does both, and it waits for the relay to serve `world138`.
3. Then ship the client.

Patreon linking starts once these are set, one time only:
1. **Patreon client:** https://www.patreon.com/portal/registration/register-clients - API version 2, redirect URI `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/callback`.
2. **Patreon webhook:** https://www.patreon.com/portal/registration/register-webhooks - URL `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/webhook`, with the six `members:*` triggers.
3. **Repository secrets:** `PATREON_CLIENT_SECRET` (the client's secret) and `PATREON_WEBHOOK_SECRET` (the webhook's). Without the client secret linking stays off; without the webhook secret, pledge changes aren't followed.
4. **`server-account/wrangler.toml`:** done - the client's id, and `PATREON_TIERS = "29666211:disciple,29666234:herald"` (Supporter has no title, Hierophant is custom).

The deploy summary names both addresses. An older client with the new service shows no Patreon row. The new client with an older service shows none either.
