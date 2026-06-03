# Tahti — open planning decisions

This document captures every unresolved architectural, legal, and product decision that must be answered before the corresponding milestone can be implemented. Work through these in order — early decisions unblock later ones.

Each topic has a **Decision** field. Leave it blank until resolved. Once filled, link to the relevant spec update (PR, doc edit, or AGENT.md change).

**Status key:**  `OPEN` · `DECIDED` · `DEFERRED` · `N/A`

---

## Topic 1 — Liquidsoap → MinIO: how do HLS segments reach object storage?

**Status:** `OPEN`  
**Blocks:** M3 (live ingress), the entire streaming architecture  
**Must decide before:** Phase 4 work begins

### Background

AGENT.md (M3) says Liquidsoap writes HLS segments to `hls_shared` — a Docker volume pinned to one Swarm node. `docs/technical/streaming-architecture.md` (written based on your direction) says segments must go to MinIO so any Caddy node can serve them. These are incompatible. Neither the spec nor Liquidsoap itself resolves this: **Liquidsoap 2.2 has no native S3/MinIO output.**

### Options

**A — Sidecar copier (local volume + mc mirror)**  
Liquidsoap writes to a local volume as today. A sidecar container (`mc mirror --watch`) syncs every new segment to MinIO continuously.  
- Pro: Zero changes to Liquidsoap config  
- Pro: Battle-tested pattern (used by many self-hosted radio stacks)  
- Con: ~1–3s additional latency per segment (copy lag)  
- Con: Adds a sidecar container per channel  
- Con: Local volume still exists; partial scaling benefit  

**B — SRS (Simple Realtime Server) for HLS packaging**  
Liquidsoap handles audio mixing, fallback, and quality tee. SRS (or MediaMTX) receives the audio output via RTMP and packages HLS directly to S3/MinIO.  
- Pro: Clean separation — Liquidsoap does audio, SRS does HLS  
- Pro: SRS has native S3 HLS output  
- Con: Adds SRS as a new technology in the stack  
- Con: Liquidsoap→SRS audio path adds latency  
- Con: SRS licensing and docs less mature than Liquidsoap  

**C — NFS/shared storage mount across Swarm nodes**  
Mount the HLS volume via NFS so all Caddy and worker nodes see the same filesystem.  
- Pro: Simple — no code change  
- Con: NFS is a single point of failure  
- Con: NFS performance under high segment write rate is poor  
- Con: Contradicts the "no shared state" principle  

**D — Nginx + Lua: serve from local volume, replicate async**  
Caddy routes HLS requests to the Liquidsoap node directly; MinIO is only for long-term archive. Horizontal Caddy scaling is deferred to Y3.  
- Pro: Simplest for Y1 (200 artists, 1 node)  
- Con: Does not scale; requires rework at Y3  
- Con: Single Caddy node is a bottleneck and SPOF  

### Decision

```
Chosen option:
Rationale:
Spec updates needed:
Owner:
Date decided:
```

---

## Topic 2 — Liquidsoap RAM budget and "always-on" scaling model

**Status:** `OPEN`  
**Blocks:** Hardware procurement, container sizing, Phase 4 Liquidsoap design  
**Must decide before:** Hardware ordered and Phase 4 begins

### Background

The spec says "one perpetual Liquidsoap container per channel." At 200 artists × ~200MB RAM = ~40GB RAM for Liquidsoap alone. Current hardware plan (Phase 3) is 2 worker nodes × 8GB = 16GB total, which is insufficient. The "always-on" promise means the archive must keep playing even when the artist is offline — this is what justifies perpetual containers. But most containers spend 99% of their time in archive fallback mode.

### Options

**A — Perpetual containers, larger nodes**  
Stick with always-on. Upgrade nodes to 16–32GB RAM each. At 200 artists × 200MB = 40GB; 2 nodes × 24GB covers it with headroom.  
- Pro: Simplest — no startup delay ever  
- Pro: Consistent with "always on" brand promise  
- Con: ~€200–400/month additional hardware/hosting cost  
- Con: Wastes RAM on channels nobody is listening to  

**B — On-demand: spin up Liquidsoap when a listener arrives**  
Liquidsoap starts on first request, returns to a pool or terminates after 30min of zero listeners.  
- Pro: ~10× lower RAM footprint  
- Pro: Scales to thousands of channels on the same hardware  
- Con: First listener experiences 3–5s startup delay ("cold start")  
- Con: If channel is in archive fallback, that delay is visible as silence  
- Con: Complicates the orchestrator significantly  

