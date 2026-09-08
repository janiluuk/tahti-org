# Tahti.live

A nonprofit broadcasting platform owned and governed by its artist members.

Tahti ry (Tahti association) is a Finnish nonprofit association (yhdistys) founded to put money, audience, and infrastructure in the hands of independent musicians - with no shareholders, no advertising, and no exit.

The platform exists for one purpose: to be the best broadcasting platform for independent artists. Quality is a constitutional obligation, not an aspiration.

Artists pay a membership subscription (€40/year or free tier). 90% of operating surplus is distributed annually to artists as grants based on engagement units. Fan subscriptions go directly to the artist, minus a 2% platform fee that rolls into the next grant pool - Tahti takes no cut of fan-sub revenue for itself.

Every artist member has a vote. The board is elected by the membership. The entire platform is [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html). Artists retain full copyright over everything they upload and broadcast.

This monorepo is the **implementation package**: constitution and strategy docs, the production API/worker/web stack, ops, and guides.

## Read first

**[`docs/about.md`](docs/about.md)** - About our mission, money, governance, AGPL, and what we do not do.

**[`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)** - the three rules that govern every other document in this repository:

1. This is for artists, not for corporate. Administration paid fairly. No profit motive.
2. Highest quality, useful, community-driven platform - by design.
3. The artist shines brightest. We don't rip off anyone in the chain.

These rules are constitutional. They are not changeable by management decision. Everything else in `docs/` implements them.

## The problem

Independent artists who want to broadcast - live sets, radio shows, 24/7 mixes, releases - are forced to stitch together tools that were never built for them:

- A **streaming host** (Mixcloud, SoundCloud) that compresses audio to 64-128 kbps for free listeners and owns the relationship with the audience.
- A **DSP distributor** for releases, a **separate site** for a fan-facing profile, a **third tool** for smart links, and manual copy-paste into MusicBrainz, Discogs, and PRO registries for every release.
- A **fan-payment processor** (Patreon, Bandcamp) that takes 8-15% off the top before the artist sees a cent.
- **No say** in any of it. Terms change, algorithms change, the platform can vanish - and the artist has no vote, no ledger to audit, and no share of what the platform earns from their work.
- **Vanity metrics** (listener counts, "trending") that reward whoever games the algorithm, not who is actually building a sustainable practice.

Tahti exists to close that gap with one integrated, member-owned platform instead of five disconnected vendors.

## What Tahti solves, area by area

Each section below states the problem an area of the product addresses and how Tahti answers it. Screenshots for every surface are in the [Screenshots](#screenshots) section.

### Listening & discovery — `/listen`, `/c/:slug`, `/u/:username`

**Problem:** Listeners have to know when an artist is live, and separately dig through a different page to find their back catalog, and a third page to see what else is happening on the platform. Discovery on major platforms means an algorithmic feed the artist doesn't control.

**Solution:** Every artist gets one always-on channel (`/c/:slug`) that is either live or their 24/7 archive rotation - there is nothing else to check. `/listen` surfaces what's live now, replays, and new releases with no algorithmic ranking; a signed-in "For you" section is just follows and history, never a recommendation engine. Artist profiles (`/u/:username`) carry bio, releases, archive, and upcoming shows on one page. Channel, release, collection, and third-party (SoundCloud/Mixcloud/HearThis) embeds let that same content live anywhere. `Tahti Jam` lets a host and their listeners sync playback across devices from a shared playlist.

### Live broadcasting — Go Live workspace, ingest, multistream

**Problem:** Setting up a broadcast usually means separate accounts for ingest, hosting, and simulcasting, manual stream-key handling, and no safety net if something goes live before it should.

**Solution:** The Studio's Go Live workspace gives an artist RTMP/Icecast credentials with reveal/copy/rotate controls, an OBS preset, and a test signal, and accepts input from OBS, Streamlabs, Mixxx, Traktor, butt, or any compatible client. Pre-flight lets them name the show, choose recording/auto-publish behavior, and preview in a listen-only "green room" before anyone else can hear it. Multistream mirrors the same broadcast to configured RTMP targets (Twitch, YouTube, Kick, custom) simultaneously. When the stream stops, the recording is automatically archived - no manual export step.

### Music library, uploads & the audio editor — Discography, Stash, `/dashboard/editor`

**Problem:** Getting a track from a laptop to a finished, published catalog entry normally spans an upload tool, a separate editor, and manual re-uploading after every edit.

**Solution:** Resumable uploads accept WAV/FLAC/MP3/AAC and route tracks, DJ sets, mixes, and recordings through only the metadata fields relevant to that type. Cloud/URL import pulls existing material from SoundCloud, Bandcamp, Google Drive, Spotify metadata, Mixcloud, and HearThis directly into the library. `Stash` holds work-in-progress privately before it becomes a public catalog item. The built-in audio editor (waveform trim/fade/EQ/dynamics/plugin chain) writes numbered revisions back into the same library entry, so editing never means re-uploading through a different pipeline.

### Releases & catalog metadata — Release ops toolkit (M30)

**Problem:** Shipping a release "properly" means manually filing it with MusicBrainz, Discogs, a PRO, and a UPC/ISRC registrar, entering the same credits and metadata four separate times, with no single record of what's been done.

**Solution:** One release record in the Studio is reused everywhere: guided MusicBrainz submission with clipboard prefill, a guided Discogs entry flow (Discogs has no submission API, so Tahti mirrors the MusicBrainz pattern), ISRC/UPC capture, a credits & roles editor, collecting-society pointers (Teosto, PRS, GEMA, etc.), a release checklist wizard, post-release DSP claim links (Spotify for Artists, Apple, YouTube), and a JSON export of the whole record. No duplicate data entry.

### Channel design — Channel Designer

**Problem:** Artists on generic hosting platforms get one templated page; anything distinctive requires custom code or a designer.

**Solution:** `/dashboard/channel/edit` is a single-section editor with a live preview of the real channel page: brand accent and eleven audio-reactive Three.js background visualizer presets (savable as named "Looks"), header/backdrop style (gradient, image, slideshow, or video on paid tiers), slideshow transitions, link buttons, optional logo/addon layout blocks, and per-look player-overlay text - all without touching code.

### Scheduling — series, recordings, venues, Tahti Radio

**Problem:** Recurring shows, one-off events, and venue bookings usually live in a calendar tool that has no connection to what actually gets broadcast.

**Solution:** Live show series carry reusable metadata and auto-increment episode numbers when scheduled; recorded shows list separately from the general discography; venue and event details feed the public "upcoming shows" data shown on an artist's profile; Tahti Radio slot bookings let artists submit eligible content into the shared meta-stream.

### Audience & communication — chat, feed, messages, newsletter

**Problem:** Talking to an audience is usually split across a chat plugin, a separate mailing list tool, and social media DMs, none of which know who is actually a member, subscriber, or one-time buyer.

**Solution:** Centrifugo-backed live chat (presence, reactions, moderation, pinned announcements) runs on every channel; the artist feed carries posts; direct messages support artist-to-fan and fan-to-artist conversation with mention-aware composing; the newsletter tool sends to opted-in subscribers with suppression handling built in - all scoped to the same account and access model as the rest of the Studio.

### Fan monetization — subscriptions & one-time purchases

**Problem:** Patreon takes 8-12%, Bandcamp takes 10-15%, and neither tells the artist what "platform fee" is actually funding.

**Solution:** Fan subscriptions run on Stripe Connect directly to the artist's account, with artist-defined tiers, perks, and payout reporting - Tahti's cut is a published 2% operational fee (Stripe + GDPR + support costs) that rolls into the grant pool, not into Tahti's own revenue. One-time purchase tiers (including "pay what you want," down to free) gate individual tracks separately from subscriptions, with an Orders view so an artist can message a buyer directly.

### Analytics — stats, top lists, revenue

**Problem:** Plays and listener-hours are vanity numbers that don't map to what an artist is actually paid, and most platforms don't show the connection.

**Solution:** Stats cover plays, unique listeners, minutes listened, downloads, followers, and geographic/device breakdowns; Revenue shows fan-subscription income, payouts, and the artist's own estimated share of the annual grant pool - the same engagement-unit formula (downloads + fan-sub euros, not listener-hours) that actually determines the grant, so the numbers an artist sees are the numbers that pay them.

### Money, transparency & grants

**Problem:** On a commercial platform, nobody outside the company can see what it earns, what it costs, or where a "creator fund" payout actually comes from.

**Solution:** Every ledger entry - membership dues, fan-sub fees, grant disbursements, reserve transfers - is public and append-only on the [transparency page](https://tahti.live/transparency). Once a year, `packages/ledger`'s largest-remainder allocator distributes 90% of operating surplus to artist members weighted by engagement units, with a public methodology page and per-year grant reports. The remaining 10% builds a reserve capped at six months of costs; surplus above that cap also goes back to artists.

### Member governance

**Problem:** Terms of service on commercial platforms change unilaterally; users have no vote and no visibility into who decided what.

**Solution:** Every artist member votes. Motions can be drafted by members, discussed, and put to advisory votes from the member's own `/governance` dashboard; results are public. AGM/board meetings persist agenda, notice, attendance, quorum, and signed minutes. A board audit log (shared `LogViewer`) records finance, subscription, membership, decision, meeting, and radio-booking events for board oversight. Binding electronic voting and a full official-decision record are still being built out (see [`docs/remaining-work.md`](docs/remaining-work.md)) - what exists today is real advisory governance, not a placeholder page.

### Administration — for the board and operators

**Problem:** Running a member-owned nonprofit still needs the operational tooling of a company: user management, support, moderation, financial controls - without those controls belonging to a for-profit owner.

**Solution:** The `/admin` surface (board-gated) covers user directory + suspension, stream management + force-offline, a content-report queue, support tickets, beta-application review, the financial ledger and fan-sub payout queue, grant-round execution, radio operations, and system status/health - the same category of tooling a commercial platform has, run by elected members instead of a company.

### Open source & self-hosting

**Problem:** A platform can shut down, get acquired, or change its rules, and every artist who depended on it loses their audience relationship along with it.

**Solution:** The entire codebase - API, workers, web clients, infrastructure templates - is [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html). Anyone can read it, self-host it, or fork it; a hosted fork must share its modified source back. Tahti's own instance runs on owned Helsinki hardware plus UpCloud Helsinki spillover (no CDN), with Docker Compose for development and Docker Swarm for production - documented in [`infra/`](infra/) and [`docs/infra-strategy.md`](docs/infra-strategy.md). The defense against forking isn't the code being hard to copy; it's the hosted instance and the community on it.

## At a glance

- **Legal form:** Finnish _yhdistys_ (registered nonprofit association)
- **License:** AGPL-3.0
- **Audio quality:** lossless FLAC for members (all their listeners); MP3 192 kbps for free-tier artists
- **Grant distribution:** annual, weighted by engagement units (downloads + fan-sub euros, not listener-hours)
- **Direct artist revenue:** fan-to-artist subscriptions with 0% org take (2% operational fee covers Stripe + GDPR + ops)
- **Hosting:** owned hardware in Helsinki + UpCloud Helsinki spillover; no CDN
- **Membership:** €40/year to support Tahti ry; free-tier artists get MP3 + 1 hr/week live broadcasting

### Web clients

| Client                                                                                    | Role                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/web`** (this repo)                                                                | Production Next.js listen + studio + admin - `app.tahti.live` / `tahti.live`                                                                                              |
| **[Tahti Player](https://github.com/janiluuk/tahti-player)** (`tahti-web`, separate repo) | Next listen + studio SPA on Tahti Player UI - live on [beta.tahti.live](https://beta.tahti.live); cutover plan [`ops/nuclear-web-cutover.md`](ops/nuclear-web-cutover.md) |

Both clients talk to the same API, chat, and media stack. Prefer the Tahti Player beta when evaluating the upcoming player UX; keep `apps/web` as production until cutover P0s are done.

## Screenshots

Captured against the seeded Docker stack (real fixture data, not empty states) via [`scripts/e2e-screenshots.sh`](scripts/e2e-screenshots.sh) - see [`docs/e2e-screenshots/README.md`](docs/e2e-screenshots/README.md) to regenerate. Full route -> file mapping in [`manifest.json`](docs/e2e-screenshots/manifest.json).

**Listener-facing**

|                                                                              |                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ![Channel page](docs/e2e-screenshots/public/channel.png)                     | ![Artist profile](docs/e2e-screenshots/public/profile.png)                      |
| **Channel** (`/c/:slug`) - live player, archive rotation, chat, all one page | **Profile** (`/u/:username`) - bio, releases, archive, no algorithmic feed      |
| ![Discover](docs/e2e-screenshots/public/listen.png)                          | ![Smart link](docs/e2e-screenshots/public/smart-link.png)                       |
| **Discover** (`/listen`) - live channels, replays, new releases              | **Smart link** (`/r/:slug`) - one link, buttons for every DSP the artist listed |

**Artist studio**

|                                                                                                             |                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ![Artist dashboard](docs/e2e-screenshots/artist/dashboard.png)                                              | ![Broadcast studio](docs/e2e-screenshots/artist/broadcast-studio.png)                         |
| **Dashboard** (`/dashboard`) - broadcast status, usage, revenue, recent uploads at a glance                 | **Broadcast studio** (`/dashboard/broadcast`) - RTMP/Icecast credentials, pre-flight, go-live |
| ![Stats](docs/e2e-screenshots/artist/stats.png)                                                             | ![Releases](docs/e2e-screenshots/artist/releases.png)                                         |
| **Stats** (`/dashboard/stats`) - plays, downloads, listener map, grant estimate                             | **Releases** (`/dashboard/releases`) - draft/publish, DSP URLs, smart links                   |
| ![Channel design](docs/e2e-screenshots/artist/channel-appearance.png)                                       | ![Collections](docs/e2e-screenshots/artist/collections.png)                                   |
| **Channel design** (`/dashboard/channel/edit`) - identity, backgrounds, visualizer, press kit, live preview | **Collections** (`/dashboard/collections`) - curated sets, each with one-click embed          |

**Governance & admin**

|                                                                                               |                                                                               |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ![Governance](docs/e2e-screenshots/artist/governance.png)                                     | ![Transparency dashboard](docs/e2e-screenshots/public/transparency.png)       |
| **Governance** (`/governance`) - motions, voting, topics, run from the member's own dashboard | **Transparency** (`/transparency`) - the public ledger every member can audit |

The current board-admin surface is also captured with review annotations. The cyan
labels identify the admin navigation, main workspace, and page heading; the dark
callout records the exact route.

|                                                                                        |                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ![Annotated admin AGM](docs/e2e-screenshots/admin/agm.png)                             | ![Annotated admin governance](docs/e2e-screenshots/admin/governance.png)             |
| **AGM admin** (`/admin/agm`) - agenda builder, governance records, motions and minutes | **Governance admin** (`/admin/governance`) - board governance operations and records |
| ![Annotated admin dashboard](docs/e2e-screenshots/admin/dashboard.png)                 | ![Annotated admin financial ledger](docs/e2e-screenshots/admin/financial-ledger.png) |
| **Admin dashboard** (`/admin/dashboard`) - operational overview                        | **Financial ledger** (`/admin/financial/ledger`) - immutable financial records       |

More surfaces (listener, free/member/artist/admin roles, ~90 pages total) are captured under [`docs/e2e-screenshots/`](docs/e2e-screenshots/) - see that folder's `README.md` for the full manifest and how to regenerate them.

## Package structure

### Foundation documents (read these to understand the project)

| File                                                           | Purpose                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`docs/about.md`](docs/about.md)                               | Public About page text - mission, money, governance, AGPL                                  |
| [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)                 | **Start here for rules.** The three rules. Constitutional.                                 |
| [`docs/business-evaluation.md`](docs/business-evaluation.md)   | Honest "is this worth doing" memo for founder, board, grant officers                       |
| [`docs/strategy-and-product.md`](docs/strategy-and-product.md) | Positioning, competitive critique (SoundCloud/Mixcloud/Spotify/Bandcamp), retention thesis |
| [`docs/roadmap-and-plan.md`](docs/roadmap-and-plan.md)         | Phase 0 (pre-incorporation), Phase 1 (Months 1-9), Phase 2 (10-24), Phase 3 (25-36)        |
| [`docs/financial-model.md`](docs/financial-model.md)           | Headline 3-year model - revenue, cost, surplus, grant pool                                 |
| [`docs/budget-detailed.md`](docs/budget-detailed.md)           | Line-item monthly budget + break-even sensitivity analysis                                 |

### User guides (plain language)

| File                                                                           | Purpose                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`docs/features.md`](docs/features.md)                                         | Current implemented feature catalog and operational dependencies    |
| [`docs/guides/README.md`](docs/guides/README.md)                               | Index - who should read which guide                                 |
| [`docs/guides/for-viewers.md`](docs/guides/for-viewers.md)                     | Listeners & fans: listen, chat, subscribe, smart links              |
| [`docs/guides/for-artists.md`](docs/guides/for-artists.md)                     | Members: dashboard, profile, releases, fan tiers                    |
| [`docs/guides/for-streamers.md`](docs/guides/for-streamers.md)                 | Going live: OBS, RTMP, limits, multistream                          |
| [`docs/guides/multistream-simulcast.md`](docs/guides/multistream-simulcast.md) | Simulcast to Twitch, YouTube, Kick, etc. (stream keys per platform) |

