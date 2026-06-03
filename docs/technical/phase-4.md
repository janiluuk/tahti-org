# Phase 4 — Artist app alpha

**Goal:** a hand-recruited artist can sign up, create a channel, broadcast live via OBS or Mixxx, and have the broadcast auto-archived. Listeners can tune in and chat in real time.

**Timeline:** Month 2–5 (milestones M0–M5 from `docs/AGENT.md`)  
**Entry state:** Phase 3 complete, stateful services running.  
**New services:** api, web, worker-media, worker-light, orchestrator, chat, icecast, rtmp-ingest.

---

## Full alpha architecture

```mermaid
graph TB
    subgraph Artists
        OBS[OBS / Streamlabs\nRTMP stream]
        MX[Mixxx / Traktor / butt\nIcecast source]
        Browser[Artist browser\napp.tahti.live]
    end

    subgraph Listeners
        LBrowser[Listener browser\nchannelslug.tahti.live]
    end

    subgraph "Edge (Caddy)"
        Caddy[Caddy 2\nTLS + routing]
    end

    subgraph "Application layer"
        Website[website\nmarketing site]
        Web[web — Next.js\napp + channel pages]
        API[api — Fastify\n× 3 replicas]
        Chat[centrifugo\n× 2 replicas]
    end

    subgraph "Ingest"
        RTMP[nginx-RTMP\n:1935]
        IC[Icecast\n:8000]
    end

    subgraph "Processing"
        Orch[orchestrator]
        LS[Liquidsoap\n1 per channel]
        WM[worker-media\ntranscode × 2]
        WL[worker-light\nstats / cleanup]
    end

    subgraph "Data"
        PG[(Postgres)]
        RD[(Redis\nBullMQ queues)]
        MN[(MinIO\nobject store)]
        HLS[(hls_shared\nvolume)]
        REC[(recordings_shared\nvolume)]
    end

    OBS -- RTMP :1935 --> RTMP
    MX -- Icecast :8000 --> IC
    Browser -- HTTPS --> Caddy
    LBrowser -- HTTPS --> Caddy

    Caddy --> Website
    Caddy --> Web
    Caddy --> API
    Caddy --> Chat
    Caddy -- /srv/hls --> HLS

    RTMP -- on_publish webhook --> API
    IC -- URL auth webhook --> API
    API -- enqueue job --> RD
    API --> PG
    API --> MN
    API --> Chat

    Orch -- docker exec --> LS
    LS -- HLS segments --> HLS
    LS -- raw recording --> REC

    WM -- dequeue --> RD
    WM -- transcode recording --> MN
    WL -- stats rollup --> PG

    Web --> API
    Chat -- pub/sub backplane --> RD
```

## Artist registration flow

```mermaid
sequenceDiagram
    participant A as Artist
    participant Web as Next.js (app.tahti.live)
    participant API as Fastify API
    participant PG as Postgres
    participant MH as Postmark (email)

    A->>Web: Open app.tahti.live/join
    Web->>A: Registration form (name, email, password, invite code)
    A->>Web: Submit form
    Web->>API: POST /api/auth/register
    API->>PG: INSERT INTO artists (name, email, password_hash)
    API->>PG: INSERT INTO memberships (artist_id, status=pending)
    API->>MH: Send verification email
    MH-->>A: "Verify your email" link
    A->>API: GET /api/auth/verify?token=xxx
    API->>PG: UPDATE memberships SET status=active
    API-->>A: 302 → /dashboard
    A->>Web: First login — dashboard with empty channel
```

## Live broadcast flow (OBS → listener)

```mermaid
sequenceDiagram
    participant OBS as OBS (artist machine)
    participant RTMP as nginx-RTMP ingest
    participant API as Fastify API
    participant Orch as Orchestrator
    participant LS as Liquidsoap (channel container)
    participant HLS as hls_shared volume
    participant CDN as stream.tahti.live (Caddy)
    participant L as Listener browser

    OBS->>RTMP: RTMP connect (rtmp://ingest.tahti.live:1935/live/<stream_key>)
    RTMP->>API: POST /internal/rtmp/on_publish {key, stream_name}
    API->>API: Validate stream key → look up artist channel
    API->>PG: INSERT broadcasts (channel_id, started_at)
    API->>Orch: Spawn Liquidsoap for channel_slug
    Orch->>LS: docker run liquidsoap --channel=slug
    LS->>RTMP: Pull RTMP stream
    LS->>HLS: Write HLS segments every 3s
    LS->>HLS: Update index.m3u8

    L->>CDN: GET /hls/slug/index.m3u8
    CDN->>HLS: Read index.m3u8
    CDN-->>L: playlist (3s segments)
    loop Every 3 seconds
        L->>CDN: GET /hls/slug/seg-NNN.ts
        CDN->>HLS: Read segment
        CDN-->>L: audio segment
    end

    Note over L: Listener hears live audio with ~6-9s delay

    OBS->>RTMP: Disconnect (stream ends)
    RTMP->>API: POST /internal/rtmp/on_done
    API->>PG: UPDATE broadcasts SET ended_at=NOW()
    API->>RD: Enqueue transcode-archive job
    Orch->>LS: Stop container after 60s grace
```

