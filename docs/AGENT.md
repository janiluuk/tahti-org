# Project: Tahti ry — nonprofit broadcasting platform

## READ THIS FIRST

Before reading anything else in this brief, read `docs/CONSTITUTION.md`. It is short. It contains the three rules that govern every implementation decision in this repository. The rules are:

1. **This is for artists, not for corporate.** No profit motive. Administration paid fairly. Professional roles, not founder-forever. Surplus redistributed to artists annually.
2. **Highest quality, useful, community-driven platform — by design.** Lossless audio not capped at listener tier. AGPL. Transparent ledger. Community-driven roadmap.
3. **The artist shines brightest. We don't rip off anyone in the chain.** No algorithmic feeds. No data sales. No 0%-with-hidden-fees pricing. 0% org cut on fan-subs. Anonymous listening by default.

If an implementation choice in this AGENT.md ever conflicts with the constitution, the constitution wins. If you (the agent) find yourself building a feature whose existence would violate one of the three rules — stop and flag it. The constitution overrides this document.

## Mission (technical interpretation)

Build a self-hostable, AGPL-3.0-licensed platform where each artist operates a
**24/7 channel** that broadcasts live and falls back to archive when offline.
The hosted instance is operated by **Tahti ry**, a Finnish registered nonprofit
association. Annual operating surplus is distributed as **transparent
engagement-unit-weighted grants** to artist members, visible on a permanent
public ledger.

## Reference user

A working independent DJ, electronic musician, ambient artist, or talk-radio
podcaster in the EU who today fragments their presence across SoundCloud,
Mixcloud, Twitch, YouTube Live, Bandcamp, and a mailing list. They want one URL
that always plays, with broadcasting tools that respect their workflow and a
financial model that returns surplus to them, not to shareholders.

## North-star principles

1. **Channel-first, always-on.** When the artist is live, the channel broadcasts
   live. When they're offline, the channel plays from their archive. Listeners
   should never hit silence on an active channel.
2. **Listeners are traffic, not users.** No accounts to listen. Chat handles are
   per-browser-session, no signup. (Exception: fan-subscribers have accounts
   because billing requires it. That is the only exception.)
3. **Live chat is featured, not buried.** A first-class capability with ephemeral
   messages and persistent artist-pinned announcements. Make it visible from the
   channel page hero.
4. **OBS integration is first-class.** Every broadcaster has copy-paste setup
   guides for OBS, Mixxx, Traktor, butt, BUTT, and a browser-based "Go Live"
   client. RTMP and Icecast both supported.
5. **Storage is generous and unenforced.** Soft target 500 MB/user, with nudges
   above. A hidden 50 GB technical ceiling exists only as an anti-abuse
   safeguard, never advertised. See `docs/storage-policy.md`.
6. **Transparency is a product surface.** Live revenue, costs, surplus, and
   grant disbursements visible on `/transparency`, queryable via public read-only
   API.
7. **Members own the org.** Paying artists are members of the *yhdistys*. The
   platform supports the governance, not the other way around.
8. **AGPL all the way down.** Every file licensed, every page footer-linked to
   source, every API response with a `Source-Code` header.
9. **One Liquidsoap container per channel.** Created on activation, runs
   perpetually.
10. **Stateless app services, stateful infra pinned.** Postgres, Redis, MinIO
    pinned to labeled Swarm nodes. API and workers replicated.
11. **Artist profile is the artist's home page on the internet.** Bio,
    biographical timeline, releases, channel, externals. Treat it as a label
    site, not a SoundCloud profile. No follower graph, no track-level
    comments, no algorithmic feed.
12. **Lossless audio for paid users. MP3 for free.** WAV and FLAC supported as
    upload formats (alongside MP3/AAC). Paid members stream FLAC 16/44 to their
    listeners; free users stream MP3 192 kbps. Originals preserved as-is.
13. **Free tier is a complete product, not a feature-limited trial.** Free
    members get the channel, profile, releases, downloads, chat, fan-subs.
    The only restrictions: MP3 audio (vs lossless) and 1 hour of live
    broadcasting per week. Everything else works. We do not break things to
    force conversion. Members upgrade because they want more, not because
    they are frustrated.
14. **Grants flow from engagement units, not listener-hours.** Downloads
    (weighted by listener commitment) and fan-subscription euros determine
    grant share. Passive listening doesn't count. Listener-hours are a vanity
    metric only. See `docs/engagement-and-fansubs.md`.
15. **Fan-to-artist subscriptions take 0% org cut.** A 2% operational fee
    covers Stripe + GDPR + ops, fully consumed by costs. Bylaws-locked.
16. **Tahti Radio is live-relay only.** Org-operated meta-stream picks up
    whichever channels are currently live. No editorial curation. Multistreamed
    to Mixcloud only (the only legally clean target).
17. **Anonymous downloads stay anonymous.** No account required for free
    downloads. Anti-fraud is rate limits + fingerprint dedup + same-track caps.
18. **No CDN, Finnish hosting.** Primary infrastructure on owned hardware
    in Helsinki; UpCloud Helsinki for spillover and DR. No Bunny, Fastly,
    Cloudflare, or US cloud. See `docs/infra-strategy.md`.

## Tech stack (non-negotiable)

- **Runtime:** Node.js 20 LTS, TypeScript strict
- **API:** Fastify 4 + @fastify/swagger
- **Realtime (chat + presence):** Centrifugo 5
- **DB:** Postgres 16 + Prisma 5
  - Schemas: `core`, `channel`, `media`, `release`, `chat`, `dist`, `governance`, `ledger`, `analytics`, `newsletter`, `promo`, `engagement`, `fansubs`, `venue`
- **Cache/queue:** Redis 7 + BullMQ
- **Object storage:** MinIO (S3-compatible), on owned hardware
- **Live ingest:**
  - Icecast2 for source-clients (Mixxx, Traktor, butt, BUTT, SAM Cast)
  - Nginx-RTMP for OBS, Streamlabs, vMix, FFmpeg-direct
  - Browser-based broadcaster (WebRTC → SRT → Liquidsoap) as a third option
- **Broadcaster:** Liquidsoap 2.2+
- **Frontend:** Next.js 14 App Router (App + Pages, RSC on channel landing)
- **Audio in browser:** HLS.js for stream playback
- **Distribution backend:** Revelator API (DSP delivery)
- **Mixcloud:** Mixcloud Upload API for mixes
- **Edge:** Caddy 2 with on-demand TLS
- **CDN:** Bunny CDN in front of MinIO + edge HLS
- **Orchestration:** Docker Swarm (production), Compose (dev)
- **Auth (artist accounts only):** Lucia + argon2, optional Google/Apple OAuth
- **Payments:** Stripe Checkout (subs) + Stripe Connect Express (grant payouts) +
  SEPA fallback where Stripe doesn't reach

## Repo layout

