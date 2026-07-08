# Governance/voting end-to-end test (2026-07-08)

## What was tested

A new realistic-scale test (`apps/api/src/routes/governance/governance-e2e.test.ts`)
exercises the member-governance system end-to-end: 10 member accounts + 1 board
account, three motions on plausible feature/policy topics, varied vote outcomes
(a clear pass, a clear fail, an exact tie), the full propose → open → vote →
close → tally lifecycle, and the manual bridge from a closed motion's tally to
the public transparency page.

Complements the existing `motions.test.ts` (narrow boundary conditions with a
3-voter fixture) rather than replacing it — kept as a permanent addition to the
suite since it covers realistic multi-voter tally accuracy that nothing else did.

**Result: 8/8 passing.** Tally math was exact in every case (7/2/1, 3/6/1, 5/5/1
including a board vote, 6/2/2, 8/2/0) — `computeTally` in
`apps/api/src/routes/governance/index.ts` is correct.

## Scope note: "members propose" vs. the actual design

The request was to have "member accounts... propose features and other stuff
that members can vote on." As built, `POST /api/v1/governance/motions` is
`requireBoard`-gated in both the API and the UI (`NewMotionForm` only renders
for `me.isBoard`) — **ordinary members cannot propose a motion**, only vote on
ones a board account has already opened. The test asserts this boundary
explicitly (a member gets 403) rather than routing around it. Whether this is
the intended design (board curates the agenda) or a real gap is a product
decision, not something fixed here — flagged below.

## Gaps found, by disposition

**Fixed in this pass** (safe, unambiguous, no design-intent question):

- **Misleading vote-change copy.** `motion-card.tsx` showed *"✓ You voted ·
  change before close"* once a member had voted — but there is no vote-update
  endpoint; a second vote attempt returns `409`. Changed the copy to show the
  actual choice cast and state plainly that votes can't be changed.
- **No cross-validation between a `BoardResolution`'s `outcome` and its vote
  counts.** A board admin could previously record `outcome: PASSED` with
  `voteFor: 0, voteAgainst: 100` and it would save and publish as-is. Added
  `outcomeMatchesVotes()` (`packages/shared/src/dto/admin-resolutions.ts`),
  enforced both at create time (Zod `.refine`) and at PATCH time (route-level
  check against the stored counts, since vote counts aren't patchable but
  `outcome` alone is) — `apps/api/src/routes/admin/resolutions.ts`.

**Built same-day, see the 2026-07-08 addendum below:**

- ~~No discussion/comment feature.~~ Built — see "Discussion threads" addendum.

