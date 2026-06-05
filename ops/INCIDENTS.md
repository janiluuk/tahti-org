# Tahti incident response

How to communicate during outages and who to involve. Technical restore steps are in
[`RUNBOOK.md`](RUNBOOK.md); backup targets in [`BACKUP.md`](BACKUP.md).

## Severity levels

| Level | Examples | User impact | Response time |
|-------|----------|-------------|---------------|
| **SEV-1** | API down, live ingest broken fleet-wide, data loss suspected | Full or core product unavailable | Immediate |
| **SEV-2** | Single ingest node down, worker backlog, Stripe webhook failures | Partial degradation | &lt; 1 h |
| **SEV-3** | Non-critical feature broken, slow dashboards, monitoring flake | Workaround exists | Next business day |

## First 15 minutes (any SEV-1/2)

1. **Acknowledge** — post to internal ops channel; assign incident lead.
2. **Assess** — `curl -sf https://api.tahti.live/health` and `/api/v1/status`; check Grafana / `./scripts/status-monitor.sh`.
3. **Mitigate** — rollback service (`docker service rollback tahti_api`), scale problematic service to 0, or fail over ingest per RUNBOOK.
4. **Status page** — update Upptime fork or interim status repo when user-visible (&gt; 5 min outage).

## Communications

### Internal

- **Channel:** Tahti ry operators (Matrix/Slack — use whatever the board has adopted).
- **Update cadence:** SEV-1 every 30 min until resolved; SEV-2 every 2 h.
- **Template:**
  > **[SEV-N] &lt;short title&gt;** — Status: investigating / mitigated / resolved.
  > Impact: … | Next step: … | Lead: …

### Public (user-visible outages)

- Post on the status page linked from the web app footer.
- Optional: short post on official social channels for SEV-1 &gt; 30 min.
- **Do not** share credentials, internal hostnames, or unverified data-loss claims.

### Post-incident

Within 5 business days for SEV-1/2:

- Timeline (UTC), root cause, what fixed it, follow-up tasks.
- Store summary in board minutes or a dated issue in the ops repo.
- Run restore-test within 7 days if Postgres or MinIO was involved.

## Escalation chain

| Role | Responsibility |
|------|----------------|
| **Incident lead** | Coordinates mitigation; speaks for ops |
| **Infra operator** | SSH to Swarm manager, deploy/rollback, backups |
| **Director** | External comms approval, vendor contact (UpCloud, fiber) |
| **Treasurer** | Stripe / ledger questions during billing incidents |
| **Board** | Notify if outage &gt; 4 h or legal/regulatory exposure |

Vendor contacts (fiber, UpCloud, Stripe, Revelator) — maintain in board credential inventory
(roadmap Phase 8a).

## Common playbooks

| Symptom | Likely cause | First action |
|---------|--------------|--------------|
| 502 on API | API container crash / DB | `docker service ps tahti_api`; check Postgres; rollback |
| Live won't connect | Ingest / Icecast | Check ingest health URLs; failover hosts in `stack.env` |
| Uploads fail | MinIO / worker-media | MinIO disk; worker-media logs; queue depth |
| Payments stuck | Stripe webhook | Verify webhook secret; check `tahti_stripe_webhook_*` metrics |
| Newsletter bounces spike | SMTP reputation | Check provider dashboard; verify bounce webhook |

## Related

- [`RUNBOOK.md`](RUNBOOK.md)
- [`BACKUP.md`](BACKUP.md)
- [`upptime/README.md`](upptime/README.md)