```
tahti/
├── apps/
│   ├── api/                     # Fastify
│   ├── web/                     # Next.js (channels, profiles, dashboard, transparency, members)
│   └── worker/                  # BullMQ workers
├── services/
│   ├── orchestrator/            # Spawns channel liquidsoap containers
│   ├── chat/                    # Centrifugo config + auth proxy
│   ├── ingest/                  # Icecast2 + nginx-rtmp + WebRTC bridge
│   ├── broadcast-web/           # Browser-based Go Live client (separate service)
│   ├── newsletter/              # Email composer + SES dispatch + bounce handling
│   ├── embed/                   # Lightweight embed player (separate Next.js app, no analytics chrome)
│   └── liquidsoap-image/
├── packages/
│   ├── db/                      # Prisma schema
│   ├── shared/                  # Zod, DTOs
│   ├── revelator/               # Distribution client
│   ├── mixcloud/                # Mixcloud client
│   ├── ledger/                  # Accounting helpers, monthly rollup logic
│   ├── smart-link/              # Smart link routing + click logging
│   └── social-post/             # Twitter/Mastodon/Threads/Bluesky OAuth + post + retry
├── infra/
├── ops/
├── public/
│   ├── LICENSE                  # AGPL-3.0
│   ├── BYLAWS.md                # Bylaws, version-tagged
│   ├── ANNUAL_REPORT_*.md
│   └── TRANSPARENCY.md
├── AGENT.md
└── README.md
```

Use pnpm workspaces. Top-level `LICENSE` is AGPL-3.0. Every source file starts with the standard AGPL header.

## Milestones (build in order, do not skip)

### M0 — Skeleton (1 day of agent time)

- Monorepo with pnpm workspaces + Turborepo
- AGPL-3.0 `LICENSE` at root; header in every source file
- Prisma schema with v4 entities (see DATA_MODEL)
- Dev compose: postgres, redis, minio, centrifugo, mailhog, icecast2, nginx-rtmp
- API `/health`, Next.js placeholder, worker boot
- ESLint, Prettier, Vitest
- GitHub Actions CI: lint, typecheck, test, AGPL header check
- `/source` endpoint returning tarball of running version (AGPL §13 compliance)
- Footer on every web page linking to source repo and license

**Done when:** `pnpm dev` brings everything up; `curl localhost:3000/source`
returns a tarball; license check passes.

### M1 — Artist accounts + membership

- Email/password signup with confirmation
- Single account type: `ARTIST` (becomes `MEMBER` upon first paid subscription)
- Profile = channel landing page details (name, bio, cover, social links, tip jar)
- Rate-limited signup
- Member roster export for Finnish associations law compliance (PRH requirement)

**Done when:** I register as an artist, verify email, upgrade to paying tier,
appear in the member register at the next nightly export.

### M2 — Channel + archive uploads

- DB: `channels` (one per user), `archive_items`, `archive_playlists`
- Resumable upload (tus) for archive material
- **No enforced storage quota.** A `soft_target_bytes` value on the user (default
  500 MB) drives UI nudges. A `hidden_ceiling_bytes` value (default 50 GB) is the
  technical anti-abuse circuit-breaker, only triggered at ≥95% to alert ops.
  Never expose this number publicly. See `docs/storage-policy.md`.
- ffprobe validation (rejects non-audio, > 8h duration as sanity check)
- FFmpeg transcode: Opus 256 (everyone) + HLS ladder + MP3 192 (free) + FLAC stream (paid)
- audiowaveform for cover thumbnails (the channel player doesn't show waveforms — it's continuous)
- chromaprint fingerprint for dedup

**Done when:** I upload a 200 MB DJ mix WAV, it transcodes, lists in archive,
plays in fallback rotation. UI shows "you've used 200 MB" without limit warnings.

### M3 — Live ingress + channel orchestrator

- **Icecast input:** per-channel mount `/live/<channel_id>`, per-channel source
  password (rotatable on demand from the dashboard)
- **RTMP input:** nginx-rtmp app `live` with stream key
  `<channel_id>__<rotating_secret>` (revealable to artist, rotatable)
- **WebRTC bridge:** browser-based "Go Live" sends WebRTC → SRT bridge →
  Liquidsoap harbor. Same channel state machine, different ingress.
- Orchestrator:
  - One perpetual Liquidsoap service per channel (`channel-<id>`)
  - Config rendered from template at activate time; redeploys on archive change
    or settings change
  - Liquidsoap config: prefer live source, fall back to archive playlist with
    `track_sensitive=false` (instant switch)
  - Outputs: HLS (Opus 64/128/256) to shared volume + harbor for now-playing
- Channel state: `OFFLINE` (archive playing) / `LIVE` (broadcasting)
- Public channel page: HLS player, current-track display, LIVE badge,
  tip-jar link, **chat panel docked beside player**, pinned announcements above
  chat scroll

**Done when:** I start broadcasting from any source (OBS, Mixxx, browser) →
my channel.tahti.live plays the live audio within 5 seconds. I stop broadcasting
→ archive starts playing within 10 seconds, no silence.

### M4 — Auto-archive of live broadcasts

- Liquidsoap sidecar captures every live broadcast to disk
- On broadcast end: encode to FLAC + Opus + MP3, upload to MinIO, create archive item
- Auto-metadata: timestamp, duration, optional artist-set title at broadcast
  start (sent through Icecast metadata)
- Optional ACRCloud post-process for DJ mix tracklisting (timestamps + tracks)
- Dashboard: auto-recorded sets appear within 5 min of broadcast end
- Recordings contribute to that channel's `listener_hours` counter for grant
  calculation (an archive item played by N listeners for T seconds = N×T/3600
  listener-hours)

**Done when:** I broadcast 1 hour, hang up, find the recording in dashboard
within 5 min, edit title, see it in public archive. Listener-hours on that
channel reflect the broadcast in the next 5-min stats rollup.

### M5 — Live chat (Centrifugo) — featured capability

This milestone is **bigger than v3's chat milestone** because chat is a featured
product capability, not an afterthought.

- One chat room per channel, always available (even when offline — listeners can
  leave messages for when the artist returns)
- Anonymous handle: user types a name on first join, stored in localStorage,
  JWT issued by API for Centrifugo auth
- Chat policy:
  - Messages **ephemeral**: last 100 messages in Redis, gone after 24h
  - Slow mode configurable per channel
  - Per-channel banlist by `fingerprint_hash = sha256(browser_fingerprint + ip_hash + monthly_salt)`
- **Artist announcements** (persistent):
  - Separate from chat messages
  - Max 3 visible, oldest auto-rolls off
  - Stored in DB, rendered above chat scroll
- **Live reactions:** ephemeral emoji bursts (💜 🔥 🎶 etc.) that fly across the
  player. Centrifugo channel for reactions, rate-limited, no persistence.
- Moderation: artist-only kick/ban; mute by fingerprint
- Listener-count from Centrifugo presence
- "Now listening" sidebar (Studio tier only): show count + handles of chat-active listeners

**Featured UX:**
- Chat panel docked on the channel page by default (not collapsed)
- Mobile: chat opens as bottom sheet, swipe up to expand
- Announcements rendered with distinct visual treatment (gold/amber tint, pinned icon)
- Empty-state copy when chat is quiet: "channel is quiet right now — say hi"

**Done when:** Listeners join chat without signup, send messages, see them
disappear after 24h. Artist pins an announcement that persists. Artist bans a
troll by fingerprint. Live reactions fly across the player at the right rate.

### M6 — Multistream out (RTMP push to social)

- Per-channel RTMP targets: YouTube Live, Twitch, Facebook Live, Mixcloud Live, custom
- Liquidsoap template adds outputs when targets exist; reload on add/remove
- Audio + cover-art video sidecar (libx264 + image, 720p, 30fps, ~2500 kbps)
- Encrypted stream-key storage (sealed box, key in Docker secret)
- Modes: live-only (default) or always-mirror (Studio only)

