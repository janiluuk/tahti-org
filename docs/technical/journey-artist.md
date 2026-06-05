# User journey — Artist

The artist is Tahti's primary user. This document traces the full lifecycle from first hearing about Tahti to receiving their first annual grant, across all seven delivery phases.

---

## Experience overview

```mermaid
journey
    title Artist lifecycle on Tahti
    section Discovery
      Hears about Tahti from another artist  : 5 : Artist
      Visits tahti.live                        : 4 : Artist
      Reads what the platform offers         : 4 : Artist
      Checks pricing (€40/year)              : 3 : Artist
    section Onboarding
      Receives invite from beta recruitment  : 5 : Artist, Director
      Signs up at app.tahti.live               : 4 : Artist
      Verifies email                         : 3 : Artist
      Sets up artist profile                 : 4 : Artist
      Creates first channel                  : 5 : Artist
    section First broadcast
      Reads OBS broadcasting guide           : 3 : Artist
      Installs OBS, gets stream key          : 3 : Artist
      Goes live for the first time           : 5 : Artist
      Sees listeners in real time            : 5 : Artist
      Reads live chat messages               : 5 : Artist
    section Archive and releases
      Uploads recorded sets                  : 4 : Artist
      Publishes first release to DSPs        : 4 : Artist
      Checks Spotify — release appears       : 5 : Artist
    section Community and grants
      Attends first AGM                      : 4 : Artist, Director
      Sees transparency ledger               : 5 : Artist
      Receives first annual grant            : 5 : Artist, Director
```

---

## Journey 1 — Discovery and registration

**Phase 1–4 relevant.**

```mermaid
sequenceDiagram
    participant A as Artist (Joonas, DJ)
    participant TF as tahti.live
    participant APP as app.tahti.live
    participant API as API
    participant Email as Postmark email

    Note over A: Joonas hears about Tahti at Äänipaja event in Helsinki
    A->>TF: Opens tahti.live on phone
    TF-->>A: Marketing site — sees "Your radio station" pitch
    A->>TF: Reads pricing section (€40/year)
    A->>TF: Clicks "Join the beta" → waiting list form
    Note over A: 3 days pass — Director sends invite

    A->>APP: Opens invite link (app.tahti.live/join?invite=xxx)
    APP-->>A: Registration form
    A->>APP: Fills in: name, email, password
    APP->>API: POST /api/auth/register
    API->>Email: Send verification email
    Email-->>A: "Verify your Tahti account" email
    A->>API: Clicks verify link
    API-->>APP: Redirect to dashboard
    APP-->>A: Dashboard — empty channel, welcome message
```

---

## Journey 2 — First live broadcast (OBS)

**Phase 4 relevant.**

### Streaming infrastructure schematic

```mermaid
graph LR
    subgraph "Artist machine"
        OBS[OBS Studio\nRTMP 2500 kbps AAC]
    end
    subgraph "Ingest tier (2 nodes)"
        RTMP_A[nginx-RTMP A\n:1935]
        RTMP_B[nginx-RTMP B\n:1935 standby]
    end
    subgraph "Edge encoder (per channel)"
        EE[ffmpeg\nnormalize → PCM 48kHz\ntee: lossless + MP3 192k\nchromaprint fingerprint]
    end
    subgraph "Media server + Recording"
        LS[Liquidsoap\nHLS packaging\narchive fallback\nsegments → MinIO]
        REC[ffmpeg-recorder\nraw FLAC → MinIO recordings/]
    end
    subgraph "Segment store"
        MN_LIVE[MinIO hls-live/\nTTL 60s per segment]
        MN_ARCH[MinIO audio/\narchive + releases]
    end
    subgraph "Delivery"
        CADDY[Caddy A\nserves /hls/* from MinIO]
        CADDY_B[Caddy B\nhot standby]
    end
    subgraph "Metrics"
        PROM[Prometheus\nsegment_write_rate\ninput_bitrate\nbandwidth_bytes_out]
    end

    OBS -->|RTMP| RTMP_A
    OBS -.->|failover| RTMP_B
    RTMP_A --> EE
    EE --> LS
    EE --> REC
    LS -->|HLS segments| MN_LIVE
    REC -->|raw recording| MN_ARCH
    MN_LIVE --> CADDY
    MN_LIVE --> CADDY_B
    LS & EE & CADDY --> PROM
```

> **Issues raised:** STREAM-001 (segments must go to MinIO not volume), STREAM-002 (edge encoder must exist), STREAM-003 (DNS failover gap), STREAM-004 (recording must be separate container). All tracked in roadmap streaming backlog.

### Sequence

