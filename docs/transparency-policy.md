# Tahti ry — transparency policy

The transparency commitment is what distinguishes Tahti ry from any other
broadcasting platform. It is also a real engineering and operational burden
that we accept deliberately.

## What we publish

### Monthly (within 30 days of month-end)

- Revenue by category (subscriptions, distribution, grants, donations)
- Costs by category (infrastructure, ops, maintenance compensation, audit, distribution
  pass-through, professional services)
- Running surplus
- Storage usage in aggregate (total TB, average per user, median per user)
- Active channel count, paying member count, listener-hour total

### Annually (within 90 days of fiscal year-end)

- Full annual report including:
  - Director's letter
  - Audited financial statements
  - Per-channel grant disbursement (anonymized as "Channel #N" unless artist
    opts into public attribution)
  - Methodology explanation (how listener-hours are counted, how the formula
    works)
  - Board roster and trustee statements of conflict
  - Sustaining donor list (with consent)
- All historical data preserved indefinitely; no quiet rewrites

### Real-time

- Public read-only API at `/api/v1/transparency/`:
  - `GET /monthly_rollup?year=YYYY` — array of monthly rollups
  - `GET /grants/:year` — grant disbursements for the year
  - `GET /categories` — category definitions and current YTD totals
  - `GET /platform-stats` — channels, members, listener-hours (anonymized)
- All endpoints CORS-open for third-party verification and journalism

### What we do NOT publish

- Individual artist subscription history (privacy)
- Individual artist revenue from distribution (their data, not ours to share)
- Listener IP addresses, fingerprints, or location data (privacy)
- Chat content (ephemeral by design, not retained)
- Internal communications (board minutes are exception — see below)
- Stripe customer details, payout details, tax IDs

### Board minutes

Board minutes are published within 30 days of each meeting, with these
redactions allowed:

- Personnel matters (compensation discussions, hiring, conflicts)
- Active legal matters
- Ongoing fundraising negotiations (unblocked once concluded)

## How we maintain it

### Architecture

- All financial movement creates a `ledger_entry` row, append-only
- Stripe webhooks auto-populate `REVENUE_SUBSCRIPTION` entries
- Distribution submissions create paired `REVENUE_DISTRIBUTION` and
  `COST_DISTRIBUTION_PASSTHROUGH` entries
- Recurring costs imported monthly by the treasurer (electric, internet,
  accountant, etc.) with audit log
- Grant disbursements at year-end create `GRANT_DISBURSEMENT` entries
- Monthly cron generates `monthly_rollup` table on the 1st

### Verification

- The treasurer reviews and finalizes monthly rollups within 10 days of month-end
- Auditor reviews ledger annually before annual report publication
- Third parties can pull our API data and cross-check against our published
  reports — this is encouraged

### Corrections

The ledger is append-only. If an entry is wrong:

1. Original entry stays in place
2. An offsetting entry is added (same category, opposite sign) with description:
   `Correction of #{original_id}: <reason>`
3. A third entry is added with the correct value
4. Monthly rollup is regenerated for affected months
5. Correction noted in next monthly transparency post

## Privacy considerations

Transparency does not mean exposing artists. The default treatment is:

- Per-channel grant amounts are public (rule of accountability)
- Per-channel artist identity is hidden behind "Channel #N" unless the artist
  has set `publicAttribution = true` in their settings (rule of consent)
- Listener data is never personal — listener-hours are computed from anonymous
  HLS request logs aggregated to the hour

Artists can:
- Opt into public attribution (their handle appears next to their grant amount)
- Opt out at any time (future reports use "Channel #N" again)
- Request retroactive anonymization (within 90 days of publication)

## The cost of transparency

This commitment has ongoing engineering, accounting, and operational costs:

| Activity | Estimated annual hours |
|---|---|
| Monthly rollup verification (treasurer) | 30 |
| Annual report writing | 40 |
| Audit prep (treasurer + director) | 60 |
| Public API maintenance + docs | 20 |
| Responding to third-party data requests | 20 |
| Board minutes preparation and review | 30 |
| **Total** | **200 hours/year** |

That's roughly 10% of one full-time role, ongoing. The director carries this in
Y1; by Y2 a part-time treasurer can pick up monthly rollup verification.

## Inspiration and precedent

We draw from these orgs that get transparency right:

- **Buffer** (commercial but radically open) — open salaries, open revenue
- **Open Collective** — transparent finances for thousands of open-source projects
- **Mozilla Foundation** — strong annual reports, board governance
- **Resonate cooperative** — community-financial reporting, similar mission scope

We also acknowledge that **doing this well is harder than doing it at all**.
Sloppy transparency erodes trust faster than no transparency. Build the
infrastructure properly or don't claim it.

## The pledge

The board commits, by formal bylaws amendment in Year 1, to:

> Maintain monthly and annual transparency reports as described in this policy.
> Failure to publish on schedule for three consecutive months requires the
> board to call an emergency General Meeting to address the lapse.

This makes the commitment teeth-bearing, not aspirational.
