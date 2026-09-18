# Internet radio now-playing: Yle + Nelonen Media parsers

Status: open, not started.

## Context

Follow-up to `internet-radio-now-playing-scraper.md` (folded into
`docs/todo/HISTORY.md`, 2026-09-16) — that pass shipped working parsers
for 2 of the 6 Finnish presets (radiohelsinki.fi, and radioplay.fi which
covers both NRJ and Radio Nova). The scraper framework itself
(`apps/worker/src/lib/internet-radio-now-playing.ts`, dispatched by
`programmingUrl` hostname, cached via `InternetRadioStation.currentProgramTitle`/
`currentProgramArtist`/`currentProgramFetchedAt`, refreshed by the
`internet-radio-now-playing-sync` cron) is generic — adding a provider is
just one more entry in `PARSERS_BY_HOST` plus a `Parser` function, no
schema or cron changes needed.

## Remaining presets

- **YleX** (`https://areena.yle.fi/audio/ohjelmat/yle-x` in the seed
  data — note this URL 301-redirects to
  `/podcastit/ohjelmat/yle-x` as of 2026-09-16, worth updating the seed
  regardless of this task). Areena is a fully client-rendered Next.js
  SPA — `curl`ing it returns an empty `pageProps: {}` shell, so there's
  nothing to scrape from the static HTML. Yle has historically run a
  public program-guide/Areena API, but it requires a registered
  `app_id`/`app_key` — not something obtainable from an unattended
  session. Needs either: (a) a human registers a Yle developer key and
  adds it as a secret, or (b) find whether Areena's frontend calls an
  unauthenticated internal API (would need real browser devtools/network
  inspection to find, not just `curl` — not attempted, no browser access
  this pass).
- **Radio Rock** (`https://www.radiorock.fi/`) and **Suomipop**
  (`https://www.supla.fi/suomipop`) — both Nelonen Media properties.
  `curl`ing radiorock.fi returned a large (300KB+) page with no
  "now playing" / "nyt soi" text and no obvious embedded now-playing
  JSON state (checked for `nelonenmedia`-hosted API URLs in the page,
  none found). Also not attempted with real browser network inspection.

## Suggested next step

Before writing more regex parsers blind: use a real browser (Chrome
DevTools Network tab, once available) on `areena.yle.fi` and
`radiorock.fi`/`supla.fi` while a station is playing, filter for
XHR/fetch requests, and look for a JSON "now playing" or "schedule"
endpoint. That's how the two working parsers in this repo were found
faster than guessing — `curl` only sees what's server-rendered, and Yle
and Nelonen Media both apparently fetch this client-side.