### Implementation documents (for the agent + director)

| File                                                                         | Purpose                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                     | Cursor/agent session entry - points at constitution, brief, remaining work              |
| [`docs/AGENT.md`](docs/AGENT.md)                                             | Coding-agent brief - repo, milestones, data model, anti-patterns                        |
| [`docs/remaining-work.md`](docs/remaining-work.md)                           | Collective incomplete checklist (legal, ops, engineering)                               |
| [`docs/design/README.md`](docs/design/README.md)                             | Design docs index - constitution, v8 mockups, reference HTML pack, active briefs        |
| [`docs/project-roadmap.md`](docs/project-roadmap.md)                         | Build audit, phase checklist, milestone status                                          |
| [`docs/future-improvements.md`](docs/future-improvements.md)                 | Deferred milestones + engineering efficiency backlog                                    |
| [`docs/governance-and-legal.md`](docs/governance-and-legal.md)               | Yhdistys structure, bylaws (§1-12), AGPL implications, AGM mechanics                    |
| [`docs/profile-and-promo-toolkit.md`](docs/profile-and-promo-toolkit.md)     | Profile, release model, embed/smartlink/social/newsletter/analytics specs               |
| [`docs/engagement-and-fansubs.md`](docs/engagement-and-fansubs.md)           | Engagement-unit grant formula + fan-to-artist subscription product spec                 |
| [`docs/tahti-radio-and-venues.md`](docs/tahti-radio-and-venues.md)           | Meta-stream architecture + venue calendar API                                           |
| [`docs/infra-strategy.md`](docs/infra-strategy.md)                           | Self-hosted Helsinki + UpCloud spillover, no CDN, GDPR posture                          |
| [`docs/funding-strategy.md`](docs/funding-strategy.md)                       | Foundation grant pipeline (Tempo, Koneen, SKR, Creative Europe), donations, sponsorship |
| [`docs/transparency-policy.md`](docs/transparency-policy.md)                 | Public ledger, annual report commitment, financial visibility                           |
| [`docs/storage-policy.md`](docs/storage-policy.md)                           | Soft-target 500MB, no enforcement, hidden 50GB abuse safeguard                          |
| [`docs/obs-and-broadcasting-guides.md`](docs/obs-and-broadcasting-guides.md) | Per-tool onboarding for OBS, Mixxx, Traktor, butt, browser ingest                       |

