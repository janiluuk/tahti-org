# Worklog — paid-member subdomain E2E + live-set scheduling polish

Date: 2026-06-19

## Goal

1. Verify, end-to-end, that a member artist's channel is reachable at their
   `<slug>.tahti.live` vanity URL (and, for members, an optional fully
   custom domain), with real test coverage backing it.
2. Verify the artist can manage channel programming (24/7 archive rotation)
   and schedule a live set, and that the "next live show" countdown renders
   directly next to the ordinary programming — both in the studio dashboard
   (while managing it) and on the public channel page (where listeners see
   it).

## Findings (current state before this work)

- `*.tahti.live` wildcard subdomain routing already works for **every**
  tier, not just members — `infra/Caddyfile:18-29` sets
  `X-Tahti-Channel-Slug`, `apps/web/src/middleware.ts:13-23` rewrites to
  `/c/[slug]`. No test coverage exists for this middleware.
- Fully custom domains (`artistname.com`, PLAT-051) **require membership**
  (`isUnlimitedLiveTier` check in
  `apps/api/src/routes/channels/custom-domain.ts:75`), resolved via
  `apps/web/src/middleware.ts:25-43` → `/api/v1/custom-domain/resolve`. This
  route file has **zero test coverage**.
- Channel programming (24/7 archive rotation) is fully built:
  `apps/api/src/routes/me/programme.ts` + `programme-panel.tsx`, tested in
  `programme.test.ts`.
- "Schedule a live set" already exists as a single next-broadcast field
  (`Channel.nextBroadcastAt` / `nextBroadcastNote`, LISTENER-002):
  `apps/api/src/routes/me/channel-schedule.ts` + `channel-schedule-panel.tsx`,
  tested in `channel-schedule.test.ts` (incl. "exposed on public channel").
- The countdown component (`apps/web/src/components/broadcast-countdown.tsx`)
  already renders on the public page, but it sits up near the artist
  bio/header (`page.tsx:237-242`), **not** next to the "Archive" section
  (`page.tsx:278`) which is the actual ordinary-programming list listeners
  see. It also never renders in the dashboard, so the artist can't preview
  it while editing programming.

## Plan

### Phase 1 — subdomain → channel flow, end to end, with coverage

1. `apps/api/src/routes/channels/custom-domain.test.ts` (new) — resolve
   (200/404), POST set (402 FREE / 200 paid / 409 dup / 409 `*.tahti.live`),
   POST verify (400 missing / 400 TXT mismatch via mocked `dns.resolveTxt` /
   200), DELETE clears fields.
2. `apps/web/src/middleware.test.ts` (new) — fast path rewrite on
   `X-Tahti-Channel-Slug`, slow path rewrite on `X-Tahti-Custom-Host` via
   mocked fetch, fall-through on API-unreachable and on 404.
3. Extend `tests/e2e/journeys/artist.sh` (running-stack smoke check) to
   assert the demo artist's tier/channel resolves correctly through the real
   API, covering the paid-membership → channel linkage that the unit tests
   above can't exercise against a live stack.
4. Run affected test suites; fix regressions.

### Phase 2 — programming management + live-set countdown placement

5. Reposition `BroadcastCountdown` on the public channel page
   (`apps/web/src/app/c/[slug]/page.tsx`) to render immediately above/next to
   the "Archive" section instead of near the bio header.
6. Add a compact live countdown preview to the studio dashboard's
   "Schedule & programme" collapse (`apps/web/src/app/dashboard/page.tsx`
   ~531-537), next to `ProgrammePanel`/`ChannelSchedulePanel`, so the artist
   sees what listeners will see while editing.
7. Confirm via existing + adjusted tests that setting/clearing
   `nextBroadcastAt` updates both placements consistently.
8. Typecheck/lint/test the touched packages (`apps/web`, `apps/api`).

## Phase 1 results

Ran end-to-end against a live local stack (postgres/redis/minio + `apps/api`
on :15011 + `apps/web` on :17777, seeded demo fixtures): the paid demo artist
(`tier: ARTIST`) resolves correctly through the simulated wildcard-subdomain
header to their channel page, content included. 11/11 e2e journey checks +
11 new API tests + 6 new middleware tests pass.

**Found and flagged (not fixed, out of scope for this feature):** an unknown
channel slug renders the not-found page body correctly but returns HTTP 200
instead of 404. Reproduces via a direct `/c/[slug]` hit too — no middleware
involved, and no `not-found.tsx` exists anywhere under `apps/web/src/app`.
This is a site-wide Next.js `notFound()` status-code issue, not specific to
subdomain routing. Worth a dedicated follow-up.

## Phase 2 results

- Public channel page: `BroadcastCountdown` and note-only fallback now render
  inside `ch-archive-section`, directly under the Archive heading (not near the
  artist bio).
- Studio dashboard: `ChannelSchedulePanel` shows a live **Listener preview**
  (compact countdown) as the artist edits date/note; hidden while the channel
  is LIVE.
- Shared component at `apps/web/src/components/broadcast-countdown.tsx` with
  `calcTimeLeft` unit tests; API schedule test extended to assert clear
  propagates to the public channel GET.

## Status

- [x] Investigation complete
- [x] Phase 1 (tests passing; one unrelated pre-existing bug flagged above)
- [x] Phase 2 — countdown moved above Archive on public channel; studio listener
      preview in Schedule & programme; `calcTimeLeft` unit tests + schedule clear
      API test extended
