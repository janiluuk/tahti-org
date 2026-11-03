# Decisions

Every settled decision for Tahti ry and this repo (API, worker, infra, money, governance), in one table per area. Append new rows; do not rewrite old ones. When a decision is superseded, add a new row that says so.

Web client and desktop player decisions live in [`tahti-player/docs/DECISIONS.md`](https://github.com/janiluuk/tahti-player/blob/master/docs/DECISIONS.md).

```mermaid
flowchart LR
    Q["Open question<br/>planning-decisions.md"] --> D["Decided<br/>row in this file"]
    D --> S["Spec / code updated<br/>(link column)"]
```

Open questions and their option write-ups stay in [`planning-decisions.md`](planning-decisions.md). This file holds only what is decided.

## Organization and money

From the design process record (README, 2026-05-17). Kept word for word.

| Date | Decision | Why | Link |
| --- | --- | --- | --- |
| 2026-05-17 | **Year 1 deficit is real and unavoidable** without grant funding. | €19k modeled. Apply to Tempo + Koneen + SKR in parallel before incorporating. | [financial-model.md](financial-model.md) |
| 2026-05-17 | **The grant-distribution model concentrates pay-out.** | Top-decile artists by engagement units receive ~€260/year at Y3 scale; mid-tier ~€19; active rest ~€4. This is intentional ("reward the artists actually building an audience here") but should be stated plainly to founding members before they join. | [engagement-and-fansubs.md](engagement-and-fansubs.md) |
| 2026-05-17 | **Fan-subs at 0% org take is unusual.** | Patreon takes 8-12%, Bandcamp takes 10-15%. The 2% Tahti operational fee is bounded by costs (Stripe + GDPR + customer support); surplus rolls into the grant pool, not into Tahti's own margin. | [engagement-and-fansubs.md](engagement-and-fansubs.md) |
| 2026-05-17 | **AGPL is a moat _and_ a vulnerability.** | Anyone can fork. The defense is the hosted instance + the network on it, not the code. Be at peace with this. | [governance-and-legal.md](governance-and-legal.md) |
| 2026-05-17 | **Director salary is real and modest.** | €30-45k cumulative €115k. This is the founder's three-year compensation; there is no equity upside downstream. | [financial-model.md](financial-model.md), [budget-detailed.md](budget-detailed.md) |
| 2026-05-17 | **No CDN is a trade.** | UpCloud Helsinki handles spillover. Y3 requires a 10 Gbps business fiber pipe (~€18k/yr). If fiber pricing changes materially, revisit the CDN decision at AGM - but don't preemptively over-provision. | [infra-strategy.md](infra-strategy.md), [cdn-strategy.md](cdn-strategy.md) |
| 2026-05-17 | **Listener-hours are vanity metrics only.** | Grant share comes from engagement units. The constitution forbids designing around listener metrics. | [CONSTITUTION.md](CONSTITUTION.md) |
| 2026-05-17 | **The audio quality story is verifiable, not aspirational.** | SoundCloud caps free listeners at 128 kbps Opus. Mixcloud caps free listeners at 64 kbps AAC. Tahti's members stream FLAC to all their listeners, free tier included, at 192 kbps MP3 minimum. | [strategy-and-product.md](strategy-and-product.md) |

## Platform and product

From the [`planning-decisions.md`](planning-decisions.md) decision log and topic blocks.

| Date | Decision | Why | Link |
| --- | --- | --- | --- |
| 2026-06-03 | **Auth:** custom session + argon2 (Lucia not adopted). Implemented in `apps/api/src/lib/session.ts` + `password.ts`. | Lucia is maintenance-only. Recorded retroactively from shipped MVP code. | [Topic 4](planning-decisions.md#topic-4--auth-library-lucia-deprecated-vs-better-auth-vs-next-auth) |
| 2026-06-03 | **Uploads:** S3 multipart via presigned part URLs (no tusd). Implemented in `routes/uploads/*`. | MinIO supports it natively; no extra service. Recorded retroactively. | [Topic 5](planning-decisions.md#topic-5--upload-resumability-tus-vs-s3-multipart) |
| 2026-06-03 | **Channel URLs:** path-based `/c/<slug>` for MVP; subdomains deferred. | Avoids wildcard TLS / DNS challenge for MVP. Recorded retroactively. | [Topic 9](planning-decisions.md#topic-9--nextjs-subdomain-routing-channel-slugs-as-subdomains) |
| 2026-06-03 | **AGM voting is advisory** for Y1; `Motion.advisory` flag (default `true`); upgrade after a bylaws amendment authorizes electronic asynchronous voting. | Finnish association law: binding AGM votes happen at the meeting unless the bylaws allow otherwise. Bylaws clause flagged for legal review. | [Topic 11](planning-decisions.md#topic-11--agmvoting-finnish-yhdistys-law-compliance) |
| 2026-06-03 | **Grant formula = engagement units** (free downloads ×1, paid downloads ×5, fan-sub €×1), 10% reserve, 5-unit floor, no hard per-artist cap, unclaimed grants roll to next year. Implemented in `packages/ledger`. Listener-hours dropped. | Listener-hours formula is an anti-pattern; `engagement-and-fansubs.md` is authoritative. | [Topic 8](planning-decisions.md#topic-8--grant-formula-consolidate-m9-spec-to-use-engagement-units) |
| 2026-06-03 | **Stripe Connect KYC gap:** block Checkout until `charges_enabled`; tiers editable during KYC with a banner; subscribe button disabled with "Subscriptions open soon". (Live Stripe wiring still pending as of the decision.) | Simplest, no partial state. Revisit waitlist post-beta. | [Topic 10](planning-decisions.md#topic-10--stripe-connect-kyc-gap-fan-subs-onboarding-ux) |
| 2026-09-11 | **Makefile:** guard unavailable Make targets with an explicit error. | Contributors hit confusing errors on targets whose directories do not exist. | [Topic 15](planning-decisions.md#topic-15--makefile-guards-for-missing-directories) |
| 2026-09-11 | **No `stream-flac` to listeners yet.** Channel and rotation templates emit a 320 kbps AAC rendition; the worker writes `master.m3u8` with AAC + `stream-mp3-192` so hls.js picks per listener. | FLAC in MPEG-TS is unplayable in mainstream browser MSE. True lossless needs a pinned Liquidsoap upgrade plus hls.js and Safari tests. | [STREAM-011 worklog](worklogs/2026-09-11-stream-011-hls-spike.md) |
| - | **Tahti Radio meta-stream: no multistream to YouTube/Twitch. Mixcloud only.** | Both will copyright-strike a stream containing third-party music regardless of artist consent. | [AGENT.md](AGENT.md) (Tahti Radio, anti-patterns) |
| - | **Opus 256 streams to listeners; FLAC is for Studio-tier downloads** on tracks the user owns. | Cost, not principle. Revisit at M14 review if listener feedback warrants it. | [AGENT.md](AGENT.md) (anti-patterns) |
| 2026-10-05 | **Import-provider Configure lifecycle:** host-rendered modal in Tahti Player (not an SDK hook). Connection test returns `{ ok: true } \| { ok: false, error }` and blocks Save on failure. Save and Enable are separate. | One configuration surface; no silently enabled unverified provider. | [AGENTS.md](../AGENTS.md), tahti-player `docs/DECISIONS.md` |

## Listening parties

From [`technical/listening-parties.md`](technical/listening-parties.md) (shipped 2026-10-28, #1029).

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Own `ListeningParty` model (schema `channel`), not `ScheduledLiveShow` + `releaseId` | A scheduled show needs a `LiveShowSeries`; a party belongs to a release. |
| 2026-10-28 | No server playout. The server owns the timeline, clients play the tracks themselves and seek to the offset | Shared timing and late join without a Liquidsoap container per party. Playout into the channel's HLS is a later project. |
| 2026-10-28 | State is derived, never stored | `canceledAt` → `CANCELED`; `now < startAt` → `SCHEDULED`; `now < startAt + Σ durationSec` → `LIVE`; else `ENDED`. Nothing can go stale when a track is re-timed. |
| 2026-10-28 | Tracks play once in `ReleaseTrack.position` order, no gaps | Intervals are half-open: at an exact boundary the next track plays at offset 0; at `endAt` the party has ended. |
| 2026-10-28 | Pre-release tracks stream only through the party | A release that is not `PUBLISHED`, or whose `releaseDate` is ahead, streams only from the party stream route, only while `LIVE`, and only for the current or an earlier track. |
| 2026-10-28 | Reuse the artist's `PurchaseTier`s | Active tiers, only while the channel's store is on and (with Stripe on) the artist can take charges. Checkout stays on `POST /api/v1/u/:username/purchase-tiers/:tierId/checkout`. |
| 2026-10-28 | Reuse the host channel's chat | Moderation, bans and announcements already exist there. |
| 2026-10-28 | Names via `safeDisplayName` | Host and channel names fall back to the username. Credits whose name contains an email address are dropped. |

## Still open

Not decided yet. Options and trade-offs are in [`planning-decisions.md`](planning-decisions.md).

| Topic | Question | Note |
| --- | --- | --- |
| 1 | Liquidsoap → MinIO: how HLS segments reach object storage | Marked `DECIDED` in the topic header, but the decision block is empty. |
| 2 | Liquidsoap RAM budget and "always-on" scaling | |
| 3 | Beta timeline | |
| 6 | Browser live: WebRTC bridge | |
| 7 | Multistream to YouTube/Twitch: legal position (per-channel) | Needs legal input. |
| 12 | ISRC: Revelator vs IFPI Finland | |
| 13 | Postgres analytics partitioning | |
| 14 | Hetzner vs Finnish colo | [`hosting-budget.md`](hosting-budget.md) has a working assumption (start on Hetzner HEL1, colo in Y2), to be updated at the founding board meeting. |