### Infrastructure templates

| File                                    | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `infra/docker-stack.yml`                | Production Swarm stack           |
| `infra/docker-compose.dev.yml`          | Local development                |
| `infra/Caddyfile`                       | Edge TLS + reverse proxy         |
| `infra/liquidsoap-channel.liq.template` | Per-channel broadcaster template |

### Presentations

| File                                                         | Purpose                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`slides/Tahti-Community.pptx`](slides/Tahti-Community.pptx) | Artist-facing deck - for founding-cohort recruitment + scene press                |
| [`slides/Tahti-Business.pptx`](slides/Tahti-Business.pptx)   | Governance + sustainability deck - for board candidates, grant officers, auditors |

## Running tests

**Node.js 24+** is required (`engines` in root `package.json`, `.nvmrc`, `.node-version`). With [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use`.

API and package tests need **Postgres** and **Redis** with the Prisma schema applied:

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
cd packages/db && pnpm db:push   # or pnpm db:migrate:test in CI
cd ../.. && pnpm test
```

For a clean checkout, the full local CI bootstrap is:

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis && pnpm install --frozen-lockfile && pnpm --filter @tahti/db db:generate && pnpm format && pnpm ci:check
```

Run the same lint, format, and typecheck gates as CI locally:

```bash
pnpm ci:check
```

Full app stack in Docker (API, web, worker, postgres, redis, minio - ports **3010** / **3011**):

```bash
make stack-up          # or ./scripts/stack-up.sh --seed for demo fixtures
make stack-deploy      # rsync + stack-up on lab host (SSH required)
```

Optional bash e2e against a running API:

```bash
API_URL=http://localhost:3001 pnpm test:e2e
SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://tahti:tahti_dev@localhost:5432/tahti \
  API_URL=http://localhost:3001 APP_URL=http://localhost:3010 pnpm test:e2e:journeys
# With web up: pnpm test:e2e:journeys:web
# Dashboard + player (web): pnpm test:e2e:dashboard-player:web
# Persona scripts (source helpers + fixtures first): journeys/listener|artist|member.sh
```

## API documentation

The topic-organized API map is in [`docs/api/README.md`](docs/api/README.md).

Public, unauthenticated reference (Scalar + filtered OpenAPI):

| Surface           | URL                                                               |
| ----------------- | ----------------------------------------------------------------- |
| Human UI (Scalar) | [`https://api.tahti.live`](https://api.tahti.live/) (also `/api`) |
| OpenAPI JSON      | `GET /api/openapi.json` (admin/internal routes omitted)           |

Ops full Swagger UI stays at `/docs` (HTTP basic auth). Credential rotation: [`ops/RUNBOOK.md`](ops/RUNBOOK.md).

On every merge to **`main`**, CI exports `openapi.json` (full) and `openapi.public.json` as release artifacts alongside the dated GitHub release.

## CI releases

Every merge to **`main`** runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml). When all checks pass, CI creates a GitHub release tagged **`YYYY-MM-DD-buildnr`** (UTC calendar date + daily increment), e.g. `2026-06-03-1`, `2026-06-03-2`.

