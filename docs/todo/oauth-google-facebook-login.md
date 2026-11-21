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

## Step by step (production)

1. Google Cloud Console: OAuth consent screen (External, app name Tahti,
   authorised domain `tahti.live`, privacy `https://tahti.live/privacy`, terms
   `https://tahti.live/terms`), scopes `openid email profile`, publish. Then
   Credentials → OAuth client ID → Web application with redirect URI
   `https://api.tahti.live/api/auth/oauth/google/callback`.
2. developers.facebook.com: add Facebook Login, Valid OAuth Redirect URI
   `https://api.tahti.live/api/auth/oauth/facebook/callback`, permissions
   `email` and `public_profile`, privacy policy and data deletion URLs, switch
   the app to Live.
3. Put the four values in `/srv/tahti/infra/stack.env` on vimage.
4. `scripts/deploy_prod.sh` (applies `20261120120000_artist_event_gallery`
   and `20261121120000_oauth_accounts`; the api container now receives the
   vars via `x-app-env`).
5. Check `GET https://api.tahti.live/api/auth/oauth/providers` lists both,
   then sign in from tahti.live with a new and an existing account.
