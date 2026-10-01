# Patch Notes: Patrons Link Their Own Titles

## Patreon titles, automatically
- **Link your Patreon.** Open your account card (the profile mark on the main menu). Under **Patreon**, press **Link Patreon**. It opens Patreon in your browser: press **Allow**, then press **Link to (your username)** on the page that follows.
- **Your tier is your title.** Disciples get the Disciple title and its glyph beside their name while their pledge is active. Wear the title from **Title** on the account card, as any other.
- **It keeps up by itself.** Change tier on Patreon and your title changes with it. End your pledge and the title goes. Nobody has to hand anything out.
- **Back in the game,** the card reads your account again, so you see your new title as soon as you return.
- **Refresh** asks Patreon again if your title looks out of date. **Unlink** takes your Patreon off this account.

## Good to know
- Linking needs a registered account (a username and a password). A guest account can't link.
- One Patreon account links to one game account. Linking it to a different game account moves it there - the page tells you which account had it.
- The page after Patreon always names the game account you're linking. If it isn't yours, close the page and nothing is linked.
- If your card is declined, the title pauses until Patreon says the payment went through.
- Titles already given by name stay as they are. Hierophant is custom and is still given by name.

---

### For the team: deploy order
1. Apply migration **`0045_patreon.sql`** to production D1 and deploy the account service (**`acct45`**). The deploy does both. Nothing changes in the relay.
2. Then ship the client.

Patreon linking starts once these are set, one time only:
1. **Patreon client:** https://www.patreon.com/portal/registration/register-clients - API version 2, redirect URI `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/callback`.
2. **Patreon webhook:** https://www.patreon.com/portal/registration/register-webhooks - URL `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/webhook`, with the six `members:*` triggers.
3. **Repository secrets:** `PATREON_CLIENT_SECRET` (the client's secret) and `PATREON_WEBHOOK_SECRET` (the webhook's). Without the client secret linking stays off; without the webhook secret, pledge changes aren't followed.
4. **`server-account/wrangler.toml`:** done - the client's id, and `PATREON_TIERS = "29666211:disciple"` (Supporter has no title, Herald isn't in the game yet, Hierophant is custom).

The deploy summary names both addresses. An older client with the new service shows no Patreon row. The new client with an older service shows none either.
