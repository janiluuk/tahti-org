// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Best-effort "now playing" scrape for a user's added internet radio
 * stations. Only ever called for a station the user has actually added
 * (never for the raw preset catalog) and only refetched past a staleness
 * window — see apps/worker/src/jobs/internet-radio-now-playing-sync.ts.
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

/** radiohelsinki.fi renders the current show + song server-side, no client
 * fetch needed: `<div class="program-name current-program-title">CADIA</div>`
 * plus `.current-song-artist` / `.current-song-title` for the track inside
 * that show. */
const parseRadioHelsinki: Parser = (html) => {
  const program = /class="[^"]*current-program-title[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  const artist = /class="[^"]*current-song-artist[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  const title = /class="[^"]*current-song-title[^"]*">([^<]+)</.exec(html)?.[1]?.trim()
  if (!program && !artist && !title) return null
  return {
    title: program || null,
    artist: artist && title ? `${artist} — ${title}` : (artist ?? title ?? null),
  }
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

const PARSERS_BY_HOST: Record<string, Parser> = {
  'www.radiohelsinki.fi': parseRadioHelsinki,
  'radiohelsinki.fi': parseRadioHelsinki,
  'www.radioplay.fi': parseBauerRadioplay,
  'radioplay.fi': parseBauerRadioplay,
}

/** Null means "no parser for this host" — a real, expected, non-error
 * outcome (most of BACKGROUND_VISUAL_PRESETS-style reserved slots here
 * too: Yle Areena needs an API key, Nelonen Media's now-playing widget is
 * client-fetched with nothing in the initial HTML — not attempted). */
export function parserForUrl(programmingUrl: string): Parser | null {
  let host: string
  try {
    host = new URL(programmingUrl).hostname
  } catch {
    return null
  }
  return PARSERS_BY_HOST[host] ?? null
}

export async function fetchNowPlaying(
  programmingUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NowPlaying | null> {
  const parser = parserForUrl(programmingUrl)
  if (!parser) return null
  try {
    const res = await fetchImpl(programmingUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TahtiBot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return parser(html)
  } catch {
    return null
  }
}
