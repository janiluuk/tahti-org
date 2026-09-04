# Tahti feature catalog

This is the current product-surface catalog for the monorepo. It describes implemented user-facing capabilities, where they live, and which external services they require. Product principles and future commitments remain in [CONSTITUTION.md](./CONSTITUTION.md) and [project-roadmap.md](./project-roadmap.md).

## Public listening

- **Always-on artist channels:** `/c/[slug]` switches between a live broadcast and the artist's 24/7 fallback playlist.
- **Channel playback:** HLS live playback, archive playback, now-playing information, queue controls, track detail routing, and external HearThis embeds.
- **Artist profiles:** `/u/[username]` presents biography, latest music, archive, collections, upcoming events, and the artist channel.
- **Discography and recordings:** Tracks, DJ sets, mixes, and recorded shows are presented separately where their metadata differs.
- **Conditional metadata:** Tracklists and venue/location details appear for shows, recordings, DJ sets, mixes, and other long-form material rather than ordinary tracks.
- **Discovery:** Channel directory, artist feed, search, radio, latest releases, and artist-curated collections.
- **Engagement:** Likes, follows, reposts, comments where enabled, add-to-queue feedback, and direct artist messaging for signed-in accounts.
- **Downloads:** Artist-controlled downloads with MP3 or lossless files when available; anonymous download paths remain supported.
- **Embeds:** Channel, release, collection, SoundCloud, Mixcloud, and HearThis playback surfaces.
- **Events:** Upcoming live shows and events appear on profiles in humanized form, such as “Next gig in 3 months at …”.
- **Sharing and safety:** Share actions and content reporting are available from compact overflow menus.
- **Tahti Jam:** `/jam/[code]` — synced group listening started from a public playlist (`/u/[username]/c/[slug]` → "Start a Jam"). One host device is the source of truth; guests' own players mirror its track, play state, and position (SSE-pushed, drift-corrected). Requires being signed in.

## Artist Studio

### Channel operations

- **Channel dashboard:** Live state, now playing, key metrics, channel links, broadcast allowance, and storage status.
- **24/7 playlist:** `/dashboard/channel/playlist` adds archive or release material, previews audio, removes queue items, and supports pointer, keyboard, and touch drag-and-drop ordering.
- **Channel transport:** Start or stop the fallback channel, switch playlists, and move to the previous or next item from the main dashboard.
- **Playlist sources:** Use the default archive rotation or select an artist collection as the active fallback source.
- **Rotation rules:** Ordered, shuffle/fair rotation, time-added, and name sorting; optional auto-enrolment of new uploads and announcement insertion.

### Live broadcasting

- **Go Live workspace:** RTMP and Icecast credentials, reveal/copy/rotate controls, downloadable OBS preset, stream-type selection, and an integrated test signal.
- **Pre-flight:** Full-quality monitor, show name/type, recording and automatic-publishing toggles, optional visibility, simulcast, chat pin, and collapsible green room.
- **Ingest clients:** OBS, Streamlabs, Mixxx, Traktor, butt, and compatible RTMP/Icecast software.
- **Recording:** Ended broadcasts can be preserved as recorded shows and processed into archive media.
- **Publishing:** Recordings can publish automatically or remain private for editing.
- **Green room:** Invite collaborators to a listen-only preview before the channel goes live.
- **Multistream:** Configure supported and custom RTMP destinations and choose which targets are enabled per broadcast.
- **Usage controls:** Free-tier live allowance and member benefits are shown in the Studio before and during broadcasting.

### Scheduling

- **Upcoming broadcasts:** Set the next broadcast time and public note.
- **Live show series:** Create reusable series metadata, choose show type, increment episode numbers, and schedule episodes with fields prefilled.
- **Recorded-show list:** `/dashboard/recordings` lists broadcasts separately from the broader discography.
- **Venues and events:** Maintain venue details, event links, locations, and public upcoming-show data.
- **Tahti Radio slots:** View and manage radio slot bookings and submit eligible content.

### Music library and uploads