Preview the next tag locally:

```bash
scripts/next-release-tag.sh
```

Manual semver production deploys still use `v*.*.*` tags via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Headline numbers (base case)

|                                        | Y1           | Y2           | Y3            | 3-yr cum.     |
| -------------------------------------- | ------------ | ------------ | ------------- | ------------- |
| Members                                | 200          | 1,200        | 4,000         | -             |
| Total org revenue                      | €35,426      | €107,700     | €290,872      | €433,998      |
| Total costs (incl. director salary)    | €54,572      | €86,092      | €148,220      | €288,884      |
| **Org surplus**                        | **-€19,146** | **+€21,608** | **+€141,500** | **+€143,962** |
| **Artist grant pool (90% of surplus)** | **€0**       | **€19,447**  | **€129,737**  | **€149,184**  |
| **Fan-sub direct to artists**          | €1,622       | €22,705      | €138,394      | €162,721      |
| **Total artist money**                 | €1,622       | €42,152      | €268,131      | **€311,905**  |
| Director compensation                  | €30,000      | €40,000      | €45,000       | €115,000      |

Break-even threshold: ~600 members in Y1 absent grant funding, ~775 in Y2, ~1,100 in Y3 (Y3 jump is the 10 Gbps fiber upgrade).

## Three things that must go right

