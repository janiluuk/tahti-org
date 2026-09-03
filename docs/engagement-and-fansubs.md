# Tahti ry — engagement units and fan-subscriptions

This doc specifies the v6 grant calculation model and the fan-to-artist
subscription product. It supersedes the listener-hours basis used in v4/v5.

## Why we changed the grant basis

Listener-hours rewarded passive consumption. An ambient channel left running
in a coffee shop generated the same grant-share as an artist with 50 devoted
fans actively engaging with their work. That's not the fairness story Tahti
wants to tell.

The v6 model rewards **intentional engagement** — listeners actively
downloading content, listeners paying the artist directly. Money and effort
flow in the same direction.

## The grant formula

For each artist `A` over a fiscal year:

```
units(A) =
    (free_downloads × 1)
  + (paid_downloads × 5)
  + (fan_sub_euros_received × 1)
```

Then:

```
grant_share(A) = units(A) / total_units_all_artists
grant(A) = grant_share(A) × grant_pool
```

Where:

- **`free_downloads`** = number of times an anonymous (non-fan-subscriber)
  listener downloaded one of artist A's tracks or mixes, after fraud filtering
  and dedup (see below).
- **`paid_downloads`** = number of times a fan-subscriber to artist A
  downloaded one of A's tracks/mixes. Weighted 5× because the strongest signal
  of value is "this person is paying *and* downloading."
- **`fan_sub_euros_received`** = total euros that fans paid artist A in direct
  subscriptions during the year. €1/month = 12 units/year. €10/month = 120 units/year.

### Worked example

Artist Long Doe in fiscal year 2027:
- 800 free-tier listeners downloaded the new mix → 800 × 1 = 800 units
- 40 fan-subscribers downloaded 3 tracks each on average → 120 × 5 = 600 units
- 40 fan-subscribers paying avg €5/month → 40 × €60 = €2,400 → 2,400 units
- **Total units: 3,800**

If the platform total is 1,000,000 units and the grant pool is €172,649 (Y3 modeled):
- Long Doe's share = 3,800 / 1,000,000 = 0.38%
- Long Doe's grant = €656

This is *in addition to* the €2,400/year that flowed directly to Long Doe via
fan-subs (gross). After the current payment provider's processing fee and the
2% ops fee, Long received **€2,136** directly (480 × €5 charges: 480 × €0.45
Stripe EU-card processing + 480 × €0.10 ops), plus the €656 grant — **€2,792**
for the year. `fan_sub_euros_received` for grants is **gross** (€2,400), not
net.

## Grant eligibility threshold

Artist must have at least **5 engagement units** in the fiscal year to be
eligible for a grant. Below that, the artist is treated as inactive and
their would-be share rolls into the next year's pool.

This excludes free-tier accounts that never had any actual engagement, while
keeping the bar accessible — 5 free downloads or one €5/month fan-sub clears it.

## Downloads — product spec

### Where downloads appear

- **Archive items:** every archive item gets a download button. Format options
  depend on what was uploaded — original (WAV/FLAC/MP3/whatever the artist
  uploaded) plus a derivative.
- **Release tracks:** every track on a release page gets a download button.
  Same format-options logic.
- **Mixes:** auto-archived live broadcasts get a download button (artist can
  opt out per-recording).

### Permissions matrix

|                       | Streaming | Free download | Paid download |
|-----------------------|-----------|---------------|---------------|
| Anonymous listener    | ✓         | ✓ (rate-limited) | — |
| Free account listener | ✓         | ✓ (rate-limited) | — |
| Fan-subscriber        | ✓         | ✓ (unlimited) | ✓ (unlimited, FLAC available) |

What "free download" gets:
- The Opus 256 streaming derivative (~6 MB per 3-minute track)
- OR the MP3 320 derivative (~7 MB per 3-minute track) — artist's choice per release

What "paid download" gets (fan-subscribers only):
- The original-source file as uploaded (WAV / FLAC / 24-bit / whatever)
- AND/OR the FLAC 16/44 derivative
- AND/OR any lower-quality format

Artist can opt-out of downloads entirely per archive-item or per release. Some
artists won't want their mixes downloadable.

### Anti-fraud (anonymous downloads)

Without account requirement, we rely on layered defenses:

