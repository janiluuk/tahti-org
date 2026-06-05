# Tahti treasurer operations

Guide for the association treasurer and board members with ledger access.
Technical deploy steps: [`RUNBOOK.md`](RUNBOOK.md). Vendor accounts: [`VENDORS.md`](VENDORS.md).

## Access

| Role | Requirement |
|------|-------------|
| Board / treasurer | User account with **board** role (`requireBoard` on admin routes) |
| Stripe dashboard | Association Stripe account (see credential inventory) |
| Admin API | Session cookie or API client with board user |

Board-only routes live under `/api/admin/*`. OpenAPI: `https://api.tahti.live/docs` (basic auth in prod).

---

## Monthly rhythm

| When | Task | Where |
|------|------|-------|
| ≤ 30 days after month end | Publish transparency rollup | Public `/transparency` |
| Monthly | Review Stripe payouts vs ledger | Stripe dashboard + ledger export |
| Monthly | Spot-check fan-sub Connect transfers | Dashboard + `GET /api/me/fan-sub-payouts` (artists) |
| Quarterly | Reconcile grant reserve vs policy | [`docs/transparency-policy.md`](../docs/transparency-policy.md) |

---

## Ledger export (audit / AGM)

**Annual CSV for auditors and PRH filing inputs:**

```bash
# As board user (browser or curl with session cookie)
GET /api/admin/ledger/export.csv?year=2026
```

Export includes header comment `# Tahti ry ledger export`, all `ledgerEntry` rows for the calendar year, categories (membership, fan-sub, grants, infrastructure, etc.).

**Manual adjustments** (infrastructure bills, donations, grants received):

```bash
POST /api/admin/ledger
Content-Type: application/json

{
  "category": "INFRASTRUCTURE",
  "amountCents": -50000,
  "description": "UpCloud invoice March 2026",
  "externalRef": "upcloud:2026-03"
}
```

List period entries: `GET /api/admin/ledger?year=2026&month=3`

---

## Grant distribution (annual)

After AGM approves the grant formula for a calendar year:

1. **Dry-run** — `GET /api/admin/grants/preview/:year`  
   Review per-artist units, anomaly flags, pool size.
2. **Execute** — `POST /api/admin/grants/run/:year`  
   Writes `GRANT_DISBURSEMENT` + `RESERVE_TRANSFER` ledger entries (idempotent per year).
3. **Publish** — public report at `GET /api/v1/transparency/grants/:year`
4. **Artist view** — each member sees `GET /api/me/grants`

Formula and engagement units: [`docs/transparency-policy.md`](../docs/transparency-policy.md), [`packages/ledger`](../packages/ledger).

---

## Membership & member export

Board membership roster for AGM / PRH:

```bash
GET /api/admin/members/export.csv
```

JSON list: `GET /api/admin/members`

Stripe membership subscriptions: artists use `POST /api/me/membership/portal` for self-service; treasurer handles disputes via Stripe dashboard.

---

## Fan-subscriptions (Connect)

Platform takes a fee; remainder transfers to artist Connect accounts via worker cron + `@tahti/ledger` retry queue.

- Failed transfers: check Prometheus `tahti_stripe_*` metrics and worker logs
- Artist payout history: `GET /api/me/fan-sub-payouts` (artist-facing)
- Subscriber export (artist): `GET /api/me/fan-subscribers/export.csv`

---

## Compliance exports

| Export | Route | Purpose |
|--------|-------|---------|
| Ledger CSV | `/api/admin/ledger/export.csv?year=` | Annual accounts |
| Audit log CSV | `/api/admin/audit/export.csv` | Security / compliance review |
| Members CSV | `/api/admin/members/export.csv` | AGM member list |
| Transparency YTD | `/api/transparency/ytd` | Public dashboard source |

---

## PRH & tax (Finland)

Tahti ry is a registered association (*rekisteröity yhdistys*). Treasurer responsibilities (high level — confirm with accountant):

- [ ] Annual PRH notification if statutory changes
- [ ] Tax return if taxable revenue thresholds met
- [ ] VAT reporting if registered (roadmap: register if Y1 revenue &gt; €15k expected)
- [ ] Retain ledger exports + Stripe reports for 6+ years

Association bylaws and grant policy: [`docs/governance-and-legal.md`](../docs/governance-and-legal.md).

---

## AGM inputs checklist

Before the annual meeting, treasurer prepares:

- [ ] Ledger export for closed fiscal year
- [ ] Stripe balance / payout summary
- [ ] Grant preview for year being closed (if surplus &gt; 0)
- [ ] Member count vs budget (`GET /api/admin/members`)
- [ ] Transparency page reviewed for accuracy

Hand off to board chair for [`AGM-PLAYBOOK.md`](AGM-PLAYBOOK.md).

## Related

- [`ONBOARDING-OPERATOR.md`](ONBOARDING-OPERATOR.md) — Track C treasurer training
- [`INCIDENTS.md`](INCIDENTS.md) — billing incident escalation
