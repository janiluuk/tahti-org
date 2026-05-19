# Phase 6 — Distribution, transparency ledger, grants

**Goal:** an artist can publish a release to major DSPs via Revelator, the transparency ledger is public, and the annual grant disbursement system runs on real data.

**Timeline:** Month 5–9 (milestones M6–M10 from `docs/AGENT.md`)  
**Entry state:** Phase 4 alpha running with active beta artists.  
**New services:** worker-dist (Revelator + Mixcloud), outbound SMTP (Postmark).

---

## Distribution pipeline

```mermaid
flowchart TD
    A[Artist submits release\napp.tahti.fi/releases/new] --> API

    API --> PG1[INSERT releases\nstatus=draft]

    A --> API2[POST /api/releases/:id/publish]
    API2 --> PG2[UPDATE releases status=submitting]
    API2 --> RD[Enqueue revelator-deliver job]

    RD --> WD[worker-dist]

    subgraph "Revelator DSP submission"
        WD --> REV_CREATE[POST /v1/releases to Revelator API]
        REV_CREATE --> REV_ASSETS[Upload audio + artwork to Revelator]
        REV_ASSETS --> REV_SUBMIT[POST /v1/releases/:id/submit]
        REV_SUBMIT --> REV_POLL[Poll delivery status every 6h]
    end

    REV_POLL --> PG3[UPDATE releases\nstatus=delivered\nisrc, upc]

    subgraph "DSP delivery (Revelator handles)"
        REV_SUBMIT --> Spotify[(Spotify)]
        REV_SUBMIT --> Apple[(Apple Music)]
        REV_SUBMIT --> Tidal[(Tidal)]
        REV_SUBMIT --> Other[(+ 40 others)]
    end

    PG3 --> API3[Notify artist via WebSocket + email]
```

## Transparency ledger

```mermaid
graph TB
    subgraph "Ledger schema (append-only)"
        LE[ledger_entries\nid, event_type, amount_eur,\nartist_id, period, created_at\nNO UPDATE / DELETE]
    end

    subgraph "Event sources"
        MR[Membership revenue\n€40 × N members]
        GR[Grant income\nfoundation transfers]
        OP[Operating costs\n-€ salaries, infra, legal]
        EG[Engagement units\nstreams × weight]
        GD[Grant disbursements\n-€ to artists]
    end

    MR --> LE
    GR --> LE
    OP --> LE
    EG --> LE
    GD --> LE

    subgraph "Public dashboard"
        PD[app.tahti.fi/transparency\nread-only, no auth required]
    end

    LE -- SELECT only --> PD
```

## Engagement unit calculation

```mermaid
flowchart LR
    subgraph "Raw events (per day)"
        ST[stream_starts\nweighted 1.0]
        LH[listener_hours\nweighted 2.5]
        DL[downloads\nweighted 5.0]
        CH[chat_messages\nweighted 0.5]
    end

    subgraph "stats_rollup (worker-light, daily)"
        WL[Aggregate by artist\nper day/week/month]
    end

    subgraph "Grant pool (annual)"
        POOL[Revenue surplus\nafter operating costs]
        EU[Total engagement units\nacross all active artists]
        SHARE[Artist share =\nartist_units / total_units × pool]
    end

    ST --> WL
    LH --> WL
    DL --> WL
    CH --> WL
    WL --> EU
    POOL --> SHARE
    EU --> SHARE
    SHARE --> Stripe[Stripe Connect payout\nto artist bank account]
```

## Grant disbursement flow

```mermaid
sequenceDiagram
    participant Dir as Director
    participant API as API (admin endpoint)
    participant PG as Postgres
    participant Stripe as Stripe Connect
    participant A as Artists

    Dir->>API: POST /admin/grants/calculate {year: 2026}
    API->>PG: SELECT SUM(engagement_units) by artist WHERE year=2026
    API->>PG: SELECT surplus FROM ledger WHERE year=2026
    API->>API: Calculate per-artist share (units/total × surplus)
    API-->>Dir: Preview: [{artist, units, amount_eur}] — NOT PAID YET

    Dir->>Dir: Review in dashboard, spot-check outliers
    Dir->>API: POST /admin/grants/disburse {year: 2026, approved: true}

    loop For each artist with amount > €10
        API->>Stripe: transfers.create({amount, currency, destination})
        Stripe-->>A: Bank transfer (2-5 business days)
        API->>PG: INSERT ledger_entries (grant-disbursement, -amount, artist_id)
    end

    API->>PG: INSERT ledger_entries (grant-round-closed, year: 2026)
    API-->>Dir: Disbursement complete — all entries on public ledger
```

## Multistream out (Mixcloud Live)

```mermaid
sequenceDiagram
    participant LS as Liquidsoap (channel)
    participant API as API
    participant WD as worker-dist
    participant MC as Mixcloud Live API

    Note over LS: Artist goes live on Tahti channel
    LS->>API: on_live_start webhook
    API->>API: Check artist has Mixcloud connected
    API->>RD: Enqueue mixcloud-start job
    WD->>MC: POST /v1/live/start {title, description}
    MC-->>WD: rtmp_url + stream_key
    WD->>LS: Set RTMP push destination (via orchestrator)
    LS->>MC: Push RTMP stream concurrently
    Note over MC: Stream also live on Mixcloud
```

## New worker queues (Phase 6)

| Queue | Worker | Trigger | Action |
|-------|--------|---------|--------|
| `revelator-deliver` | worker-dist | Release published | Submit release to Revelator API |
| `revelator-royalty-sync` | worker-dist | Daily cron | Pull royalty reports, write to ledger |
| `mixcloud-upload` | worker-dist | Stream ends (if artist opted in) | Upload recording to Mixcloud |
| `mixcloud-start` | worker-dist | Stream starts | Start Mixcloud Live RTMP push |

## Postmark / SMTP setup

Required before newsletter feature (M13). Must be configured in Phase 6 so the domain is warmed up:

```bash
# Update the smtp_password secret with real Postmark API key
echo -n "<postmark-api-key>" | docker secret rm smtp_password || true
echo -n "<postmark-api-key>" | docker secret create smtp_password -

# Update the stack
make deploy TAG=$(git rev-parse --short HEAD)
```

DKIM and SPF DNS records for `tahti.fi`:
```
TXT  pm._domainkey.tahti.fi   → <postmark-dkim-value>
TXT  tahti.fi                 → "v=spf1 include:spf.mtasv.net ~all"
```

## Exit criteria

| Check | Method | Expected |
|-------|--------|----------|
| Release to Spotify | Submit a real release | Appears on Spotify in 1–3 days |
| Revelator royalty sync | Trigger job manually | Royalties appear in ledger |
| Transparency ledger | Open app.tahti.fi/transparency | Shows real ledger entries |
| Grant calculation | `POST /admin/grants/calculate` | Returns realistic preview |
| Grant disbursement dry-run | Run with `dry_run: true` | No money moved, log shows amounts |
| Mixcloud upload | End a stream with MC connected | Recording on Mixcloud within 30 min |
| Ledger is append-only | Try `DELETE FROM ledger_entries` | DENIED by PG trigger |
