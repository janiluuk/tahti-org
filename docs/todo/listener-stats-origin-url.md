# Listener stats: full origin / referrer URL

**Status:** partial  
**Updated:** 2026-11-18  
**Sibling:** `../tahti-player/docs/todo/listener-stats-origin-url.md` (UI)

## Shipped in this PR

- `ListenSession.referrerUrl` migration + schema
- `normalizeReferrerUrl` + heartbeat Zod/persist (host still set)
- Audience dimension `referrerUrl`
- Data export includes `referrerUrl`
- `isOwner` on `GET/POST /api/me/channel/moderators`

## Left

OpenAPI/api-client regen after merge; track insights URL mode; live verify.
Historical rows stay host-only (no backfill).
