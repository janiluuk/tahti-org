# Streaming architecture — distributed, measurable, scalable

Every container in the streaming path must be:
1. **Independently scalable** — add capacity to one tier without touching others
2. **Individually measured** — CPU, memory, segment write rate, bandwidth per channel
3. **Independently recoverable** — one container crash must not silence other channels

The current monolithic design (one Liquidsoap container per channel writing to a shared Docker volume) fails all three criteria at scale. This document specifies the target distributed architecture.

---

## Tier map

```mermaid
graph TB
    subgraph Artists
        OBS[OBS / Streamlabs\nRTMP]
        MX[Mixxx / Traktor / butt\nIcecast]
        WEB[Browser\nWebRTC]
    end

    subgraph "Tier 1 — Ingest (horizontally scalable)"
        I1[nginx-RTMP node A\n:1935]
        I2[nginx-RTMP node B\n:1935 — hot standby]
        IC1[Icecast node A\n:8000]
        IC2[Icecast node B\n:8000 — hot standby]
        WB[WebRTC→SRT bridge\n:8443]
    end

    subgraph "Tier 2 — Edge encoders (per stream, on demand)"
        EE[ffmpeg edge-encoder\n1 container per live channel\nnormalizes codec + bitrate\nchromaprint fingerprint at ingest]
    end

    subgraph "Tier 3 — Media server (per channel)"
        LS[Liquidsoap 2.2\n1 container per channel\nHLS packaging\narchive fallback orchestration\nquality routing]
    end

    subgraph "Tier 4 — Segment store (MinIO, NOT shared volume)"
        MN_LIVE[MinIO bucket: hls-live\nshort TTL: 60s per segment\n2min playlist window]
        MN_ARCH[MinIO bucket: audio\narchive + release files\nlong-term storage]
    end

    subgraph "Tier 5 — Recording pipeline (independent of streaming)"
        REC[ffmpeg recorder\n1 per live broadcast\nwrites raw to MinIO recordings/\nsurvives Liquidsoap restart]
    end

    subgraph "Tier 6 — Delivery (Caddy, horizontally scalable)"
        C1[Caddy edge A\nserves /hls/* from MinIO]
        C2[Caddy edge B\nhot standby]
    end

    subgraph "Tier 7 — Transcode workers (async)"
        WM[worker-media\ntranscode-archive queue\nconverts recording to FLAC + Opus + HLS]
    end

    OBS --> I1
    OBS -.->|failover| I2
    MX --> IC1
    MX -.->|failover| IC2
    WEB --> WB

    I1 & I2 & IC1 & IC2 & WB --> EE
    EE --> LS
    EE --> REC

    LS --> MN_LIVE
    LS -- pulls archive from --> MN_ARCH

    REC --> MN_ARCH

    MN_LIVE --> C1 & C2

    MN_ARCH --> WM
    WM --> MN_ARCH
```

---

## Why segments go to MinIO, not a shared volume

The current `hls_shared` Docker volume is pinned to one Swarm node. This means:
- Caddy must run on the same node as Liquidsoap
- Adding a second Caddy node doesn't help — it can't read the volume
- Adding a second worker node doesn't help — Liquidsoap segments can't be read from there

By writing HLS segments to MinIO:
- Any Caddy node can serve segments (MinIO is network-accessible)
- Liquidsoap containers can run on any worker node
- Caddy nodes can be added or removed without data migration
- Segment TTL is enforced by MinIO lifecycle rules, not cron jobs

**MinIO bucket policy for live segments:**
```json
{
  "Rules": [{
    "ID": "expire-live-hls",
    "Filter": { "Prefix": "hls-live/" },
    "Expiration": { "Days": 1 }
  }]
}
```
Individual segments expire via object headers (`x-amz-expiration`), not batch cron.

---

## Edge encoder — what it does and why

Between raw RTMP/Icecast input and Liquidsoap, an FFmpeg edge encoder container:

1. **Normalizes codec** — RTMP sources send AAC, MP3, or Opus at varying bitrates. The edge encoder outputs a consistent 320 kbps PCM or Opus stream regardless of input.
2. **Produces two feeds** — a high-quality FLAC-compatible feed for paid channels and an MP3 feed for free channels, from a single source input.
3. **Runs chromaprint fingerprint at ingest** — fpcalc sidecar posts segments every ~30s; archive job resolves titles via **AcoustID** when `ACOUSTID_API_KEY` is set (ACRCloud deferred).
4. **Decouples ingest from Liquidsoap** — if Liquidsoap crashes and restarts mid-stream, the edge encoder continues receiving from the artist without dropping the connection. Liquidsoap reconnects to the edge encoder's output, not the artist's OBS.

```mermaid
flowchart LR
    OBS[OBS RTMP stream\n320 kbps AAC] --> EE
    subgraph EE["Edge Encoder (ffmpeg)"]
        NORM[Normalize to 48kHz PCM]
        SPLIT[Tee: lossless path + MP3 path]
        FP[chromaprint fingerprint\nsegment-level]
    end
    NORM --> SPLIT
    SPLIT --> FLAC_FEED[FLAC/PCM feed\n→ Liquidsoap lossless output]
    SPLIT --> MP3_FEED[MP3 192k feed\n→ Liquidsoap free output]
    FP --> API[POST /internal/broadcast/:id/fingerprint-segment]
```