1. A founding grant of €20-25k lands in Year 1 (Tempo, Koneen, or SKR).
2. The org reaches at least 100 members by end of Year 1 (200 modeled).
3. The director does not burn out or quit.

If all three: Tahti is operationally self-funding by Y2 and distributes meaningful grants by Y3.
If any one fails: the org pauses, retrenches, or terminates. See `business-evaluation.md` for honest scenarios.

## What's on record from the design process

This package is the seventh major iteration of a multi-session design process. The accumulated honest observations:

1. **Year 1 deficit is real and unavoidable** without grant funding. €19k modeled. Apply to Tempo + Koneen + SKR in parallel before incorporating.

2. **The grant-distribution model concentrates pay-out.** Top-decile artists by engagement units receive ~€260/year at Y3 scale; mid-tier ~€19; active rest ~€4. This is intentional ("reward the artists actually building an audience here") but should be stated plainly to founding members before they join.

3. **Fan-subs at 0% org take is unusual.** Patreon takes 8-12%, Bandcamp takes 10-15%. The 2% Tahti operational fee is bounded by costs (Stripe + GDPR + customer support); surplus rolls into the grant pool, not into Tahti's own margin.

4. **AGPL is a moat _and_ a vulnerability.** Anyone can fork. The defense is the hosted instance + the network on it, not the code. Be at peace with this.

5. **Director salary is real and modest.** €30-45k cumulative €115k. This is the founder's three-year compensation; there is no equity upside downstream.

6. **No CDN is a trade.** UpCloud Helsinki handles spillover. Y3 requires a 10 Gbps business fiber pipe (~€18k/yr). If fiber pricing changes materially, revisit the CDN decision at AGM - but don't preemptively over-provision.

7. **Listener-hours are vanity metrics only.** Grant share comes from engagement units. The constitution forbids designing around listener metrics.

8. **The audio quality story is verifiable, not aspirational.** SoundCloud caps free listeners at 128 kbps Opus. Mixcloud caps free listeners at 64 kbps AAC. Tahti's members stream FLAC to all their listeners, free tier included, at 192 kbps MP3 minimum.

- Generated 2026-05-17. Rewritten 2026-09-08 to cover implemented functionality problem-by-problem.
