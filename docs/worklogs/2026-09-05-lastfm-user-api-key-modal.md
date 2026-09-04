# 2026-09-05 — Last.fm user API key modal

Studio Integrations **Connect** for Last.fm opens a modal for the user's own
API key + shared secret (`POST …/lastfm/prepare`), then Last.fm desktop auth.
Credential stores `apiKey` / `apiSecret` / `sessionKey` / `username`. Platform
env remains optional fallback.
