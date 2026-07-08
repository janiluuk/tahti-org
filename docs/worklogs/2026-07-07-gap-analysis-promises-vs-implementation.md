# Gap analysis: implementation docs vs. website promises vs. actual code (2026-07-07)

Requested: read through the implementation/planning docs, compare against what the
website promises publicly, and produce a worklog of what's missing or needs
improvement. Method: two research passes (planning-doc inventory, website-promise
inventory) cross-referenced against `docs/project-roadmap.md` — the repo's own
maintained build audit — plus direct verification of the handful of items where
the roadmap's claimed status looked surprising or where two public sources
disagreed with each other.

**Headline finding, before the details: the platform is far more complete than a
worklog request like this usually turns up.** `docs/project-roadmap.md` tracks
M0–M31 plus ~100 PLAT-/SEC-/UX-/PERF- backlog items, and the overwhelming majority
are marked done and verify as done. The genuine gaps are a short, specific list
(below), not a broad "half the roadmap is unbuilt" situation. The more interesting
findings from this pass are **inconsistencies between what's promised in different
public places** — which is a trust/credibility risk for a transparency-first
nonprofit even where the underlying feature is fully built — and **one place where
the roadmap doc itself under-reports real progress.**

## 1. Public promises contradict each other (highest priority — fix before anyone reads both pages)

`apps/web` (the actual Next.js app: homepage, `/for-artists`, `/about`,
`/how-it-works`, `/transparency`, help pages) and `website/index.html` (a
**separate, standalone static marketing page**, not part of the Next.js app, with
its own OG tags/meta) disagree on at least four concrete numbers:

| Claim | `apps/web` says | `website/index.html` says | Which is real? |
|---|---|---|---|
| Fan-subscription price range | €3–€10/month | €1–€100/month | Verify against `packages/shared` fan-tier validation bounds and fix whichever page is wrong |
| Operating reserve target | 6 months of costs (CONSTITUTION.md, `/about`, `/how-it-works`) | 3 months (`/transparency/methodology`) | Code implements the 90/10 split correctly (`packages/ledger/src/allocate.ts:43`, `reservePct = 0.1`) — the "months of runway" figure is a **board policy statement, not a code-enforced cap**, so this is a pure prose inconsistency. `transparency/methodology/page.tsx` is the one that needs correcting to match the constitution's "6 months," since the constitution is the higher-authority document per its own text ("if a future director... reads only one file... this is the one that matters") |
| Distribution/release fee | Not stated as a flat number in the app | "€3–5 per release" (`transparency/methodology`) vs **"€8/release"** (`website/index.html`) — these two contradict each other even within the same claim category | Pick one number and use it everywhere; check `apps/api/src/routes/me/revelator.ts` / `distribution-integrations.ts` for what's actually charged |
| Pricing tier structure | Exactly two tiers: Free and €40/yr membership | A **third "Studio" tier** with FLAC downloads, custom domain, press kit, 12 releases/yr included — this tier doesn't exist anywhere in the live app | `website/index.html` is describing a pricing model that was apparently retired (the app's own `financial-model.md` v7 changelog says *"One membership (€40/yr), Studio dropped"*) but the static marketing page was never updated to match |

**Root cause**: `website/index.html` reads like an earlier, more elaborate draft of
the pitch that was never reconciled with the shipped product. It also describes
several real features more specifically than the app does (Stash 20GB quota, visual
customization presets, venue directory details) — those parts are accurate, just
not numerically consistent on money. Per `.cursor/rules/website-off-limits.mdc`,
`website/` isn't touched without being asked — flagging this here rather than
editing it.

## 2. Roadmap under-reports real progress: Google Drive cloud import

`docs/project-roadmap.md`'s "Cloud drive import" section (PLAT-080 through
PLAT-083) marks all four items `[ ]` — not started. Verified directly against the
code:

```
apps/web/src/app/dashboard/upload/import/google-drive/_google-drive-connect.tsx
apps/web/src/app/dashboard/upload/import/google-drive/_google-drive-picker.tsx
apps/web/src/app/dashboard/upload/import/google-drive/page.tsx
apps/api/src/routes/me/google-drive.ts
apps/worker/src/jobs/cloud-import-google-drive.ts
```

