# Tahti ry — artist profile and promo toolkit

This document specifies the v5 additions: the modern artist profile page, the
release management model, and the five promo tools. The agent uses this
alongside `docs/AGENT.md` when building M12–M14.

## Design principle

The artist profile is a **label-style biographical page**, not a SoundCloud
profile. Three things to keep in mind:

1. **It's the artist's home page on the internet.** What shows up when
   someone googles them. What they put on their flyer.
2. **No social graph layered on it.** No follows, no likes, no comments under
   tracks, no algorithmic feed. The only interactions are: tune in to channel,
   click smart link, subscribe to newsletter.
3. **Discovery on the platform happens through the channel** (the listener
   experience) and **through external links** (search, social, embedded
   widgets). Not through any internal feed.

## The artist profile page

URL: `tahti.fi/u/<handle>`

### Sections

1. **Hero**
   - Cover image (3000×1000, optional)
   - Display name
   - Location (optional)
   - "ON AIR NOW" badge with link to channel, if currently live
   - Primary CTA — artist-customizable text and target (e.g., "Tune in to my
     channel," "Pre-save the new EP," "Sign up for tour dates")

2. **Bio**
   - Markdown-rendered rich text
   - Supports paragraphs, headings (H2/H3 only), bold, italic, links, images,
     blockquotes
   - Embedded video allowed: YouTube and Vimeo only, via allowlist
   - Max length: ~5,000 characters (~750 words) — encourages discipline

3. **Releases timeline**
   - Reverse chronological by default
   - Each entry: cover art, title, release type (single/EP/album/comp/remix),
     date, primary tracklist (first 5 tracks shown, expandable), description
     (~300 chars), smart link, embed widget
   - Drag-to-reorder for "featured" override (artist can pin a release to top)

4. **Channel embed**
   - Live player widget showing current state (live/archive)
   - Click-through to the full channel page

5. **Externals**
   - Configurable list of links: Instagram, Bandcamp, SoundCloud, personal
     site, Patreon, Twitter/Mastodon, etc.
   - Order is artist-controlled
   - Each renders as a button with platform icon

6. **Press kit** *(Studio tier, optional)*
   - Downloadable bio: 200-word, 400-word, 1000-word versions (PDF + plain text)
   - High-res photos (artist uploads, displayed as gallery)
   - Hi-res cover art for releases (auto-pulled)
   - Tech rider (optional, PDF upload)
   - Contact info: booking, press, management — separate fields, can be hidden

7. **Tip jar** *(optional)*
   - Link-out to PayPal.me, Buy Me a Coffee, Patreon, Bandcamp
   - We don't process payments here — pure link-out
   - Shown as a "Support" button near the hero

### What's NOT on the profile

- Track-level comments
- Like buttons
- Follower count or follow button (subscribe-to-newsletter button instead)
- "Other artists you might like" recommendations
- Activity feed
- Tags or genre browse-from-here
- Public play counts under tracks (the artist sees them in their dashboard, but
  they're not displayed publicly)

### SEO and sharing

- `<title>` = display name
- `<meta description>` = first 160 chars of bio
- Open Graph image = release cover art (latest release) or hero cover
- Twitter Card: `summary_large_image`
- JSON-LD: `MusicGroup` schema with embedded `MusicAlbum` entries
- Sitemap: every published release gets its own sitemap entry
- Canonical URL is `tahti.fi/u/<handle>`; custom domain (Studio) sets canonical
  to the custom domain version

### Performance

- RSC-rendered, no client-side state needed for first paint
- Hero image and first 3 release covers are LCP candidates — preload via
  Next.js `<Image priority>`
- Target: LCP <1.5s on cold cache, total page weight <500 KB

## The release model

### Release types

- `SINGLE` — 1–2 tracks, often promotional
- `EP` — 3–6 tracks
- `ALBUM` — 7+ tracks
- `COMPILATION` — various-artists collection
- `REMIX` — remix release

### Upload pipeline

Source formats accepted:
- WAV (16/24-bit, 44.1/48/96 kHz)
- FLAC (same)
- AIFF (same)
- MP3 (192 kbps and above)
- AAC (192 kbps and above)

Source formats rejected:
- Anything below MP3 192 kbps (quality floor)
- Files >500 MB without explicit override (operational safety)
- Files with no audio track
- DRM-protected files

Validation:
- `ffprobe` parses container; checks codec, sample rate, bit depth, channel layout
- `chromaprint` generates acoustic fingerprint
- Dedup check: if fingerprint exists in artist's own catalog, warn (not block)
- Optional: ACRCloud check against rights database for releases where it
  matters (we don't enforce; we warn the artist they may have a clearance issue)

Transcoding (worker job `transcode-release-track`):

1. **Stream derivative:** Opus 256 kbps Ogg, mono if source is mono, otherwise stereo
2. **HLS ladder:** Opus 64/128/256 kbps in MPEG-TS segments, 4-second segments
3. **FLAC derivative:** FLAC 16-bit/44.1 kHz (downsampled from 24/96 with
   proper dither if needed). For Studio-tier downloads.
4. **Source preservation:** the uploaded file is stored as-is in `sourceKey`,
   never re-encoded. Studio-tier users can download their original.

Storage:
- `sourceKey` (original WAV/FLAC/MP3) — primary archival object
- `streamKey` (Opus 256) — for player
- `flacKey` (FLAC 16/44 derivative) — for Studio downloads
- `hlsManifest` — for adaptive streaming

### What "highest possible quality" means in practice

You can **upload** in 24/96 WAV or FLAC. We **preserve** the original. We
**stream** in Opus 256 (transparent at speaker level, ~5× cheaper bandwidth
than FLAC streaming, indistinguishable from lossless in blind tests for
~99% of listeners).

Studio-tier users can **download** the FLAC derivative for any track they own,
and download the original source file as uploaded. This is the same model
Bandcamp uses for their highest tier.

If a listener strongly prefers FLAC streaming, the platform doesn't currently
support it. The bylaws (§ TBD) commit to revisiting this if storage and
bandwidth cost trends make it feasible — but the operational cost of FLAC
streaming today (~5× the bandwidth bill, ~5× the CDN spillover) doesn't justify
the imperceptible quality benefit.

## The promo toolkit (M14)

### Embed widget

URL pattern:
- `tahti.fi/embed/r/<release-id>` — single release player
- `tahti.fi/embed/c/<channel-slug>` — channel "now playing" player
- `tahti.fi/embed/u/<handle>` — artist profile mini-widget

Implementation:
- Separate Next.js app under `services/embed`, no shared chrome
- Inline CSS, no external font, no analytics tracking
- Total page weight: <30 KB
- Default colors match the parent page's `prefers-color-scheme`
- Customizable via query string: `?theme=dark|light&accent=cyan|amber|...`
- HLS.js loaded only when play is clicked (lazy)

oEmbed discovery:
- `GET /oembed?url=https://tahti.fi/r/abc&format=json` returns oEmbed JSON
- WordPress, Substack, Notion, Ghost auto-embed when artist pastes a release URL

### Smart links

URL pattern: `tahti.fi/r/<smart-link-slug>`

Page renders:
- Cover art
- Release title + artist
- List of platform buttons (only those the artist set targets for)
- Optional artist message
- "Available on" badges
- Click event logged with: target platform, country (from IP, anonymized), UA hash

Pre-release mode:
- Artist can set a release date in the future
- Smart link landing page shows countdown
- Email capture: "Be notified when this drops"
- Capture goes into the artist's newsletter list (with explicit opt-in)

Analytics:
- Clicks per platform per day
- Top countries
- Top referers (anonymized)
- Conversion (clicks ÷ unique visitors) where measurable

### Social auto-post

Supported platforms:
- **Twitter / X** — v2 API, OAuth 2.0 user context
- **Mastodon** — instance-agnostic, OAuth via user-provided instance URL
- **Threads** — via Meta Graph API (requires Threads access, may be limited)
- **Bluesky** — AT Protocol, app password auth

Triggers (per artist, opt-in):
- `release_published` — auto-posts when a release is published
- `going_live` — posts when channel state transitions to LIVE
- `newsletter_sent` — optional; posts a "new newsletter is out" link
- `manual` — one-off posts composed in the dashboard

Template variables:
- `{artist}`, `{release}`, `{smart_link}`, `{cover_url}`, `{channel_url}`

Retry behavior:
- Failed posts queued with exponential backoff (1m, 5m, 30m, 2h, 8h)
- Max 5 retries, then logged as failed
- Rate-limited platform (e.g., Twitter): respect the `x-ratelimit-reset` header

Operational notes:
- OAuth tokens refresh proactively (worker job runs daily for any expiring tokens)
- A failed post never silently disappears — artist sees it in dashboard with retry option
- Meta API quirks (Threads' 24h posting windows, IG's media-first requirement)
  are surfaced as warnings to the artist upfront

### Track-level analytics dashboard

What it shows:

Per release:
- Plays: last 24h / 7d / 30d / all-time
- Unique listeners: best-effort estimate (rotating IP-hash + UA fingerprint;
  no cookies, no personal data)
- Top countries (top 10)
- Top embedding domains (where the embed widget plays from)
- Smart-link clicks per platform
- Newsletter mentions (if release was linked in a newsletter)

Per track within release:
- Plays
- Completion rate: percentage of plays that finished the track (>95% of duration)
- Skip-out points (graphed, anonymized)

Per channel:
- Listener-hours (already core to the grant calculation, exposed here)
- Peak concurrent listeners
- Country breakdown
- Regular vs one-time listeners (≥3 sessions in 30d = regular)
- Chat message count (no content, just volume)

Newsletter analytics (when M13 is live):
- Sent, delivered, opened, clicked, unsubscribed
- Per-send breakdowns
- Audience growth over time

Export:
- `GET /v1/me/stats/export.csv` returns full analytics as a CSV
- All aggregates, no PII

### Privacy commitment

The analytics system is built **without persistent listener identity**:

- No cookies for analytics
- No browser fingerprinting beyond the chat ban-by-fingerprint (which is
  fingerprint-hashed and salt-rotated)
- IP addresses hashed with a daily-rotating salt for unique counting
- "Unique listener" is a daily-bucketed concept; we cannot tell you that the
  same person came back yesterday
- This means counts are slightly less accurate than other platforms — that's
  the trade

## What the agent should NOT build

- Comment threads on releases or tracks
- Public play counts displayed on the profile page
- A "trending releases this week" page
- Track-level "like" buttons
- Cross-artist playlists assembled by users
- Recommendation widgets ("artists like Long Doe")
- A search index over all releases (search by artist handle is fine; search
  across tracks is not)
- Anything resembling a feed of activity
- Crowdfunding / pre-orders (link out to Bandcamp instead)
- In-platform merchandise sales

These are all SoundCloud-like patterns we explicitly opted against.