- **Discography:** `/dashboard/archive` manages uploaded tracks, sets, mixes, recordings, albums, metadata, visibility, downloads, and fallback eligibility.
- **Resumable uploads:** WAV, FLAC, MP3, AAC, and supported audio files upload through the prepared multipart flow with progress and processing states.
- **Track/set mode:** Upload UI distinguishes ordinary tracks from DJ sets, mixes, shows, and recordings so only relevant metadata is requested.
- **Cloud and URL import:** Import paths exist for URLs, SoundCloud, Bandcamp, Google Drive, Mixcloud rescue, Spotify metadata, and HearThis.
- **HearThis localization:** Download-enabled HearThis tracks can be fetched in the background, preserving the offered original/lossless source before normal processing; other tracks remain embeds.
- **Collections:** Create playlists, add archive items or releases, reorder them, import catalog material, and customize collection presentation.
- **Releases and smart links:** Draft and publish releases, upload tracks/artwork, manage versions and credits, set external DSP URLs, and share release landing pages.
- **Distribution:** Delivery workflows, DSP status, MusicBrainz defaults, identifiers, credits, and release-operation tools.
- **Stash:** Hold private working files before they become public catalog items.

### Audio editor

- **Large editing workspace:** `/dashboard/editor` keeps editing controls clear of Studio navigation and can open directly from the music library.
- **Waveform workflow:** Zoom, reset, selection, trim, fades, clip creation, and playback preview.
- **Processing:** Gain, EQ/filter curve, dynamics, stereo controls, and plugin-chain before/after preview.
- **Plugin UX:** Inactive plugins collapse by default, enabled plugins show a green indicator, and disabled plugins are visibly unavailable.
- **Revisions:** Applying edits preserves the original and creates numbered revisions; the ten newest revisions are retained.
- **Export:** Export sits beside preview and uses the current non-destructive edit state.

### Channel design (Channel Designer)

`/dashboard/channel/edit` is a focused single-section editor: a section list on the left, the active section's form in the middle with its own sticky Save/Done bar, and a live preview of the actual channel page on the right — click a region of the preview to jump straight to the section that controls it.

- **Visual style:** Brand accent (six preset gradients or a custom 5-color scheme), the background visualizer (eleven Three.js presets, e.g. Water ripple, Aurora, Particle field — each with speed/intensity/scale and an audio-reactive toggle), and **Saved Looks**: save the current Visual style settings as a named preset from a picker at the top of the section, re-apply any saved Look, or delete one. Saving under a name that's already used asks for confirmation before overwriting it.
- **Header & backdrop:** Header banner style (gradient, solid color, or a video loop on paid tiers), the backdrop media (image, gallery slideshow, or direct video file) that style uses, and which quick-facts (join date, live listener count) show next to the artist name in the header. Name/avatar/country/pronouns/tags are edited on Settings → Artist info instead — this section only links there, so there's one save path for identity fields.
- **Slideshow transitions:** Only shown once a gallery mode is enabled in Header & backdrop. Eight transition styles (four plain CSS crossfades, four richer WebGL ones — particle dissolve, glitch wipe, cube flip, liquid distortion), plus interval, transition duration, and autoplay.
- **Links:** The link buttons shown in the channel banner (label + URL each,
  platform icon auto-detected from the URL) — persisted as `channelLinksJson`
  via `PATCH /api/me/channel/visual`.
- **Player overlay text:** An optional stylized headline/tagline over the
  player stage (`playerOverlay*`), distinct from the channel-page text layer
  (`textLayer*` / designer `textOverlay*`).
- **Look extras:** Player/background independent gradients, background
  visualizer preset, and now-playing overlay style also persist on Channel
  (see worklog `2026-09-04-channel-look-extras.md`).
- **Press kit** now lives on Settings → Artist info's Branding tab, not in the designer, since it's identity material rather than a per-look setting. **Addons** was dropped from the designer's section list (the feature itself is unchanged, just not surfaced there).
- **Artist info:** Compact Identity, Story, and People tabs for name, avatar, logo, genres, location, biography, project type, and members.
- **Uploads:** Avatar, logo, artwork, and visual media use the standard drag-and-drop interaction.
- **Connections:** Separate tabs for streaming platforms, profile links, social accounts, and MusicBrainz.
- **Visibility:** Notifications & visibility contains dedicated Alerts, Visibility, Comments, and Mentions tabs.
- **Public profile defaults:** Biography, latest music, archive, upcoming event, and report/share menu behavior are reflected on the artist page.

### Audience and communication