This is a complete, working pipeline — OAuth connect UI, Google Picker integration,
a real worker job that streams the file server-side straight into MinIO and
enqueues a transcode (confirmed earlier this session as *"the only fully working
'download real audio into Tahti' pipeline"* among all the import integrations,
ahead of SoundCloud and Bandcamp which are genuinely still stubs), plus encrypted
token storage and a disconnect route. **Fixed in `project-roadmap.md`**:
PLAT-080 (core import) and PLAT-083 (token security) → `[x]`; PLAT-082 (import job
UX) → `[~]` partial — a status-pill progress UI exists, but no audit-log entry per
import was found; PLAT-081 (the generic `CloudImportProvider` abstraction for a
second provider like Dropbox) is legitimately still open — only Google Drive is
implemented, the same bespoke-per-provider pattern as Mixcloud/Bandcamp/SoundCloud.

## 3. Genuinely open items (verified directly, not just roadmap-status)

Pulled from `project-roadmap.md`'s own tracked backlog, then re-checked against
the live code rather than trusted at face value:

### Security (highest severity of anything in this list)
- **SEC-007 — Centrifugo publish-proxy has no signature verification.**
  Confirmed: `apps/api/src/routes/chat/message.ts` parses and trusts the proxy
  request body with no check that the caller is actually Centrifugo (no shared
  secret, no signature header check). Impact is bounded — hitting this endpoint
  directly doesn't let an attacker publish a chat message (Centrifugo itself still
  gates the actual WebSocket publish), but it's an unauthenticated endpoint that
  performs DB lookups and captcha-verification logic on arbitrary input. Worth
  closing before public beta, matching the roadmap's own P2 rating.
- **SEC-008 — No HSTS or baseline CSP header on `app.tahti.live`/`api.tahti.live`.**
  Confirmed: no `Strict-Transport-Security` or `Content-Security-Policy` in the
  Caddy config. Cheap to add, meaningful defense-in-depth for a platform handling
  session cookies and payment flows.
- **SEC-010 — No session revocation on login.** Confirmed: `apps/api/src/routes/auth/login.ts`
  doesn't invalidate other active sessions on a fresh login. Lower severity (P3 per
  roadmap) but relevant if an account is ever compromised — the legitimate owner
  regaining access via password reset wouldn't kick out an attacker's existing
  session.

### UX debt (tracked, not regressions)
- ~~**UX-005**~~ — **Stale by the time this was written.** This item claimed ~15
  files still used hand-typed `studio-btn-*` classes, but that migration had
  already shipped in `d7acdc1` (2026-07-01, six days before this worklog) — 17
  call sites moved to `ui-btn`, all `studio-btn-*` CSS deleted. Caught and
  corrected 2026-07-09 when picking this up as the "next worklog item" turned up
  zero remaining `studio-btn` references anywhere in `apps/web/src`.
- ~~**UX-006**~~ — **Fixed 2026-07-08**, unlike UX-005 this one really was still
  open. Confirmed real (unlike UX-005), then fixed: `Panel` now wraps Mixcloud,
  Tahti Radio, moderators (+ the chat-bans sibling in the same file family,
  same code smell), and the overview's "Recent broadcasts" section — all four
  used to render bare hand-typed card classes instead of the shared wrapper.
  Overview's other two sub-sections were already correctly using
  `StudioCollapse`, a distinct-but-valid wrapper for collapsible content — the
  original worklog wording overstated the overview gap slightly. Verified live
  in a browser (Playwright, seeded local account) on all four settings/overview
  pages before and after; orphaned CSS (`studio-panel-section`,
  `studio-section-heading`, the old `tahti-radio-panel`/`db-recent-archive`
  outer-wrapper rules) deleted.
- **UX-007** — Missing form labels + empty states on fan-tier creator,
  announcements, moderators add-form.

### Performance (tracked, moderate priority)
- **PERF-005** — Funnel/egress stats still use `findMany` + JS-side bucketing
  instead of SQL aggregation. Matters more as the download/listener volume grows.
- **PERF-006** — Dashboard fetches broadcast/catalog payloads even on
  overview-only page visits (no tab-lazy loading).
- **PERF-007** — Visual preset picker renders a live WebGL preview for every
  preset thumbnail instead of just the selected one.
