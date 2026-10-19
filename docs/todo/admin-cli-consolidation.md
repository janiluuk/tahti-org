# Consolidate `scripts/` into one admin CLI (`tahti-admin`)

**Status:** open

**Why:** `scripts/` holds 48 files: operator commands (deploy, backups,
production checks, env changes) sit next to CI guards, screenshot tooling and
one-off experiments. Each operator script re-implements its own host/path
defaults, argument parsing and safety checks, and none of them log what was
changed on production. Changing a production setting meant hand-typed
`ssh vimage "…"` one-liners that broke on line wrapping (2026-10-19,
rate limits) — `scripts/stack-env.sh` is the first piece that does this
properly, and the model for the rest.

**Not the same as** tahti-player's `docs/todo/tahti-cli-tool.md`: that is a
public CLI on top of `@tahti/api-client` for artists. This one is for
operators and runs against the deploy host.

## Inventory (2026-10-19)

| Area                            | Scripts                                                                                                                                                                                                                                                                                                                                                                                                                                   | Goes to                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Settings                        | `stack-env.sh` (new)                                                                                                                                                                                                                                                                                                                                                                                                                      | `tahti-admin env …`                                                                                                  |
| Deploy                          | `deploy_prod.sh`, `deploy_minio_remote.sh`, `deploy_worker_remote.sh`, `radio-discord-bot-src.sh`                                                                                                                                                                                                                                                                                                                                         | `tahti-admin deploy prod\|minio\|worker`                                                                             |
| Database                        | `db-migrate-deploy.sh`, `pre-destructive-db-snapshot.sh`, `restore-postgres.sh`                                                                                                                                                                                                                                                                                                                                                           | `tahti-admin db migrate\|snapshot\|restore`                                                                          |
| Backups                         | `backup.sh`, `backup-drill.sh`; deprecated `backup-minio.sh`, `backup-postgres.sh`, `restore-test.sh`                                                                                                                                                                                                                                                                                                                                     | `tahti-admin backup run\|drill\|status\|restore-test`; delete the deprecated wrappers                                |
| One-time setup                  | `init-secrets.sh`, `init-minio-buckets.sh`, `install-crons.sh`                                                                                                                                                                                                                                                                                                                                                                            | `tahti-admin setup secrets\|buckets\|crons`                                                                          |
| Production checks               | `check-prod-readiness.sh`, `check-distribution-prod.sh`, `check-mixcloud-prod.sh`, `check-revelator-prod.sh`, `status-monitor.sh`, `unified-smoke.sh`, `stack-smoke.sh`                                                                                                                                                                                                                                                                   | `tahti-admin check readiness\|distribution\|status\|smoke` (mixcloud/revelator become `check distribution --only …`) |
| Maintenance                     | `trim-bullmq-backlog.sh` + `.cjs`, `docker-disk-cleanup.sh`, `sync-tor-exit-list.mjs`                                                                                                                                                                                                                                                                                                                                                     | `tahti-admin queue trim`, `tahti-admin cleanup docker`, `tahti-admin tor sync`                                       |
| Release                         | `next-release-tag.sh`, `release-meta.sh`, `release-changelog.sh`                                                                                                                                                                                                                                                                                                                                                                          | `tahti-admin release tag\|meta\|changelog` (CI keeps calling the same entry points)                                  |
| Load tests                      | `channel-load-test.sh`, `editor-load-test.sh`                                                                                                                                                                                                                                                                                                                                                                                             | `tahti-admin load hls\|editor`                                                                                       |
| Stays as is (not operator work) | CI guards `ci-check.sh`, `check-design-tokens.sh`, `check-font-weight-cap.sh`, `check-reference-token-values.sh`, `check-tor-exit-list-fresh.mjs`, `check-node-version.mjs`, `ci-docker-cleanup.sh`; dev `dev-setup.sh`, `stack-up.sh`, `copy-ffmpeg-core.mjs`; screenshots `capture-*-screenshots.mjs`, `demo-live-screenshots.mjs`, `e2e-screenshots.sh`, `stack-screenshots.sh`, `run-e2e-journeys.sh`, `design-conformance-routes.sh` | Keep behind `pnpm` scripts; optionally move to `tools/`                                                              |
| Out of place                    | `deforum-animate.py`                                                                                                                                                                                                                                                                                                                                                                                                                      | Move out of the repo or into `tools/experiments/`                                                                    |

## Command shape

```
tahti-admin [--host vimage] [--path /srv/tahti] [--dry-run] [--yes] <area> <command> [args]

tahti-admin env list|get|set|unset|preset|presets|diff|backups|restore|apply
tahti-admin ratelimit loose|default|status        # shortcut over env presets
tahti-admin deploy prod [--no-cache|--down] | minio | worker
tahti-admin db migrate | snapshot | restore <backup>
tahti-admin backup run [postgres|minio] | drill | status | restore-test
tahti-admin check readiness | distribution [--only mixcloud|revelator] | status | smoke [--prod]
tahti-admin queue trim
tahti-admin release tag | meta | changelog <tag>
tahti-admin load hls | editor
tahti-admin setup secrets | buckets | crons
```

Shared behaviour every command gets for free:

- One target resolver (`DEPLOY_HOST`, `DEPLOY_PATH`, `SWARM_STACK`, or flags), so
  nothing hard-codes `vimage` / `/srv/tahti` again.
- Anything that writes on production asks for confirmation (`--yes` to skip in
  automation) and supports `--dry-run`.
- An append-only audit line on the host (`/srv/tahti/ops-audit.log`: time,
  operator, command, masked arguments).
- Secrets masked in all output (same rule as `stack-env.sh`).
- Remote work is sent as a script over `ssh … bash -s` (never hand-built quoted
  one-liners), values base64-encoded.

## Phases

- [ ] **1. Skeleton.** `packages/admin-cli` (TypeScript, bin `tahti-admin`,
      `pnpm admin …` from the repo root), target resolver, confirm/dry-run,
      audit log, `--help` per area. No behaviour of its own yet.
- [ ] **2. Wrap.** Each area command shells out to the existing script, so
      operators can switch now and old paths keep working.
- [ ] **3. Port settings first.** `env` and `ratelimit` natively (from
      `stack-env.sh`), with tests against a local `DEPLOY_HOST=local` target and
      a stubbed `docker`.
- [ ] **4. Port the rest area by area** (backups, checks, queue, release),
      each with a test; delete the deprecated backup wrappers and fold
      `check-mixcloud-prod.sh` / `check-revelator-prod.sh` into
      `check distribution`.
- [ ] **5. Thin out `scripts/`.** Replace ported scripts with one-line shims
      that call `tahti-admin` (CI and cron entries keep working), update
      `install-crons.sh`, `AGENTS.md`, `docs/technical/*` references, then
      remove the shims a release later.
- [ ] **6. Docs.** One `docs/technical/admin-cli.md` page; README and
      AGENTS point there.

## Open questions

- Node (shares code with `@tahti/api-client`, testable) vs. a single bash
  entry point (no install on the host). Leaning Node on the operator's
  machine, plain bash on the host side.
- Should API-level admin actions (suspend a user, re-run a job) live here too,
  through `@tahti/api-client` with an admin token, or stay in the web admin?
- Swarm vs. compose: production docs describe both; the CLI should detect
  which one is running (as `stack-env.sh apply` does) until one is retired.
