# Turn channel setup into a multi-step wizard

Status: open, not started.

## Request

User attached a reference screenshot: a "Time to setup your radio
station" wizard, "STEP 1 OF 5", collecting station name + logo (drag-
drop upload, 2MB max png/jpg) + description (10–300 chars) before a
"Continue" button. Ask: when a user hasn't set up their channel yet,
the existing "Setup" button should take them to a wizard like this,
instead of whatever exists today.

## The "Setup" button already exists — the destination is the gap

CTAs to `/dashboard/setup-channel` already exist in three places:
`apps/web/src/app/dashboard/page.tsx` (~line 287),
`apps/web/src/app/dashboard/_dashboard-overview.tsx` (~line 107, shown
when `!channel`), and `apps/web/src/app/dashboard/_studio-header-actions.tsx`
(~line 84). **Nothing needs to change about how a user reaches setup** —
the gap is what's currently at that destination.

## Current `/dashboard/setup-channel` is a single-click blind provision, not a wizard

`apps/web/src/app/dashboard/setup-channel/page.tsx` is a static feature-
highlight page (three feature blurbs) with one CTA
(`_setup-channel-client.tsx` → `SetupChannelClient`) that calls
`provisionChannel()` (`setup-channel-actions.ts`) — a bare
`POST /api/me/channel/provision` with **no request body at all**. The
API (`apps/api/src/routes/me/channel-provision.ts`, tested in
`channel-provision.test.ts`) creates the channel using the user's
existing account `displayName` as the channel name and no logo/bio —
all of that gets filled in afterward in the channel editor
(`/dashboard/channel/edit`).

So today: click "Setup" → channel is silently created with defaults →
land in the full channel editor to fill in everything. The requested
change: click "Setup" → walk through a short wizard (name, logo,
description, ... — screenshot shows 5 steps total, only step 1 shown)
→ _then_ the channel is created with that info already in place.

## What building this actually involves

- Replace (or precede) the current one-button `setup-channel` page with
  a real multi-step form — needs a stepper/wizard UI pattern; check
  whether one already exists elsewhere in `packages/ui` before building
  a new one (e.g. the audio editor or upload flow may have a similar
  paged pattern worth reusing).
- `provisionChannel()`/`POST /api/me/channel/provision` currently takes
  no fields — needs extending to accept `displayName`/name override,
  and either accept a logo upload inline or create the channel first
  then immediately PATCH the logo (existing channel-editor upload
  plumbing likely already handles logo upload — reuse that endpoint
  rather than building a second one).
- Only step 1 of the reference wizard was shown (name/logo/description)
  — the remaining 4 steps' content is unknown. Needs the user to specify
  what belongs on steps 2–5 (genre? social links? streaming setup?
  something else) before the full flow can be built — building only
  step 1 and dropping the user straight into the existing editor after
  is a reasonable smaller first slice if the rest isn't decided yet.

## Step 2, from a second reference screenshot

A second screenshot (same reference product, but labeled "STEP 2 OF
**3**" — inconsistent with the first screenshot's "STEP 1 OF **5**",
flag this discrepancy back to the user before locking a step count)
shows: a genre search-and-select field (autocomplete dropdown, e.g.
"Blues, Country Blues, Dubstep, etc."), selected genres as removable
chips capped at 5 ("2 genre(s) selected"), and a segmented toggle
"Your station is an... Online Station / Online and AM/FM station".

User's instruction: **drop the Online/AM-FM broadcast-type toggle** —
not relevant to Tahti — **and ask instead whether the user wants to
list the channel in public listings/directories.**

**Correction to an earlier pass of this doc:** it previously said no
channel-level genre field/picker exists — that was wrong, found on a
second look:

- **A channel-level genre picker already exists and should be reused
  as-is** ("use the same picker as we have in profile page" — user
  confirmed this is the one meant): `apps/web/src/app/dashboard/channel-identity-panel.tsx`
  (~line 407) renders a "Genres" `StudioCollapse` section — a checkbox
  grid over the shared `SOUND_GENRES` list
  (`packages/shared/src/dto/sound-metadata.ts`, the same fixed genre
  taxonomy used for per-track genre tagging — one taxonomy, not two),
  capped at `MAX_GENRES = 6` (screenshot showed a cap of 5 — confirm
  with the user which number is right, or whether 6 stays since it's
  already shipped), CSS classes `signup-genre-grid`/`signup-genre-chip`.
  Channel genres are persisted inside `socialLinksJson` under a
  `genres` key (`_channel-editor-data.ts` / `updateChannelProfile`,
  `parseSocialLinksGenres`) — not a real column, but already wired
  end-to-end and working.
