// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Best-effort "now playing" scrape for internet radio stations. The worker
 * runs it for stations a user has added, refetched past a staleness window
 * (apps/worker/src/jobs/internet-radio-now-playing-sync.ts); the API runs it
 * on demand, cached, for the station catalog (routes/internet-radio/now-playing.ts).
 *
 * There is no shared public API across Finnish commercial radio sites, so
 * this is a small per-host parser table rather than one generic client.
 * Each parser reads whatever the site's own server-rendered HTML already
 * exposes — no headless browser, no JS execution — so a parser returns
 * null (not an error) the moment a site's markup changes underneath it.
 * That's a deliberate tradeoff: silently going stale is fine, throwing and
 * failing the whole cron tick for every other station is not.
 */

export interface NowPlaying {
  title: string | null
  artist: string | null
}

type Parser = (html: string) => NowPlaying | null

/** radiohelsinki.fi also renders the current show + song server-side:
 * `<div class="program-name current-program-title">CADIA</div>` plus
 * `.current-song-artist` / `.current-song-title`. That HTML sits behind the
 * site's page cache and lags several songs behind, so it is only the
 * fallback for when the live feed below is unavailable. */
const parseRadioHelsinki: Parser = (html) => {
  const program = /class="[^"]*current-program-title[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  const artist = /class="[^"]*current-song-artist[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  const title = /class="[^"]*current-song-title[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  return radioHelsinkiNowPlaying(program, artist, title)
}

function radioHelsinkiNowPlaying(
  program: string | undefined,
  artist: string | undefined,
  title: string | undefined,
): NowPlaying | null {
  if (!program && !artist && !title) return null
  return {
    title: program || null,
    artist: artist && title ? `${artist} — ${title}` : artist || title || null,
  }
}

interface RadioHelsinkiFeed {
  programs?: { current?: { program_title?: unknown } | null } | null
  last_playing?: ({ artist?: unknown; song?: unknown } | null)[] | null
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

/** The JSON the site's own player polls every 20 seconds to fill in the
 * show and song: `programs.current` and `last_playing[0]`, newest first.
 * The file is briefly empty while the site rewrites it. */
const parseRadioHelsinkiFeed: Parser = (body) => {
  let feed: RadioHelsinkiFeed
  try {
    feed = JSON.parse(body) as RadioHelsinkiFeed
  } catch {
    return null
  }
  const song = Array.isArray(feed?.last_playing) ? feed.last_playing[0] : undefined
  return radioHelsinkiNowPlaying(
    trimmedString(feed?.programs?.current?.program_title),
    trimmedString(song?.artist),
    trimmedString(song?.song),
  )
}

/** The feed is served with an eight-day max-age, so the site busts caches
 * with a `dt` that changes every 20 seconds; this does the same. */
const RADIO_HELSINKI_FEED_BUCKET_MS = 20_000

function radioHelsinkiFeedUrl(now: number): string {
  const bucket = Math.floor(now / RADIO_HELSINKI_FEED_BUCKET_MS) * RADIO_HELSINKI_FEED_BUCKET_MS
  return `https://www.radiohelsinki.fi/wp-content/djonline.js?dt=${bucket}`
}

/** radioplay.fi (Bauer Media — NRJ, Radio Nova) embeds a hydration state
 * blob server-side with one or more `"stationNowPlaying":{...}` objects
 * (earlier ones in the page can be empty placeholders for sibling
 * stations/widgets) — the last non-empty one is this page's own station. */
const parseBauerRadioplay: Parser = (html) => {
  const matches = [...html.matchAll(/"nowPlayingTrack":"([^"]*)","nowPlayingArtist":"([^"]*)"/g)]
  for (let i = matches.length - 1; i >= 0; i--) {
    const [, track, artist] = matches[i]!
    if (track || artist) {
      return { title: track || null, artist: artist || null }
    }
  }
  return null
}

/** How to read one site: its programme page, and optionally a live feed
 * that is tried first because the page itself is cached or stale. */
export interface NowPlayingSource {
  parse: Parser
  liveFeed?: { url: (now: number) => string; parse: Parser }
}

const radioHelsinkiSource: NowPlayingSource = {
  parse: parseRadioHelsinki,
  liveFeed: { url: radioHelsinkiFeedUrl, parse: parseRadioHelsinkiFeed },
}

const bauerRadioplaySource: NowPlayingSource = { parse: parseBauerRadioplay }

const SOURCES_BY_HOST: Record<string, NowPlayingSource> = {
  'www.radiohelsinki.fi': radioHelsinkiSource,
  'radiohelsinki.fi': radioHelsinkiSource,
  'www.radioplay.fi': bauerRadioplaySource,
  'radioplay.fi': bauerRadioplaySource,
}

/** Null means "no parser for this host" — a real, expected, non-error
 * outcome (most of BACKGROUND_VISUAL_PRESETS-style reserved slots here
 * too: Yle Areena needs an API key, Nelonen Media's now-playing widget is
 * client-fetched with nothing in the initial HTML — not attempted). */
/** Sent with every programme page fetch, so a station can see who is
 * asking and where to complain. */
export const NOW_PLAYING_USER_AGENT = 'TahtiBot/1.0 (+https://tahti.live; now-playing)'

/** Pages listed in `NOW_PLAYING_DISABLED_HOSTS` (comma separated: a host
 * such as `radioplay.fi`, or a host and path such as `radioplay.fi/nrj` for
 * one station on a shared site) are never fetched: the switch for a station
 * whose page changed or that asked us to stop, without a deploy. */
export function disabledNowPlayingHosts(): string[] {
  const raw = typeof process === 'undefined' ? '' : process.env.NOW_PLAYING_DISABLED_HOSTS
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

export function parserForUrl(
  programmingUrl: string,
  disabledHosts: readonly string[] = disabledNowPlayingHosts(),
): NowPlayingSource | null {
  let parsed: URL
  try {
    parsed = new URL(programmingUrl)
  } catch {
    return null
  }
  const source = SOURCES_BY_HOST[parsed.hostname]
  if (!source) return null
  const page = `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.toLowerCase()
  const disabled = disabledHosts.some((entry) => {
    const bare = entry.replace(/^www\./, '').replace(/\/+$/, '')
    return page === bare || page.startsWith(`${bare}/`)
  })
  return disabled ? null : source
}

export async function fetchNowPlaying(
  programmingUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NowPlaying | null> {
  const source = parserForUrl(programmingUrl)
  if (!source) return null
  if (source.liveFeed) {
    const live = await fetchAndParse(
      source.liveFeed.url(Date.now()),
      source.liveFeed.parse,
      fetchImpl,
    )
    if (live) return live
  }
  return fetchAndParse(programmingUrl, source.parse, fetchImpl)
}

async function fetchAndParse(
  url: string,
  parse: Parser,
  fetchImpl: typeof fetch,
): Promise<NowPlaying | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': NOW_PLAYING_USER_AGENT },
    })
    if (!res.ok) return null
    return parse(await res.text())
  } catch {
    return null
  }
}
