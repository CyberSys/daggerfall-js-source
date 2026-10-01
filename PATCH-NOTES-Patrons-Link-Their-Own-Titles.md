# Patch Notes: Patrons Link Their Own Titles

## Patreon titles, automatically
- **Link your Patreon.** Open your account card (the profile mark on the main menu). Under **Patreon**, press **Link Patreon**. It opens Patreon in your browser: press **Allow**, then press **Link to (your username)** on the page that follows.
- **Your tier is your title.** Disciple, Apostle and Hierophant are yours while your pledge is active - with the tier's glyph beside your name. Wear the title from **Title** on the account card, as any other.
- **It keeps up by itself.** Change tier on Patreon and your title changes with it. End your pledge and the title goes. Nobody has to hand anything out.
- **Back in the game,** the card reads your account again, so you see your new title as soon as you return.
- **Refresh** asks Patreon again if your title looks out of date. **Unlink** takes your Patreon off this account.

## Good to know
- Linking needs a registered account (a username and a password). A guest account can't link.
- One Patreon account links to one game account. Linking it to a different game account moves it there - the page tells you which account had it.
- The page after Patreon always names the game account you're linking. If it isn't yours, close the page and nothing is linked.
- If your card is declined, the title pauses until Patreon says the payment went through.
- Titles already given by name stay as they are.

---

### For the team: deploy order
1. Apply migration **`0045_patreon.sql`** to production D1 and deploy the account service (**`acct45`**). The deploy does both. Nothing changes in the relay.
2. Then ship the client.

It ships **off**. Patreon linking starts once these are set, one time only:
1. **Patreon client:** https://www.patreon.com/portal/registration/register-clients - API version 2, redirect URI `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/callback`.
2. **Patreon webhook:** https://www.patreon.com/portal/registration/register-webhooks - URL `https://daggerfall-accounts.mackcothran.workers.dev/v1/patreon/webhook`, with the six `members:*` triggers.
3. **Repository secrets:** `PATREON_CLIENT_SECRET` (the client's secret) and `PATREON_WEBHOOK_SECRET` (the webhook's).
4. **`server-account/wrangler.toml`:** `PATREON_CLIENT_ID` (the client's id) and `PATREON_TIERS` - each tier's id is the number after `rid=` in its Join link, e.g. `"1234567:disciple,2345678:apostle,3456789:hierophant"`.

The deploy summary names both addresses. An older client with the new service shows no Patreon row. The new client with an older service shows none either.
