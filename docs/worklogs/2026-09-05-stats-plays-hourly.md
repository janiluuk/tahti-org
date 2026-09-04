# 2026-09-05 — Artist plays hourly + today/custom windows

- `GET /api/me/stats/plays` accepts `range=1` and `from`/`to` day bounds.
- `GET /api/me/stats/plays/hourly?date=YYYY-MM-DD` returns 24 UTC hour buckets
  (counted downloads + smart-link clicks) for Studio ListeningClock modals.