**C — Hybrid: perpetual for paying members, on-demand for free tier**  
Paying members (€40/year) get a perpetual Liquidsoap. Free accounts spin up on demand.  
- Pro: Aligns cost with revenue tier  
- Pro: "Always on" is a paid feature differentiator  
- Con: Creates two-tier "always on" experience, may feel unfair  
- Con: Free tier gets silence on cold start — bad first impression for listeners  

**D — Single shared Liquidsoap instance, channel multiplexing**  
One Liquidsoap process manages N channels via harbor inputs and multiple outputs.  
- Pro: Single process, minimal RAM  
- Con: One crash kills all channels  
- Con: Liquidsoap multiplexing at scale is complex and untested at this size  
- Con: Breaks the isolation principle  

### Decision

```
Chosen option:
RAM per node (min/target):
Hosting provider for nodes (Hetzner AX52 €68/mo vs own colo):
Rationale:
Spec updates needed (AGENT.md principle #9, hosting-budget.md):
Owner:
Date decided:
```

---

## Topic 3 — Beta timeline: what ships by June 15?

**Status:** `OPEN`  
**Blocks:** Recruiting beta artists, grant applications, Director hiring  
**Must decide before:** Development schedule is set

### Background

The current Gantt (overview.md) shows Phase 4 (M0–M5) running April 1 – June 15, with closed beta from June 15. Today is May 31. That leaves 15 days. M0–M5 realistically takes 8–10 weeks for a solo developer. Something must be cut or the date must move.

### Milestone content recap

| Milestone | Content | Est. weeks |
|-----------|---------|-----------|
| M0 | Monorepo skeleton, CI, Prisma schema, /health, /source | 1w |
| M1 | Artist signup, email verify, membership payment | 1.5w |
| M2 | Channel + archive upload, transcode pipeline | 2w |
| M3 | Live RTMP/Icecast ingress, Liquidsoap orchestrator, HLS output | 3–4w |
| M4 | Auto-archive of live sets | 1w |
| M5 | Live chat (Centrifugo), pinned announcements, reactions | 1w |

Total: ~10–11 weeks from a cold start.

### Options

**A — June 15: M0 + M1 only (registration beta)**  
Artists can sign up, verify email, see an empty dashboard. No broadcasting, no audio yet. Useful for collecting member data and testing email flows.  
- Pro: Achievable by June 15  
- Con: Not a broadcasting product — artists can't do anything meaningful  
- Con: Hard to test the core value proposition  

**B — August 1: M0–M4 (broadcasting beta, no chat)**  
Artists can broadcast via OBS or Mixxx, archive auto-saves, listeners can tune in. No live chat. Sufficient for testing the core loop.  
- Pro: Core value proposition is testable  
- Pro: Chat absence is understandable in a beta context  
- Con: Pushes public beta to September+  

**C — September 1: M0–M5 (full MVP beta)**  
Everything including chat. Matches the original public beta target.  
- Pro: Full experience from day one  
- Con: No beta artists until September  

**D — Rolling beta: invite 5 artists at M0+M1, expand as milestones ship**  
Start technical alpha at M0+M1 with hand-picked artists who understand they're seeing early work. Expand at each milestone.  
- Pro: Real-world feedback from day 1  
- Pro: No artificial deadline pressure  
- Con: Risk of disappointing early invitees with an incomplete product  

### Decision

```
Chosen option:
New beta open date:
New public beta date:
Milestones in scope for initial beta:
Spec updates needed (overview.md Gantt, roadmap-and-plan.md):
Owner:
Date decided:
```

---

## Topic 4 — Auth library: Lucia (deprecated) vs better-auth vs next-auth

**Status:** `DECIDED` (custom session + argon2 — see decision log)  
**Blocks:** M1 (artist accounts)  
**Must decide before:** M1 development begins

### Background

AGENT.md specifies `Lucia + argon2` for authentication. Lucia's author (pilcrowonpaper) announced in late 2024 that Lucia is in maintenance-only mode and recommends migrating to **better-auth**, which is the spiritual successor. Starting a new project on Lucia in 2026 means being on a deprecated library from day one.

### Options

**A — better-auth**  
Direct successor to Lucia. TypeScript-first, Prisma adapter available, supports email/password + OAuth (Google, Apple), session management, email verification built in.  
- Pro: Actively developed (the recommended successor)  
- Pro: Prisma adapter works out of the box  
- Pro: Built-in: email verification, password reset, 2FA  
- Con: Newer — less StackOverflow answers than next-auth  