On broadcast end, `archive-broadcast` collapses fingerprint boundaries, optionally looks up each unique chromaprint via [AcoustID](https://acoustid.org/chromaprint), and writes `tracklist` entries on the auto-archived item.

**Env:** `ACOUSTID_API_KEY` on `worker` (register at https://acoustid.org/new-application). Without a key, tracklist entries use generic “Track change (m:ss)” labels.

---

## Icecast ingest failover (STREAM-007)

`GET /api/me/stream-settings` health-probes each host in `ICECAST_INGEST_HOSTS` via `/status-json.xsl` and returns `fallbackServers` for Mixxx/Traktor.

**Production:** deploy two Icecast replicas behind public hostnames, e.g. `ICECAST_INGEST_HOSTS=https://icecast-a.tahti.live,https://icecast-b.tahti.live`.

**Local stack:** optional second node for probe testing:

```bash
docker compose -f infra/docker-compose.stack.yml --profile icecast-failover up -d icecast-b
# API env (host-visible URLs for dashboard + health probes from api container via published ports):
# ICECAST_INGEST_HOSTS=http://localhost:18100,http://localhost:18101
```

RTMP uses the same pattern with `RTMP_INGEST_HOSTS` and nginx-RTMP `/health`.

---

## Per-channel metrics (required from day 1)

Every Liquidsoap container and every edge encoder must expose a Prometheus metrics endpoint. These are the minimum measurements required:

| Metric | Source | Why |
|--------|--------|-----|
| `tahti_channel_segment_write_rate` | Liquidsoap | Detects silent/frozen channels |
| `tahti_channel_listeners_connected` | Caddy + Centrifugo | Listener count per channel |
| `tahti_channel_input_bitrate_kbps` | Edge encoder | Source quality monitoring |
| `tahti_channel_cpu_seconds_total` | Docker stats exporter | Cost attribution per channel |
| `tahti_channel_memory_bytes` | Docker stats exporter | Container sizing |
| `tahti_channel_hls_segment_age_seconds` | MinIO + watchdog | Alert if newest segment > 15s old |
| `tahti_channel_bandwidth_bytes_out` | Caddy | Per-channel egress billing |
| `tahti_recording_bytes_written` | ffmpeg recorder | Recording progress |

Grafana dashboard: one row per channel, showing segment freshness, listener count, and input bitrate. Red if `hls_segment_age_seconds > 15`.

---

## Per-channel health watchdog

A `channel-watchdog` job runs every 30 seconds inside `worker-light`:

```mermaid
flowchart TD
    W[Watchdog tick: 30s] --> Q[Query all channels WHERE state=LIVE]
    Q --> CHECK{For each live channel}
    CHECK --> SEG[Check MinIO: newest segment age]
    SEG --> OLD{segment_age > 20s?}
    OLD -- No --> OK[Mark healthy]
    OLD -- Yes --> RESTART[POST /internal/orchestrator/restart-channel]
    RESTART --> LOG[Log: channel X restarted after stale segments]
    LOG --> ALERT{> 2 restarts in 10min?}
    ALERT -- Yes --> OPS[Alert ops: channel X unstable]
    ALERT -- No --> OK2[Mark restarted — monitor]
```

The watchdog does **not** bounce artists' OBS connections. The edge encoder holds the RTMP/Icecast connection. Liquidsoap restarts silently and reconnects to the edge encoder's output. Listeners experience at most one missed HLS segment (3s gap).

---

## Recording pipeline (independent of streaming)

Recording must survive Liquidsoap crashes. It runs as a separate container:

```mermaid
sequenceDiagram
    participant A as Artist OBS
    participant EE as Edge Encoder
    participant REC as ffmpeg-recorder
    participant MN as MinIO recordings/
    participant WM as worker-media

    Note over A,EE: Broadcast starts — edge encoder is live
    EE->>REC: Tee: also pipe to recorder
    REC->>MN: Write raw stream to recordings/<channel_id>/<timestamp>.flac
    Note over REC: Continues writing even if Liquidsoap restarts

    A->>EE: Artist disconnects (broadcast end)
    EE->>REC: Signal: end of stream
    REC->>MN: Finalize file: flush + close
    REC->>API: POST /internal/recording/complete {channelId, minio_key, duration_sec}
    API->>WM: Enqueue transcode-archive job
    WM->>MN: Transcode: FLAC → Opus 256 + HLS ladder + MP3 192
    WM->>PG: INSERT archive_items (state=READY)
```

If the recording container crashes mid-broadcast, `ffmpeg` can resume from where it left off using the partially-written file (FLAC is a streamable format). The archive item is only created after successful finalization.

---

## Ingest redundancy

Two nginx-RTMP instances + two Icecast instances. DNS round-robin (`ingest.tahti.fi`) distributes new connections. Existing connections stay on their assigned ingest node until disconnect.

```mermaid
graph LR
    DNS["ingest.tahti.fi\nDNS: round-robin A records"] --> I1[nginx-RTMP A]
    DNS --> I2[nginx-RTMP B]

    I1 & I2 --> API[on_publish webhook → API\nvalidate stream key]
    API --> EE[Edge encoder per channel\nspawned on any worker node]
```

If one ingest node fails, new connections go to the surviving node via DNS TTL expiry (TTL 30s for ingest subdomain). Existing connections that were on the failed node must reconnect — OBS auto-reconnects within 30s by default.

**Known issue:** DNS failover has a 30s window where OBS connections attempt the dead node. See backlog item `STREAM-003`.

---

## Storage architecture

```mermaid
graph TB
    subgraph "MinIO buckets"
        B1["hls-live/\nLive HLS segments\nTTL: 60s per object\nAccess: Caddy + Liquidsoap"]
        B2["audio/\nArchive items (Opus + MP3 + FLAC)\nTTL: none (lifecycle: archive after 90 days)\nAccess: API signed URLs + worker-media"]
        B3["recordings/\nRaw live recordings\nTTL: 7 days (deleted after transcode confirmed)\nAccess: worker-media only"]
        B4["covers/\nArtwork + avatars\nTTL: none\nAccess: public read via Caddy"]
        B5["backups/\nPostgres + config backups\nTTL: 90 days\nAccess: ops only"]
    end

    subgraph "Access patterns"
        HOT[Hot: hls-live, covers\nhigh request rate, small objects]
        WARM[Warm: audio\nmoderate rate, large objects]
        COLD[Cold: recordings, backups\nlow rate, large objects]
    end

    B1 --> HOT
    B4 --> HOT
    B2 --> WARM
    B3 & B5 --> COLD
```

MinIO tiering: hot buckets on NVMe, cold buckets on spinning disk (Y2 storage expansion).

---

## Container sizing guide

At Y1 beta (200 artists, max 20 live simultaneously):

| Container | Min | Max | Trigger to add more |
|-----------|-----|-----|---------------------|
| Edge encoder (per channel) | 0.5 CPU / 256 MB | 1 CPU / 512 MB | Always 1 per live channel |
| Liquidsoap (per channel) | 0.25 CPU / 128 MB | 0.5 CPU / 256 MB | Always 1 per active channel |
| ffmpeg-recorder (per broadcast) | 0.5 CPU / 256 MB | 1 CPU / 512 MB | Always 1 per live broadcast |
| worker-media | 2 CPU / 2 GB | 4 CPU / 4 GB | Queue depth > 10 jobs |
| Caddy | 0.5 CPU / 256 MB | 2 CPU / 1 GB | P95 latency > 200ms |
| nginx-RTMP | 0.5 CPU / 256 MB | 1 CPU / 512 MB | Input bitrate > 600 Mbps total |

At 20 simultaneous live channels:
- 20 edge encoders: ~10 CPU, ~5 GB RAM
- 20 Liquidsoap: ~5 CPU, ~2.5 GB RAM
- 20 recorders: ~10 CPU, ~5 GB RAM
- Total streaming: ~25 CPU / ~12.5 GB RAM

This requires 2 worker nodes of 4 vCPU / 8 GB minimum for comfortable headroom. See `docs/hosting-budget.md`.

---

## Known issues → backlog

See `docs/project-roadmap.md` section **Streaming backlog** for tracked items.

| ID | Issue | Severity |
|----|-------|----------|
| STREAM-001 | HLS segments on shared Docker volume, not MinIO | CRITICAL — blocks horizontal scaling |
| STREAM-002 | RTMP edge encoder (#75) + dual-bitrate HLS; chromaprint at ingest sidecar (STREAM-008) | HIGH (partial) |
| STREAM-003 | Health-ranked ingest fallbacks on stream settings; multi-host env + low DNS TTL still ops | HIGH (partial) |
| STREAM-004 | ~~Recording is a Liquidsoap sidecar~~ — ffmpeg recorder sidecar (STREAM-004) | ~~HIGH~~ done |
| STREAM-005 | No per-channel health watchdog — silent channels go undetected | HIGH |
| STREAM-006 | No per-channel bandwidth accounting — can't attribute costs | MEDIUM |
| STREAM-007 | Icecast `/status-json.xsl` health probe + `ICECAST_INGEST_HOSTS` fallbacks; optional `icecast-b` stack profile | MEDIUM (partial) |
| STREAM-008 | Ingest fpcalc sidecar, live fingerprints API, archive tracklist + AcoustID lookup (`ACOUSTID_API_KEY`); ACRCloud deferred | MEDIUM (partial) |
| STREAM-009 | ~~Liquidsoap archive fallback reads from MinIO with no caching~~ — local cache volume + cron | ~~LOW~~ done |
| STREAM-010 | Telnet `graceful_shutdown` + `fade.out` on `radio_out`; `docker stop -t 20` backstop | LOW (done) |
