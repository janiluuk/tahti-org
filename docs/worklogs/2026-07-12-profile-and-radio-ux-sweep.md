# Profile and radio UX sweep (2026-07-12)

## Scope

Audit of `/u/[username]` (profile), `/c/[slug]` (channel), and `/radio` (Tahti
Radio) for consistency, plus a repo-wide scan for orphan pages and stub
functionality. Requested after a run of features (Events, Posts, streaming
platform links, SoundCloud embeds) were added to the channel page only —
worth checking whether that pattern left gaps.

## Finding: profile page is missing Events, Posts, and SoundCloud embeds

`/c/[slug]` (the live channel page) and `/u/[username]` (the artist's
permanent profile page) are two different surfaces for the same artist, and
they've drifted:

**Only on `/c/[slug]`:** Events, Posts/"Updates", SoundCloud embeds, raw
archive/back-catalog list, live player + tracklist, live listener count,
chat, broadcast countdown, visual customization (text layer, gallery,
color scheme, visualizer), genre tag chips.

**Only on `/u/[username]`:** Releases/discography grid, Collections, tip jar
link, a labeled "Podcasts & feeds" section, JSON-LD structured data for SEO.

Most of that split makes sense — the channel page is the live-broadcast
surface, the profile page is the catalog/discography surface. But Events,
Posts, and embeds are artist-level content, not broadcast-state content: an
artist who isn't currently live still has upcoming shows, still wants to
post updates, still wants their SoundCloud tracks embedded — and `/u/[username]`
is the URL that's stable regardless of live state. Leaving them
channel-page-only means an offline artist's profile shows none of it.

**Fixed in this pass:** ported the Events, Posts, and Embeds sections to
`/u/[username]/page.tsx`, fetching from the same three public endpoints
(`/api/channels/:slug/events`, `/posts`, `/embeds`) keyed off `channel.slug`
when the artist has a channel. Reused the same section markup/CSS classes
already shipped for the channel page, so no new styling was needed.

## Finding: `/u/[username]` has no footer at all

`/radio` and `/c/[slug]` both render `PublicFooter` (governance/legal/help
links) via their respective layouts. `/u/[username]` uses `ProfilePageLayout`,
which never renders a footer — so the profile page has zero path to
`/governance`, `/transparency`, `/privacy`, `/terms`, `/help`, etc.

**Fixed in this pass (follow-up).** `ProfilePageLayout` already takes a
`narrow` prop that's `true` only on the `/subscribe` checkout flow — tied
footer rendering to `!narrow`, so the main profile page gets the footer and
the checkout flow stays distraction-free. Verified live: footer present on
`/u/[username]`, absent on `/u/[username]/subscribe`.

## Finding: `/help` index page has no inbound links

Every `/help/*` sub-page is linked from somewhere (marketing pages, other
help pages), but nothing links to `/help` itself — the footer
(`packages/ui/src/brand/PublicFooter.tsx`) links to `/how-it-works`,
`/for-artists`, `/about`, `/venues`, `/governance`, `/transparency`,
`/privacy`, `/terms`, `/agpl`, but not `/help`. A visitor can only reach
individual guides, never the full index.

**Fixed in this pass:** added `/help` to the shared footer link list.

## Findings noted, not fixed (deliberate or out of scope)

- **`/join` and `/dashboard/channel`** are legacy redirect shims
  (`redirect('/apply')`, `redirect('/dashboard/channel/edit')`) with no
  inbound links — intentional, they exist only to keep old bookmarks/links
  working. No action needed.
- **`/dev/components`** is a dev-only component playground (`notFound()` in
  production) with no inbound links by design.
- **SoundCloud download-import** (`/dashboard/upload/import/soundcloud`)
  shows "Import coming soon" on every track row — the OAuth-connect flow
  works, but the actual download/transcode was never implemented. Pre-existing,
  unrelated to today's SoundCloud *embed* feature (which is a separate,
  already-shipped path — see PR #260). Left as-is; implementing real
  SoundCloud downloading is a bigger job (rate limits, format handling,
  licensing checks) that deserves its own pass.
- **`/r/[slug]` "Streaming links coming soon."** — this is a correct empty
  state (shown only when a release has zero configured DSP targets), not a
  stub. No action needed.
- **Admin vendor settings page** self-reports Mixcloud/Revelator
  integrations as `STUB` vs `LIVE` — this is an intentional, honest status
  indicator for admins, not a bug.
- **Tahti Radio live-relay URL mismatch** (`picker.ts` builds `index.m3u8`,
  the pipeline outputs `stream.m3u8`) and **production archive-cover 403s**
  (MinIO bucket policy) were both already tracked from an earlier pass
  (worklog gap-analysis, 2026-07-07) and are out of scope here — both need
  production/infra access this environment doesn't have.

## Not investigated further

`/radio` itself checked out structurally sound: it's linked from the shared
site nav (`ChannelPageLayout`'s `SiteNavId`), the marketing page, `/how-it-works`,
`/help/for-listeners`, and `/listen`; its player correctly branches
video/audio/none based on `resolveActiveRadioPlayback`; the "Browse live
channels by genre" link to `/listen` resolves. The one known real bug in this
area (the `index.m3u8`/`stream.m3u8` mismatch above) is already tracked
separately.