- **Artist feed and posts:** Publish artist updates; the artist feed is surfaced first under My Library.
- **Live chat:** Public and fan chat use Centrifugo with reconnect handling, presence, reactions, moderation, and pinned artist announcements.
- **Announcements:** Chat announcements and reusable announcement audio clips live under Radio & announcements.
- **Comments and mentions:** Artists control defaults and notification behavior.
- **Messages:** Wide conversation view, artist search, follower/following contact list, unread state, and mention-aware composing.
- **Newsletter:** Compose and send audience updates with subscription and suppression handling.
- **Fan subscriptions:** Stripe Connect onboarding, artist-defined tiers and perks, subscriber access, and payout reporting.
- **One-time purchase tiers:** Separate from fan subscriptions — an artist prices a tier once (optionally "pay what you want," including free) and assigns it to specific tracks from the track editor's Access tab. A track can also be gated to subscribers-only with no tier involved. An active fan-subscriber always gets everything for free; buying one tier only unlocks that tier's own tracks, not another tier's. Sales appear in an Orders list where the artist can message a buyer directly. An optional Store section lists active tiers on the artist's public page.

### Analytics and account

- **Stats:** Plays, unique listeners, minutes listened, streams, downloads, followers, geographic/device breakdowns, and detailed metric modals.
- **Artist top lists:** Ranked artist-content views by period, dimension, and metric.
- **Revenue:** Fan-subscription revenue, payouts, and grant-related views.
- **Storage:** Usage is visible; active Tahti ry members display unlimited quota rather than the free-tier 500 MB soft target.
- **Account security:** Email/password authentication, verification, password reset/setup, session cookies, logout, API tokens, and optional two-factor settings.
- **Membership:** Tahti ry membership and billing are distinct from fan subscriptions to individual artists.

## Administration and governance

- **Admin overview:** Users, channels, streams, storage, support, reports, beta applications, and operational status.
- **Content tools:** Artist archive management, artist-specific top lists, announcements, news, venues, and moderation/report workflows.
- **Tahti Selects:** Generate a ten-track rotation from top-played eligible tracks, add or replace the current list, reorder/remove entries, and auto-fill an empty rotation before stream start.
- **Radio operations:** Radio stream status, submissions, scheduling, and operational controls.
- **Financial transparency:** Ledger, fan-subscription operations, grants, payouts, public transparency summaries, and immutable correction entries.
- **Association governance:** Member register, AGM material, motions, resolutions, voting, audit trail, and public governance documents.

## Platform and integrations

- **API:** Fastify REST API with authenticated Studio routes, public endpoints, OpenAPI output, rate limits, and source-code headers.
- **Workers:** BullMQ media and light-job lanes for transcoding, broadcast archive finalization, imports, editing renders, newsletters, statistics, and maintenance.
- **Media:** Original files remain preserved; derivatives are stored in MinIO and delivered through channel/release playback paths.
- **Realtime:** Centrifugo powers channel chat and presence.
- **Streaming:** RTMP and Icecast ingest, Liquidsoap channel playout, HLS delivery, recording, transport controls, and fallback playlist generation.
- **External services:** Stripe, Mixcloud, Revelator, MusicBrainz, SoundCloud, Bandcamp, Spotify metadata, HearThis, Google Drive, email delivery, and configured social networks.
- **Self-hosting:** Docker Compose for development, Docker Swarm production definitions, Caddy edge routing, Postgres, Redis, MinIO, and observability endpoints.

## Operational dependencies

Some features require configured credentials or running infrastructure. A visible UI does not replace those dependencies:

- Live playback and recording require ingest, orchestrator, Liquidsoap, object storage, and HLS edge services.
- Chat requires Redis and Centrifugo plus the configured public websocket URL.
- Upload processing, imports, and audio renders require Redis, MinIO, FFmpeg tooling, and workers.
- Payments and fan subscriptions require valid Stripe platform and Connect configuration.
- Distribution and social publishing require credentials for each external provider.
- Integration tests require Postgres and Redis; browser journeys additionally require the API and web app.

## Documentation map

- Artist workflow: [guides/for-artists.md](./guides/for-artists.md)
- Broadcasting: [guides/for-streamers.md](./guides/for-streamers.md)
- Listening: [guides/for-viewers.md](./guides/for-viewers.md)
- Audio editor: [audio-editor.md](./audio-editor.md)
- Architecture: [technical/](./technical/)
- Current roadmap and deferred work: [project-roadmap.md](./project-roadmap.md) and [future-improvements.md](./future-improvements.md)
