# User journey — Director / Board

The director is the executive of Tahti ry — accountable for finances, governance, artist relations, and grant management. The board oversees the director and votes on strategic decisions. Both use the platform's transparency tooling and admin interfaces.

---

## Experience overview

```mermaid
journey
    title Director and Board lifecycle
    section Phase 0 – Pre-launch
      Registers yhdistys with PRH               : 3 : Director
      Opens bank account                         : 3 : Director
      Submits grant applications                 : 4 : Director
      Recruits founding board                    : 4 : Director
    section Phase 1–3 – Infrastructure
      Reviews infra budget vs financial model   : 4 : Director, Board
      Signs DPAs with UpCloud, Postmark, Stripe : 3 : Director
      Approves first VPS spend                  : 5 : Director
    section Phase 4–5 – Beta
      Recruits beta artists personally           : 5 : Director
      Runs first support session                 : 4 : Director
      Hosts first AGM (within 6 months of reg)  : 4 : Director, Board
    section Phase 6 – Grants
      Reviews grant calculation preview         : 4 : Director
      Presents to board for approval             : 4 : Director, Board
      Authorises disbursement                    : 5 : Director
      Publishes transparency report              : 5 : Director
    section Phase 7+ – Scale
      Hires second engineer                      : 4 : Director
      Runs AGM election (artist board seat)      : 5 : Director, Board, Artists
      Files first full audit                     : 3 : Director
```

---

## Journey 1 — Annual grant review and disbursement

**Phase 6. The most significant governance action of the year.**

```mermaid
sequenceDiagram
    participant DIR as Director
    participant Board as Board members (3)
    participant API as API (admin portal)
    participant PG as Postgres (ledger)
    participant Stripe as Stripe Connect
    participant Artists as All active artists

    Note over DIR: Q1 Year 2 — preparing grant calculation

    DIR->>API: POST /admin/grants/calculate {year: 2025, dry_run: true}
    API->>PG: Aggregate: engagement units, surplus
    API-->>DIR: Preview table (200 rows, sorted by units)

    DIR->>DIR: Spot checks:\n- Any artist with > 15% of total pool? (flag)\n- Any known inactive accounts with high units? (investigate)
    DIR->>Board: Share preview via board mailing list

    Board->>DIR: Board vote: all approve (3/3)
    Board-->>DIR: Written resolution signed

    DIR->>API: POST /admin/grants/calculate {year: 2025, dry_run: false}
    Note over API: Begins 200 Stripe transfers — takes ~10 minutes

    loop Per artist (non-blocking)
        API->>Stripe: transfers.create
        Stripe-->>Artists: Bank transfer notification
    end

    API->>PG: INSERT ledger: grant-round-closed
    DIR->>DIR: Publish annual transparency report
    DIR->>PG: Verify every ledger entry matches bank statement
    DIR-->>Artists: Email: "Your Tahti grant has been sent — check your account in 2-5 days"
```

---

## Journey 2 — AGM governance (first year)

```mermaid
sequenceDiagram
    participant DIR as Director
    participant Web as app.tahti.live/agm
    participant Artists as Artist members
    participant Board as Board

    Note over DIR: AGM must happen within 6 months of registration (bylaws)

    DIR->>Web: Create AGM event: date, agenda, resolution proposals
    Web-->>Artists: Email notification: "Annual General Meeting — you are invited"

    Artists->>Web: Submit agenda items / questions (2 weeks before AGM)
    DIR->>DIR: Prepares annual report (finances, metrics, what shipped)

    Note over DIR,Artists: AGM day (hybrid: Helsinki venue + video call)
    DIR->>Web: Opens voting on resolutions
    Artists->>Web: Vote on: budget approval, board re-election, bylaws amendments
    Web->>API: Record votes (append-only)
    Board->>DIR: Board formally adopts results

    DIR->>Web: Publish AGM minutes (within 30 days, per bylaws)
    Web-->>Artists: Minutes available at app.tahti.live/transparency
```

---

## Journey 3 — Financial transparency

**Monthly reporting. Fully public.**

```mermaid
flowchart TD
    subgraph "Revenue events (auto-logged)"
        R1[Member subscription payments\nStripe webhook → ledger]
        R2[Fan subscription revenues\nStripe webhook → ledger]
        R3[Grant income\nManual entry by director]
    end

    subgraph "Cost events (manually entered monthly)"
        C1[Director salary\n€2,200/month]
        C2[Infra costs\nVPS + fiber + domain]
        C3[Service costs\nPostmark, Revelator, Stripe fees]
        C4[Legal + accounting\nquarterly]
    end

    subgraph "Ledger (Postgres, append-only)"
        LE[(ledger_entries\nall events, forever)]
    end

    subgraph "Public dashboard"
        PD[app.tahti.live/transparency\n— no auth required\n— updates in real time]

        PD_REV[Revenue: €X this year]
        PD_COST[Costs: €Y this year]
        PD_SURPLUS[Surplus: €Z → grant pool]
        PD_HIST[Historical: full ledger, every entry]
    end

    R1 & R2 & R3 --> LE
    C1 & C2 & C3 & C4 --> LE
    LE --> PD_REV & PD_COST & PD_SURPLUS & PD_HIST

    style PD fill:#111827,stroke:#f0a500,color:#e8eaf6
```

