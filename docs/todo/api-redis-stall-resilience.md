# api-redis-stall-resilience.md

**Status:** partial

## What

Stop a slow Redis from holding API requests for 10-60s. On 2026-09-22/23, MinIO writes saturated vimage disk `sdd`, and Redis (AOF on the same disk) stalled. Every Redis-backed request then waited, up to 5s per command (the node-redis default), for several commands in a row: rate-limit `INCR`/`EXPIRE`/`TTL`, then `json-cache` `GET`/`SET`. The full evidence is in `tahti-player/docs/todo/api-slow-requests.md`.

## Done on this branch

- [x] Shared client command timeout `REDIS_COMMAND_TIMEOUT_MS` (default 500).
- [x] `getOptionalRedisClient()` + `noteRedisFailure()`: after a timeout, cache and rate-limit paths skip Redis for `REDIS_SLOW_BYPASS_MS` (default 5000).
- [x] `json-cache` no longer awaits the cache write before responding.
- [x] Alert rules `TahtiApiMeanLatencyHigh` and `TahtiVimageDiskSaturated`.

## Left

- [ ] Deploy the API and alert rules (`ops/monitoring/vimage6/deploy.sh`). Prometheus has no Alertmanager attached, so decide where alerts should go.
- [ ] Move `stack_redis` (ideally MinIO/Postgres too) off the spinning disk on vimage, or set `no-appendfsync-on-rewrite yes`. Moving MinIO to tahti.local ([`tahti-local-onboarding.md`](tahti-local-onboarding.md)) would also take MinIO's writes off vimage's disk.