- **PERF-008** — Releases/stash/newsletter-drafts/programme-list endpoints aren't
  paginated yet.

### Content moderation — the one genuine product gap, not just tech debt
No `ContentReport`/`Flag`/takedown model exists anywhere in the schema. `ChatBan`
and `ChannelModerator` cover artist-side chat moderation only — there's no path for
a listener to report an upload, release, or profile for review, and nothing for
board/admin to triage such reports at scale. Today this has to route through
generic support tickets. Fine for a closed beta with a known cohort; **this is the
one item on this whole list I'd actually block public/open beta on**, since an
open platform accepting public uploads without any abuse-reporting surface is a
real trust-and-safety gap, not a polish item. Already correctly flagged in the
roadmap's "Improvements identified" table as unstarted, tagged for "M21 follow-up
(post-beta)" — worth reconsidering whether "post-beta" is the right sequencing
given open beta launches 1 August 2026.

### Infra/ops (already known, not new)
- **PLAT-053** — Tahti Radio → Mixcloud Live multistream blocked: no Liquidsoap
  `.liq` config for Tahti Radio exists in-repo (the radio service sends telnet
  commands to an external Liquidsoap process not tracked in version control).
- **M29** — pgBackRest point-in-time recovery still deferred (current backup is
  `pg_dump`-based with ~24h RPO, which the roadmap and `ops/RUNBOOK.md` are honest
  about).
- **M7 / M11 / M13** — partial states are all pure ops blockers (live Mixcloud app
  approval, live Revelator API key, live Upptime fork deploy, SES API transport if
  SMTP limits are hit) — no code work needed, just credentials/deployment actions.

## 4. Documentation hygiene (not a feature gap, but worth a five-minute fix)

`docs/project-roadmap.md`'s "Listener geography map (PLAT-061–065)" and "Audio
editor: remaining DSP (PLAT-066–069)" sections are each **duplicated verbatim
three times** in the file (lines ~609–619 / 632–642 / 655–665, and similarly for
the audio editor section) — looks like a copy-paste/merge artifact from editing
history. Harmless (both say `[x]` done consistently across all three copies, so
nothing is contradicted), but worth collapsing to one copy each so the doc doesn't
mislead a future reader into thinking there are six separate initiatives.

## 5. Milestone-numbering inconsistency (cosmetic, but confusing to a new reader)

Two unrelated things are both labeled "M21" across different docs: the admin panel
(`docs/technical/phase-12.md`'s actual M21 spec, confirmed shipped) and, separately,
`docs/audio-editor.md`/the PLAT-066-069 backlog entries refer to the pro audio
editor as "M21" too. Both are fully shipped, so this doesn't hide a gap — it's
purely a documentation cross-referencing error. Separately, the milestone sequence
jumps from M31 straight to an undocumented **M33** (`Channel.fallbackEnabled` — pull
a published release track into 24/7 rotation alongside archive sets, referenced
only in code: `apps/api/src/routes/me/programme.ts`,
`apps/worker/src/lib/archive-fallback-cache.test.ts`) with no M32 anywhere and no
spec doc for M33 at all. The feature itself works; it's just never been written up.

## 6. Recommendations, in priority order

1. **Reconcile `website/index.html` against the live app's numbers** (fan-sub
   range, reserve months, distribution fee, and the phantom Studio tier) — this is
   the single most visible risk, since a visitor comparing the pitch page against
   the actual app or transparency dashboard would find the org contradicting
   itself on money, which is a bad look specifically for a radical-transparency
   nonprofit.
2. **Close SEC-007 and SEC-008** before public beta (1 August 2026) — both are
   small, well-scoped fixes already sized correctly (P2) by the existing audit.
3. **Decide explicitly whether content moderation ships before or shortly after
   open beta** — currently slotted "post-beta," worth a deliberate board/director
   call given the launch date rather than letting it drift by default.
4. ~~Fix the roadmap's Google Drive status~~ — done as part of this pass (see §2).
5. Everything else on this list (UX-005/006/007, PERF-005/006/007/008, PLAT-053,
   M29 PITR) is real but lower-stakes — reasonable to pick up opportunistically
   rather than as a dedicated push.

## 7. Implementation pass (2026-07-07, same day)

Items 1 and 2 above are done. Item 3 (content moderation) is a scope decision,
not something to build unprompted — flagged separately for the user rather than
guessed at.

