# Phase 8 — Artist profile and releases (M12)

**Goal:** every artist has a permanent public URL at `tahti.fi/u/<handle>` that functions as their home page on the internet — bio, release timeline, channel embed, and social links. Artists can upload tracks, publish releases, and have the platform generate smart links automatically.

**Timeline:** Months 10–12 (post-launch, alongside live beta)  
**Entry state:** Phase 7 complete, public beta open, 50+ active member artists.  
**New services:** none — existing `api`, `web`, and `worker-media` services extended.

---

## Artist profile architecture

```mermaid
graph TB
    subgraph Public
        V[Visitor browser]
        Bot[Search engine\nSocial crawler]
    end

    subgraph "Edge (Caddy)"
        Caddy[Caddy 2]
    end

    subgraph "Application"
        Web[web — Next.js\nRSC profile pages]
        API[api — Fastify]
        WM[worker-media\ntranscode-release-track queue]
    end

    subgraph Data
        PG[(Postgres\nrelease schema)]
        MN[(MinIO\naudio + artwork)]
    end

    V -- "GET tahti.fi/u/djname" --> Caddy
    Bot -- "HEAD + GET" --> Caddy
    Caddy --> Web
    Web -- "Server-side fetch" --> API
    API --> PG
    API --> MN
    WM --> PG
    WM --> MN
```

## Release upload and transcode pipeline

```mermaid
sequenceDiagram
    participant A as Artist browser
    participant API as Fastify API
    participant MN as MinIO
    participant RD as Redis (BullMQ)
    participant WM as worker-media
    participant PG as Postgres

    A->>API: POST /v1/me/releases {title, type, releaseDate, artworkFile}
    API->>MN: Upload artwork → covers/releases/<id>/artwork.jpg
    API->>PG: INSERT releases (state=DRAFT, artworkKey)
    API-->>A: { releaseId }

    A->>API: POST /v1/me/releases/:id/tracks/prepare {filename, size, contentType}
    API->>API: Validate MIME type, extension, size ≤ 500 MB
    API->>MN: Generate presigned PUT URL (15 min TTL)
    API->>PG: INSERT release_tracks (state=UPLOADING, sourceKey)
    API-->>A: { uploadUrl, trackId }

    A->>MN: PUT presigned URL (direct upload, bypasses API)
    MN-->>A: 200 ETag

    A->>API: POST /v1/me/releases/:id/tracks/:trackId/complete {etag}
    API->>PG: UPDATE release_tracks (etag confirmed)
    API->>RD: Enqueue {job: transcode-release-track, trackId}

    WM->>RD: Dequeue
    WM->>MN: Download source file
    WM->>WM: ffprobe — validate audio, extract duration/sampleRate/bitDepth
    WM->>WM: chromaprint — fingerprint for intra-catalog dedup
    WM->>WM: ffmpeg — Opus 256 kbps Ogg (stream default)
    WM->>WM: ffmpeg — HLS Opus ladder (64/128/256 kbps, 4s segments)
    WM->>WM: ffmpeg — FLAC 16/44.1 (download, membership)
    WM->>MN: Upload streamKey, hlsManifest, flacKey
    WM->>PG: UPDATE release_tracks (state=READY, durationSec, sampleRate, bitDepth, streamKey, flacKey)
    WM-->>API: Webhook /internal/webhooks/track-ready {trackId}
    API-->>A: WebSocket push "track ready"
```

## Release publish and profile page render

```mermaid
sequenceDiagram
    participant A as Artist browser
    participant API as Fastify API
    participant PG as Postgres
    participant Web as Next.js RSC
    participant V as Visitor

    A->>API: POST /v1/me/releases/:id/publish
    API->>PG: Check all tracks in state=READY
    API->>PG: UPDATE releases (state=PUBLISHED, publishedAt=NOW(), smartLinkSlug=slug)
    API-->>A: { smartLinkSlug, profileUrl }

    V->>Web: GET tahti.fi/u/djname (cold request)
    Web->>API: GET /v1/u/djname (server component fetch)
    API->>PG: SELECT user + channel state + releases WHERE state=PUBLISHED ORDER BY releaseDate DESC
    API-->>Web: Profile JSON
    Web->>Web: Render RSC — bio, release timeline, channel embed, open graph tags
    Web-->>V: HTML with OG meta, JSON-LD MusicGroup + MusicAlbum

    Note over Web,V: Subsequent loads served from Next.js incremental static cache (ISR 60s TTL)
```

