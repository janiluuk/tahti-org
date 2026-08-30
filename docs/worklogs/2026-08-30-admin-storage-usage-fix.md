# Admin storage usage showing 0B fixed (2026-08-30)

## Scope

Fixed a reported bug: Admin → Storage's total-used figure and per-user usage
list read 0B for real accounts with real uploads (a live user with many
uploaded tracks showed no usage anywhere). Found while wiring a related
tahti-web client change (a per-file "revisions" count in the admin files
browser) that touched the same area.

## Root cause

`UserStorageQuota.usedBytes` — the field `GET /api/admin/storage` was reading
— is a cached counter from an abandoned hard-cap storage model. The functions
meant to keep it in sync on upload/delete, `recordUsageDelta` and
`hasRoomFor` (`apps/api/src/lib/storage-quota.ts`), are unused: nothing in the
API calls either of them. `GET /api/me/storage` was already migrated months
ago to the current model (`docs/storage-policy.md`: no hard caps, usage
computed live from `ArchiveItem`/`StashFile`, quota is `User.softTargetBytes`)
via `computeUserStorageUsedBytes`, but the admin overview route was never
updated to match, so it kept reading a counter that always reads 0 (or
whatever stale value a row happened to have, for the users who ever got one).

## Fix

- Added `computeAllUsersStorageUsedBytes` (`apps/api/src/lib/user-storage.ts`)
  — the same live computation as `computeUserStorageUsedBytes`, but for every
  user in 3 grouped queries total (archive bytes grouped by `channelId` then
  remapped to `userId`, stash bytes grouped by `userId` directly), rather than
  one query pair per user.
- `GET /api/admin/storage` now uses that, and reads quota from
  `User.softTargetBytes` instead of the disused `UserStorageQuota.quotaBytes`.
  Users with zero usage are filtered out of the per-user list (matches the
  client's existing "no usage recorded" empty-state framing) and no longer
  inflate the total-quota figure.
- `PATCH /api/admin/storage/users/:id/quota` (the admin quota-override
  action) now writes `User.softTargetBytes` and returns live usage, instead
  of silently writing to a table nothing reads any more.
- `UserStorageQuota` itself and `recordUsageDelta`/`hasRoomFor` were left in
  place, untouched — this fix stops the admin route from reading a stale
  field, it doesn't remove the (also unused) legacy table/functions, which is
  a separate cleanup call if the model is confirmed permanently retired.

## Also, unrelated but adjacent

`GET /api/admin/files` now returns a real `revisionCount` per file
(`ArchiveItemVersion` count via `_count.versions`), requested by the
tahti-web admin file-detail modal. Added to `AdminFileRowSchema` in
`@tahti/shared`.

## Validation

Ran against a real disposable Postgres (`docker run postgres:16-alpine` +
`prisma db push --accept-data-loss`), not mocked:

- `apps/api/src/routes/admin/storage.test.ts` — 12/12 (3 existing tests
  updated: they asserted the old dead-code `UserStorageQuota` path, now
  seed real `ArchiveItem`/`StashFile` rows and assert against
  `User.softTargetBytes`)
- `apps/api/src/lib/user-storage.test.ts` — 3/3 (existing 2 unchanged, added
  1 new test for `computeAllUsersStorageUsedBytes`)
- `apps/api/src/routes/admin/files.test.ts` — 5/5 (existing 4 unchanged,
  added 1 new assertion for `revisionCount`)
- `pnpm --filter api typecheck` and `pnpm --filter api lint` clean
- `openapi.json`/`openapi.public.json` regenerated — no path-level change
  (the export only tracks paths, not full response-body shapes), so nothing
  to commit there

Not deployed/verified against production data from this session — the
reporting user's real account wasn't reachable from this environment; the
fix was verified by reproducing the same class of bug against fresh
disposable-DB fixtures (upload real files, confirm usage is 0 with the old
code path, confirm it's correct with the new one) rather than the original
account directly.