**B — next-auth v5 (Auth.js)**  
Battle-tested, huge community, first-class Next.js integration.  
- Pro: Extremely well documented  
- Pro: First-class App Router support  
- Con: Prisma adapter has historically been laggy to update  
- Con: More configuration for custom flows (email verify, rate limiting)  

**C — Custom JWT + argon2 (no framework)**  
Roll sessions manually: argon2 for password hashing, JWT or opaque tokens for sessions, all custom endpoints.  
- Pro: Full control, no framework churn risk  
- Con: Must implement: email verify, password reset, rate limiting, session invalidation — all from scratch  
- Con: Security surface is larger  

**D — Keep Lucia (maintenance mode)**  
Lucia is stable enough for a Y1 product. It will continue to work.  
- Pro: Spec doesn't change  
- Con: No active security patches  
- Con: Will need migration anyway in Y2  

### Decision

```
Chosen option:
Rationale:
Spec updates needed (AGENT.md tech stack):
Owner:
Date decided:
```

---

## Topic 5 — Upload resumability: tus vs S3 multipart

**Status:** `DECIDED` (option A, S3 multipart — see decision log)  
**Blocks:** M2 (archive uploads)  
**Must decide before:** M2 development begins

### Background

AGENT.md M2 says "resumable upload (tus)" for archive material. However, MinIO does not support tus natively — it requires running `tusd` as a separate service, which then writes to MinIO via S3. Alternatively, S3 multipart upload (natively supported by MinIO) provides equivalent resumability: the browser uploads in 5MB parts, and an interrupted upload can resume from the last confirmed part.

### Options

**A — S3 multipart upload (recommended)**  
Browser uses AWS SDK or `@aws-sdk/client-s3` to upload directly to MinIO in 5MB parts via presigned part URLs. Upload state tracked server-side in Postgres.  
- Pro: No extra service (no tusd)  
- Pro: MinIO natively supports this  
- Pro: Works with any S3-compatible storage (portable)  
- Con: Client-side code is more complex than tus  
- Con: Browser SDK adds ~80KB to bundle (can tree-shake)  

**B — tus via tusd**  
Run `tusd` as a sidecar service. It accepts tus protocol from the browser and writes to MinIO via S3.  
- Pro: Simple client library (tus-js-client is well maintained)  
- Pro: Automatic resume, chunk size auto-negotiation  
- Con: Extra service to run, configure, and monitor  
- Con: Another point of failure in the upload path  

**C — Simple single presigned PUT (no resumability)**  
For files ≤ 500MB (95% of cases), a single presigned PUT is fine. If it fails, the user re-uploads.  
- Pro: Simplest implementation  
- Con: A 500MB upload on a 10Mbps connection takes ~7 minutes — a failure means starting over  
- Con: Poor UX for DJ sets (often 300–500MB)  

### Decision

```
Chosen option:
Max part size:
Upload state tracking (Postgres table or Redis?):
Spec updates needed (AGENT.md M2):
Owner:
Date decided:
```

---

## Topic 6 — Browser live: WebRTC bridge technology

**Status:** `OPEN`  
**Blocks:** M3 (live ingress, browser Go Live path)  
**Must decide before:** M3 design is finalized

### Background

M3 spec says "browser-based Go Live: WebRTC → SRT → Liquidsoap harbor." This requires a WebRTC-to-SRT bridge. Options range from Janus Gateway (complex C service) to WHIP (Liquidsoap 2.3 native support) to simply deferring browser live until post-MVP.

OBS covers ~70% of DJ/artist workflows. Mixxx + Icecast covers another 20%. Browser live (no install) serves primarily the remaining 10% — but that 10% includes listeners at venues and artists without a desktop setup.

### Options

**A — Skip for MVP, add post-beta (recommended for timeline)**  
Remove browser live from M3. OBS + Mixxx + butt cover the beta cohort. Add it in M3b using WHIP once Liquidsoap 2.3 is stable.  
- Pro: Removes the most complex component from MVP  
- Pro: WHIP in Liquidsoap 2.3 is the cleanest long-term solution  
- Con: Artists without OBS cannot broadcast in beta  
- Con: Delays the "no install needed" story  

**B — WHIP (WebRTC HTTP Ingestion Protocol)**  
Liquidsoap 2.3+ supports WHIP natively. The browser's `RTCPeerConnection` sends directly to a Liquidsoap WHIP endpoint — no bridge service needed.  
- Pro: Native Liquidsoap support — no extra service  
- Pro: Standard protocol (RFC draft), supported by OBS 31+, browsers  
- Con: Liquidsoap 2.3 is not yet stable (as of May 2026 — check current status)  
- Con: May need to run Liquidsoap from a nightly build  

