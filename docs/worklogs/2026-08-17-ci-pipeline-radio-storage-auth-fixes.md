# CI pipeline, radio reliability, storage policy, and auth self-service (2026-08-17)

## Scope

Started from a red `main` CI pipeline (workflow_dispatch run 32027427297) and a
report that Tahti Radio was "down again." Chased both to real root causes
rather than surface fixes, then used the same session to close a few other
live reports (missing password-reset UX, a false storage-quota limit, no
watchdog for stuck broadcast channels).

## Finding: CI pipeline red — four separate bugs, chained fixes

1. **Prettier vs. the SDK generator fighting each other.** `packages/api-client/scripts/generate.mjs`
   ran raw `openapi-typescript` output (4-space/double-quote/semi) straight to
   disk, but the repo's prettier config (`singleQuote`, `semi: false`, 2-space)
   reformats the same file differently. Whichever step ran last in a commit
   made the *other* CI job (`format:check` vs. the SDK drift check) fail on
   the next run — a permanent tug-of-war neither side could win. Fixed by
   running `prettier --write` on `schema.d.ts` inside `generate.mjs` itself,
   so regeneration and formatting can never disagree again.
2. **API-token auth hook stealing internal service Bearer tokens.** The
   personal-API-token feature (`apps/api/src/plugins/auth.ts`) added a global
   preHandler that claimed *any* `Authorization: Bearer …` header and 401'd
   immediately on failed lookup — including internal service-to-service
   routes (webhooks, radio, programme) that use their own
   `Bearer <internalSecret>` convention on the same header. Fixed by scoping
   the hook to tokens with the `tahti_` prefix real API tokens use; other
   Bearer schemes now fall through to route-level auth untouched.
3. **`radio.test.ts` flaky against the shared `TAHTI_RADIO_SLUG` fixture.**
   Unlike the three journey specs that go through `createTahtiRadioChannel()`
   (which deletes any stale fixture user first), this file created its own
   `username: TAHTI_RADIO_SLUG` user directly — colliding on a unique
   constraint whenever a journey spec happened to run first in the same
   Postgres. Added the same stale-cleanup guard.
4. A trailing **unescaped apostrophe** (`react/no-unescaped-entities`) in new
   storage-panel copy briefly re-broke lint after an unrelated fix landed.

All four fixed and pushed as separate commits; CI is green and cutting
releases again (confirmed `2026-08-17-1` and later tags).

## Finding: "Radio is down" — it wasn't, the status API was lying

Checked directly on `vimage`: `tahti-channel-tahti-radio`'s Liquidsoap process
was actively writing fresh HLS segments the whole time (confirmed via
`docker exec` + segment mtimes). The repeating `input.http … 404` log lines
are benign — Liquidsoap's live-input harbor polling for a broadcaster on the
Icecast mount, correctly falling through to the archive/rotation fallback
when nobody's live.

The real bug: `GET /api/v1/radio` (`apps/api/src/routes/radio/index.ts`)
proxied to a `tahti-radio` microservice (`services/tahti-radio`,
`RADIO_URL=http://tahti-radio:3004`) that **was never deployed** — no
compose/stack entry, no container running or even stopped anywhere on
production. Every request hit the catch block and returned
`{live:false, channel:null}`, indistinguishable from the real "no artist
booked right now" state. The frontend radio widget reads exactly this field
to decide what to show, so it always looked offline.

**Fixed:** derive `live`/`channel` straight from `RadioSlotBooking` (a row
covering the current time means that artist is on air) instead of the
phantom service. No new deploy needed, no dependency on `services/tahti-radio`
at all.

## Finding: `/restart` (STREAM-005) existed but nothing ever called it