---

## Journey 4 — Quarterly board review

**Every quarter. Structured cadence.**

```mermaid
sequenceDiagram
    participant DIR as Director
    participant Board as Board members
    participant API as Admin API
    participant PG as Postgres

    Note over DIR: Q3 review preparation

    DIR->>API: GET /admin/reports/quarterly {q: 3, year: 2026}
    API->>PG: Aggregate:\n- Revenue (membership + fan subs)\n- Costs\n- Member count + churn\n- Engagement units Q3
    API-->>DIR: Report JSON

    DIR->>DIR: Write narrative around numbers:\n"We grew from 340 to 412 members (+21%).\nTop engagement artist: 4,200 units.\nInfra costs up 12% due to storage growth."

    DIR->>Board: Share report PDF + raw numbers
    Board->>DIR: Questions / concerns
    DIR->>Board: Board meeting (video call)

    Board->>DIR: Decisions:\n1. Approve Q4 budget variance\n2. Request artist satisfaction survey\n3. Confirm grant calculation schedule

    DIR->>PG: INSERT board_resolutions (date, text, vote_result)
    DIR->>Web: Publish board minutes (redacted for personnel items)
```

---

## Journey 5 — Artist complaint handling

**The director is the first point of escalation.**

```mermaid
sequenceDiagram
    participant A as Artist (Veera)
    participant Email as ops@tahti.live
    participant DIR as Director
    participant API as Admin API
    participant PG as Postgres

    Note over A: Veera's engagement units seem wrong — she feels she should get more grant

    A->>Email: "My engagement units for Q3 look much lower than I expected"

    DIR->>Email: Receives complaint within 24h
    DIR->>API: GET /admin/artists/veera/engagement?period=Q3-2026
    API->>PG: SELECT engagement_units, streams, listener_hours, downloads\nWHERE artist_id = veera AND period = Q3-2026
    API-->>DIR: { streams: 1240, listener_hours: 3200, downloads: 45, total_units: 9645 }

    DIR->>DIR: Cross-checks with raw event counts in stats table
    Note over DIR: Finds: one broadcast not counted (ingest error — recording job failed)

    DIR->>API: POST /admin/engagement/adjustment\n{artist: veera, units: +420, reason: "ingest failure 2026-09-14"}
    API->>PG: INSERT ledger_entries (engagement-adjustment, artist=veera, +420 units)

    DIR-->>A: Explains what happened, confirms adjustment applied
    DIR->>DIR: Files bug: "Ingest failure should alert ops within 5 min"
```

---

## Director's admin interface requirements

These are the API endpoints / admin UI pages the director needs. None of these are artist-facing.

```mermaid
graph LR
    subgraph "Finance"
        F1[POST /admin/ledger/entry — manual entry]
        F2[GET /admin/reports/quarterly — aggregate report]
        F3[GET /admin/grants/calculate — preview]
        F4[POST /admin/grants/disburse — execute]
    end

    subgraph "Members"
        M1[GET /admin/artists — list with status]
        M2[POST /admin/artists/:id/status — approve/suspend]
        M3[GET /admin/engagement/adjustments — audit trail]
    end

    subgraph "Governance"
        G1[POST /admin/agm — create AGM event]
        G2[POST /admin/board-resolutions — record decision]
        G3[GET /admin/transparency-report — public ledger export]
    end

    subgraph "Support"
        S1[GET /admin/artists/:id/engagement — unit breakdown]
        S2[POST /admin/engagement/adjustment — correct unit error]
        S3[GET /admin/chat/moderation-log — chat review]
    end
```

---

## Governance risk map

```mermaid
graph TB
    subgraph "Operational risks"
        R1[Grant formula controversial\nat AGM] --> M1[Formula is parameter-driven\nnot hardcoded — change by\nboard resolution, not code]
        R2[Engagement unit outliers\nbots or self-streams] --> M2[Director reviews preview\nbefore disbursement — flagging\nif any artist > 15% of pool]
        R3[Director salary can't\nbe funded by revenue] --> M3[Bylaws: project pauses\nif director can't be paid\nfairly — not negotiable]
    end

    subgraph "Governance risks"
        G1[Director conflict of interest\non own grant] --> G2[Director abstains from vote\non own engagement unit review]
        G3[Board member resigns] --> G4[AGM elects replacement\nwithin 3 months — quorum\nnot affected by 1 vacancy]
    end
```