- **This exact component is already used in an onboarding wizard once
  before**: `apps/web/src/app/signup/profile/profile-form.tsx` uses the
  same `SOUND_GENRES` grid during account signup — direct precedent for
  reusing it in the setup-channel wizard too, so step 2 is largely
  "reuse `ChannelIdentityPanel`'s genre section (or extract it if it's
  too coupled to the rest of that panel to drop in standalone)," not
  new UI.
- On "use storybook components for these": there is no real Storybook
  in this repo (checked before, see [[loading-indicators-playables]])
  — read as "use the existing shared `@tahti/ui` components/patterns"
  (`Panel`, `StudioCollapse`, etc., the same primitives
  `channel-identity-panel.tsx` already uses), not literally Storybook.
- **"List in public listings" has no existing flag to bind to either.**
  Checked for `isPublic`/`isListed`/directory-style booleans on
  `Channel` — none exist. The closest existing thing is
  `apps/web/src/app/dashboard/discovery-settings-panel.tsx` /
  `/dashboard/settings/discovery` (`topListsOptOut`, an opt-_out_ of
  top-lists ranking specifically) — related territory, but not the
  same as a general "show this channel in public directory listings"
  toggle. Needs a decision: is this a new field, or should it reuse/
  extend the existing discovery opt-out semantics (inverted)?

## Step 3: the existing channel editor — no new build needed

User attached a Discord profile-customization screenshot (sidebar of
grouped setting sections — Nameplate, Avatar & Decoration, Banner
Color, Profile Effect & Frame — beside a live preview pane) as the
layout reference for this step, and said step 3 should be "the channel
editor."

This already exists and already matches that layout:
`apps/web/src/app/dashboard/channel/edit/page.tsx` →
`ChannelEditorSections` (`apps/web/src/app/dashboard/channel/_channel-editor-sections.tsx`,
own comment: "Full-page channel customization studio — one focused
section at a time, live preview beside it") + `ChannelLivePreview`
(`_channel-live-preview.tsx`). Step 3 of the wizard is just routing
into this existing page/flow, not building a new one.

## Step 4: 24/7 rotation — enable, with a no-tracks guard, or the playlist editor

User's ask: enabling 24/7 rotation should check whether the user has
any tracks uploaded first. If not, show a notice instead of enabling.
If they do, show the channel playlist editor so they can build the
rotation.

Both halves already exist, just not wired together:

- **24/7 rotation is the existing "fallback" toggle**:
  `apps/web/src/app/dashboard/channel-controls-panel.tsx`'s
  `toggleChannel()` (~line 188) flips `programme.fallbackEnabled` via
  `PATCH /api/me/channel/programme`
  (`apps/api/src/routes/me/programme.ts`). **No guard exists today,
  client or server** — checked `programme.ts` for any track-count
  validation before allowing `fallbackEnabled: true`; none found. This
  is a real, current gap independent of the wizard — worth fixing at
  the source (the API route) rather than only in the new wizard step,
  so the existing `channel-controls-panel.tsx` toggle also gets
  protected.
- **The "channel playlist editor" is `/dashboard/channel/playlist`**
  (`apps/web/src/app/dashboard/channel/playlist/page.tsx`, built on
  `RotationEditor` from `apps/web/src/app/dashboard/schedule/_rotation-editor.tsx`)
  — step 4 routes here once there's at least one track, same reuse
  pattern as step 3.
- Needs: a track-count check (count of the channel's `READY` `Sound`
  rows) surfaced both as the wizard's gate and as a proper guard on the
  API route itself.

## Open: what's step 5?

Only 4 steps have content now (identity, genres + listing, channel
editor, rotation/playlist) against a claimed 5-step reference. Asked
the user directly — no answer yet in this pass. A natural candidate
given Tahti's own positioning (`setup-channel/page.tsx`'s existing
"Broadcast studio" blurb: "RTMP and Icecast credentials, live preview,
and a weekly hour to go live on the free tier") would be a broadcast-
setup / "go live" step — but this is a suggestion, not confirmed.