1. **Rate limit per IP:** 5 downloads/hour, 20 downloads/day per IP. Returns
   HTTP 429 with `Retry-After` header.
2. **Rate limit per browser fingerprint:** same limits as IP. Fingerprint =
   `sha256(user_agent + canvas_hash + audio_context_hash + daily_salt)`.
3. **Same-track dedup:** the same fingerprint downloading the same track only
   counts once per 30 days. Subsequent downloads succeed (don't block the
   listener) but don't add new units.
4. **Per-track cap:** maximum 10 dedup'd downloads count per listener per track,
   regardless of how many times they actually download it. A fanatic-but-real
   listener still works; a script trying to inflate a single track to 10,000
   units is blocked.
5. **Net-new IP threshold:** the IP must have been seen on Tahti (ny page)
   at least 24 hours before its download counts. Brand-new IPs can download,
   they just don't count toward grants for that first day.
6. **Tor and known bot networks:** allowed to download (we don't refuse
   service), but downloads don't count toward grants. Use a maintained allowlist
   of legitimate research / journalism IPs that override this.

Daily cron runs fraud detection: flags any artist whose download volume grew
>20× day-over-day, queues for manual review. Fraud convictions result in unit
reversal in the ledger (with audit trail) and possibly account suspension per
bylaws §3 (member misconduct).

### Bandwidth and storage implications

At Y3 scale (4,000 member artists, ~400k downloads/year):
- Average download ~6 MB (Opus 256 derivative)
- Total ~2.4 TB/year of download bandwidth
- Cost: ~€3,000/yr on Bunny CDN (modeled in financials)
- Storage: marginal — we're serving the same derivative as streaming, not
  generating new files per download

For paid (FLAC) downloads at Y3 scale (~60k FLAC downloads/year, ~30 MB each):
- ~1.8 TB/year
- Cost: included in same line

## Fan-to-artist subscriptions — product spec

### The product

A listener can subscribe directly to an artist to support their work. The
artist sets the price (€1, €5, €10, or custom). The subscription bills monthly
via Stripe. The listener gets:

- A "Supporter" badge in chat (cosmetic)
- Unlimited downloads of that artist's tracks/mixes
- FLAC download option on every track they download
- Access to fan-only chat (separate channel from public chat — artist toggles
  it on/off)
- Access to fan-only newsletter (separate list, artist toggles)
- The warm fuzzies of supporting an artist they care about

The artist receives the subscription revenue via the **selected payment
provider** (today: Stripe Connect Express). The split is always:

1. the provider's **processing fee** (paid to that provider, not to Tahti)
2. Tahti's **2% operational fee** on gross (bylaws §11.b — not a platform cut)
3. the remainder to the artist

There is no SEPA fallback for fan-subs. Grants may still pay out by Connect or
SEPA; that is a different money stream (see below).

### Pricing

The artist sets one or more subscription tiers per channel. Suggested defaults:

- **Supporter** — €3/month — basic supporter badge + fan chat
- **Backer** — €5/month — adds unlimited downloads + FLAC option
- **Patron** — €10/month — adds fan-only newsletter access
- **Custom** — artist defines any tier name and price (€1–€100/month range)

Artists can disable any tier. Artists can set custom benefits per tier (free
text, displayed on subscribe page). We don't enforce benefit fulfillment —
that's between artist and fan.

### The money flow

**Authoritative split** for every fan-sub charge:

```
artist_net = gross − provider_processing − (gross × 2%)
```

- **Provider processing** is whatever the selected payment provider charges
  for that payment method. It is not Tahti's money and it is not the 2% ops
  fee. Today the only provider is Stripe; EU cards are modeled as
  **2.9% + €0.30** per successful charge (`packages/ledger/src/fansub.ts`).
  Other methods (AMEX, non-EU cards) can cost more; the ledger currently
  records this modeled fee, not Stripe's live `balance_transaction`.
- **2% operational fee** is Tahti's capped ops line (GDPR, disputes, billing
  support, Connect platform costs we owe, audit attribution). It does **not**
  "cover processing." Per bylaws §11.b it is operational, not org profit; any
  surplus rolls into the next year's artist grant pool.
- **Artist net** is what the Connect (or future provider) destination should
  credit. A payout row marked `PAID` means Tahti booked the period, not that
  the bank credit has landed. Stripe Express then pays the Connect balance
  out on Stripe's own schedule.