While making the radio pipeline more robust per request ("music never
stops"), found the orchestrator already exposes `POST /restart` specifically
for a stuck channel — but grepped the whole repo and found no caller. No cron,
no watchdog, nothing. A channel could sit silently stuck indefinitely with
only "container still running" to go on (this is exactly the class of bug
that caused the dockerd-crash incident referenced in `liquidsoap.ts`'s
comments).

**Fixed:** extended the existing 20s `now-playing-sync` poll loop (which
already telnets every active channel) rather than adding a separate timer:
- 3 consecutive telnet failures (~60s) → restart.
- Newest HLS segment older than 20s (should land every 4s) → restart.
- 2-minute per-channel cooldown to avoid a restart loop on a channel that's
  persistently broken for some other reason.
- Skips (logs a warning) rather than guessing if no active `Broadcast` row is
  found for the channel — a wrong template/broadcastId on respawn could break
  things worse than leaving it stuck.

## Finding: dashboard storage panel showed a false hard 500MB limit

A member reported seeing "500MB limit" despite being a paying member.
`docs/storage-policy.md` is explicit and bylaws-referenced: Tahti does not
enforce per-user storage limits, and the 500MB "soft target" is the same for
*every* tier — it was never designed to scale with membership.

But `/api/me/storage` read from a separate, legacy `UserStorageQuota` model
(`storage-quota.ts`'s `hasRoomFor`/`getOrCreateQuota` — confirmed unused by
every upload path, so nothing was actually being enforced), and the dashboard
panel's copy claimed "uploads may be rejected" and suggested "upgrading,"
neither of which exist anywhere in the code. That's what a member account saw
as a flat, unexplained cap regardless of tier.

**Fixed:** `/api/me/storage` now reads `User.softTargetBytes` +
live-computed usage (`computeUserStorageUsedBytes`), and the panel's copy
matches the policy doc's own "appreciative, not threatening" tone.

**Not fixed, flagged for follow-up:** `apps/api/src/routes/admin/storage.ts`
(board's admin storage overview + per-user quota override) still uses the
legacy `UserStorageQuota` model. Out of scope here since it's not
member-facing, but it should be reconciled with the same policy — right now
its data disagrees with what `/api/me/storage` reports for the same user.

## Added: resend-verification, forgot-password, reset-password

No forgot-password path existed anywhere (confirmed earlier this session) and
there was no way to resend a stuck verification email either. Built both,
reusing existing patterns rather than inventing new ones:

- `PasswordSetup` token model (already used for the one-time invite-setup
  flow) reused for password *reset* too, with its own 1-hour expiry
  (`passwordResetExpiresAt`, vs. the invite flow's 7 days — this one can take
  over an already-active account, so it needs a tighter window).
- Reset POST revokes all other sessions before logging the user back in,
  matching login's existing SEC-010 behavior.
- Both request endpoints (`/api/auth/resend-verification`,
  `/api/auth/forgot-password`) return a constant response regardless of
  whether the email matches an account — no enumeration.
- Frontend: login page offers a resend link when login fails with the
  "verify your email" error, plus a "Forgot password?" link; new
  `/forgot-password` and `/reset-password` pages mirror `/setup-password`'s
  existing structure; dashboard membership panel also gets a resend button
  for the `PENDING_EMAIL` case.

**Caveat flagged to the user, not yet resolved:** prod SMTP still routes to
Mailhog (per earlier session notes) — none of this reaches a real inbox in
production until that's fixed. User is mid-signup for Resend as the
replacement; SMTP_* values not yet wired into `stack.env`.

## Open finding: mobile dashboard sidebar doesn't collapse — NOT fixed

Reported: on mobile, the desktop sidebar (`StudioSidebar` /
`.db-sidebar`) takes the whole screen and hides the actual page content next
to it, specifically noticed on settings pages.

There IS a rule that should prevent this —
`brand-studio.css` has `@media (max-width: 768px) { .db-sidebar { display: none } .db-layout { grid-template-columns: 1fr } }`
— but the user confirms it's still showing full-screen in practice. Was
mid-investigation (checking for a later, more specific `.db-sidebar` rule
overriding it — there's also a `.admin-shell .db-sidebar` rule and a
non-media-query `.db-sidebar` rule earlier in the cascade that need checking
for specificity/order conflicts) when this got deprioritized for the worklog.
**Needs a follow-up session** — likely a real browser repro (mobile viewport,
real login) rather than more static CSS reading, since two rounds of that
didn't find the actual conflict.

## Still queued, not started this session

- Member badge for artist profiles on public-facing pages.
- hearthis.at real-audio import (scoped with the user to self-owned
  tracks/sets only, given the existing embed-only design was a deliberate
  ToS/rights choice) — not built yet.
- README feature-documentation audit (close the gap between what's documented
  and what the code actually does) — not started.
