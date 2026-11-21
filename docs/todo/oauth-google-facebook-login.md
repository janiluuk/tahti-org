# Google and Facebook sign-in: leftovers

**Status:** partial

API shipped (see HISTORY 2026-11-21). The Tahti Player web client
(Continue with Google / Facebook, Settings → Security → Linked logins) is in
tahti-player.

## Left

- [ ] Ops: create a Google OAuth client (openid email profile) and a Facebook
      app (email, public_profile) per host; register
      `{API_URL}/api/auth/oauth/google/callback` and
      `{API_URL}/api/auth/oauth/facebook/callback`; set
      `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` and `FACEBOOK_OAUTH_CLIENT_ID` /
      `_SECRET` (or `*_FILE`) on the api service.
- [ ] Set a password from Settings for accounts created with Google/Facebook
      (forgot-password skips accounts without one).
- [ ] Dedicated error code for a Facebook signup without an email (today
      `failed`).
- [ ] Include linked accounts in the data export.