**C — Janus Gateway**  
Janus handles WebRTC signaling and media, forwards via RTP/RTSP to Liquidsoap.  
- Pro: Battle-tested WebRTC server  
- Con: Large C service, complex deployment and config  
- Con: Adds a new technology with a steep learning curve  

**D — MediaMTX (formerly rtsp-simple-server)**  
Lightweight Go service that accepts WebRTC (WHIP) and forwards to RTMP. More modern than Janus.  
- Pro: Small single binary, easy Docker deployment  
- Pro: Supports WHIP input → RTMP output → existing nginx-rtmp path  
- Con: Less widely tested than Janus for large-scale WebRTC  

### Decision

```
Chosen option:
If deferred: target milestone for browser live:
If WHIP: Liquidsoap version to use:
Spec updates needed (AGENT.md M3):
Owner:
Date decided:
```

---

## Topic 7 — Multistream to YouTube/Twitch: legal position

**Status:** `OPEN`  
**Blocks:** M6 (multistream out)  
**Must decide before:** M6 design begins

### Background

M6 allows per-channel RTMP push to YouTube Live, Twitch, Facebook Live, Mixcloud Live, and custom destinations. The Tahti Radio doc explicitly bans YouTube/Twitch for the meta-stream because "You will get copyright-struck within weeks."

The same copyright risk applies to per-channel multistream via Tahti infrastructure: the RTMP connection originates from Tahti's IP (via Liquidsoap). If an artist plays a commercially licensed track, the DMCA strike lands on Tahti's YouTube/Twitch account credentials — or worse, YouTube identifies the originating IP and begins throttling all outbound connections from that IP.

The artist-side legality is separate: the artist bears responsibility for their own YouTube/Twitch account. But Tahti's infra acting as the relay may not be protected.

### Options

**A — Mixcloud only (same as Tahti Radio — legally clean)**  
Mixcloud has blanket DJ mix licenses. Only offer Mixcloud Live as a multistream destination. Remove YouTube/Twitch/Facebook entirely from M6.  
- Pro: Consistent with Tahti Radio policy  
- Pro: No copyright strike risk  
- Con: Artists who want to reach YouTube/Twitch audiences must use OBS multistream separately  

**B — Provide multistream credentials to artist, artist runs their own relay**  
Tahti provides the source audio stream credentials. The artist configures their own restream.io/OBS multistream to their personal YouTube/Twitch. Tahti's IP is never the origin of the multistream.  
- Pro: Zero liability for Tahti  
- Pro: Artist has full control  
- Con: Added complexity for the artist  
- Con: Not the "set-it-once, forget it" UX the spec promises  

**C — Allow YouTube/Twitch, require artist acknowledgment**  
Show a clear warning ("You are responsible for all copyright compliance on your destination platforms") and require explicit per-destination acknowledgment. Log the acknowledgment.  
- Pro: Maintains the feature  
- Con: Acknowledgment does not protect Tahti's infrastructure from strike consequences  
- Con: Legal opinion needed before proceeding  

**D — Legal opinion first, defer decision**  
Before building M6, get a written legal opinion on whether Tahti acting as an RTMP relay to YouTube/Twitch creates liability for the org under Finnish and EU copyright law.  
- Pro: Makes the decision on solid legal ground  
- Con: Delays M6  

### Decision

```
Chosen option:
If legal opinion needed: lawyer engaged? (Y/N):
Destinations in scope for M6:
Spec updates needed (AGENT.md M6):
Owner:
Date decided:
```

---

## Topic 8 — Grant formula: consolidate M9 spec to use engagement units

**Status:** `DECIDED` (engagement units; implemented in `packages/ledger`)  
**Blocks:** M9 (annual grant calculation)  
**Must decide before:** M9 development begins

### Background

There are two incompatible grant formulas in the codebase:

**AGENT.md M9** (original):
```
grant = (channel_listener_hours / total_eligible_listener_hours) × grant_pool
```

**docs/technical/phase-11.md** (updated per backlog item):
```
engagement_units = SUM(downloads.weight) + SUM(fan_sub_euros × 10)
grant = (artist_engagement_units / total_eligible_units) × grant_pool
```

The listener-hours formula is explicitly listed as an anti-pattern in AGENT.md ("v6: Treating listener-hours as still meaningful for grants. They are not."). But it hasn't been removed from M9. The first real grant payout using the wrong formula would be a serious error.

