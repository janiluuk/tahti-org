# Community stories

**Status:** partial

Public, chronological "Community stories" feed of artist posts for the
tahti-player web app, plus a category on artist posts.

- Prisma: `ArtistPostCategory { STORY NEWS ANNOUNCEMENT }`, `ArtistPost.category`
  (default `STORY`), index on `(publishAt DESC, id DESC)`. Migration
  `20261030120000_artist_post_category`.
- `/api/me/posts` create/update accept optional `category`; author list,
  `GET /api/channels/:slug/posts` and `/api/me/feed` post items include it.
- `GET /api/v1/community/stories?cursor=<postId>&limit=<n>` (default 12,
  clamped to 30): published posts by available (not suspended / deleted)
  artists, newest first by `publishAt` then `id`, keyset cursor = last item id,
  `Cache-Control: public, max-age=30`. Response
  `{ items: CommunityStory[], nextCursor: string | null }`; excerpt is the
  body with markdown/HTML stripped, max 280 chars ending in `…` when cut;
  author display name goes through `safeDisplayName`.

Left:

- [ ] Migration runs on deploy (`prisma migrate deploy`).
- [ ] Web half (feed story cards) in `../tahti-player`.
