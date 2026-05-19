# User journey — Artist

The artist is Tahti's primary user. This document traces the full lifecycle from first hearing about Tahti to receiving their first annual grant, across all seven delivery phases.

---

## Experience overview

```mermaid
journey
    title Artist lifecycle on Tahti
    section Discovery
      Hears about Tahti from another artist  : 5 : Artist
      Visits tahti.fi                        : 4 : Artist
      Reads what the platform offers         : 4 : Artist
      Checks pricing (€40/year)              : 3 : Artist
    section Onboarding
      Receives invite from beta recruitment  : 5 : Artist, Director
      Signs up at app.tahti.fi               : 4 : Artist
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
    participant TF as tahti.fi
    participant APP as app.tahti.fi
    participant API as API
    participant Email as Postmark email

    Note over A: Joonas hears about Tahti at Äänipaja event in Helsinki
    A->>TF: Opens tahti.fi on phone
    TF-->>A: Marketing site — sees "Your radio station" pitch
    A->>TF: Reads pricing section (€40/year)
    A->>TF: Clicks "Join the beta" → waiting list form
    Note over A: 3 days pass — Director sends invite

    A->>APP: Opens invite link (app.tahti.fi/join?invite=xxx)
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

    A->>Guide: Reads tahti.fi/docs/obs-guide
    A->>OBS: Opens OBS, adds RTMP server
    Note over A,OBS: server: rtmp://ingest.tahti.fi:1935/live\nstream key: copied from dashboard

    A->>OBS: Clicks "Start Streaming"
    OBS->>RTMP: RTMP connect with stream key
    RTMP->>API: POST /internal/rtmp/on_publish
    API-->>RTMP: 200 authorized
    API->>LS: Spawn channel container
    LS-->>CH: HLS segments begin flowing

    Note over CH: slug.tahti.fi now shows LIVE badge
    L->>CH: Opens slug.tahti.fi (someone shared the link)
    CH-->>L: Page loads, audio player
    L->>CH: Clicks play
    CH-->>L: Audio starts (6–9s delay behind live)

    L->>CH: Types "this is fire 🔥" in chat
    CH-->>A: Chat message appears in sidebar

    A->>OBS: Stops streaming after 2 hours
    OBS->>RTMP: Disconnect
    RTMP->>API: POST /internal/rtmp/on_done
    API->>API: Enqueue transcode-archive job
    Note over API: 5 min later: recording transcoded, appears in channel
    A->>CH: Refreshes channel — sees broadcast in archive
```

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
    Note over A,MX: server: ingest.tahti.fi:8000\nmount: /live/riitta-slug\npassword: from dashboard

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
    participant APP as app.tahti.fi
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
    participant APP as app.tahti.fi
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
    Note over A: Artist opens app.tahti.fi/transparency
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