**Flagged, not fixed — each is a scope/product decision:**
- **Closed motion tallies don't automatically reach the public transparency
  page.** `Motion`/`Vote` (member-facing, `requireMember`-gated) and
  `BoardResolution` (public, the `/transparency` page's data source) are
  entirely separate models with no code linking them. Closing a motion reveals
  its tally only to members; getting a result onto `/transparency` requires a
  board member to manually re-type title/body/outcome/vote counts into a
  second, disconnected form. The test demonstrates both states explicitly (an
  un-bridged motion is absent from the public page; a manually-bridged one
  appears correctly with exact counts). Per `docs/planning-decisions.md` Topic
  11, Y1 voting is advisory-only (Finnish yhdistyslaki §17 requires live-meeting
  AGM votes absent bylaws authorizing async voting) — it's plausible this
  separation is deliberate (advisory member motions vs. legally-binding board
  resolutions are different things and shouldn't be conflated on the public
  page), but that's a call for whoever owns governance, not an engineering
  default.
- **No auto-close or quorum.** A motion past `closeAt` while still `OPEN`
  silently stops accepting votes (`409`) but the tally stays hidden until a
  board member manually `PATCH`es to `CLOSED` — there's no scheduled job.
  Separately, any single vote produces a valid outcome; nothing requires a
  minimum turnout. Both are policy questions (what quorum? who runs the close
  job and when?) rather than bugs.
- **`isMember` boolean vs. `Membership.status` enum.** Route guards
  (`requireMember`) check only the denormalized `User.isMember` boolean, never
  `Membership.status`. In the current codebase the two are kept in sync
  centrally (`membership.ts`), so this is likely fine in practice, but there's
  no route-level defense if a future code path forgot to flip both — worth a
  boundary test if this area gets touched again, not changed here.
- **Client-only motion reference IDs** (`M-2026-03` shown in `motions-list.tsx`)
  are computed per-render from sort order, not returned by the API or stored —
  cosmetic, not a correctness issue.

## Verification

`tsc --noEmit` clean (api/web/shared); full suite 200 files / 811 tests passing,
no regressions; `eslint` + `prettier --check` clean; `apps/web` production build
succeeds.

## Addendum, same day: discussion threads

Built the discussion/comment thread flagged above. Design mirrors the closest
existing pattern in the codebase, `SupportTicketNote` (flat chronological list,
`body: String`, nullable `authorId` with `onDelete: SetNull` so a deleted
account doesn't delete their comments, single `@@index([motionId, createdAt])`,
no edit/soft-delete).

**Model**: `MotionComment` (schema `governance`, alongside `Motion`/`Vote`).

**API**: `GET/POST /api/v1/governance/motions/:id/comments`, both
`requireMember`. Posting is allowed through `DRAFT` and `OPEN` (discussion
continues alongside voting, not just during circulation) and blocked once
`CLOSED` (`409`, mirrors the vote-after-close rule) — existing comments stay
readable after close, since the discussion record should persist. Rate-limited
30/hour/IP (`apps/api/src/plugins/rate-limit.ts`). `commentCount` added to
`MotionSummarySchema` so the list view can show a count with no extra fetch.

**UI**: no motion detail route exists (everything renders inline as cards on
one list page), so this is an expandable section inside `MotionCard`
(`DiscussionThread` sub-component) rather than a new page. Comments for every
motion are fetched server-side in `page.tsx` alongside motions/members —
governance data volume is small (capped at 100 motions, realistically a
handful open at once), so this was simpler than inventing a client-side
authenticated fetch-on-expand pattern.

**Real bug found and fixed while building this**: `MotionSummarySchema` (the
list response) never actually returned a `tally` field — only the per-motion
detail endpoint did, and the `/governance` page has no per-motion detail fetch.
Every closed motion on the page was silently showing "0 for · 0 against · 0
abstained" regardless of the real vote outcome. Fixed by computing tally in the
list route too (now fetches full vote rows for every motion, not just the
caller's own vote, and derives `youVoted`/`yourChoice`/`tally` from one query).
Caught and locked in with a test asserting the list endpoint carries the same
tally as the detail endpoint.

**Second bug found and fixed via live browser testing** (Playwright against a
seeded local account, not just `vitest`/`app.inject`): posting a comment
visibly collapsed the discussion thread you were actively typing in. Root
cause — `postMotionComment`'s `revalidatePath('/governance')` call was
remounting `DiscussionThread`, resetting its `open` state, even though
`page.tsx`'s fetches are already `cache: 'no-store'` and have no Data Cache for
`revalidatePath` to usefully invalidate; its only real effect was a disruptive
Router Cache refresh of the page the user was actively on. Fixed by dropping
`revalidatePath` from that one action (kept on `castVote`/`transitionMotion`,
which don't have this problem) and having the action return the created
comment so the client can append it optimistically instead.

Verified live in a browser as both a board and a non-board member account
(seeded locally, not production) — comment posting, ordering, attribution, and
the closed-motion read-only state all confirmed visually correct after the fix.

New tests added to `governance-e2e.test.ts`: posting during DRAFT/OPEN,
blocked after CLOSE with existing comments still readable, a non-member gets
401 on both routes, and the list-endpoint tally fix. Full suite: 200 files /
813 tests, no regressions.
