# Listener stats: full origin / referrer URL

**Status:** open  
**Updated:** 2026-11-18  
**Sibling:** `../tahti-player/docs/todo/listener-stats-origin-url.md` (UI)

Persist and expose a referrer/origin URL on listen sessions (privacy-safe),
and feed Studio Stats / insights. Canonical **Next 30** table lives in the
player sibling (same numbering). Org owns slices 1–12 and shares 25 / 30.

## Org focus

1. `ListenSession.referrerUrl` + `normalizeReferrerUrl`
2. Heartbeat body + persist (keep `referrerHost`)
3. Audience / insights groupBy URL
4. OpenAPI + api-client regenerate
5. Export / privacy include the field

## Blocked until

Nothing — start with the migration and heartbeat. Player UI waits on
slices 7–10 for real buckets.
