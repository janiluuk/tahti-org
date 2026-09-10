# Admin dashboard: contact-inbox mail stats

Status: ready to merge

## What this is

Surfaces unread-mail counts for `hello@tahti.live` / `support@tahti.live`
(both aliases to `jani@tahti.live`) as a KPI tile on `/admin/dashboard`,
sourced from Prometheus on vimage6.

## Pieces

- `ops/monitoring/vimage6/mail-metrics.sh` (already committed earlier, cron
  every 5 min on vimage6) writes `mail_inbox_unseen/total{mailbox=...}` via
  doveadm to `~/infra/mail/metrics/mail.prom`
- `ops/monitoring/vimage6/mail-exporter.py` (new) — tiny stdlib HTTP server
  serving that file on `:9275` with the correct Prometheus content-type
  (plain `python -m http.server` sends `.prom` as octet-stream, which
  Prometheus v3 rejects)
- `ops/monitoring/vimage6/deploy.sh` — deploys the exporter container
  (`monitoring-mail-exporter`) and installs the cron job
- `ops/monitoring/vimage6/prometheus-tahti.snippet.yml` — new
  `tahti_mail_metrics` scrape job (60s)
- `ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py` +
  `tahti-infrastructure.json` — new "Contact inbox (tahti.live)" Grafana row
- `apps/api/src/config.ts` — `config.promUrl` (env `PROM_URL`, defaults to
  vimage6)
- `apps/api/src/routes/admin/stats.ts` — `GET /api/admin/stats/mail`
  (board-only), fail-open to zeros if Prometheus is unreachable
- `apps/web/.../admin/dashboard/page.tsx` — "Unread mail (hello+support)"
  KPI tile + webmail link when count > 0
- `ops/EMAIL.md` — new "Contact-inbox metrics" section tying it together;
  reformatted the file's existing tables to satisfy `pnpm format:check`
  (unrelated whitespace-only diff, same file)

## Verified this pass

- `pnpm exec prettier --check` on all changed ts/tsx/json — clean
- `apps/api` and `apps/web` `tsc --noEmit` — clean (needed
  `pnpm --filter @tahti/db run db:generate` first in the fresh worktree)
- `pnpm exec eslint` on changed files — clean
- `apps/api` stats test suite (6 tests incl. the 2 new mail-stats cases,
  200 + non-board 403) — passing against a local Postgres
- `pnpm --filter @tahti/api-client generate` — re-ran, `schema.d.ts` output
  identical to what was already staged (no drift)
- Regenerated `tahti-infrastructure.json` from its generator — identical to
  what was already staged (no drift)

## Left open

- Nothing known. Ready to commit/push once reviewed.