### Open sub-questions

1. **What is 1 fan-sub euro in units?** Currently: €1 = 10 units. Is this the right weight relative to downloads (weight=1 for free, weight=5 for paid)?
2. **Minimum engagement threshold?** Phase-11 removed the 10 listener-hour minimum from M9. Should there be a minimum unit threshold to qualify for grants?
3. **Cap per artist?** Should any single artist receive more than X% of the grant pool? (Director review catches this manually — should it also be a hard cap?)
4. **Unclaimed grants** (artist doesn't confirm payout within 30 days): roll to next year's pool — confirmed?

### Decision

```
Authoritative formula:
  engagement_units(A) = (free_downloads × 1) + (paid_downloads × 5)
                        + (fan_sub_euros_received × 1)
  grant(A) = (units(A) / total_eligible_units) × grant_pool
  grant_pool = annual_surplus − 10% operating reserve
  Minimum threshold to qualify: 5 engagement units (below → rolls to next year)
  Per-artist cap (%): none hard-coded (board review catches outliers); revisit if needed
  Unclaimed grant handling: GrantState.UNCLAIMED → rolls into next year's pool
  fan_sub weight (€1 = N units): €1 received = 1 unit (so €5/mo = 60 units/yr)
  Spec updates needed: AGENT.md M9 listener-hours formula is superseded; the
    engagement-unit formula in engagement-and-fansubs.md is authoritative.
Owner: Dev
Date decided: 2026-06-03
```

**Implementation note (2026-06-03):** M9 implemented in `packages/ledger`.
- `allocateGrants()` is a pure, deterministic largest-remainder (Hamilton)
  allocator — sums to the pool exactly (zero rounding drift), 10% reserve, 5-unit
  eligibility threshold. Unit-tested incl. the spec's worked example.
- `runAnnualGrantCalc(prisma, year)` reads the year's `MonthlyRollup` surpluses
  and counted `engagement.Download` weights per channel→artist, allocates, and
  writes `GrantDisbursement` rows + `GRANT_DISBURSEMENT`/`RESERVE_TRANSFER`
  ledger entries (append-only; refuses to re-run a finalized year).
- Fan-sub euros now contribute to units (M19 shipped): `computeEngagementUnits`
  sums `FanSubPayout.grossCents` per artist for the year (1 unit per euro) in
  addition to download weight. Listener-hours are **not** used.
- Surfaced via `POST /api/admin/grants/run/:year` (board), `GET
  /api/v1/transparency/grants/:year` (public, anonymized), `GET /api/me/grants`.
- Worker cron `annual-grant-calc` runs 03:00 on March 1 for the prior year.

---

## Topic 9 — Next.js subdomain routing: channel slugs as subdomains

**Status:** `DECIDED` (path-based for MVP — see decision log)  
**Blocks:** M3 (channel page at `slug.tahti.live`)  
**Must decide before:** web app scaffold begins

### Background

Caddy is configured to route `*.tahti.live` → `web:3000` with header `X-Tahti-Channel-Slug: {labels.0}`. But Next.js App Router has no built-in subdomain routing. The web app needs a `middleware.ts` that reads this header and rewrites the path.

Additionally: channel slugs as subdomains require wildcard TLS (`*.tahti.live`). Let's Encrypt wildcard certs require DNS challenge (not HTTP challenge), which means Caddy needs a DNS provider plugin. Traficom/Finnish registrars may not have a Caddy-compatible DNS challenge plugin.

### Options

**A — middleware.ts rewrites + wildcard TLS via Caddy DNS challenge**  
`middleware.ts` reads `X-Tahti-Channel-Slug` and rewrites to `/c/[slug]`. Caddy uses DNS-01 challenge via the registrar's API.  
- Need to verify: does the domain registrar support Caddy DNS plugins (Cloudflare DNS API, Route 53, or generic ACME DNS)?  
- Pro: Clean URL (`slug.tahti.live`)  
- Con: DNS challenge adds complexity and a dependency on the registrar's API  

**B — Path-based routing: `tahti.live/c/slug`**  
No subdomains. Channels live at `tahti.live/c/djname`. Simpler TLS (single cert), no DNS challenge needed.  
- Pro: Simplest implementation  
- Pro: Standard ACME HTTP challenge works  
- Con: Less memorable URL  
- Con: Doesn't match the spec's `slug.tahti.live` promise  

**C — Hybrid: `tahti.live/c/slug` in MVP, add subdomains post-beta**  
Ship with path-based routing. Add subdomain support as a later enhancement once the registrar DNS situation is confirmed.  
- Pro: Unblocks development  
- Pro: DNS challenge complexity deferred  
- Con: Beta artists get path-based URL, then URL changes after beta  

### Decision

```
Chosen option:
Registrar DNS plugin availability (checked? Y/N):
URL format for beta artists:
Spec updates needed (Caddyfile, web middleware.ts design):
Owner:
Date decided:
```

---

## Topic 10 — Stripe Connect KYC gap (fan-subs onboarding UX)

**Status:** `DECIDED` (A — block Checkout until `charges_enabled`)  
**Blocks:** M19 (fan-subscriptions)  
**Must decide before:** M19 UI design

### Background

M19 requires artists to complete Stripe Connect Express KYC (identity verification, bank account, tax forms) before receiving fan-sub payments. KYC takes 1–3 business days. During this window, an artist may have enabled fan-subs in the dashboard and shared their subscribe link, but the Stripe Checkout will fail because the destination account isn't approved.

### Questions

1. What does the artist see in the dashboard during the KYC window?
2. What does a listener see if they try to subscribe before KYC is complete?
3. Is there a "waitlist" mechanism — collect subscriber intent, charge when KYC clears?

### Options

**A — Block Checkout until KYC approved**  
"Support" button on channel is grayed out / shows "Coming soon" until Stripe confirms `charges_enabled = true`.  
- Pro: Simplest — no partial state to manage  
- Con: An artist may share their subscribe link before KYC completes, then listeners hit a dead end  

**B — Queue subscriptions, charge when KYC completes**  
Collect subscriber email + intent (no card yet). When KYC clears, email subscribers to complete payment.  
- Pro: No lost subscribers  
- Con: Complex state management; re-engagement email required  

**C — Email capture only during KYC window**  
"Support this artist — get notified when subscriptions open" — email capture, no payment. Stripe Checkout not offered until KYC clear.  
- Pro: Simple, honest  
- Pro: Builds the artist's newsletter list as a side effect  
- Con: Not an actual subscription — subscriber may not return  

### Decision

```
Chosen option: A — block Checkout until Stripe reports charges_enabled = true
Dashboard state during KYC: tiers editable, but a banner "Finish Stripe
  onboarding to start receiving payments"; subscribe link shows the same.
Listener-facing message during KYC: subscribe page renders tiers but the
  Subscribe button is disabled with "Subscriptions open soon".
Spec updates needed (AGENT.md M19, phase-11.md): note A; revisit waitlist (C) post-beta.
Owner: Dev
Date decided: 2026-06-03
```

**Implementation note (2026-06-03):** M19 core shipped without the live Stripe
boundary, so the KYC gate is not yet enforced in code. The subscribe endpoint
already fails closed: when Stripe is configured it returns `501` until Checkout
is wired (no silent free subscriptions), and when it is not configured (dev/test)
it activates directly. Wiring real Connect Express + the `charges_enabled` gate
(option A) is part of the remaining Stripe integration.

---

## Topic 11 — AGM/voting: Finnish yhdistys law compliance

**Status:** `DECIDED` (advisory voting for Y1 — see decision log)  
**Blocks:** M10 (member governance UI), Bylaws finalization  
**Must decide before:** M10 design AND bylaws are filed with PRH

### Background

M10 proposes asynchronous 14-day online voting for AGM resolutions. Finnish association law (yhdistyslaki, §17) requires that votes at the annual general meeting happen at the meeting itself (physical or video). Asynchronous pre-meeting voting is only valid if explicitly authorized in the bylaws.

If the bylaws filed with PRH don't explicitly authorize electronic asynchronous voting, M10's voting feature cannot be used for legally binding AGM decisions. It could only be used for advisory polls.

### Questions

1. Does the bylaws draft (docs/governance-and-legal.md) currently authorize electronic asynchronous voting?
2. If not, can it be added before PRH filing?
3. What is the fallback if async voting can't be authorized — live video AGM with real-time voting?

### Options

**A — Add explicit electronic voting authorization to bylaws**  
Add a clause: "The board may convene an annual general meeting electronically and permit asynchronous voting via the platform for a period not exceeding 14 days."  
- Pro: Makes M10 fully legally valid  
- Pro: Forward-looking  
- Con: Requires lawyer review of the clause  

**B — M10 is advisory only; binding votes happen at live AGM**  
The dashboard voting UI is used for pre-AGM sentiment surveys and informal motions. Binding votes happen at a live AGM (video call). Results recorded manually.  
- Pro: No legal risk  
- Con: Requires organizing a live AGM — harder to get quorum  
- Con: Reduces the utility of M10 significantly  

**C — Defer the legal question, build M10 as advisory, upgrade later**  
Ship M10 as advisory voting. After bylaws are filed and year 1 is running, propose a bylaws amendment at the first AGM to authorize electronic voting.  
- Pro: Unblocks M10 development  
- Con: Members using M10 in Y1 must understand it's advisory only  

### Decision

```
Chosen option: C — ship M10 voting as ADVISORY for Y1; upgrade to binding after a
  bylaws amendment authorizes electronic asynchronous voting.
Bylaws clause status (exists? lawyer reviewed?): not yet — flagged for legal review
M10 legal status for Y1 (binding / advisory): ADVISORY
Spec updates needed (AGENT.md M10, governance-and-legal.md): note advisory status;
  motions carry an `advisory` flag (default true) in the data model.
Owner: Dev / Board
Date decided: 2026-06-03
```

**Implementation note (2026-06-03):** M10 motions/voting built with this in mind.
Each `Motion` has an `advisory` boolean (default `true`). Results are surfaced as
advisory tallies; binding AGM decisions still require a live meeting until the
bylaws clause lands. Once Option A's clause is filed with PRH, set new motions'
`advisory = false`.

---

## Topic 12 — ISRC: Revelator auto-allocation vs IFPI Finland membership

**Status:** `OPEN`  
**Blocks:** M7 (distribution: Mixcloud + Revelator)  
**Must decide before:** M7 development begins (minor — easy to fix)

### Background

AGENT.md M7 says "ISRC allocated for you via IFPI Finland membership." Getting IFPI Finland membership requires the organization to have an active music publishing presence — which Tahti won't have in Year 1. This creates a chicken-and-egg problem.

Revelator, however, automatically allocates ISRCs as part of the submission flow. No separate membership is needed.

### Options

**A — Use Revelator's ISRC allocation (remove IFPI requirement)**  
Revelator handles ISRC allocation automatically. Remove IFPI Finland membership from the spec entirely.  
- Pro: No external dependency  
- Pro: Revelator is already in the stack  
- Con: ISRCs are tied to Revelator's account — if Tahti leaves Revelator, ISRCs must be transferred  

**B — Apply for IFPI Finland in Y2 when publishing history exists**  
Revelator for Y1. Apply for IFPI Finland membership in Y2 to get direct ISRC authority. Update the spec to reflect the two-phase approach.  
- Pro: Best long-term outcome  
- Pro: Doesn't block M7  
- Con: Minor complexity (two different ISRC sources in Y1 vs Y2)  

### Decision

```
Chosen option:
ISRC source for Y1:
Spec updates needed (AGENT.md M7):
Owner:
Date decided:
```

---

## Topic 13 — Postgres analytics schema: time-series partitioning from day 1

**Status:** `OPEN`  
**Blocks:** M0 (Prisma schema definition)  
**Must decide before:** M0 schema is written

### Background

The `analytics` schema will accumulate events continuously: listener-hours, downloads, engagement units, newsletter opens. At Y3 scale (4,000 artists, millions of events per day), unpartitioned tables cause full-table scans on aggregation queries. Partitioning is painful to add to an existing populated table — it's much cheaper to design it in at M0.

Prisma doesn't support declarative table partitioning — it must be done via raw SQL migrations (`prisma/migrations/XXXX_init/migration.sql`).

### Questions

1. Which tables need partitioning from day 1?
2. Partition by month (simpler) or by week (more granular, more partitions)?

### Proposed partition plan

| Table | Partition key | Partition by |
|-------|--------------|-------------|
| `analytics.ListenerHour` | `bucket` (hour-truncated timestamp) | Month |
| `engagement.Download` | `countedAt` | Month |
| `analytics.SmartLinkClick` | `clickedAt` | Month |
| `analytics.EmbedPlay` | `playedAt` | Month |

### Decision

```
Tables to partition at M0:
Partition granularity (month/week):
Partition management (manual vs pg_partman cron):
Spec updates needed (AGENT.md data model, M0 migration):
Owner:
Date decided:
```

---

## Topic 14 — Hetzner vs Finnish colo: grant narrative timing

**Status:** `OPEN`  
**Blocks:** Hardware procurement, infra costs  
**Must decide before:** First server is ordered

### Background

`docs/hosting-budget.md` recommends starting on Hetzner HEL1 (cheaper, no capex) and migrating to Finnish colo in Y2 when grant funding covers the capex. But:

- Koneen Säätiö and Suomen Kulttuurirahasto specifically value "Finnish infrastructure" as part of the digital sovereignty narrative
- Grant applications may be reviewed as early as Q4 2026
- If Tahti is running on German-owned Hetzner when the grant application is reviewed, the "Finnish nonprofit on Finnish infrastructure" story weakens

### Questions

1. When is the earliest grant application deadline (Koneen Säätiö spring round? SKR autumn round?)
2. Does "Finnish colocation" require Finnish-owned hardware, or just that the servers are physically in Finland?
3. Is Hetzner's Helsinki data center (HEL1, Finnish soil, German-owned company) sufficient for the grant narrative?

### Options

**A — Hetzner HEL1 until Y2 grant covers colo capex**  
Save ~€5,600/year in Y1. Accept the weaker grant narrative. Migrate to Finnish colo in Y2.  

**B — Finnish colo from day 1 (bootstrap or grant-funded)**  
Accept €6,000 upfront capex + €8,460/year opex. Apply for grants with a clean "all-Finnish infrastructure" story.  
- Requires: founder can front the €6,000 capex, or grant covers it  

**C — Hetzner HEL1 + Finnish colo for one key service**  
Run the marketing site and a Postgres node on Finnish colo to make the statement. Worker nodes on Hetzner. Hybrid.  

### Decision

```
Chosen option:
Grant application deadline (Koneen Säätiö / SKR):
Hetzner HEL1 acceptable for grant narrative (Y/N):
Colo capex source (founder / grant / deferred):
Spec updates needed (hosting-budget.md, infra-strategy.md):
Owner:
Date decided:
```

---

## Topic 15 — Makefile: guards for missing directories

**Status:** `OPEN`  
**Blocks:** Developer experience from Phase 4 onward  
**Must decide before:** Phase 4 branch is shared with collaborators

### Background

`make build` and `make push` reference `api/`, `web/`, `worker/`, `orchestrator/` — none of which exist yet. Running `make build` on the Phase 1–3 branch produces errors. This is confusing for contributors who check out main.

### Options

**A — Add existence guards to Makefile**  
Each build target checks if the directory exists before running `docker build`. If not, prints "not yet implemented" and exits gracefully.  

**B — Phased Makefile (Makefile.phase1, Makefile)**  
Keep separate Makefile per phase. `main` Makefile only includes targets that are currently buildable.  

**C — Accept it until M0 creates the directories**  
The problem self-resolves at M0. Document it in `README.md` as "some Make targets are future targets."  

### Decision

```
Chosen option:
Owner:
Date decided:
```

---

## Decision log

Record decisions here as they are made, in date order.

| # | Topic | Decision summary | Date | Owner |
|---|-------|-----------------|------|-------|
| 4 | Auth library | Custom session + argon2 (Lucia not adopted). Implemented in `apps/api/src/lib/session.ts` + `password.ts`. | 2026-06-03 | Dev |
| 5 | Upload resumability | **A** — S3 multipart via presigned part URLs (no tusd). Implemented in `routes/uploads/*`. | 2026-06-03 | Dev |
| 9 | Subdomain routing | **B/C** — path-based `/c/<slug>` for MVP; subdomains deferred. | 2026-06-03 | Dev |
| 11 | AGM voting legality | **C** — M10 voting is **advisory** for Y1; `Motion.advisory` flag; upgrade after bylaws amendment. | 2026-06-03 | Dev / Board |
| 8 | Grant formula | **Engagement units** (downloads ×1/×5 + fan-sub €×1), 10% reserve, 5-unit floor; implemented in `packages/ledger`. Listener-hours dropped. | 2026-06-03 | Dev |
| 10 | Stripe Connect KYC gap | **A** — block Checkout until `charges_enabled`; tiers editable during KYC with a banner. (Live Stripe wiring still pending.) | 2026-06-03 | Dev |

> Topics 4, 5, and 9 are marked retroactively from the shipped MVP code — they
> were decided implicitly by implementation and are recorded here for the audit
> trail. Remaining `OPEN` topics (1, 2, 3, 6, 7, 12–15) still need explicit
> resolution before their milestones.

---

## How to use this document

1. Work through topics 1–3 first — they block all Phase 4 work.
2. For each topic: fill the **Decision** block, then update the referenced spec files.
3. When a decision is made, change **Status** from `OPEN` to `DECIDED` and add a row to the decision log.
4. If a topic becomes irrelevant, mark it `N/A` with a one-line explanation.
5. Commit this file with every decision update — it's the audit trail for why things were built the way they were.