**Number reconciliation** — turned out to run the opposite direction from what
§1 assumed. Checked every contested figure against the actual enforced code
(`packages/shared/src/dto/fan-tier.ts`'s Zod bounds, `config.distribution` in
`apps/api/src/config.ts`, `packages/ledger/src/allocate.ts`) rather than trusting
either public page:

- Fan-sub price: the enforced range is **€1–€100/month** (`FanTierBodySchema`,
  100–10,000 cents). `website/index.html` had this right; it was the app's own
  pages (`for-artists`, `about`, `how-it-works`, `help/for-listeners`) that
  understated it as €3–€10 — fixed in all four.
- Distribution fee: the actual charge is **€8/release**
  (`DISTRIBUTION_FEE_CENTS` default 800) with a real **`STUDIO` tier** getting 12
  releases/year included (`studioIncludedPerYear`) — `website/index.html` had
  this right too. `transparency/methodology/page.tsx`'s "€3–5 per release" was
  the wrong number — fixed.
- Operating reserve: no code enforces a "months of runway" cap at all — this is
  pure board policy, never mechanically checked. Fixed
  `transparency/methodology/page.tsx`'s "3 months" to "6 months" to match
  `CONSTITUTION.md`, the higher-authority document.
- **`website/index.html` needed no edits** — every number checked against it
  turned out to be correct. Not touched, consistent with it being off-limits
  without being asked.
- **New finding, not fixed**: `STUDIO` is a real `ArtistTier` enum value with
  real billing logic, but no self-serve path exists anywhere to become a Studio
  member — `admin/users.ts` is the only place that sets it. The website markets
  it as if it's purchasable; the app doesn't even mention it exists. Whether to
  build self-serve Studio checkout or drop it from the pitch page is a product
  decision, not something fixed here.

**SEC-007** — Centrifugo's publish-proxy webhook (`/api/chat/message`) now sits
behind the same `isTrustedInternalRequest` check (private network or
`Bearer $INTERNAL_SECRET`) that already protects `/internal/*` — one line
extending the existing `onRequest` hook in `apps/api/src/server.ts`, since
Centrifugo always calls it over the internal Docker network anyway. Verified with
a new test asserting a public-IP request gets 403.

**SEC-008** — Added HSTS (enforcing) and a baseline CSP (**report-only**,
deliberately — this app embeds Stripe Checkout, Spotify/YouTube/Vimeo/Mixcloud
iframes, and a chat WebSocket, and an enforcing policy risks silently breaking
one of those without being able to verify against real production traffic;
promote to enforcing once collected reports confirm the allow-list is complete)
to `infra/Caddyfile` via a reusable `(security_headers)` snippet.

**Unplanned discoveries while validating the Caddy change** — running
`caddy validate`/`caddy fmt` against `infra/Caddyfile` surfaced that the file
would not have started at all as committed:

- `chat.tahti.live`'s two `@ws header ...` lines were two separate matcher
  *definitions* sharing one name, which Caddy rejects outright
  (`matcher is defined more than once: @ws`) — needed to be one matcher block
  with both header conditions. Same bug, same fix, also existed in
  `infra/Caddyfile.staging`.
- The custom-domain catch-all (`:443`, PLAT-051) had `tls { on_demand }` nested
  inside a `handle` block, which Caddy also rejects (`tls` isn't an ordered HTTP
  handler). Moved to the site-block level.
- `on_demand` TLS (used by both the `*.tahti.live` wildcard and the
  custom-domain catch-all) had no permission/`ask` module configured — Caddy
  refuses to enable on-demand TLS at all without one, to prevent cert-issuance
  abuse. Since none existed, **this means the committed Caddyfile has never
  actually been able to start**, which in turn means the custom-domain feature
  (PLAT-051, marked done in the roadmap) has likely never been deploy-tested
  end-to-end. Added `apps/api/src/routes/internal/tls-ask.ts` (a new
  `/internal/tls-ask` endpoint, protected by the same SEC-001 mechanism,
  validating the requested hostname is either a non-reserved `*.tahti.live` /
  `*.staging.tahti.live` label or a `Channel.customDomain` with
  `customDomainVerified: true`) and wired it via `on_demand_tls { ask ... }` in
  both `infra/Caddyfile` and `infra/Caddyfile.staging`.
