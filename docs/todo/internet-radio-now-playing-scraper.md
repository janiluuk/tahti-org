# Internet radio: "now playing" program scraper

Status: open, not started.

## Request

For the 6 Finnish internet radio presets (`apps/api/scripts/seed-internet-radio-presets.ts`:
YleX, Radio Helsinki, Radio Rock, Suomipop, NRJ, + one more — see that
file for the full list and each station's `programmingUrl`), fetch and
show the currently-playing program title.

- Only crawl a station once a user has actually added it
  (`InternetRadioStation` row exists, `core` schema,
  `packages/db/prisma/schema.prisma:3816`) — not for every preset
  up front.
- Cache the fetched title for a while, then refresh — avoid hitting each
  station's schedule page/API on every request. Needs a TTL/cache
  strategy (new column(s) on `InternetRadioStation`, e.g.
  `currentProgramTitle` + `currentProgramFetchedAt`, refreshed by a
  worker cron job past some staleness threshold — exact interval not
  yet decided).
- Clicking the radio station should navigate to "the radio station page"
  — needs clarifying which page: `ChannelKind.RADIO` (added in #524,
  `packages/db/prisma/schema.prisma`'s `Channel.kind`) is new
  groundwork for an internal Tahti channel page variant that shows
  programming instead of bio/subscribe — but that's for Tahti's own
  radio-kind channels (e.g. Tahti Radio), not these external Finnish
  stations. External `InternetRadioStation` rows have no dedicated page
  today; `programmingUrl` currently isn't linked from the UI at all
  (`apps/web/src/app/dashboard/internet-radio-panel.tsx`'s `StationRow`
  only has play/edit/remove). Options: (a) link out to each station's own
  `programmingUrl`, or (b) build a small internal
  `/radio/internet/[id]`-style page that shows the cached now-playing
  title + station info. Needs a decision before implementing the click
  target.

## Existing groundwork (already in the repo)

- `InternetRadioPreset` / `InternetRadioStation` models + CRUD
  (`apps/web/src/app/dashboard/internet-radio-actions.ts`,
  `internet-radio-panel.tsx`) — adding/removing a station already works.
- Each of the 6 presets already carries a `programmingUrl` pointing at
  the station's real public schedule/homepage — that's the crawl target
  per station, but each is a different site with no shared schedule
  format, so this is 6 bespoke scrapers (or 6 bespoke parsers over a
  shared fetch+cache scaffold), not one generic crawler.
- No scraper, cron job, or "now playing" field exists yet anywhere in
  the codebase for this.

## Not yet decided

- Scrape cadence / cache TTL.
- Per-station parser approach — each `programmingUrl` is a different
  site (Yle Areena, radiohelsinki.fi, radiorock.fi, supla.fi,
  radioplay.fi, and the 6th preset) with no common schedule API found
  yet; would need one parser per site (fragile — these can break on any
  site redesign) unless each has an underlying JSON/RSS schedule
  endpoint worth checking first.
- Where the fetched title is surfaced in the UI beyond the dashboard
  panel (e.g. also on `/listen` or wherever else stations are listed).
- The click-through destination (see above).