## Archive upload flow

```mermaid
sequenceDiagram
    participant A as Artist browser
    participant API as API
    participant MN as MinIO
    participant RD as Redis (BullMQ)
    participant WM as worker-media

    A->>API: POST /api/uploads/prepare {filename, size, content_type}
    API->>MN: Generate presigned PUT URL (15 min TTL)
    API-->>A: { upload_url, upload_id }

    A->>MN: PUT <presigned-url> (direct upload, not via API)
    MN-->>A: 200 ETag

    A->>API: POST /api/uploads/complete {upload_id, etag}
    API->>PG: INSERT archive_items (channel_id, minio_key, status=processing)
    API->>RD: Enqueue {job: transcode-archive, item_id}

    WM->>RD: Dequeue job
    WM->>MN: Download raw audio
    WM->>WM: ffmpeg: normalize → MP3 192k + FLAC 16/44
    WM->>WM: audiowaveform: generate waveform JSON
    WM->>MN: Upload MP3, FLAC, waveform
    WM->>PG: UPDATE archive_items SET status=ready, duration, waveform_key
    WM->>API: POST /internal/webhooks/item-ready {item_id}
    API->>A: WebSocket push "your upload is ready"
```

## Live chat flow

```mermaid
sequenceDiagram
    participant L as Listener browser
    participant Web as Next.js
    participant API as Fastify
    participant CH as Centrifugo
    participant RD as Redis

    L->>Web: Open channelslug.tahti.live
    Web->>API: GET /api/channels/slug/token (server-side render)
    API->>API: Generate Centrifugo JWT (sub=anon_fingerprint)
    API-->>Web: { channel_token }
    Web-->>L: Page with embedded token

    L->>CH: WebSocket connect (wss://chat.tahti.live)
    L->>CH: Subscribe to channel:slug
    CH->>RD: Store presence record
    CH-->>L: Last 100 messages from history

    L->>CH: Publish {text: "great track!"}
    CH->>API: Proxy publish webhook (moderation check)
    API->>API: Check fingerprint ban list
    API-->>CH: 200 allow
    CH->>RD: Fan out to all subscribers
    CH-->>All Listeners: {handle: "anon_4f2a", text: "great track!"}
```

## Sub-phase breakdown

### 4a — Skeleton + accounts (M0–M1, Weeks 1–4)

```mermaid
gantt
    title Phase 4a milestones
    dateFormat YYYY-MM-DD
    axisFormat Week %W

    section M0 — Skeleton
    Repo structure, CI, docker baseline     :m0, 2026-02-15, 7d
    section M1 — Accounts
    Artist registration + email verify      :m1, after m0, 7d
    Dashboard shell (empty state)           :after m0, 7d
    Membership status (pending/active)      :after m0, 7d
```

**Deliverable:** artist can register, verify email, log in, see empty dashboard.

### 4b — Channel + archive (M2, Weeks 5–6)

**Deliverable:** artist can upload an MP3, see it transcoded and listed in their channel. Listeners can visit `slug.tahti.live` and play the archive item.

### 4c — Live broadcast (M3–M4, Weeks 7–10)

**Deliverable:** OBS guide published, artist follows it, stream is live. Icecast ingress also works for Mixxx. Auto-archive fires within 5 minutes of stream end.

### 4d — Live chat (M5, Weeks 11–12)

**Deliverable:** anonymous listener types a message, it appears for all connected listeners in < 200 ms. Channel artist can see and delete messages.

## Deployment checklist (on top of Phase 3)

```bash
# Deploy the full stack (all new services)
TAG=<sha> docker stack deploy -c infra/docker-stack.yml tahti

# Check all services are running
docker stack services tahti

# Run DB migrations
docker exec -it $(docker ps -qf name=tahti_api) node dist/migrate.js

# Verify API health
curl https://api.tahti.live/health

# Verify chat WebSocket
wscat -c wss://chat.tahti.live/connection/websocket

# Check worker queues are processing
docker logs $(docker ps -qf name=tahti_worker-media) | tail -20
```

## Exit criteria

| Check | Method | Expected |
|-------|--------|----------|
| Artist registration | Sign up at app.tahti.live | Email arrives in < 30s |
| Email verification | Click link in email | Dashboard opens |
| Archive upload | Upload 10 min MP3 | Ready in < 5 min |
| Live stream | OBS → RTMP → listener | Audio in < 10s delay |
| Stream auto-archive | End OBS stream | Archive item appears in < 5 min |
| Live chat | 2 browser tabs | Message appears in < 200 ms |
| 50 concurrent listeners | k6 load test | No 5xx, P95 latency < 500 ms |
| Artist non-technical guide | Ask a non-technical volunteer to broadcast | Succeeds without support |
