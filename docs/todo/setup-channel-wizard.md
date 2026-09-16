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
