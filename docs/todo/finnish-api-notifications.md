# Finnish API notification bodies

**Status:** blocked  
**Updated:** 2026-11-19  
**Sibling:** `../tahti-player/docs/todo/finnish-api-notifications.md`

## Goal

Store notification title/body in the recipient’s UI language (EN/FI). Bodies
are written in `packages/db/src/notifications.ts` (and a few API/worker
helpers) as English strings today.

## Blocker

Player language choice lives only in client `languageStore` — there is no
`User` locale / `uiLocale` column and no PATCH to persist it. Without a
server-side preference, the API cannot pick FI copy when creating rows.

## Next (when unblocked)

1. Add `User.uiLocale` (`en` | `fi` | null = auto/browser) + owner PATCH.
2. Player Language panel saves to the API (keep local store as cache).
3. Introduce `notificationCopy(locale, key, vars)` with EN+FI maps; migrate
   one template first (e.g. `THEME_UNDER_REVIEW`), then the rest.
4. Prefer storing localized text at create time (simpler clients); do not
   invent a second Finnish copy in tahti-web.
