# Finnish API notification bodies

**Status:** partial  
**Updated:** 2026-11-19  
**Sibling:** `../tahti-player/docs/todo/finnish-api-notifications.md`

## Goal

Store notification title/body in the recipient’s UI language (EN/FI).

## Shipped

- `User.uiLocale` (`en` | `fi` | null) + migration
- `ProfilePatch` / GET profile expose `uiLocale`
- Player Language panel PATCHes `uiLocale`; hydrates from profile after auth
- `notificationCopy` helper + first template: `THEME_UNDER_REVIEW` (EN/FI)

## Left

Migrate remaining templates in `packages/db/src/notifications.ts` (and API/worker
helpers) through the same copy maps.
