# Google and Facebook sign-in: ops

**Status:** partial

API and leftovers shipped (see HISTORY 2026-11-21). The Tahti Player web
client is in tahti-player.

## Left

- [ ] Ops: create a Google OAuth client (openid email profile) and a Facebook
      app (email, public_profile) per host; register
      `{API_URL}/api/auth/oauth/google/callback` and
      `{API_URL}/api/auth/oauth/facebook/callback`; set
      `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` and `FACEBOOK_OAUTH_CLIENT_ID` /
      `_SECRET` (or `*_FILE`) in the stack env for the api service
      (`infra/stack.env.vimage.example`).