**Done when:** I add my YouTube Live target, go live, my YouTube channel shows
my audio + cover within 30 seconds.

### M7 — Distribution: Mixcloud + Revelator

Same as v3 spec. Key points:

- Mixcloud OAuth + Upload API for mixes (free integration)
- Revelator white-label API for DSP delivery (€3-5/release pass-through, our cost)
- Studio tier: 12 releases/yr included; Artist tier: pay €8/release
- DistroKid affiliate link as fallback for full-catalog artists
- ISRC validation, artwork 3000×3000 enforcement, 14-day release lead time
- Royalty pull (monthly cron) → dashboard display → Stripe Connect Express payout

**Done when:** Mix → Mixcloud one-click. Original track → Revelator wizard →
appears on Spotify in 7-10 days. Royalty reports flow back monthly.

### M8 — Transparency ledger (NEW for v4)

This is what makes  Tahti a nonprofit, not just an open-source project.

- Schema `ledger.ledger_entries` append-only, partitioned by month:
  - `id`, `category`, `amount_cents`, `currency`, `description`, `external_ref`,
    `created_at`, `period_start`, `period_end`
  - Categories: REVENUE_SUBSCRIPTION, REVENUE_DISTRIBUTION,
    REVENUE_GRANT_INBOUND, REVENUE_DONATION, COST_INFRASTRUCTURE,
    COST_DISTRIBUTION_PASSTHROUGH, COST_OPERATIONS, COST_SALARY, COST_AUDIT,
    COST_PROFESSIONAL_SERVICES, GRANT_DISBURSEMENT, RESERVE_TRANSFER
- Workers populate the ledger:
  - Stripe webhooks → REVENUE_SUBSCRIPTION
  - Revelator royalty cron → not a ledger entry (passes through directly to
    artist, never our money)
  - Distribution wizard → REVENUE_DISTRIBUTION and COST_DISTRIBUTION_PASSTHROUGH
  - Monthly cost imports (electric bill, internet, accountant) → manual entries
    by treasurer with audit log
  - Annual audit → COST_AUDIT entry once finalized
- Monthly rollup table `ledger.monthly_rollup` aggregates the prior month
- Public dashboard at `/transparency`:
  - YTD revenue/costs by category, with monthly breakdown
  - Running surplus calculation
  - Last grant report (per-channel, anonymized as "Channel #123" unless artist opts into public attribution)
  - Methodology page (`/transparency/methodology`)
  - Public API:
    - `GET /api/v1/transparency/monthly_rollup?year=YYYY`
    - `GET /api/v1/transparency/grants/:year`
    - `GET /api/v1/transparency/categories`
    - All returning JSON, CORS-open for third-party use

### M9 — Annual grant calculation + disbursement (NEW for v4)

- Cron runs March 1 for prior calendar year (matches Finnish fiscal year)
- Step 1: read `ledger.monthly_rollup` for the year, compute surplus
- Step 2: subtract 10% operating reserve → `grant_pool`
- Step 3: read `analytics.listener_hours` aggregated per channel for the year
  - Only paying-member channels count
  - Channels with <10 listener-hours total are excluded from the pool
    (anti-gaming threshold)
- Step 4: for each eligible channel,
  `grant = (channel_hours / total_eligible_hours) × grant_pool`
- Step 5: notify members by email, require they confirm payout details within
  30 days; unclaimed grants roll into next year's pool
- Step 6: trigger payouts (Stripe Connect Express where available, SEPA otherwise)
- Step 7: write GRANT_DISBURSEMENT entries to ledger
- Step 8: publish grant report at `/transparency/grants/YYYY` and email all
  members the public link

**Done when:** Test data flowed through Y1 simulation produces correct grant
allocations within 1 cent of hand-calculation.

### M10 — Member governance UI (NEW for v4)

- Member directory (members-only): member number, name, channel link, join date
- AGM (annual general meeting) scheduling page
- Voting:
  - Board posts motions (free-text description + yes/no/abstain options)
  - Voting open for 14 days after AGM convenes
  - Members vote via the dashboard (one vote per member)
  - Results published on the transparency page at vote close
- Bylaws version history:
  - Bylaws live at `public/BYLAWS.md` in the repo
  - Each amendment is a PR with the proposed diff
  - Approved amendments tagged with `bylaws-vYYYY-MM-DD`

**Done when:** A motion can be posted, voted on, and results published. Bylaws
diff can be displayed in the member portal.

### M11 — Hardening + audit prep (formerly M8 in v3)

- Rate limiting (Redis token bucket) on all public endpoints incl. chat
- hCaptcha on signup + first chat message
- Audit log for moderator actions, payouts, distribution submissions, ledger
  entries
- Backups: pgBackRest for Postgres, `mc mirror` for MinIO offsite
- Status page: self-hosted Upptime
- ACRCloud cost watchdog
- **Audit-ready financial export:** Excel/CSV monthly rollup downloadable by
  treasurer for Finnish auditor (mandatory at €100k+ revenue)

### M12 — Modern artist profile + releases (NEW for v5)

The artist profile is the artist's **home page on the internet** — what shows
up when someone googles them, what they put on every flyer and Instagram bio.
This is *not* a SoundCloud profile (no algorithmic feed, no follower graph, no
track-level comments). It's closer to a label site or a Linktree-meets-Bandcamp.

**Profile structure:**

- `tahti.live/u/<handle>` — the artist's permanent URL
- Hero section: name, location, "currently broadcasting" indicator with link to
  channel, primary CTA (custom — could be "tune in," "buy the album," "subscribe")
- Bio: rich-text (Markdown), supports paragraphs, headings, images, embedded
  video (YouTube/Vimeo only, allowlist), pull-quotes, links
- Releases timeline: artist's albums, EPs, singles in reverse-chronological
  order. Each entry shows cover, title, type, release date, primary tracklist,
  links to streaming services (auto-generated via the smart-link service in
  M14), short description
- Channel section: embed of their channel player (currently playing / live
  state), link to channel page
- Externals: configurable list of social/external links (Instagram, Bandcamp,
  personal site, etc.)
- Press kit (optional, Studio tier): downloadable bio (200 / 400 / 1000 word
  variants), high-res photos, hi-res cover art, tech rider, contact info
- Tip jar / support links (PayPal.me, Buy Me a Coffee, Patreon — link-out, no
  payment processing on our side beyond the existing Stripe channel)

**Release data model:**

```prisma
model Release {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  title           String
  type            ReleaseType  // SINGLE | EP | ALBUM | COMPILATION | REMIX
  artworkKey      String   // 3000×3000 JPG required
  releaseDate     DateTime
  description     String?  // Markdown, ~500 words max
  tracks          ReleaseTrack[]
  upc             String?
  primaryArtist   String   // canonical spelling
  contributors    Json?
  smartLinkSlug   String   @unique
  smartLinkTargets Json    // {spotify, apple, tidal, bandcamp, soundcloud, mixcloud, ...}
  embedEnabled    Boolean  @default(true)
  state           ReleaseState  // DRAFT | PUBLISHED | ARCHIVED
  publishedAt     DateTime?
  createdAt       DateTime @default(now())

  @@index([userId, releaseDate])
  @@schema("release")
}

model ReleaseTrack {
  id            String   @id @default(cuid())
  releaseId     String
  release       Release  @relation(fields: [releaseId], references: [id], onDelete: Cascade)
  position      Int
  title         String
  isrc          String?
  durationSec   Int
  // Multiple format keys — uploaded original lives in `sourceKey`,
  // streaming derivative lives in `streamKey`, FLAC download in `flacKey`.
  sourceKey     String   // original WAV/FLAC/MP3 as uploaded
  sourceFormat  String   // 'wav' | 'flac' | 'mp3' | 'aac' | 'aiff'
  sourceSampleRate Int   // 44100 | 48000 | 96000
  sourceBitDepth Int     // 16 | 24 | 32
  streamKey     String   // Opus 256 derivative
  flacKey       String?  // FLAC 16/44 derivative for Studio downloads
  hlsManifest   String?
  explicit      Boolean  @default(false)
  previewStart  Int?
  fingerprint   String?

  @@unique([releaseId, position])
  @@schema("release")
}

enum ReleaseType { SINGLE EP ALBUM COMPILATION REMIX }
enum ReleaseState { DRAFT PUBLISHED ARCHIVED }
```

