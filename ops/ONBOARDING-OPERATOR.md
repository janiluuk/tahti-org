# Tahti operator onboarding

Training syllabus for member-operators who can run the platform without a single
contractor. Each track ends with a **sign-off checklist** the trainer initials.

**Prerequisites:** SSH access to the Swarm manager, read access to this repo, and
membership in the ops communication channel.

## Related docs

| Doc | Use for |
|-----|---------|
| [`RUNBOOK.md`](RUNBOOK.md) | Deploy, rollback, restore |
| [`BACKUP.md`](BACKUP.md) | RPO/RTO, cron, escalation |
| [`INCIDENTS.md`](INCIDENTS.md) | Outage severity and comms |
| [`DEPLOY.md`](DEPLOY.md) | Migration order before deploy |
| [`secrets-management.md`](secrets-management.md) | Swarm secrets |
| [`EMAIL.md`](EMAIL.md) | Newsletter / SMTP / bounces |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Service topology |

---

## Track A — Infra (trainer: Dev)

**Goal:** Deploy a tagged release, read health signals, run backup verification, and
rollback one service without data loss.

### Module 1 — Orientation (2 h)

- Read [`ARCHITECTURE.md`](ARCHITECTURE.md) and skim `infra/docker-stack.yml`
- Log in to Swarm manager; run `docker service ls` and identify `tahti_*` services
- Open Grafana / Prometheus (vimage6) or run `./scripts/status-monitor.sh`

### Module 2 — Deploy & rollback (3 h)

- Walk through [`DEPLOY.md`](DEPLOY.md): migrate → deploy → smoke
- **Exercise:** `docker service rollback tahti_web` on staging/lab, then restore
- Locate `stack.env` and explain `TAG`, ingest host lists, `MIXCLOUD_CLIENT_ID`

### Module 3 — Backups (2 h)

- Run `./scripts/backup.sh status` and interpret exit codes ([`BACKUP.md`](BACKUP.md))
- Run `./scripts/backup.sh restore-test` on a non-prod host or read last log on prod
- Review cron: `cat /etc/cron.d/tahti-backup`

### Module 4 — Incidents (2 h)

- Table-top: API returns 503 — follow [`INCIDENTS.md`](INCIDENTS.md) first 15 minutes
- Find backup age metric: `curl -s localhost:3001/metrics | grep tahti_postgres_backup`
- Optional: restart Liquidsoap via orchestrator logs (`docker service logs tahti_orchestrator`)

### Infra sign-off

| # | Task | Trainee | Trainer | Date |
|---|------|:-------:|:-------:|------|
| 1 | Explain Swarm stack layout (api, web, workers, ingest) | ☐ | ☐ | |
| 2 | Deploy a known-good `TAG` to lab stack | ☐ | ☐ | |
| 3 | Roll back one service and verify `/health` | ☐ | ☐ | |
| 4 | Run `backup.sh status` + interpret result | ☐ | ☐ | |
| 5 | Run or review `backup.sh restore-test` log | ☐ | ☐ | |
| 6 | Post a mock SEV-2 update using INCIDENTS template | ☐ | ☐ | |

---

## Track B — Support (trainer: Director)

**Goal:** Handle member account issues, chat abuse, and membership billing questions.

### Module 1 — Accounts & membership (2 h)

- Signup → verify email → Stripe Checkout flow (`/help` + dashboard)
- `POST /api/me/membership/portal` for self-service billing
- Admin: `GET /api/admin/members` (board export)

### Module 2 — Chat & abuse (2 h)

- Centrifugo fan vs artist tokens; 24 h anonymous sessions
- Ban flow and hCaptcha on public chat
- When to escalate to infra (Centrifugo down vs app bug)

### Module 3 — Artist tools (1 h)

- Tier limits: `/help/tier-limits`
- Mixcloud connect troubleshooting ([`RUNBOOK.md`](RUNBOOK.md) § Mixcloud OAuth)
- Newsletter: confirm double opt-in; bounces via [`EMAIL.md`](EMAIL.md)

### Support sign-off

| # | Task | Trainee | Trainer | Date |
|---|------|:-------:|:-------:|------|
| 1 | Walk a test user through verify + membership pay | ☐ | ☐ | |
| 2 | Issue a membership portal link | ☐ | ☐ | |
| 3 | Explain chat ban + appeal path | ☐ | ☐ | |
| 4 | Answer one tier-limit question from `/help/tier-limits` | ☐ | ☐ | |

---

## Track C — Treasurer (trainer: Treasurer)

**Goal:** Read transparency data, export ledger, and prepare grant narrative inputs.

### Module 1 — Transparency (2 h)

- Public `/transparency` and methodology page
- `GET /api/transparency/ytd` and admin ledger export routes
- Stripe Connect vs platform ledger (fan-sub split)

### Module 2 — Grants & AGM inputs (2 h)

- Grant preview tooling in admin (`/api/admin/grants`)
- Engagement-unit formula (see `docs/transparency-policy.md`)
- What to export before AGM — [`TREASURER.md`](TREASURER.md); meeting flow — [`AGM-PLAYBOOK.md`](AGM-PLAYBOOK.md)

### Treasurer sign-off

| # | Task | Trainee | Trainer | Date |
|---|------|:-------:|:-------:|------|
| 1 | Explain YTD transparency numbers on public page | ☐ | ☐ | |
| 2 | Run a ledger export (or describe steps from admin UI) | ☐ | ☐ | |
| 3 | List data needed for grant distribution memo | ☐ | ☐ | |

---

## Handover target

Per roadmap Phase 9: **≥ 3 operators** complete Track A; **≥ 1** each for B and C.
Director vacation test: two weeks with only operator on-call — no unresolved SEV-1.

## Quarterly refresh

- Re-run Module 3 (backups) after any cron or `backup.sh` change
- Re-run status monitor / Upptime drill when [`upptime/README.md`](upptime/README.md) goes live