```mermaid
sequenceDiagram
    participant A as Artist (Joonas)
    participant Guide as OBS Guide (docs)
    participant OBS as OBS on laptop
    participant RTMP as nginx-RTMP ingest
    participant API as Fastify API
    participant LS as Liquidsoap
    participant CH as Channel page
    participant L as Listener (Maija)

    A->>Guide: Reads tahti.live/docs/obs-guide
    A->>OBS: Opens OBS, adds RTMP server
    Note over A,OBS: server: rtmp://ingest.tahti.live:1935/live\nstream key: copied from dashboard

    A->>OBS: Clicks "Start Streaming"
    OBS->>RTMP: RTMP connect with stream key
    RTMP->>API: POST /internal/rtmp/on_publish
    API-->>RTMP: 200 authorized
    API->>API: Spawn edge-encoder container for channel
    API->>LS: Spawn Liquidsoap (pulls from edge encoder output)
    API->>REC: Spawn ffmpeg-recorder (writes raw to MinIO recordings/)
    LS-->>MN: HLS segments flowing to MinIO hls-live/
    MN-->>CH: Caddy serves /hls/slug/* from MinIO

    Note over CH: slug.tahti.live now shows LIVE badge
    L->>CH: Opens slug.tahti.live (someone shared the link)
    CH-->>L: Page loads, audio player
    L->>CH: Clicks play
    CH-->>L: Audio starts (6–9s delay behind live)

    L->>CH: Types "this is fire 🔥" in chat
    CH-->>A: Chat message appears in sidebar

    A->>OBS: Stops streaming after 2 hours
    OBS->>RTMP: Disconnect
    RTMP->>EE: Edge encoder receives EOF
    EE->>REC: Signal broadcast end
    REC->>MN: Finalize recording file
    REC->>API: POST /internal/recording/complete {channelId, key, durationSec}
    API->>WM: Enqueue transcode-archive job
    Note over WM: 5 min later: FLAC + Opus + MP3 derivatives ready
    A->>CH: Refreshes channel — sees broadcast in archive
```

> **Issue ARTIST-001:** If OBS disconnects unexpectedly (network drop) before the graceful end signal, the recorder must detect the closed input stream and finalize the partial recording rather than discarding it. Tracked in roadmap.
> **Issue ARTIST-002:** Stream key rotation while live is not yet supported — tracked in roadmap.

---

## Journey 3 — First Mixxx broadcast (Icecast)

**Phase 4 relevant. Applies to DJs using hardware mixers.**

```mermaid
sequenceDiagram
    participant A as Artist (Riitta, vinyl DJ)
    participant MX as Mixxx on laptop
    participant IC as Icecast ingest
    participant API as API
    participant LS as Liquidsoap

    Note over A: Riitta uses Mixxx with a mixer — doesn't want OBS
    A->>A: Opens dashboard, copies Icecast credentials
    Note over A,MX: server: ingest.tahti.live:8000\nmount: /live/riitta-slug\npassword: from dashboard

    A->>MX: Configures Icecast output in Mixxx preferences
    A->>MX: Clicks "Enable Live Broadcasting"
    MX->>IC: Icecast source connect
    IC->>API: GET /internal/icecast/on_connect?mount=/live/riitta-slug
    API-->>IC: 200 authorized
    API->>LS: Spawn channel container pulling from Icecast

    Note over A: Channel is now live — identical experience for listeners
```

---

## Journey 4 — Archive upload

**Phase 4 relevant.**

```mermaid
sequenceDiagram
    participant A as Artist
    participant APP as app.tahti.live
    participant API as API
    participant MN as MinIO
    participant WM as worker-media
    participant CH as Channel page

    A->>APP: Dashboard → "Upload a recording"
    APP-->>A: Upload drag-zone
    A->>APP: Drops 2h MP3 file (170 MB)
    APP->>API: POST /api/uploads/prepare {size: 170MB, type: audio/mpeg}
    API->>MN: Generate presigned PUT URL
    API-->>APP: { upload_url, upload_id }
    APP->>MN: PUT <presigned-url> (direct browser → MinIO, not via API)
    Note over APP,MN: Progress bar shows upload progress
    MN-->>APP: 200 ETag
    APP->>API: POST /api/uploads/complete {upload_id}
    API->>API: Enqueue transcode-archive job

    WM->>MN: Pull raw audio
    WM->>WM: ffmpeg → MP3 192k (streaming) + FLAC 16/44 (download)
    WM->>WM: audiowaveform → waveform.json
    WM->>MN: Store processed files

    API-->>APP: WebSocket: "Upload ready"
    APP-->>A: Notification: "Your recording is live in your channel"

    A->>CH: Visits channel — waveform visible, both quality tiers available
```

---

## Journey 5 — Release to DSPs

**Phase 6 relevant.**

```mermaid
sequenceDiagram
    participant A as Artist
    participant APP as app.tahti.live
    participant API as API
    participant RD as Redis
    participant WD as worker-dist
    participant REV as Revelator DSP

    A->>APP: Releases → "Submit new release"
    APP-->>A: Release form: title, artist name, label (Tahti ry), tracks, artwork
    A->>APP: Fills in ISRC (Tahti provides one via IFPI membership), genre, release date
    A->>APP: Clicks "Publish to stores"
    APP->>API: POST /api/releases/:id/publish
    API->>RD: Enqueue revelator-deliver job

    WD->>REV: POST /v1/releases (metadata)
    WD->>REV: Upload audio + artwork files
    WD->>REV: POST /v1/releases/:id/submit

    loop Every 6 hours until delivered
        WD->>REV: GET /v1/releases/:id/status
        REV-->>WD: status: processing
    end

    REV-->>WD: status: delivered, spotify_url: https://open.spotify.com/...
    WD->>API: Webhook: release delivered
    API-->>APP: WebSocket: "Your release is live on Spotify"
    APP-->>A: "🎉 Your release is now on Spotify, Apple Music, and 40+ stores"
```