**Upload pipeline:**

- Accept: WAV (16/24-bit, 44.1/48/96 kHz), FLAC (same), AIFF, MP3 (192+),
  AAC (192+). Reject: anything below MP3 192, files >500 MB without explicit
  override, non-audio files.
- ffprobe validates header, format, sample rate, bit depth
- chromaprint fingerprint for dedup detection (within artist's own catalog)
- Transcode to:
  - Opus 256 kbps Ogg (streaming default for all listeners)
  - HLS Opus ladder (64/128/256) for adaptive bitrate
  - FLAC 16/44.1 (download for Studio tier on tracks they own — if source was
    24-bit or higher, downsample with proper dither)
- Original `sourceKey` retained as-is — never recompressed. Studio tier users
  can download the original they uploaded.

**Profile page acceptance criteria:**

- Loads in <1.5s on a cold cache (RSC + image optimization)
- Open Graph + Twitter Card meta tags from artist's bio and latest release
- JSON-LD structured data: `MusicGroup` and `MusicAlbum` per Schema.org
- Sitemap automatically includes every public release
- Edit interface: WYSIWYG-light (Markdown editor with preview), drag-reorder
  releases (default chronological), live preview

**Done when:** I can fill out a bio with formatting and images, upload a 24-bit
WAV album with cover art, publish the release, and the profile page renders at
`tahti.live/u/<handle>` with the release in the timeline, smart link generated,
and Open Graph card showing correctly when shared on social media.

### M13 — Newsletter & fan email list (NEW for v5)

Every channel/artist gets a built-in newsletter system. Listeners can opt in to
receive emails from artists they follow. Artist sends, we deliver, GDPR-clean.

**The product:**

- "Subscribe to artist updates" button on every channel page + profile page
- Listener flow: enter email → confirmation email → confirmed → opted in
- Artist composer: rich-text email composer, can include a release teaser, link
  to next live show, embed of latest release, plain text fallback
- Send schedule: artist queues an email; goes out within 1 hour
- Per-send analytics: sent / delivered / opened / clicked / unsubscribed
- Per-list: total subscribers, growth over time, top countries
- Subscriber sees: 1 email per artist subscribed per send. Always with
  unsubscribe link (GDPR mandatory).

**Tech stack:**

- Transactional email provider: **Postmark** for transactional (signup/reset),
  **Amazon SES** for broadcast newsletters (cheap at scale, $0.10/1000 sends)
- Templating: MJML compiled to HTML at send time
- Bounce + complaint handling: SNS webhook → suppression list (per-subscriber,
  per-list)
- Unsubscribe: one-click via List-Unsubscribe header + visible link in every email

**Anti-abuse:**

- Rate limit: max 1 newsletter / artist / week (free tier), 4 / week (Artist),
  unlimited (Studio)
- Content scan for spam keywords (basic)
- Manual review required for first 3 newsletters from new artists (Studio tier
  exempt after first verification)

**Cost projection at scale (Y3, 4,000 paying artists, avg 2,000 subscribers each):**

- 96M sends/year at SES rate: ~$960/yr = €890
- Postmark for transactional: ~€500/yr
- Bounce/complaint storage: negligible
- Total: ~€1,400/yr (within Y3 budget line)

**Done when:** Artist composes a newsletter, schedules it, it lands in
subscribers' inboxes within 1 hour with proper unsubscribe footer. Analytics
populate within 24h.

### M14 — Promo toolkit: embed widget, smart links, social auto-post, analytics (NEW for v5)

Four lightweight tools, surfaced from the same dashboard area, each with
real-world utility.

**Embed widget (oEmbed + iframe):**

- Every release has an embed URL: `tahti.live/embed/r/<release-id>`
- Every channel has an embed URL: `tahti.live/embed/c/<slug>`
- Renders a lightweight player (cover art, play button, current track) in a
  customizable color theme
- oEmbed discovery endpoint at `/oembed?url=...` so paste-into-Substack /
  WordPress / Notion auto-embeds
- iframe-safe, no third-party tracking, ~25 KB total
- Bandwidth served from CDN with aggressive caching
- Embed analytics: where it was embedded, plays from that embed (referer-based)

**Smart links (one URL → all DSPs):**

- Every release auto-generates a smart link: `tahti.live/r/<slug>`
- Landing page: cover art, release title, artist, list of streaming services
  (Spotify, Apple, Tidal, Amazon, Deezer, Bandcamp, SoundCloud, Mixcloud, YouTube
  Music — only the ones the artist has set targets for)
- Click logging: which platform was chosen, country, anonymized referer
- Artist can customize the page: alternative title, additional copy,
  pre-release teaser mode (collect emails before release date)
- API: `GET /v1/releases/:id/smartlink-stats` returns clicks per service per day

**Social auto-post:**

- OAuth integrations: Twitter/X, Mastodon, Instagram (via Threads API),
  Bluesky (AT Protocol)
- Templates with placeholders: `{artist}`, `{release}`, `{smart_link}`, `{cover_url}`
- Triggers:
  - "New release published" → auto-post to enabled platforms
  - "Going live now" → auto-post when channel state changes to LIVE
  - "Manual" → artist composes a one-off post
- Retry queue for ratelimited posts (exponential backoff, max 3 retries)
- Honest about limitations: we display "Instagram API has a 24h posting window,
  scheduling may be delayed" type warnings
- Per-platform on/off toggle per trigger

**Track-level analytics dashboard:**

- Per release: plays (last 24h, 7d, 30d, all-time), uniques (best effort, no
  fingerprinting), top countries, top embedding domains, smart-link click-through
- Per track within release: plays, completion rate (% who finished the track)
- Per channel: listener hours, peak concurrent, top countries, regular vs
  one-time listeners
- Newsletter analytics integrated here too
- Exportable: CSV download of all metrics
- No personally identifiable data anywhere — all aggregates

**Privacy / GDPR notes:**

- Analytics use rotating IP-hash + Salt for uniques, never raw IPs
- Embed plays don't set cookies unless required for HLS DRM (which we don't use)
- "Track-level" doesn't mean "track per user" — it's aggregate counters

**Done when:** Artist publishes a release; clicks "Generate everything";
smart link, embed widget, and auto-post all work; analytics start populating
within 5 minutes of first plays.

### M15 — Artist tagging (NEW for v6)

A lightweight `@-mention` system that lets artists reference each other across
the platform. Tags resolve to profile links. Opt-in notifications. No social
graph implied — tagging is just human-readable cross-references, like links.

