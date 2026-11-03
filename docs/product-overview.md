# Product overview

What problem Tahti solves, area by area. Moved from the root README. Screenshots: [`screenshots.md`](screenshots.md). Full feature catalog: [`features.md`](features.md).

## At a glance

| | |
| --- | --- |
| Legal form | Finnish _yhdistys_ (registered nonprofit association) |
| License | AGPL-3.0 |
| Audio quality | Lossless FLAC for members (all their listeners); MP3 192 kbps for free-tier artists |
| Grant distribution | Annual, weighted by engagement units (downloads + fan-sub euros, not listener-hours) |
| Direct artist revenue | Fan-to-artist subscriptions with 0% org take (2% operational fee covers Stripe + GDPR + ops) |
| Hosting | Owned hardware in Helsinki + UpCloud Helsinki spillover; no CDN |
| Membership | €40/year to support Tahti ry; free-tier artists get MP3 + 1 hr/week live broadcasting |

## The problem

Independent artists who want to broadcast - live sets, radio shows, 24/7 mixes, releases - are forced to stitch together tools that were never built for them:

| Gap | Today |
| --- | --- |
| Streaming host | Mixcloud, SoundCloud compress audio to 64-128 kbps for free listeners and own the relationship with the audience. |
| Release tooling | A DSP distributor for releases, a separate site for a fan-facing profile, a third tool for smart links, and manual copy-paste into MusicBrainz, Discogs and PRO registries for every release. |
| Fan payments | Patreon, Bandcamp take 8-15% off the top before the artist sees a cent. |
| No say | Terms change, algorithms change, the platform can vanish - and the artist has no vote, no ledger to audit, and no share of what the platform earns from their work. |
| Vanity metrics | Listener counts and "trending" reward whoever games the algorithm, not who is actually building a sustainable practice. |

Tahti exists to close that gap with one integrated, member-owned platform instead of five disconnected vendors.

## Area by area

| Area | Problem | How Tahti answers it |
| --- | --- | --- |
| Listening and discovery (`/listen`, `/c/:slug`, `/u/:username`) | Listeners have to know when an artist is live, dig through another page for the back catalog, and a third for what else is happening. Discovery means an algorithmic feed the artist doesn't control. | One always-on channel per artist (`/c/:slug`), live or 24/7 archive rotation. `/listen` shows what's live, replays and new releases with no algorithmic ranking; signed-in "For you" is just follows and history. Artist profiles (`/u/:username`) carry bio, releases, archive and upcoming shows. Channel, release, collection and third-party (SoundCloud/Mixcloud/HearThis) embeds. Tahti Jam syncs playback across devices from a shared playlist. |
| Live broadcasting (Go Live, ingest, multistream) | Separate accounts for ingest, hosting and simulcasting, manual stream keys, no safety net if something goes live too early. | Go Live gives RTMP/Icecast credentials with reveal/copy/rotate, an OBS preset and a test signal; accepts OBS, Streamlabs, Mixxx, Traktor, butt or any compatible client. Pre-flight names the show, sets recording/auto-publish, and previews in a listen-only green room. Multistream mirrors to Twitch, YouTube, Kick or custom RTMP. Recordings archive automatically when the stream stops. |
| Library, uploads and audio editor (Discography, Stash, `/studio/editor`) | Getting a track from a laptop to a published catalog entry spans an upload tool, a separate editor and re-uploading after every edit. | Resumable uploads (WAV/FLAC/MP3/AAC) with type-specific metadata. Cloud/URL import from SoundCloud, Bandcamp, Google Drive, Spotify metadata, Mixcloud and HearThis. Stash holds private work in progress. The built-in editor (trim/fade/EQ/dynamics/plugin chain) writes numbered revisions back to the same library entry. |
| Releases and catalog metadata (Release ops toolkit, M30) | Filing a release with MusicBrainz, Discogs, a PRO and an ISRC/UPC registrar means entering the same data four times. | One release record reused everywhere: guided MusicBrainz submission, guided Discogs entry (no submission API), ISRC/UPC capture, credits and roles editor, collecting-society pointers (Teosto, PRS, GEMA, etc.), a release checklist, DSP claim links (Spotify for Artists, Apple, YouTube) and a JSON export. |
| Channel design (`/studio/channel`) | Generic hosts give one templated page; anything distinctive needs code or a designer. | Single-section editor with live preview: brand accent, eleven audio-reactive Three.js visualizer presets (saved as named "Looks"), header/backdrop style (gradient, image, slideshow, or video on paid tiers), transitions, link buttons, logo/addon blocks and per-look overlay text. |
| Scheduling (series, recordings, venues, Tahti Radio) | Shows and venue bookings live in a calendar with no link to what gets broadcast. | Live show series with reusable metadata and auto-numbered episodes; recorded shows listed separately; venue and event details feed "upcoming shows"; Tahti Radio slot bookings submit content into the shared meta-stream. |
| Audience and communication (chat, feed, messages, newsletter) | Chat plugin, mailing list and DMs are separate and don't know who is a member, subscriber or buyer. | Centrifugo live chat (presence, reactions, moderation, pinned announcements) on every channel; artist feed; direct messages with mentions; newsletter to opted-in subscribers with suppression handling. Same account and access model as the Studio. |
| Fan monetization (subscriptions, one-time purchases) | Patreon takes 8-12%, Bandcamp 10-15%, and neither says what the fee funds. | Fan subscriptions on Stripe Connect straight to the artist, with artist-defined tiers, perks and payout reporting. Tahti's cut is a published 2% operational fee (Stripe + GDPR + support) that rolls into the grant pool. One-time purchase tiers (including pay-what-you-want, down to free) gate tracks; an Orders view lets the artist message buyers. |
| Analytics (stats, top lists, revenue) | Plays and listener-hours don't map to what an artist is paid. | Plays, unique listeners, minutes, downloads, followers, geo/device breakdowns. Revenue shows fan-sub income, payouts and the estimated grant share using the same engagement-unit formula that pays the grant. |
| Money, transparency and grants | Nobody outside a commercial platform can see what it earns or where a "creator fund" comes from. | Every ledger entry (dues, fan-sub fees, grants, reserve transfers) is public and append-only on the [transparency page](https://tahti.live/transparency). Once a year `packages/ledger`'s largest-remainder allocator distributes 90% of operating surplus by engagement units, with a public methodology and per-year reports. The other 10% builds a reserve capped at six months of costs; anything above the cap also goes to artists. |
| Member governance | Terms change unilaterally; users have no vote and no visibility. | Every artist member votes. Members draft and discuss motions and put them to advisory votes from `/governance`; results are public. AGM/board meetings keep agenda, notice, attendance, quorum and signed minutes. A board audit log records finance, subscription, membership, decision, meeting and radio-booking events. Binding electronic voting is still being built (see [`remaining-work.md`](remaining-work.md)). |
| Administration (`/admin`, board-gated) | A member-owned nonprofit still needs company-grade ops tooling. | User directory and suspension, stream management and force-offline, content reports, support tickets, beta applications, ledger and fan-sub payout queue, grant rounds, radio operations, system status. |
| Open source and self-hosting | A platform can shut down or change its rules and artists lose their audience. | Everything (API, workers, web clients, infra templates) is [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html): read it, self-host it, fork it; hosted forks share their source. Tahti runs on owned Helsinki hardware plus UpCloud Helsinki spillover (no CDN), Docker Compose for dev and Docker Swarm for production ([`../infra/`](../infra/), [`infra-strategy.md`](infra-strategy.md)). The defense against forking is the hosted instance and its community, not the code. |