---

## Journey 6 — Receiving annual grant

**Phase 6 relevant. First real disbursement: Q1 Year 2.**

```mermaid
sequenceDiagram
    participant A as Artist (all 200 active artists)
    participant DIR as Director
    participant API as API (admin)
    participant PG as Postgres
    participant Stripe as Stripe Connect
    participant Bank as Artist's bank

    Note over DIR: Q1 Year 2 — grant calculation begins

    DIR->>API: POST /admin/grants/calculate {year: 2025}
    API->>PG: Aggregate engagement units per artist (streams, hours, downloads)
    API->>PG: SELECT surplus from ledger WHERE year=2025
    API-->>DIR: Preview table: [{artist, units, share, amount_eur}]

    DIR->>DIR: Reviews for anomalies (bots, self-streams, etc.)
    DIR->>API: POST /admin/grants/disburse {year: 2025, approved: true}

    loop Per artist (200 iterations)
        API->>Stripe: transfers.create {amount_eur → artist Stripe Connect}
        Stripe-->>A: Bank transfer notification
        A->>Bank: Receives €N in 2-5 business days
        API->>PG: INSERT ledger_entries (grant-disbursement)
    end

    API->>PG: INSERT ledger_entries (grant-round-closed, year: 2025)
    Note over A: Artist opens app.tahti.live/transparency
    A->>A: Sees their entry in the public ledger — amount, date, year
```

---

## Friction map (where artists need support)

```mermaid
graph LR
    subgraph "High friction — needs good docs or async support"
        F1[OBS setup\nfirst broadcast]
        F2[Stream key location\nin dashboard]
        F3[Icecast config\nfor Mixxx/Traktor]
        F4[ISRC and metadata\nfor DSP submission]
        F5[Stripe Connect\nbank onboarding]
    end

    subgraph "Medium friction — watch for drop-off"
        M1[Email verification\nspam folder]
        M2[Upload processing time\n< 5 min unclear to user]
        M3[Understanding\nengagement units]
    end

    subgraph "Low friction — should just work"
        L1[Signing up]
        L2[Playing archive]
        L3[Live chat]
        L4[Checking transparency ledger]
    end

    F1 & F2 & F3 --> Action1[OBS guide + video walkthrough]
    F4 --> Action2[Release submission wizard with tooltips]
    F5 --> Action3[Stripe Connect step-by-step in dashboard]
    M1 --> Action4[Resend verification email button]
    M2 --> Action5[Processing status indicator with time estimate]
```

---

## Detailed steps (implemented today)

| Journey | Step | Web | API | E2e |
|---------|------|-----|-----|-----|
| 1 — Register & verify | Sign up | `/join` | `POST /api/auth/register` | `vital-flows.sh` |
| 1 | Email verify | `/verify` | `GET /api/auth/verify` | seed token (manual) |
| 1 | Activate membership | `/dashboard` | `POST /api/me/membership/checkout` | `artist.sh` (`/api/me/membership`) |
| 2 — First broadcast | Stream settings | `/dashboard` | `GET /api/me/stream-settings` | `artist.sh`, `dashboard-player.sh` |
| 2 | Icecast auth | — | `POST /internal/icecast/on_connect` | `artist.sh` |
| 2 | Multistream help | `/help/multistream` | `GET /api/me/rtmp-targets` | `artist.sh` |
| 3 — Releases & fan tiers | Dashboard studio | `/dashboard` | `GET /api/me/releases`, `GET /api/me/fan-tiers` | `artist.sh`, `dashboard-player.sh` |
| 4 — Archive upload | Upload flow | `/dashboard` | `POST /api/uploads/*` | not in bash e2e (worker/MinIO) |
| 5 — DSP delivery | Release publish | `/dashboard` | Revelator worker queue | not in bash e2e |
| 6 — Grant receipt | Transparency | `/transparency` | public ledger + grants report | `director.sh`, `vital-flows.sh` |

---

## Automated coverage

| Layer | Script / test |
|-------|----------------|
| CI bash | `tests/e2e/user-journeys.sh` → `journeys/artist.sh`, `dashboard-player.sh` |
| Playwright (local) | `tests/e2e/user-journeys.mjs`, `dashboard-player.mjs` |
| Vitest | `apps/api/src/routes/journeys/persona-journeys.test.ts` (artist describe) |
| Fixtures | `apps/api/scripts/seed-e2e-screenshots.ts` (demo EP, archive, fan tier) |
| Index | [user-flows.md](../user-flows.md) |