## New worker queue

| Queue | Trigger | Action |
|-------|---------|--------|
| `transcode-release-track` | Track upload completed | ffprobe → chromaprint → Opus/HLS/FLAC derivatives |

No new Docker services. `worker-media` picks up the new queue alongside the existing `transcode-archive` queue.

## New API routes (Phase 8)

```
# Public — anonymous
GET    /v1/u/:handle                  → profile (bio, releases, channel state)
GET    /v1/u/:handle/releases         → release timeline (paginated)
GET    /v1/r/:slug                    → release detail + tracklist + smart link targets
GET    /v1/r/:slug/tracks/:id/stream  → signed streaming URL (Opus 256)
GET    /v1/r/:slug/tracks/:id/flac    → signed FLAC download (membership)
GET    /oembed?url=                   → oEmbed discovery

# Artist-authed
GET    /v1/me/profile
PATCH  /v1/me/profile                 → bio, hero image, social links, press kit toggle
GET    /v1/me/releases
POST   /v1/me/releases
PATCH  /v1/me/releases/:id
POST   /v1/me/releases/:id/tracks/prepare
POST   /v1/me/releases/:id/tracks/:trackId/complete
PATCH  /v1/me/releases/:id/tracks/:trackId → title, ISRC, position, explicit, previewStart
POST   /v1/me/releases/:id/tracks/reorder
POST   /v1/me/releases/:id/publish
DELETE /v1/me/releases/:id            → moves to ARCHIVED; source file retained
GET    /v1/me/releases/:id/tracks/:trackId/download/source → original WAV/FLAC
```

## Open Graph and SEO

Every profile page and release page generates:

```html
<!-- Profile page: tahti.fi/u/djname -->
<meta property="og:type"        content="profile" />
<meta property="og:title"       content="DJ Name — Tahti" />
<meta property="og:description" content="First 160 chars of bio" />
<meta property="og:image"       content="https://cdn.tahti.fi/covers/users/<id>/avatar.jpg" />
<link rel="canonical"           href="https://tahti.fi/u/djname" />

<!-- Release page: tahti.fi/r/album-slug -->
<meta property="og:type"        content="music.album" />
<meta property="og:title"       content="Album Title — DJ Name" />
<meta property="og:image"       content="https://cdn.tahti.fi/covers/releases/<id>/artwork.jpg" />
<meta property="music:release_date" content="YYYY-MM-DD" />
```

JSON-LD on profile:
```json
{
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "DJ Name",
  "url": "https://tahti.fi/u/djname",
  "description": "...",
  "album": [{ "@type": "MusicAlbum", "name": "...", "datePublished": "..." }]
}
```

Sitemap: `api` exposes `GET /sitemap/profiles.xml` and `GET /sitemap/releases.xml` — Next.js fetches at build time and includes both in the sitemap index.

## Deployment notes

No new services. New migrations only:

```bash
# Run migration on production
docker exec -it $(docker ps -qf name=tahti_api) node dist/migrate.js

# Confirm new tables
docker exec $(docker ps -qf name=tahti_postgres) \
  psql -U tahti -c "\dt release.*"
# Should list: releases, release_tracks
```

## Exit criteria

| Check | Method | Expected |
|-------|--------|----------|
| Profile renders | Open `tahti.fi/u/testartist` | Bio, avatar, release timeline visible |
| OG image correct | Share URL on Telegram | Release artwork shows in card preview |
| Track upload | Upload 24-bit WAV, 5 tracks | All in state=READY within 15 min |
| FLAC download | Member artist downloads own track | Correct FLAC 16/44 file served |
| Anon cannot FLAC | Unauthenticated GET /r/:slug/tracks/:id/flac | 401 |
| Smart link auto | Publish a release | `tahti.fi/r/<slug>` renders without error |
| ISR works | Update bio, wait 60s, reload | Updated bio visible without redeploy |
| JSON-LD valid | Paste profile URL into schema.org validator | No errors |
| Transcode speed | 10-min WAV (44.1 kHz 24-bit) | READY within 3 min |
| Sitemap includes | `GET /sitemap/releases.xml` | Lists all published releases |
