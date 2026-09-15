# Branding section (avatar/backdrop crop + nameplate)

Status: **open** (implemented, tests green, not yet pushed/PR'd)

## What this is

New "Branding" panel under Settings → Account (`apps/web/src/app/dashboard/settings/account/branding-panel.tsx`),
shown whenever the account has a channel. It consolidates:

- **Avatar** — reuses the existing `/api/me/profile/avatar/*` upload pair.
- **Backdrop** — new wide banner photo behind the avatar. New `User.backdropUrl`
  column, new `/api/me/profile/backdrop/{prepare,complete}` routes
  (`apps/api/src/routes/me/avatar.ts`), same presign/upload/complete shape as
  avatar/logo. Static image only (JPEG/PNG/WebP) — deliberately separate from
  `Channel.videoBackgroundUrl`, which drives the public channel page's video/
  image header and supports video loops.
- **Nameplate** — new short text + hex color (`User.nameplateText`,
  `User.nameplateColor`), rendered as a colored pill next to the display name.
  Persisted through the existing `PATCH /api/me/profile` (extended
  `ProfilePatchSchema`/`ProfileFieldsSchema`).

The pan/zoom crop tool (previously `avatar-crop-modal.tsx`, avatar-only,
always circular/square) was generalized into
`apps/web/src/components/image-crop-modal.tsx` (`ImageCropModal`) with
`aspectRatio` and `shape` ('circle' | 'rect') props, so the same tool now
handles both the circular 1:1 avatar crop and the wide 3:1 rectangular
backdrop crop. `channel-identity-panel.tsx` (the only prior consumer) was
updated to the new import with unchanged behavior (defaults preserve the old
square/circle crop exactly).

`backdropUrl`/`nameplateText`/`nameplateColor` are also exposed on the public
profile API response (`PublicProfileArtistSchema`, `apps/api/src/routes/profile/public.ts`)
so the data is available, but **not yet wired into the actual public
`/u/[username]` page rendering** — see Follow-ups.

## Why

Requested directly: "make the nameplate as part of the branding section
under settings -> account -> branding" + "make sure the crop tool works like
in the screenshot for backdrop images and for avatar images" (reference:
Discord's own profile-branding editor — Nameplate / Avatar & Decoration /
Banner Color / Profile Effect, screenshots shared as `Archive.zip`). Also
closes a gap found while investigating that reference: the existing Channel
Designer backdrop upload skips a crop step entirely (client uploads the raw
file); this task's crop-modal generalization gives future backdrop-ish
uploads a reusable tool, though the Channel Designer's own video/image
backdrop upload itself was intentionally left untouched (see Follow-ups —
video can't be cropped by this canvas-based tool, and that upload is a
separate, more complex system from this new personal-profile backdrop).

## Files touched

- `packages/db/prisma/schema.prisma` + new migration
  `20260915120000_branding_backdrop_nameplate` — `User.backdropUrl`,
  `User.nameplateText`, `User.nameplateColor`.
- `packages/shared/src/dto/avatar-upload.ts` — `BackdropUploadPrepareSchema`/
  `CompleteSchema`/`CompleteResponseSchema`.
- `packages/shared/src/dto/profile.ts`, `packages/shared/src/dto/responses/profile.ts` —
  new fields on `ProfilePatchSchema`, `ProfileFieldsSchema`, `PublicProfileArtistSchema`.
- `apps/api/src/routes/me/avatar.ts` — new backdrop prepare/complete routes.
- `apps/api/src/routes/me/profile.ts`, `apps/api/src/routes/profile/public.ts` —
  select/serialize/patch the new fields.
- `apps/web/src/components/image-crop-modal.tsx` (renamed from
  `avatar-crop-modal.tsx`) — generalized `ImageCropModal`.
- `apps/web/src/app/dashboard/channel-identity-{panel,actions,utils}.tsx/ts` —
  updated import; `uploadBlob` now takes a `prepare` fn param (defaults to
  avatar) so it works for backdrop uploads too; new
  `prepareBackdropUpload`/`completeBackdropUpload` actions;
  `updateChannelProfile` patch type extended.
- `apps/web/src/app/dashboard/settings/account/branding-panel.tsx` (new),
  wired into `apps/web/src/app/dashboard/settings/account/page.tsx`.
- `packages/ui/src/styles/brand-studio.css` — renamed `.avatar-crop-*` →
  `.image-crop-*` (+ `--circle`/`--rect` viewport modifiers), new
  `.branding-panel*`/`.account-hero` adjacent rules.
- `apps/api/.eslintrc.json` — added `profile.test.ts`/`public.test.ts` to the
  existing `no-restricted-syntax` (raw-hex) override list, same pattern
  already used for `channel-look-extras.test.ts`.
- Tests: `apps/api/src/routes/me/profile.test.ts` (+2 cases),
  `apps/api/src/routes/me/avatar.test.ts` (+1 describe block, backdrop
  routes), `apps/api/src/routes/profile/public.test.ts` (+3 assertions).

## Verified

- `tsc --noEmit` clean for `@tahti/shared`, `@tahti/api`, `@tahti/web`.
- `eslint` clean on all touched files.
- `pnpm --filter @tahti/api-client generate` regenerates `schema.d.ts`
  cleanly (not committed — gitignored).
- Migration applied to local dev DB (`prisma migrate deploy`); 32 API tests
  pass (`profile.test.ts`, `avatar.test.ts`, `public.test.ts`).
- Not yet tested manually in a browser (no running web dev server in this
  session) — before merging, click through Settings → Account → Branding:
  upload + crop an avatar, upload + crop a backdrop, set + save a nameplate,
  confirm the live preview and a page reload both reflect the saved state.

## Follow-ups (not in this PR)

- Wire `backdropUrl`/`nameplateText`/`nameplateColor` into the actual public
  `/u/[username]` page hero. Today that page renders through the shared
  `ProfileHero`/`ProfileCover` components (`@tahti/ui`), which are a
  separate, multi-page-shared surface (also used by the channel page) — the
  `PageHero` component (a newer, still-unused-anywhere shared component,
  `packages/ui/src/brand/PageHero.tsx`) already has `backdropUrl` and
  `titleExtra` props that look purpose-built for exactly this, suggesting
  `PageHero` may be the intended eventual replacement for `ProfileHero`, but
  swapping that in is a separate, larger refactor outside this task's scope.
- The Channel Designer's own backdrop upload (`channel-header-panel.tsx` →
  `/api/me/channel/video-background/*`, `Channel.videoBackgroundUrl`) still
  has no crop step for its image-mode uploads. Not addressed here since it's
  entangled with the video-loop path and the broader visual-preset system;
  `ImageCropModal` is now reusable if someone picks this up.
