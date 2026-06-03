# User journey — Listener

Listeners are anonymous by default. They need no account to tune in, chat, or browse channels. This aligns with the constitution's Rule 3 (anonymous listening by default).

---

## Experience overview

```mermaid
journey
    title Listener experience on Tahti
    section Discovery
      Artist shares channel link on social media    : 5 : Listener
      Opens channelslug.tahti.live                    : 4 : Listener
      Page loads instantly (static channel page)    : 5 : Listener
    section First listen
      Clicks play on live stream                    : 5 : Listener
      Audio starts within 10 seconds               : 4 : Listener
      Sees waveform and track info                  : 4 : Listener
    section Community
      Reads live chat (no account needed)           : 4 : Listener
      Types a chat message (anonymous handle)       : 3 : Listener
      Message appears for all listeners             : 5 : Listener
    section Return visits
      Bookmarks channel URL                         : 5 : Listener
      Returns next day, artist is offline           : 3 : Listener
      Archive plays automatically (fallback)        : 4 : Listener
      Discovers other artist channels               : 3 : Listener
    section Fan subscription
      Decides to support artist financially         : 4 : Listener
      Subscribes via Stripe (€5/month)              : 4 : Listener
      Unlocks FLAC quality + download access        : 5 : Listener
```

---

## Journey 1 — First listen (anonymous)

**Phase 4 relevant.**

### Streaming delivery schematic

```mermaid
graph LR
    subgraph "Listener device"
        PHONE[Mobile browser\nHLS.js]
    end
    subgraph "Delivery"
        CADDY[Caddy\nserves /hls/*]
    end
    subgraph "Segment store"
        MN[MinIO hls-live/\n3-second segments\nObject TTL: 60s]
    end
    subgraph "Media server"
        LS[Liquidsoap\nwrites new segment every 3s\nindex.m3u8 updated]
    end
    subgraph "Watchdog"
        WD[worker-light\nchecks segment_age every 30s\nauto-restarts stale channels]
    end

    PHONE -->|GET /hls/slug/index.m3u8| CADDY
    CADDY -->|s3 get| MN
    MN -->|playlist| CADDY
    CADDY -->|playlist| PHONE
    PHONE -->|GET seg-NNN.ts every 3s| CADDY
    CADDY -->|s3 get| MN
    MN -->|segment| CADDY
    CADDY -->|segment| PHONE
    LS -->|PUT seg-NNN.ts| MN
    WD -->|check newest segment age| MN
    WD -.->|restart if age > 20s| LS
```

> **Issue LISTENER-001:** On slow mobile (4G, 100ms RTT), the 3s segment interval plus 2-segment buffer = ~6s startup delay. HLS.js shows a spinner with no text — the channel page must show an explicit "Buffering..." state with a time estimate. Tracked in roadmap.
> **Issue STREAM-005:** Without the watchdog, a crashed Liquidsoap container produces no new segments but the playlist still exists in MinIO with old entries. Listeners get `404` on segment fetches and HLS.js stalls silently. The watchdog detects this via segment age check.

```mermaid
sequenceDiagram
    participant L as Listener (Maija)
    participant Link as Shared link (Instagram)
    participant CH as channelslug.tahti.live
    participant API as API (SSR)
    participant HLS as stream.tahti.live (HLS)

    L->>Link: Sees artist's Instagram story: "live now — tahti.live/joonas"
    L->>CH: Opens link on phone (mobile browser)
    CH->>API: SSR: GET /api/channels/joonas (channel data)
    API-->>CH: Channel metadata, current broadcast, last 10 archive items
    CH-->>L: Page renders (< 1s on 4G)

    Note over L,CH: Page shows: artist name, LIVE badge, waveform, chat
    L->>CH: Taps play
    CH->>HLS: GET /hls/joonas/index.m3u8
    HLS-->>CH: Playlist (3s segments)
    CH->>HLS: GET /hls/joonas/seg-001.ts ... seg-003.ts
    HLS-->>CH: Audio segments (buffering ~2 segments)
    CH-->>L: Audio playing ✓ (6–9s delay behind live)

    Note over L: Maija listens for 45 minutes
    L->>CH: Types "amazing set 🎵" in chat
    CH->>API: POST /api/chat/channel:joonas (fingerprint-based anon)
    API->>API: Moderation check (not banned)
    API-->>CH: Centrifugo publish
    CH-->>L: Message appears as "anon_7f3b: amazing set 🎵"
    CH-->>All: Broadcast to all connected listeners
```

---

## Journey 2 — Offline fallback (archive playback)

**Phase 4 relevant. The channel always plays — live or archive.**

> **Issue ARTIST-003 / LISTENER-002:** When an artist goes offline, the archive fallback begins within 10 seconds. But if the archive is cold in MinIO (not recently accessed), Liquidsoap must fetch segments from MinIO before it can serve them. This can produce a brief silence. Mitigation: Liquidsoap should pre-buffer the first 3 archive segments on startup, before going into fallback mode. Additionally, there is currently no "Next broadcast: Thursday 22:00" signal — the channel page shows "offline" with no further information, which is a dead end for returning listeners.