Worked example with **Stripe as the current provider**, €5/month EU card:

| Line | Amount | Share of €5 |
|---|---|---|
| Fan pays (gross) | €5.00 | 100% |
| Payment processing (Stripe 2.9% + €0.30) | −€0.45 | 9% |
| Tahti ops fee (2% of gross) | −€0.10 | 2% |
| **Artist receives** | **€4.45** | **89%** |

The same formula at other prices (Stripe EU card). The **fixed €0.30**
dominates small tiers:

| Gross | Processing | 2% ops | Artist | Artist share |
|---|---|---|---|---|
| €1 | €0.33 | €0.02 | €0.65 | 65% |
| €3 | €0.39 | €0.06 | €2.55 | 85% |
| €5 | €0.45 | €0.10 | €4.45 | 89% |
| €10 | €0.59 | €0.20 | €9.21 | 92% |
| €100 | €3.20 | €2.00 | €94.80 | 95% |

Do not quote "98% to the artist" or "2% covers processing." Those collapse
two different fees. On a €5 Stripe EU-card charge the artist keeps **89%**.

A later payment-provider plugin (roadmap **PLAT-060**) lets the artist pick
another processor; the 2% ops fee stays, the processing line changes to that
provider's published fees.

### Not the same money as grants or royalties

| Stream | What the artist sees | When |
|---|---|---|
| Fan-sub orders | `GET /api/me/fan-sub-payouts` — one row per billing period | Charge → daily `fan-sub-payout` cron (04:00 UTC) books `PAID` / retries `FAILED`. Last run is on `/admin/dashboard` and `/admin/financial/fansubs`. |
| Annual grants | Org surplus pool, engagement units | Year-end; confirm within 30 days. Separate from fan-subs. |
| DSP royalties | Revelator reports | Monthly sync. Production Revenue mixes these into the same dated list; they are not fan-sub orders. |

One fan can hold **one** active subscription per artist (unique
artist+subscriber). Upgrading a tier overwrites that row.

### Artist year economics — worked examples

These scenarios show **one artist's personal P&L** for a fiscal year:
Tahti membership (what they pay the org) plus fan-sub income (what fans pay
them, net of **current-provider processing + 2% ops**) plus any **M9
engagement grant** (from the org surplus pool, separate from fan-sub
passthrough).

Per charge at **€5/month** with Stripe EU card: processing **€0.45**, Tahti
ops **€0.10**, artist net **€4.45**. Implemented in
`packages/ledger/src/artist-year-economics.ts` (`SCENARIO_*` constants);
tests lock the numbers below.

**Net profit (year)** = net from fan-subs + annual grant − Tahti membership.

#### Example A — ~€50 net profit (music + modest supporters)

**Story:** Long Doe publishes on Tahti, pays **€40/year** membership, keeps
**2 fans at €5/month for 10 months**, and receives a small **€1** engagement
grant from the annual pool.

| Line (artist perspective) | Amount |
|---|---|
| Fan subscriptions (gross) | +€100.00 (2 × €5 × 10 mo) |
| Payment processing (Stripe) | −€9.00 (20 charges × €0.45) |
| Tahti operational fee (2%) | −€2.00 (20 × €0.10) |
| **Net from fan-subs** | **+€89.00** |
| Annual engagement grant (M9) | +€1.00 |
| Tahti membership (Artist tier) | −€40.00 |
| **Net profit (year)** | **+€50.00** |

Long keeps **€89** via the current payment provider during the year; the
**€1** grant and **€40** membership sit on top of that for a **€50** personal
surplus after membership.

#### Example B — −€50 net (paid platform, no fan income)

**Story:** Casey uploads music and pays for Tahti but never attracts paying
fan-subscribers. Only cost is membership — **€50** in this example (e.g. list
price or first-year bundle above the default €40).

| Line (artist perspective) | Amount |
|---|---|
| Fan subscriptions (gross) | €0.00 |
| Net from fan-subs | €0.00 |
| Annual engagement grant | €0.00 |
| Tahti membership | −€50.00 |
| **Net profit (year)** | **−€50.00** |

No grant eligibility without engagement units; fan-sub tooling still works but
generates no offsetting income.

#### Example C — ~break even (one supporter covers membership)

