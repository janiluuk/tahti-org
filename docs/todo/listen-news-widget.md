# Listen News widget (artist RSS feed → public channel page)

Worktree: `worktree-listen-news-widget`.

## Background

`GET /api/me/rss-feed` (an SSRF-guarded RSS/Atom proxy) landed on main in
commit `4f92a2f4` via its `server.ts` registration, but the route file
itself was never committed — main was broken for a clean checkout until
this session added it back (see commit `1f8a915d`, pushed directly to main
per this repo's no-worktree-for-fixes convention). Its comment said the
route existed "for the Listen News widget," but no such widget existed
anywhere in the codebase. This doc is that widget.

## Scoping decision

Checked whether "widget" meant a sandboxed `Addon` (the renamed
`DiscoWidget` subsystem — see `addons-rename-and-branding-widgets.md`).
Ruled out: `AddonHostApi` (`packages/addon-sdk/src/protocol.ts`) exposes
only `getContext`/`resize`/`openLink`/`onConfigChange` — no fetch
primitive, so a sandboxed addon has no way to hit an artist-supplied URL
itself. Building this as a real Addon would mean extending the per-scope
context payload with server-fetched feed data and pushing it through the
bundle-upload+approval pipeline — disproportionate for what is otherwise a
first-party feature. Built as a plain dashboard settings field + public
render section instead, no sandboxing involved.

## What shipped

- **DB**: `User.newsFeedUrl String?` (migration
  `20260904020000_add_user_news_feed_url`).
- **Shared guard extracted**: `apps/api/src/lib/rss-feed.ts` —
  `fetchGuardedFeed()` (the SSRF guard, unchanged behavior, moved out of
  the route so it's shared) and `parseFeedItems()` (RSS `<item>` / Atom
  `<entry>` → `{title, link, pubDate}[]`, via `fast-xml-parser`, added as
  an `apps/api` dependency — no XML parser existed anywhere in the repo
  before this). `apps/api/src/routes/me/rss-feed.ts` now just calls
  `fetchGuardedFeed` — behavior/tests unchanged.
- **Settings**: `PATCH /api/me/profile` accepts `newsFeedUrl` (same
  trim-or-null pattern as `tipJarUrl`). Dashboard UI is a new "News feed"
  panel (`apps/web/src/app/dashboard/news-feed-panel.tsx`) on the
  Discovery settings page, alongside Addons — Save persists the URL,
  Preview calls a server action that proxies through `/api/me/rss-feed`
  and parses the returned XML with the browser's native `DOMParser` (kept
  client-side deliberately — no need for a second XML-parsing path here).
- **Public rendering**: new public route `GET /api/v1/u/:username/news`
  (`apps/api/src/routes/profile/public.ts`) — looks up the user's
  `newsFeedUrl`, fetches+parses it server-side (reusing the same guard),
  caches the result 300s via the existing `getCachedJson` Redis helper
  (keyed `profile:news:<username>`), and fails soft to `{ items: [] }` on
  any error (unset feed, unreachable, unparsable) — the section simply
  doesn't render rather than surfacing an error to visitors. Wired into
  the channel page (`apps/web/src/app/c/[slug]/page.tsx`) as a "Latest
  news" section in the feed tab, styled like the existing Events list.
- New shared DTOs: `RssFeedItemSchema`/`RssFeedResponseSchema` in
  `packages/shared/src/dto/profile.ts` (named `Rss*` rather than `News*`
  to avoid colliding with the existing admin site-news
  `NewsFeedResponseSchema` in `dto/api-responses.ts`, which is unrelated —
  that one is `NewsPost[]` for `/admin/news`).

## Not done / deliberately out of scope

- Not added to `u/[username]/c/[slug]/page.tsx` — that route is actually
  the **collection/playlist** detail page (misleadingly similar path
  shape), not a channel page alias. Only the real channel page
  (`apps/web/src/app/c/[slug]/page.tsx`) got the section.
- No feed-URL reachability validation at save time (mirrors `tipJarUrl`'s
  existing looseness) — an artist can save an unreachable URL; the public
  render just shows nothing until it's fixed. The Preview button in
  settings is how they'd notice.
- No admin moderation/allowlist for feed URLs — same trust level as any
  other artist-supplied external link on the platform (tip jar, social
  links).

## Verification

`pnpm typecheck` (api/web/shared) and `pnpm exec eslint` on every touched
file are green. `pnpm --filter @tahti/api-client generate` regenerated
`packages/api-client/src/schema.d.ts` for the new route + field.

Also ran the full DB-backed suite locally, on a second attempt: spun up
an ephemeral `postgres:16-alpine` container and used `prisma db push`
(not `migrate deploy` — this repo's `migrations/` directory starts mid-
history, at `20260605120000_hot_ingest_rotation`; applying it to a truly
empty database fails with missing-schema/missing-relation errors, since
it assumes tables from an earlier, since-squashed baseline that isn't in
this migrations folder — `db push` syncs directly from `schema.prisma`
instead and works fine for local ad-hoc testing). Full `apps/api` suite:
233 files / 1083 tests passed / 3 skipped, 0 failures, including new
coverage for `GET /api/v1/u/:username/news`
(`routes/profile/public.test.ts`). Added test coverage for that route
after confirming it worked, since it had none.

Note for next time this project needs a from-scratch local Postgres:
`prisma migrate deploy` will not work against an empty database with the
current `migrations/` history — use `prisma db push` instead (schema
drift only, no migration history — fine for local dev/test, not for
anything that needs to double as a migration dry-run).
