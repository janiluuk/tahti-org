# db-audit-query-fixes.md

**Status:** partial

## What

Query and caching fixes from the 2026-11 database audit (items 1, 2, 3, 4 and 8 of its summary). API response shapes are unchanged. Indexes are added separately (index migrations PR); session/token sweeps are a separate worker PR.

## Done on this branch (`perf/db-audit-queries`)

- Per-sound like, comment, play and download counts on list endpoints come from `loadSoundEngagementCounts` (`apps/api/src/lib/sound-engagement-counts.ts`), one `groupBy` per relation scoped to the listed ids, instead of Prisma `_count` (which aggregates the whole child table). Latest tracks, channel items, public profile, public collection, smart link, liked tracks, artist library. The track page keeps `_count` (single id, index-backed).
- `/metrics` caches the platform and listen aggregates per process for `METRICS_CACHE_SEC` (60 s; 0 under test). `cachedInProcess` generalises `cachedAdminStat`.
- New to you: heard tracks via `groupBy` in SQL (newest listens first, cap 5000); per-user picks cached in Redis 5 min (`discover:new-to-you:v1:{userId}:{limit}`); gates and presigned URLs still per request.
- Top list: `ORDER BY count LIMIT n` in SQL (ties by sound id). Loved list: one `COUNT(DISTINCT userId)` query over likes + LOVE reactions with `LIMIT`. Month, half-year, all-time and loved list cache 10 min; week stays 30 s.
- Admin chat KPI, chat timeseries, content stats and listening stats use `cachedAdminStat`; chat timeseries groups by UTC day in SQL; signed-in listeners is `COUNT(DISTINCT)`.

## Left

- Admin listening stats still load up to 500k `ListenSession` rows to sum minutes per channel in Node; move to SQL (`SUM(GREATEST(...)) GROUP BY channelId`).
- Admin/artist per-dimension top lists still group every ranked track in the window (they bucket in Node, but join display rows for winners only). A window-function query or a daily per-sound rollup would bound it.
- Audit items 5, 7, 9, 10 and the lower-ranked caches (sitemaps, `/api/v1/stats`, latest tracks rows) are not in this PR.