**Story:** River has **one fan at €5/month for 9 months** against **€40**
membership. Fan-sub net is **€40.05** (9 × €4.45); after membership the year
is within a few cents of zero.

| Line (artist perspective) | Amount |
|---|---|
| Fan subscriptions (gross) | +€45.00 (1 × €5 × 9 mo) |
| Payment processing (Stripe) | −€4.05 (9 × €0.45) |
| Tahti operational fee (2%) | −€0.90 (9 × €0.10) |
| **Net from fan-subs** | **+€40.05** |
| Annual engagement grant | €0.00 |
| Tahti membership | −€40.00 |
| **Net profit (year)** | **≈ €0.00** (+€0.05) |

This is the minimum viable supporter story: **one dedicated fan for most of a
year** roughly pays for the artist's Tahti seat. Extra fans, paid downloads
(5× grant weight), and grant pool share improve the outcome (see grant formula
above).

### Subscriber accounts

Fan-subscribers have full user accounts:
- Email + password (or OAuth via Google/Apple)
- Stripe customer ID
- One or more active subscriptions (per artist)
- Payment method on file
- GDPR-compliant data: full export, full deletion on request

When a subscriber cancels:
- Subscription marked as canceled in Stripe; access continues through end of
  current billing period
- After grace period (7 days post-period-end), Supporter badge removed,
  download privileges revert to free-tier
- Their account stays unless they request deletion
- They keep any downloads they already grabbed (those bytes are theirs)

### Churn and refunds

- Standard 7-day money-back guarantee on first month of any new subscription
- Refunds processed by the artist (artist can refuse, but we recommend honoring)
- Disputed charges: handled per Stripe's standard dispute flow; the org
  doesn't intervene unless the artist requests escalation
- Unpaid renewals (failed card): standard Stripe smart-retry, then auto-cancel
  after 14 days

### Artist setup flow

1. Artist in dashboard → "Fan Subscriptions" → "Enable"
2. Stripe Connect Express onboarding (KYC: ID, bank account, tax form)
3. Once approved (1-3 days typical), artist defines tiers
4. Artist customizes the public subscribe page (intro text, perks)
5. "Subscribe" button appears on channel page + profile page
6. Optional: artist creates fan-only chat channel, fan-only newsletter list

### Subscribe page design

On `tahti.live/u/<handle>/subscribe`:
- Artist hero (same as profile)
- Intro text: why subscribe (artist-written)
- Tier cards: name, price, benefits
- "Subscribe" CTA per tier → Stripe Checkout
- Trust signals: "Direct to artist. Tahti keeps 2% for ops. The payment
  provider's processing fee is extra (Stripe EU card: 2.9% + €0.30)."
- FAQ: how cancellation works, what happens to my downloads, etc.

## Data model (Prisma sketch — agent expands)

