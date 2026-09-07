# vimage6 Grafana: host gauges + fix API metrics scrape auth

**Status:** partial

Requested 2026-09-07: the `tahti-infrastructure` Grafana dashboard on
vimage6 showed "API unhealthy", "pi4 down", and "API dependencies: no
data" — plus a request to turn the "Hosts" panel into small per-host
gauges showing status + CPU usage.

## Root causes found (not assumed)

- **API unhealthy / API dependencies no data — same root cause.**
  Prometheus's `tahti_api_metrics` scrape (`192.168.2.100:15011/metrics`)
  returns `403 Forbidden`. `apps/api/src/lib/internal-request.ts`'s
  `SEC-014` fix deliberately removed `192.168.0.0/16` from the API's
  trusted-internal IP range (that range was shared with public reverse-proxy
  traffic — see the comment there). Genuinely-remote LAN callers like
  Prometheus are expected to send `Authorization: Bearer $INTERNAL_SECRET`
  instead, but the vimage6 scrape config was never updated after that
  security tightening shipped.
- **pi4 down** was stale/already resolved by the time this was
  investigated (`up{instance="pi4"}` was `1` in Prometheus). Not a real
  ongoing issue.
- **vimage7 down** (found while investigating, confirmed by the user
  as a real bug): the `node`/`cadvisor`/`docker-catalog` jobs in
  vimage6's `prometheus.yml` (not managed by this repo's deploy script
  — hand-maintained directly on the host) had vimage7's IP as the
  stale `192.168.2.187`; the real IP is `192.168.2.106`. Fixed directly
  on the host (`sed` all 4 occurrences, `promtool check config`,
  `docker kill -s HUP`), with a timestamped backup taken first.
  vimage7 itself is reachable (ping + SSH both succeed from vimage6),
  but `node_exporter`/`cadvisor`/the docker-catalog exporter aren't
  actually running there yet — a separate gap, out of scope here (no
  access to vimage7 to install them).

## What shipped in this PR

- `ops/monitoring/vimage6/prometheus-tahti.snippet.yml`: added
  `bearer_token_file: /etc/prometheus/tahti-api-metrics.token` to the
  `tahti_api_metrics` job, matching the existing `giggi` job's
  established pattern for this exact problem.
- `ops/monitoring/vimage6/deploy.sh`: provisions that token file from
  `infra/stack.env`'s `INTERNAL_SECRET` on every deploy, so this can't
  silently regress again. Errors loudly if the secret is missing.
- `ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py`:
  added `vimage7` to the `HOSTS` constant (it was already referenced
  in the Worker-nodes section's queries but missing from the main host
  list — so even after the IP fix it wouldn't have shown up in the
  general host panels). Added `host_gauge_panel()`: a single `gauge`
  panel whose query returns one series per host (CPU usage % when up,
  a `-1` sentinel mapped to "DOWN" text when `up == 0`) — Grafana
  renders one series per query result as its own small gauge
  automatically, no per-host panel needed. Replaced the old "Hosts —
  node exporter" stat panel (plain UP/DOWN blocks) with this.

## Verified

- Prometheus query design (CPU% via `and on(instance)` filtered by
  `up == 1`, `-1` sentinel via the `up == 0` OR-branch) tested directly
  against vimage6's live Prometheus before committing to it — confirmed
  correct values for all 10 hosts including the `-1` sentinel for the
  (at-the-time) down vimage7.
- vimage7 IP fix: `promtool check config` clean, reloaded live,
  confirmed the scrape target now points at `192.168.2.106` (still
  reports down, correctly, since the monitoring agents themselves
  aren't running there — see above).
- Dashboard JSON: regenerated, `prettier --check` clean, deployed live
  to vimage6 (`docker restart monitoring-grafana` to force-reload
  provisioning).
- **Not yet live:** the bearer-token config was deployed to vimage6's
  `prometheus.yml`, but `promtool check config` correctly refuses to
  validate until `/etc/prometheus/tahti-api-metrics.token` exists —
  copying `INTERNAL_SECRET` into that file requires reading a
  production secret, which this session's own tooling blocks agents
  from doing unsupervised. Handed the user the exact one-line command
  to run themselves; **Prometheus has not been reloaded with the
  bearer-token config yet** — it's still running the pre-fix config
  (metrics scrape still 403s) until that token file exists and someone
  runs the reload.

## Remaining

- [ ] User runs the token-provisioning command (or `deploy.sh`, which
      now does it automatically) so the `tahti_api_metrics` scrape can
      actually be reloaded with the new bearer-token config.
- [ ] Install `node_exporter`/`cadvisor`/docker-catalog exporter on
      vimage7 so its gauge actually goes green — separate task, no
      access to that host from this session.
