# Last.fm user API key modal

Branch: `feat/lastfm-user-api-key-modal`.

## Goal

Studio Integrations → Last.fm **Connect** opens a modal where the user pastes
their own Last.fm API key + shared secret, then continues to Last.fm auth.
Platform `LASTFM_API_KEY` / `SECRET` remain optional fallbacks.

## Approach

1. Registry: document fields + signup URL on `lastfm` (OAuth authKind kept).
2. `POST /api/me/integrations/lastfm/prepare` — validate via `auth.getToken`,
   stash key/secret (+ token) in short-lived httpOnly cookies, return `authUrl`.
3. OAuth start/callback prefer pending user cookies; fall back to platform env.
4. Persist `{ apiKey, apiSecret, sessionKey, username }` on success.
5. Scrobble uses credential keys when present.
6. Studio panel: Connect opens modal; submit → prepare → redirect.