```mermaid
sequenceDiagram
    participant L as Listener
    participant CH as Channel page
    participant API as API
    participant LS as Liquidsoap (channel)
    participant ARCH as Archive (MinIO)

    Note over L: Tuesday evening — artist is not broadcasting
    L->>CH: Opens channelslug.tahti.live
    CH->>API: GET /api/channels/slug
    API-->>CH: { status: offline, fallback: archive }

    Note over CH: Liquidsoap is running archive fallback rotation
    LS->>ARCH: Pull oldest un-played archive item
    LS->>CH: HLS segments from archive stream

    CH-->>L: Page shows: no LIVE badge, "playing archive — last broadcast 2 days ago"
    L->>CH: Clicks play
    CH-->>L: Archive audio plays seamlessly

    Note over L: Listener doesn't feel cheated — channel always has content
```

---

## Journey 3 — Fan subscription

**Phase 6 relevant. The listener voluntarily subscribes — never prompted by algorithm.**

```mermaid
sequenceDiagram
    participant L as Listener (Maija, after 3 months of listening)
    participant CH as Channel page
    participant API as API
    participant Stripe as Stripe

    Note over L: Maija has been listening for 3 months, loves the channel
    L->>CH: Opens channel, sees "Support Joonas" section (subtle, non-intrusive)
    CH-->>L: Tier info: Free (MP3 192k) / Fan €5/mo (FLAC + downloads)

    L->>CH: Clicks "Become a fan — €5/month"
    CH->>API: POST /api/fan-subscriptions/create {channel_id}
    API->>Stripe: Create Stripe Checkout session (Stripe Connect to artist)
    API-->>CH: { checkout_url }
    CH-->>L: Redirect to Stripe Checkout

    L->>Stripe: Enters card details
    Stripe-->>API: Webhook: subscription.created
    API->>PG: INSERT fan_subscriptions (listener_fingerprint, channel_id, tier=fan)
    API->>PG: INSERT ledger_entries (fan-sub-revenue, artist_id, amount)

    Note over L: Maija returns to channel — now has FLAC player and download button
    L->>CH: Clicks download on archive item
    CH->>API: GET /api/downloads/:item_id (auth: subscription cookie)
    API->>MN: Generate presigned GET URL for FLAC file
    API-->>CH: Download URL
    CH-->>L: FLAC file downloads ✓

    Note over API: Tahti takes 0% cut — full €5 goes to artist via Stripe Connect
```

---

## Journey 4 — Listener discovers new artists

**Phase 4+ relevant. No algorithmic discovery — only human paths.**

```mermaid
flowchart LR
    L[Listener] --> CH1[Visits one channel\nfrom shared link]
    CH1 --> Notice[Notices "Related channels"\nsection — artist-curated list\nnot algorithm]
    Notice --> CH2[Visits another channel]
    CH2 --> CH3[Artist's profile shows\ncollaborators and label-mates]
    CH3 --> CH4[Listener bookmarks\nfavourite channels manually]

    Note1["Discovery is human:\nartists mention each other\nin chat, social, at shows.\nTahti does NOT rank or\nrecommend algorithmically."]

    style Note1 fill:#1a2340,stroke:#f0a500,color:#e8eaf6
```

---

## Privacy model

```mermaid
flowchart TD
    subgraph "What Tahti knows about listeners"
        L1[IP address — hashed with rotating salt\nnot stored raw]
        L2[Session cookie — ephemeral, no account]
        L3[Chat messages — linked to fingerprint\nnot to name or email]
        L4[Fan subscription — Stripe handles card\nTahti stores only: fan tier, channel, active status]
    end

    subgraph "What Tahti does NOT collect"
        N1[No name or email for anonymous listeners]
        N2[No listening history linked to identity]
        N3[No behavioural profiling]
        N4[No third-party analytics scripts]
        N5[No cross-site tracking]
    end

    subgraph "What the artist sees"
        A1[Total listener count\nper broadcast]
        A2[Engagement units\naggregated, not per-person]
        A3[Chat messages\nwith anonymous handles]
    end
```

---

## Listener support flow

```mermaid
sequenceDiagram
    participant L as Listener
    participant CH as Channel page
    participant Email as ops@tahti.live

    Note over L: Chat message deleted by artist — listener disputes
    L->>CH: Sees "message removed" placeholder
    L->>Email: Sends email to ops@tahti.live
    Email-->>Director: Support ticket
    Director->>PG: SELECT * FROM chat_moderation_log WHERE fingerprint=...
    Note over Director: Reviews deletion reason
    Director-->>L: Responds within 48h with explanation

    Note over L: Fan subscription not working
    L->>CH: Plays archive but gets MP3 quality despite being subscribed
    L->>Email: Reports issue
    Director->>API: GET /admin/subscriptions?fingerprint=<hash>
    API-->>Director: Subscription active, but cookie expired
    Director-->>L: Asks listener to clear cookies and log in again
```