- **`infra/Caddyfile` and `infra/docker-stack.yml` proxy to `api:3000`
  throughout (5 occurrences) — the API container actually listens on 3001**
  (`apps/api/Dockerfile`: `ENV PORT=3001` / `EXPOSE 3001`; `config.ts`'s own
  default; and the locally-verified `infra/docker-compose.stack.yml` explicitly
  sets `PORT: '3001'` / `API_URL: http://api:3001`). `infra/Caddyfile.staging`
  already had it right at 3001. This means, as committed, `api.tahti.live`
  would be unreachable (connection refused) and the `api` service's own
  Swarm healthcheck would never pass. Fixed all 5 references (2 in Caddyfile, 3
  in docker-stack.yml, one of which was a healthcheck that would have kept the
  service permanently marked unhealthy).

None of this affects the *actual* current production deployment — per prior
session context, live production runs on a Raspberry Pi 4 behind Nginx Proxy
Manager, a different topology entirely from `infra/docker-stack.yml` +
`infra/Caddyfile`, which represents the target Swarm/colo architecture for a
later migration. But as tracked, committed infrastructure-as-code that's
supposed to be ready when that migration happens, it was silently broken in
three independent ways, and would have failed immediately on first deploy
attempt. All four Caddyfiles/configs (`Caddyfile`, `Caddyfile.staging`,
`docker-stack.yml`, plus the new `tls-ask.ts`) now validate cleanly via
`caddy validate` and pass their respective test suites.

**Verification**: `tsc --noEmit` clean across api/web/shared; `caddy validate`
and `caddy fmt` clean on both Caddyfiles; new test suites for the SEC-007 hook
(4 tests) and the tls-ask endpoint (9 tests), all passing; full API/web/shared
suite (198 files, 793 tests) passing with no regressions; `prettier --check` and
`eslint` clean on every touched file.

## 8. Content moderation (minimal MVP, 2026-07-07)

Item 3 from §6 was a scope decision, not a fix — asked the user how to handle
it rather than guessing. Chosen: build a minimal version now.

Deliberately small, mirroring the existing `SupportTicket`/`admin/support`
pattern rather than introducing a new one:

- **`ContentReport` model** (`packages/db/prisma/schema.prisma`) —
  `targetType` (`ARCHIVE_ITEM`/`RELEASE`/`CHANNEL`/`COLLECTION`) + `targetId`,
  no FK (a report can reference any of four different tables), `reason`,
  optional `details`, `status` (`OPEN`/`REVIEWING`/`ACTIONED`/`DISMISSED`),
  `reporterIpHash` (same daily-rotating-salt pattern as `Download.byIpHash` —
  no tracking beyond what abuse-prevention needs).
- **`POST /api/v1/reports`** — no auth required, matching the platform's
  anonymous-by-default listener model (you can already listen, download, and
  chat with no account; reporting content shouldn't need one either).
  Rate-limited 5/hour/IP via the same plugin pattern as
  `/api/support/contact`.
- **`/admin/content-reports`** (board-only) — status-filtered queue with
  inline resolve actions (start review / mark actioned / dismiss + optional
  resolution note), reusing `admin-table`/`admin-filter-pills` styling. New
  sidebar nav entry.
- **`<ReportButton>`** (`apps/web/src/components/report-button.tsx`) — a
  small reusable component, wired onto the channel page (`/c/[slug]`,
  sidebar) and the public profile page (`/u/[username]`), reporting the
  channel by slug.

**Deliberately not built**: automated takedown. Resolving a report is a
manual admin action — the queue tracks the report and its outcome, but
actually removing content still goes through existing tools (artist
self-deletion, admin user suspension). Also not wired onto individual
release/archive-item/collection pages yet — the two highest-value surfaces
(channel, profile) are covered; extending the same `<ReportButton>` to more
surfaces is a small, mechanical follow-up.

**Verification**: schema pushed and validated; new test suite for the
report/admin routes (8 tests, all passing); `tsc --noEmit` clean across
api/web/shared; full `apps/web` production build succeeds with the new routes
present; full test suite re-run (199 files, 801 tests) with no regressions;
`eslint` and `prettier --check` clean on every touched file.