**Where tags work:**
- Profile bio (Markdown rendering treats `@handle` as a link)
- Channel announcements
- Release credits ("Featuring @other-artist", "Remix by @another")
- Chat messages (artist-side; listeners can mention but it's not a notification)
- Newsletter compose

**Tag resolution:**
- `@handle` → `tahti.live/u/<handle>` with the artist's display name
- Unknown handles render as plain text (no broken links)
- Tags in user-generated content (chat) are validated at send time; deleted
  artists' tags render as `@deleted-user`

**Notifications:**
- Opt-in per artist in settings (default ON for paying members, OFF for free)
- "You were mentioned by @X in their bio / announcement / release / chat"
- Email digest, max one per day per mentioned-artist
- Notification logs to ledger as auditable event

**Anti-abuse:**
- Rate limit: max 20 mentions per artist per day across all surfaces
- "Mute mentions" — an artist can mute another artist from mentioning them at all
- Bylaws-protected list — no mentioning deceased members or vulnerable parties
  for promotional purposes (board-maintained block list)

**Done when:** I write a bio "made with @collaborator" and the rendered profile
links to that artist's page. They receive a notification if opted in. Muting
works.

### M16 — Tahti Radio meta-stream (NEW for v6)

A 24/7 org-operated stream that **relays whichever channels are currently live**.
Multistreamed to Mixcloud Live. Live-only — no curation, no archive replay.

**Architecture:**
- New service `services/tahti-radio/` — perpetual Liquidsoap container
- Orchestrator runs a "TahtiRadioPicker" routine every 60 seconds
- Picker queries currently-live channels (filtered: `metaStreamOptOut=false`,
  not in cooldown, member in good standing)
- Picker sorts: longest-since-last-feature first (fair rotation, prefer
  less-broadcast channels)
- Picker hands off: re-encodes the chosen channel's HLS into the meta-stream's
  own HLS output
- Tahti Radio HLS published at `radio.tahti.live` via Bunny CDN
- Tahti Radio simultaneously pushes RTMP to Mixcloud Live at the org's
  `mixcloud.com/tahti-radio` account
- When zero channels are live: falls back to `services/tahti-radio/placeholder.flac`
  (public-domain instrumental + voice tag)

**Channel opt-out:**
- Channel settings adds: "Include my live broadcasts on Tahti Radio" (default ON)
- When OFF, channel is excluded from picker pool

**Listener-hour attribution:**
- Listeners on `radio.tahti.live` are counted toward the originating channel's
  listener-hour counter (vanity metric only; doesn't affect grants under v6)

**No multistream to YouTube/Twitch.** Both will copyright-strike a stream
containing third-party music regardless of artist consent. **Mixcloud only.**
This decision is documented in the anti-patterns list — do not add YouTube/Twitch
multistream targets to the meta-stream "to test it." You will lose the org's
YouTube/Twitch accounts and damage Tahti's relationships with the platforms.

**Done when:** Two artists go live simultaneously. Tahti Radio plays one for
~10 min, switches to the other, switches back. Mixcloud account shows the
live stream with rotating "Now broadcasting" metadata. When both stop, the
placeholder loop kicks in within 30 seconds.

### M17 — Venue calendar API (NEW for v6)

A lightweight system for venues to register and publish iCalendar feeds of
broadcasts happening at their location. No booking marketplace, no ticketing.

**Scope:**
- New account type `VENUE` (separate from `ARTIST`)
- Public venue directory at `tahti.live/venues`
- Venue profile pages at `tahti.live/v/<slug>`
- iCalendar feeds at `tahti.live/v/<slug>/calendar.ics`
- JSON API at `/v1/venues/<slug>/broadcasts`

**Data model in `services/api`:**

```prisma
model Venue {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  address      String
  city         String
  countryCode  String
  latitude     Float?
  longitude    Float?
  capacity     Int?
  description  String?
  externalLinks Json?
  photos       String[]
  verifiedAt   DateTime?
  createdBy    String
  createdAt    DateTime @default(now())

  broadcasts   VenueBroadcast[]

  @@schema("venue")
}

model VenueBroadcast {
  id          String   @id @default(cuid())
  venueId     String
  venue       Venue    @relation(fields: [venueId], references: [id])
  artistUserId String
  startAt     DateTime
  endAt       DateTime?
  description String?
  channelId   String?
  state       VenueBroadcastState @default(SCHEDULED)
  createdAt   DateTime @default(now())

  @@index([venueId, startAt])
  @@index([artistUserId, startAt])
  @@schema("venue")
}

enum VenueBroadcastState { SCHEDULED LIVE COMPLETED CANCELED }
```

**Verification:** venues are flagged `verifiedAt = NULL` until manually approved
by board-designated verifier. Unverified venues exist but don't show in
public directories.

**Done when:** A venue can register, create a broadcast for a future date,
publish it. Artists can see upcoming venue-broadcasts in their dashboard.
The iCalendar feed at `/v/<slug>/calendar.ics` parses correctly in Apple
Calendar / Google Calendar / Thunderbird.

### M18 — Downloads as first-class action (NEW for v6, replaces partial v5 spec)

Downloads of archive items and release tracks become a primary product
action, with anti-fraud and grant-unit accounting baked in.

**Permissions:**
- Anonymous listener: streaming + free download (rate-limited)
- Free account listener: same as anonymous
- Fan-subscriber: streaming + unlimited downloads + FLAC option + source-format

**Anti-fraud (per `docs/engagement-and-fansubs.md`):**
- Rate limit per IP: 5/hour, 20/day
- Rate limit per fingerprint: same
- Same-track dedup: same fingerprint × same track = counts once per 30 days
- Per-track cap: max 10 dedup'd downloads per listener per track count
- Net-new IP threshold: 24h before downloads count toward grants
- Tor and known bot IPs allowed but don't count

**Grant unit logging:**
- Every download writes a `Download` row to `engagement.downloads`
- Row has `countedAt` and `weight` fields; populated by rules engine
- `weight = 1` for anonymous/free, `weight = 5` for fan-subscriber
- Worker `download-unit-rollup` aggregates eligible downloads every 15 min
  into the artist's engagement-unit counter

**Storage handling:**
- Original-source files preserved in MinIO
- Opus 256 derivative served for free downloads
- FLAC 16/44 derivative served for fan-sub downloads
- Source files (WAV/FLAC original) only available to fan-subscribers,
  served via signed Bunny URLs (5-min expiry)

**Done when:** A free listener downloads a track 12 times in a week. The
artist's engagement counter shows +1 for that download (counted once due to
dedup). A fan-subscriber downloads the FLAC version of 5 tracks. The artist's
counter shows +25 units for those (5 × 5×). Fraud monitor detects a script
hitting one track 1000× from one fingerprint, flags for review, those
downloads don't count.

### M19 — Fan-to-artist subscriptions (NEW for v6)

A direct payment relationship between listeners and artists, with 0% org
take (operationally break-even, 2% covers Stripe + GDPR + support).

**Architecture:**
- New account type for `SUBSCRIBER` listeners (separate from `ARTIST` and
  `VENUE`)
- Stripe Connect Express onboarding for artists who enable fan-subs
- Stripe customers (listeners) subscribe to specific artists
- Funds flow listener → Stripe → 2% to org operational account → ~97% to
  artist's Stripe Connect Express account
- Monthly cron processes payouts, logs ledger entries

**Artist setup flow:**
1. Dashboard → "Fan Subscriptions" → "Enable"
2. Stripe Connect Express onboarding (KYC: ID, bank, tax forms)
3. Once approved (1-3 days), artist defines tiers
4. Tiers go live on `tahti.live/u/<handle>/subscribe`

**Listener subscribe flow:**
1. On artist's channel page or profile: "Support [artist name]" button
2. Routes to `tahti.live/u/<handle>/subscribe`
3. Choose tier → Stripe Checkout
4. On successful payment, account created automatically (email + Stripe
   customer ID); confirmation email sent with password setup link
5. Supporter badge appears in chat, downloads unlock, fan-only chat/newsletter
   access granted

**Subscriber accounts:**
- Email + password (or Google/Apple OAuth)
- Stripe customer ID
- One or more active subscriptions
- GDPR: full export and deletion supported
- Listener anonymous-by-default principle still applies for non-fan-sub
  listening — only subscribers have accounts

**Data model:** see `docs/engagement-and-fansubs.md` for full schema
(FanSubscription, FanSubPayout, FanTier).

**Done when:** I enable fan-subs as an artist, set a €5/month tier, complete
Stripe onboarding. A listener subscribes via Checkout. Money flows to my
Stripe account minus 2% (~€0.45 to org) and Stripe fees (~€0.45). I see
"Supporter: handle_42" in my fan chat. They can download my FLACs.

### M20 — Tier gating: free tier limits + paid lossless (NEW for v7)

Two gates implemented gracefully so free users never feel "broken":

**Free tier weekly broadcasting cap:**
- 1 hour (3,600 seconds) of live broadcasting per calendar week (UTC week, Mon 00:00)
- `weeklyLiveSecondsUsed` field on User; incremented every minute during live broadcast
- Cron `weekly-broadcast-reset` runs every Monday 00:00 UTC: resets all free users' counter to 0
- When approaching the cap (45-min warning, 55-min warning), gentle banner: "you've broadcast 45 minutes this week — 15 minutes left until Monday"
- At cap: broadcast continues for 60 seconds (grace), then orchestrator gracefully stops the broadcast with the message "your weekly hour is up — channel returns to archive. Reset Monday 00:00 UTC."
- Listeners get a smooth transition to archive, not a hard cut. No error toasts.
- Paid users: `weeklyLiveSecondsUsed` is still tracked (for stats) but the gate doesn't apply.

**Audio quality differentiation:**
- Liquidsoap channel template renders two outputs per live broadcast:
  - **`stream-mp3-192/`** — MP3 192 kbps, HLS segmented
  - **`stream-flac/`** — FLAC 16/44 over HLS-FLAC manifest
- API routes player to the right manifest based on the artist's tier:
  - Free artist's channel → all listeners get MP3 192 manifest
  - Paid artist's channel → all listeners get FLAC manifest
- Listener doesn't choose. The artist's tier sets the quality.
- Archive playback: same logic. Free artists' archives transcode to MP3 derivatives; paid artists' archives keep FLAC.

**Upgrade path (graceful, no friction):**
- "Upgrade to lossless" CTA appears at the *end* of a live broadcast (post-show, not during), shown to the artist (not listeners) in the dashboard:
  > "Your listeners heard MP3 192 today. Upgrade to Tahti to broadcast in lossless FLAC and remove the weekly hour cap. €40/year, fully tax-deductible if you're a registered professional in Finland."
- Upgrade processed via Stripe Checkout in <60 seconds; next broadcast is lossless.

**Anti-patterns to avoid here:**
- Showing free users a degraded UI ("upgrade for chat moderation!" — no, free users get full chat moderation).
- Adding a watermark, advertising, or any audio degradation beyond bitrate.
- Making the weekly cap user-visible as a "you've hit your limit" friction popup; it's a gentle banner approaching, a smooth transition at the cap.
- Treating MP3 192 as "low quality" in marketing copy — it's good enough for streaming. We just deliver better when paid.

**Done when:** I'm a free user, broadcast 1 hour live in a week, see the gentle warnings, smoothly transition to archive at the cap, and my Monday reset works. As a paid user, my listeners hear FLAC, my upgrade button at end of broadcasts is non-aggressive, and there's no friction popup blocking my workflow.

## Data model (Prisma schema sketch — agent expands)

```prisma
model User {
  id              String     @id @default(cuid())
  email           String     @unique
  emailVerifiedAt DateTime?
  passwordHash    String
  username        String     @unique
  displayName     String
  bio             String?
  avatarUrl       String?
  socialLinks     Json?
  tipJarUrl       String?
  tier            ArtistTier @default(FREE)
  isMember        Boolean    @default(false)
  memberNumber    Int?       @unique           // ry membership register
  memberSince     DateTime?
  publicAttribution Boolean  @default(true)    // show name in transparency reports vs "Channel #N"
  stripeCustomerId String?
  payoutMethodEnc  Bytes?                      // sealed box: SEPA IBAN or Stripe Connect ID
  softTargetBytes  BigInt     @default(524288000)   // 500 MB
  hiddenCeilingBytes BigInt   @default(53687091200) // 50 GB
  storageUsedBytes BigInt     @default(0)
  // v7: free tier broadcasting limit
  weeklyLiveSecondsUsed Int    @default(0)         // resets weekly via cron
  weeklyLiveResetAt     DateTime?                   // last reset timestamp
  createdAt       DateTime   @default(now())

  channel    Channel?
  releases   Release[]
  mixUploads MixUpload[]
  votes      Vote[]
  grants     GrantDisbursement[]

  @@schema("core")
}

model Channel {
  id              String        @id @default(cuid())
  userId          String        @unique
  user            User          @relation(fields: [userId], references: [id])
  slug            String        @unique
  customDomain    String?
  state           ChannelState  @default(OFFLINE)
  containerId     String?
  liveSourceMount String
  liveSourcePassHash String
  rtmpStreamKeyHash  String
  webrtcTokenHash    String
  fallbackMode    String        @default("shuffle")
  totalLiveHours  Float         @default(0)
  totalListenerHours BigInt     @default(0)   // for grant calculation
  goneliveAt      DateTime?
  createdAt       DateTime      @default(now())

  archiveItems    ArchiveItem[]
  rtmpTargets     RtmpTarget[]
  announcements   ChannelAnnouncement[]
  banList         ChatBan[]

  @@schema("channel")
}

model ArchiveItem {
  id           String   @id @default(cuid())
  channelId    String
  channel      Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  title        String
  description  String?
  source       ArchiveSource @default(UPLOAD)
  durationSec  Int
  recordedAt   DateTime?
  publishedAt  DateTime?
  isPublic     Boolean  @default(true)
  isFallback   Boolean  @default(true)
  coverUrl     String?
  fileKey      String
  flacKey      String?
  hlsManifest  String?
  fingerprint  String?
  tracklist    Json?
  playCount    BigInt   @default(0)
  state        TrackState @default(UPLOADING)
  sizeBytes    BigInt

  mixUpload    MixUpload?
  createdAt    DateTime @default(now())

  @@index([channelId, isFallback])
  @@schema("media")
}

model RtmpTarget { /* same as v3 */ @@schema("channel") }
model ChannelAnnouncement { /* same as v3 */ @@schema("channel") }
model ChatBan { /* same as v3 */ @@schema("chat") }

model Release { /* same as v3 */ @@schema("dist") }
model ReleaseTrack { /* same as v3 */ @@schema("dist") }
model MixUpload { /* same as v3 */ @@schema("dist") }

model ListenerHour {
  id          BigInt   @id @default(autoincrement())
  channelId   String
  archiveItemId String?
  bucket      DateTime  // hour-truncated
  hours       Float
  createdAt   DateTime  @default(now())

  @@index([channelId, bucket])
  @@schema("analytics")
}

// Ledger schema — append-only

model LedgerEntry {
  id            BigInt   @id @default(autoincrement())
  category      LedgerCategory
  amountCents   BigInt
  currency      String   @default("EUR")
  description   String
  externalRef   String?  // Stripe charge ID, Revelator release ID, etc.
  periodStart   DateTime
  periodEnd     DateTime
  createdAt     DateTime @default(now())
  createdBy     String   // user id (for manual entries) or 'system'

  @@index([category, periodStart])
  @@schema("ledger")
}

model MonthlyRollup {
  yearMonth  String  @id   // 'YYYY-MM'
  byCategory Json           // {REVENUE_SUBSCRIPTION: 12345, ...}
  surplus    BigInt
  finalizedAt DateTime?

  @@schema("ledger")
}

model GrantDisbursement {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  forYear        Int
  listenerHours  Float
  amountCents    BigInt
  state          GrantState @default(PENDING)  // PENDING | CONFIRMED | PAID | UNCLAIMED
  payoutMethod   String?   // 'stripe_connect' | 'sepa'
  payoutRef      String?
  notifiedAt     DateTime?
  confirmedAt    DateTime?
  paidAt         DateTime?
  publishedAs    String    // 'Channel #N' or actual name based on User.publicAttribution
  createdAt      DateTime  @default(now())

  @@index([forYear])
  @@schema("ledger")
}

model Motion {
  id          String        @id @default(cuid())
  title       String
  description String
  proposedBy  String        // user id, must be board member
  openAt      DateTime
  closeAt     DateTime
  state       MotionState   @default(DRAFT)  // DRAFT | OPEN | CLOSED
  votes       Vote[]
  createdAt   DateTime      @default(now())

  @@schema("governance")
}

model Vote {
  motionId   String
  userId     String
  motion     Motion  @relation(fields: [motionId], references: [id])
  user       User    @relation(fields: [userId], references: [id])
  choice     VoteChoice  // YES | NO | ABSTAIN
  castAt     DateTime @default(now())

  @@id([motionId, userId])
  @@schema("governance")
}

enum ArtistTier { FREE PAID }
enum ChannelState { OFFLINE LIVE STARTING FAILED }
enum ArchiveSource { UPLOAD LIVE_RECORDING }
enum TrackState { UPLOADING SCANNING TRANSCODING READY FAILED TAKEDOWN }
enum LedgerCategory {
  REVENUE_SUBSCRIPTION REVENUE_DISTRIBUTION REVENUE_GRANT_INBOUND REVENUE_DONATION
  COST_INFRASTRUCTURE COST_DISTRIBUTION_PASSTHROUGH COST_OPERATIONS COST_SALARY
  COST_AUDIT COST_PROFESSIONAL_SERVICES
  GRANT_DISBURSEMENT RESERVE_TRANSFER
}
enum GrantState { PENDING CONFIRMED PAID UNCLAIMED }
enum MotionState { DRAFT OPEN CLOSED }
enum VoteChoice { YES NO ABSTAIN }
```

## API contract sketch

```
# Public — anonymous
GET    /v1/c/:slug                    → channel metadata + announcements
GET    /v1/c/:slug/archive            → public archive list
GET    /v1/c/:slug/now-playing
POST   /v1/c/:slug/heartbeat
POST   /v1/chat/:slug/join            → JWT for Centrifugo (hCaptcha-gated)
POST   /v1/chat/:slug/message         → moderation pre-check
POST   /v1/chat/:slug/react           → ephemeral live reaction

# Public transparency
GET    /v1/transparency/monthly_rollup?year=
GET    /v1/transparency/grants/:year
GET    /v1/transparency/categories
GET    /source                         → tarball of running version (AGPL §13)

# Artist auth
POST   /v1/auth/signup
POST   /v1/auth/login
...

# Channel mgmt (authed)
GET    /v1/me/channel
PATCH  /v1/me/channel
POST   /v1/me/channel/rotate-source-password
POST   /v1/me/channel/rotate-rtmp-key
POST   /v1/me/channel/rotate-webrtc-token
GET    /v1/me/archive
POST   /v1/me/archive
PATCH  /v1/me/archive/:id
DELETE /v1/me/archive/:id
POST   /v1/me/announcements
DELETE /v1/me/announcements/:id
POST   /v1/me/chat/ban
DELETE /v1/me/chat/ban/:fingerprint

# Distribution
GET    /v1/me/releases
POST   /v1/me/releases
POST   /v1/me/releases/:id/submit
POST   /v1/me/mixes/:archiveItemId/mixcloud
GET    /v1/me/royalties
GET    /v1/me/grants

# Governance (members)
GET    /v1/governance/members         → directory (members-only)
GET    /v1/governance/motions
GET    /v1/governance/motions/:id
POST   /v1/governance/motions/:id/vote

# Broadcasting helpers
GET    /v1/me/broadcast/credentials   → all current source credentials
GET    /v1/me/broadcast/guides/:tool  → returns OBS/Mixxx/Traktor/butt/BUTT guide
                                         personalized with this artist's credentials

# Public profile (v5)
GET    /v1/u/:handle                  → profile JSON (bio, releases, channel state)
GET    /v1/u/:handle/releases         → release timeline
GET    /v1/r/:id                      → release detail incl. tracklist + smart link
GET    /v1/embed/r/:id                → oEmbed metadata
GET    /v1/embed/c/:slug              → oEmbed metadata
GET    /oembed?url=                   → oEmbed discovery endpoint

# Profile + release management (authed)
GET    /v1/me/profile
PATCH  /v1/me/profile                 → update bio, hero, externals, press kit
POST   /v1/me/releases                → create release (draft)
PATCH  /v1/me/releases/:id
POST   /v1/me/releases/:id/publish
DELETE /v1/me/releases/:id
POST   /v1/me/releases/:id/tracks     → upload track
PATCH  /v1/me/releases/:id/tracks/reorder
GET    /v1/me/releases/:id/download/source/:trackId   → original-format download
GET    /v1/me/releases/:id/download/flac/:trackId     → FLAC derivative (Studio tier)

# Newsletter (v5)
GET    /v1/me/newsletter/subscribers  → counts + recent growth
POST   /v1/me/newsletter/compose      → save draft
POST   /v1/me/newsletter/send/:draftId → queue for delivery
GET    /v1/me/newsletter/sends        → past sends + analytics
POST   /v1/newsletter/subscribe       → public endpoint, listener subscribes
GET    /v1/newsletter/confirm/:token  → double opt-in confirmation
GET    /v1/newsletter/unsubscribe/:token → one-click unsubscribe (also via List-Unsubscribe header)

# Promo tools (v5)
GET    /v1/r/:id/smartlink            → renders smart link landing page
POST   /v1/me/releases/:id/smartlink  → update smart-link targets
GET    /v1/me/releases/:id/analytics  → plays, smart-link clicks, embed plays
POST   /v1/me/social/connect/:platform → OAuth init for Twitter/Mastodon/Threads/Bluesky
POST   /v1/me/social/post             → manual one-off post
PATCH  /v1/me/social/triggers         → enable/disable auto-post triggers

# Stats
GET    /v1/me/stats/channel
GET    /v1/me/stats/listeners
GET    /v1/me/stats/listener-hours    → for grant transparency
GET    /v1/me/stats/releases          → aggregate release plays + embed plays
GET    /v1/me/stats/export.csv        → full analytics export

# Internal (orchestrator only)
GET    /v1/internal/channels/:id/fallback.m3u
GET    /v1/internal/channels/:id/state
```

## Worker jobs

- `transcode-archive` — input: `{archiveItemId}`. ffmpeg → Opus/HLS/FLAC, fingerprint, ACRCloud tracklist
- `transcode-release-track` — input: `{releaseTrackId}`. Validates source, produces Opus 256, HLS ladder, FLAC 16/44 derivative
- `record-live` — Liquidsoap sidecar, captures live → finalizes on stop → creates archive item
- `mixcloud-upload` — pushes MixUpload to Mixcloud API
- `revelator-deliver` — submits Release, polls until DELIVERED
- `revelator-royalty-sync` — monthly cron, royalty reports per artist
- `chat-cleanup` — hourly, prune Redis chat keys past TTL
- `chat-ban-salt-rotate` — monthly, rotate fingerprint salt (old bans expire)
- `stats-rollup` — every 5 min, aggregate Redis counters → Postgres
- `listener-hours-rollup` — every 15 min, accumulate listener-hours per channel
- `monthly-ledger-rollup` — first of each month, generate `MonthlyRollup` for prior month
- `annual-grant-calc` — March 1 each year, compute and create `GrantDisbursement` rows
- `grant-payout` — triggered when artist confirms; processes Stripe Connect or SEPA
- `storage-soft-target-monitor` — daily, identify users >500 MB; queue email nudge (max one per quarter)
- `storage-ceiling-alert` — daily, alert ops if any user >47.5 GB (95% of hidden ceiling)
- `newsletter-send` — dispatches a queued newsletter via SES, tracks per-recipient state
- `newsletter-bounce-handler` — SNS webhook consumer, updates suppression list
- `social-post-dispatch` — per platform OAuth post; retries with exponential backoff
- `smartlink-click-aggregate` — every 15 min, aggregate click events for analytics

## OBS and broadcasting integration

This is a featured product capability. The agent must build per-tool, copy-paste
guides that fill in the artist's current credentials. See
`docs/obs-and-broadcasting-guides.md` for the content; here's the technical
implementation:

- `GET /v1/me/broadcast/guides/obs` returns a personalized Markdown guide for OBS:
  - The artist's current RTMP server URL (`rtmp://rtmp.tahti.live/live`)
  - Their current stream key (revealed once, rotatable)
  - Recommended OBS settings (1920×1080 placeholder, 30 fps, AAC 128k, x264 veryfast, 2500 kbps)
  - Audio-only setup (recommended): set video to "color source" with their cover art, set audio to their interface
- Same for `/mixxx`, `/traktor`, `/butt`, `/sam`, `/browser`
- The web dashboard renders the guide inline with downloadable `.obs` profile
  and downloadable Mixxx XML preset
- Each guide ends with a "test connection" button that performs a 10-second
  probe and reports back

## Liquidsoap channel template

Same as v3 — `infra/liquidsoap-channel.liq.template`. Live source priority,
archive fallback, live recording sidecar, HLS output, optional RTMP multistream.

## Acceptance criteria (for every milestone)

- `pnpm test` passes
- `pnpm typecheck` passes
- AGPL header check passes on every source file
- Zod validation on every API endpoint
- Every secret read from `process.env`
- Structured JSON logs (pino)
- Integration tests for the upload → transcode → archive → channel-fallback flow
- Integration tests for the live ingress → channel state change → archive resume flow
- Integration tests for chat join → message → ephemeral expiry
- Integration tests for ledger entry creation on Stripe webhook
- Integration tests for annual grant calculation against fixture data

## Anti-patterns to avoid

- Enforcing the storage limit. **Do not.** The soft target is a nudge, the
  hidden ceiling is an emergency brake. See `docs/storage-policy.md`.
- Treating channels like playlists.
- Letting chat scrollback grow unbounded in Redis. TTL aggressively.
- Submitting DJ mixes to Revelator/DSPs. Mixcloud only.
- Building algorithmic discovery, charts, "for you" feeds, follow graphs. Out of scope.
- Centralized moderation. Each channel is moderated by its artist.
- Skipping the `/source` endpoint. AGPL §13 requires it for network-deployed software.
- Mutating ledger entries after creation. The ledger is append-only — corrections
  are made by adding offsetting entries with a descriptive `description`.
- Computing grants outside the annual cron. Real-time "estimated grant" displays
  are okay; the *actual* calculation happens once a year against finalized data.
- Re-encoding original uploads. The `sourceKey` is the artist's master.
  Transcodes go into separate derivative keys. Never overwrite.
- Streaming FLAC by default. Opus 256 streams to listeners; FLAC is for
  Studio-tier *downloads* on tracks the user owns. This decision is about cost,
  not principle — revisit at M14 review if listener feedback warrants it.
- Treating profile pages as SoundCloud profiles. They're label/biographical
  pages. No track-level comments, no follower graph, no like buttons.
- Letting newsletters become a spam vector. Hard rate limits per tier,
  manual review for first 3 sends from new artists, mandatory unsubscribe.
- Auto-posting to social on every minor event. Newsletter sends, going-live,
  and new-release-published are it. Don't post every track upload.
- **v6:** Treating listener-hours as still meaningful for grants. They are
  not. Vanity metric only. The grant formula is engagement units.
- **v6:** Forgetting the 5× multiplier on paid-subscriber downloads.
- **v6:** Counting fan-sub euros as org revenue. They're not. They're a
  passthrough to the artist, minus 2% operational fee.
- **v6:** Allowing artists to subscribe to themselves or sock-puppet accounts.
  Dedup by email and payment method.
- **v6:** Adding YouTube or Twitch as Tahti Radio multistream targets. You
  will get copyright-struck within weeks. Mixcloud only.
- **v6:** Editorializing the Tahti Radio rotation. The picker algorithm is
  fair-rotation by default. The director should not have programming control.
- **v6:** Building a venue *booking* marketplace. Calendar feeds only — no
  job postings, no application flows, no mediation. We are not Resident Advisor.
- **v6:** Requiring accounts for free downloads. Anti-fraud relies on rate
  limits + fingerprint dedup. Accounts are required only for fan-subscribers.

## What's explicitly NOT in this product

- Algorithmic discovery / charts / trending / "for you"
- Follow graphs / activity feeds
- Track-level reactions or comments (chat is the only social layer, per-channel)
- Anonymous-listener accounts (only fan-subscribers need accounts; everyone else
  is anonymous traffic)
- Cross-platform search
- Centralized moderation team
- Merch shop (link out to Bandcamp)
- Native mobile apps in v1 (PWA only)
- Multi-region deployment
- Sponsorship displayed in-product (transparency report only, no logos in player)
- Advertising of any kind
- Re-posts or quote-posts (no internal social graph)
- Track-level likes (we keep aggregate plays, not personal endorsements)
- Public playlists curated by users (each artist's release timeline is their own)
- Crowdfunding / pre-orders within the platform (link out to Bandcamp)
