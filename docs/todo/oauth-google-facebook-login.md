# Google and Facebook sign-in (API)

**Status:** partial

**Why:** Tahti Player web is adding "Continue with Google / Facebook" on the
sign-in screen and a "Linked accounts" section in Settings. This is the API
side; the web client is built against the contract below in parallel.

## Shipped (branch `feat/oauth-google-facebook`)

- **Storage:** `core.OAuthAccount { userId, provider, providerUserId, email?, createdAt }`,
  unique on `(provider, providerUserId)` and `(userId, provider)`; migration
  `20261121120000_oauth_accounts`. Rows removed on account deletion.
- **Routes**
  - `GET /api/auth/oauth/providers` → `{ providers: ('google'|'facebook')[] }` (only
    providers with both client id and secret set).
  - `GET /api/auth/oauth/:provider/start?returnTo=&link=1` → 302 to the consent screen.
    Authorization code + PKCE (S256) + `state`. Pending state (state, verifier,
    returnTo, web origin, link user) lives in an HMAC-signed (SESSION_SECRET)
    httpOnly cookie `tahti_oauth_login`, path `/api/auth/oauth`, 10 min. Redis is
    not used because `getRedisClient()` is null under test and the cookie also
    binds the flow to the browser that started it. `returnTo` must be a relative
    path (400 otherwise); unknown provider 404; unconfigured provider or `link=1`
    without a session redirects with `oauth_error`.
  - `GET /api/auth/oauth/:provider/callback` → always 302 to the web app:
    `returnTo` + `oauth=ok` (appended with `?` or `&`, hash kept),
    `returnTo` + `oauth=totp&challengeId=…` for 2FA accounts (finish with
    `POST /api/auth/login/totp`), or `/?oauth_error=cancelled|email_in_use|already_linked|not_configured|failed`.
  - `GET /api/me/oauth-accounts` → `{ accounts: { provider, email, linkedAt }[] }`.
  - `DELETE /api/me/oauth-accounts/:provider` → 204; 409 when it is the last way to
    sign in (no password, no other provider); 404 when not linked.
- **Web origin:** the `Origin`/`Referer` of the `/start` navigation when it passes
  the CORS allowlist (`lib/allowed-origin.ts`), else `APP_URL`.
- **Linking rules:** existing identity signs in; `link=1` attaches to the signed-in
  user (session must still match at callback); a matching email auto-links only
  for Google with `email_verified` **and** an already-verified Tahti account,
  otherwise `email_in_use`. New accounts go through `createArtistAccount`
  (unique username/channel slug, `safeDisplayName`, no password, email verified
  only when Google verified it; Facebook signups get the normal verification
  email). Avatar imported from the provider picture via the shared
  `setAvatarFromUrl` path (best effort).
- **Same outcome as password login:** shared `lib/login-session.ts`
  (`loginBlockedReason`, `createTotpChallenge`, `startLoginSession`) now used by
  password login, TOTP and OAuth: same session row, session + refresh cookies.
- **Rate limit:** `/start` and `/callback` are on the auth bucket.

## Left

- [ ] Ops: create the Google OAuth client (Web) and the Facebook app per host;
      redirect URIs `{API_URL}/api/auth/oauth/google/callback` and
      `{API_URL}/api/auth/oauth/facebook/callback`; set `GOOGLE_OAUTH_CLIENT_ID`,
      `GOOGLE_OAUTH_CLIENT_SECRET`, `FACEBOOK_OAUTH_CLIENT_ID`,
      `FACEBOOK_OAUTH_CLIENT_SECRET` on the api service (see `infra/stack.env.example`).
- [ ] Facebook signups without an email fail with `oauth_error=failed`; decide whether
      to add a dedicated code.
- [ ] Passwordless (OAuth-only) accounts cannot use forgot-password to add a
      password (the route skips users with no password hash); consider a
      "set a password" flow in Settings.
- [ ] Fold into HISTORY when the PR is ready to merge.