```prisma
model Download {
  id              BigInt   @id @default(autoincrement())
  archiveItemId   String?  // OR releaseTrackId — one of these is set
  releaseTrackId  String?
  format          String   // 'opus256' | 'mp3_320' | 'flac' | 'wav' | 'source'
  byUserId        String?  // NULL if anonymous
  byFingerprint   String   // always set: sha256(ua + canvas + audio + daily_salt)
  byIpHash        String   // sha256(ip + daily_salt)
  bytes           Int
  countedAt       DateTime?  // NULL if didn't count toward grants (fraud, dedup, etc.)
  reason          String?    // why it didn't count if NULL countedAt
  weight          Int        @default(1)  // 1 for free, 5 for paid-sub
  createdAt       DateTime   @default(now())

  @@index([archiveItemId, createdAt])
  @@index([releaseTrackId, createdAt])
  @@index([byFingerprint, createdAt])
  @@schema("engagement")
}

model FanSubscription {
  id                  String   @id @default(cuid())
  artistUserId        String   // the artist receiving subs
  subscriberUserId    String   // the listener-account paying
  artist              User     @relation("ArtistFanSubs", fields: [artistUserId], references: [id])
  subscriber          User     @relation("SubscriberFanSubs", fields: [subscriberUserId], references: [id])
  tierName            String
  amountCents         Int      // in EUR cents
  stripeSubscriptionId String  @unique
  state               FanSubState  @default(ACTIVE)  // ACTIVE | CANCELED | PAST_DUE | EXPIRED
  startedAt           DateTime
  currentPeriodEnd    DateTime
  canceledAt          DateTime?
  createdAt           DateTime @default(now())

  payouts             FanSubPayout[]

  @@unique([artistUserId, subscriberUserId])
  @@index([artistUserId, state])
  @@schema("fansubs")
}

model FanSubPayout {
  id                String   @id @default(cuid())
  fanSubscriptionId String
  fanSubscription   FanSubscription @relation(fields: [fanSubscriptionId], references: [id])
  forPeriodStart    DateTime
  forPeriodEnd      DateTime
  grossCents        Int
  stripeFeeCents    Int
  orgFeeCents       Int     // 2% operational fee
  netToArtistCents  Int
  stripeTransferId  String?
  state             FanSubPayoutState @default(PENDING)
  paidAt            DateTime?
  createdAt         DateTime @default(now())

  @@index([fanSubscriptionId, forPeriodStart])
  @@schema("fansubs")
}

model FanTier {
  id          String   @id @default(cuid())
  artistUserId String
  artist      User     @relation(fields: [artistUserId], references: [id])
  name        String
  amountCents Int
  description String?  // markdown, ~280 chars
  perks       String[] // bullet list, ~5 items
  active      Boolean  @default(true)
  position    Int      // display order
  createdAt   DateTime @default(now())

  @@schema("fansubs")
}

enum FanSubState { ACTIVE CANCELED PAST_DUE EXPIRED }
enum FanSubPayoutState { PENDING PAID FAILED REFUNDED }
```

## Worker jobs

- `download-fraud-scan` — daily 06:00 UTC, flags channels with >20× day-over-day counted download growth (`DOWNLOAD_FRAUD_ALERT` audit)
- `membership-renewal-reminder` — daily 07:00 UTC, email ~30 days before annual membership expiry (deduped via audit log)
- `membership-lapse` — daily 08:00 UTC, suspends ARTIST memberships older than 365 days without renewal
- `download-unit-rollup` — every 15 min, aggregates eligible downloads into `engagement_units_daily` table
- `fan-sub-payout` — daily 04:00 UTC (`packages/shared/src/worker-cron-jobs.ts`).
  Destination charges usually route net funds on payment; this job books
  `PENDING` → `PAID` and retries `FAILED` transfers. Last run + schedule are
  on `/admin/dashboard` (cron list) and `/admin/financial/fansubs`.
- `fan-sub-grant-units-rollup` — monthly, aggregates fan-sub euros received per artist
- `fan-sub-churn-monitor` — daily, identifies past-due subs, sends reminder emails

## Ledger entries

Two new categories under `ledger.LedgerCategory`:

- `FAN_SUB_GROSS_RECEIVED` — gross amount fans paid (one entry per period, per artist)
- `FAN_SUB_NET_TO_ARTIST` — net amount paid to artist after fees
- `FAN_SUB_OPERATIONAL_FEE` — the 2% org fee taken from fan-sub gross
- `DOWNLOAD_LOGGED` — not a financial entry, but a parallel `engagement_ledger` table tracks all eligible downloads for audit

## Anti-patterns to avoid

- Treating listener-hours as still meaningful for grants. They are not. They
  are a vanity metric only.
- Forgetting to apply the 5× multiplier to paid-subscriber downloads.
- Counting fan-sub euros as org revenue. They're not. They're a passthrough
  to the artist, minus the selected provider's processing fee and the 2%
  operational fee.
- Saying the 2% ops fee "covers processing," or that artists keep 98% / 97.9%.
  Processing is the provider's line. On a €5 Stripe EU-card charge the artist
  keeps €4.45 (89%).
- Treating a `PAID` payout row as "money in the artist's bank." It is Tahti
  bookkeeping; the provider then pays out the connected balance on its own
  schedule.
- Allowing artists to subscribe to themselves (or sock-puppet accounts to
  themselves). Same email/payment-method dedup.
- Building "tip" or "one-time payment" features in v6. Defer to v7 — adds
  scope, doesn't change the math.
- Showing per-artist fan-sub revenue publicly without consent. The artist's
  fan-sub income is their business; it appears on the transparency dashboard
  only as aggregate "Channel #N received €X in fan-subs this year" with the
  same anonymization rules as grants.
