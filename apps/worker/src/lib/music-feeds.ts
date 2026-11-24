// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { XMLParser } from 'fast-xml-parser'

export interface MusicNewsSource {
  key: string
  name: string
  feedUrl: string
}

/** Finnish music news feeds the board approved. Only headline, a short
 * plain-text excerpt and a link back are stored, never the article. */
export const MUSIC_NEWS_SOURCES: readonly MusicNewsSource[] = [
  { key: 'konekellari', name: 'Konekellari', feedUrl: 'https://konekellari.fi/feed/' },
  { key: 'soundi', name: 'Soundi', feedUrl: 'https://www.soundi.fi/feed/' },
  { key: 'rumba', name: 'Rumba', feedUrl: 'https://www.rumba.fi/feed/' },
  { key: 'inferno', name: 'Inferno', feedUrl: 'https://www.inferno.fi/feed/' },
  { key: 'kaaoszine', name: 'Kaaoszine', feedUrl: 'https://kaaoszine.fi/feed/' },
]

export const EXCERPT_MAX_CHARS = 280
const FETCH_TIMEOUT_MS = 15_000
const MAX_FEED_BYTES = 2 * 1024 * 1024
export const FEED_USER_AGENT = 'TahtiFeedImporter/1.0 (+https://tahti.live)'

export interface FeedEntry {
  externalId: string
  title: string
  link: string
  excerpt: string
  publishedAt: Date | null
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16))
    }
    if (code.startsWith('#')) {
      return String.fromCodePoint(parseInt(code.slice(1), 10))
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Plain text from feed HTML, cut on a word boundary with an ellipsis. */
export function plainExcerpt(html: string, maxChars = EXCERPT_MAX_CHARS): string {
  const text = decodeEntities(
    html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
    // WordPress appends "The post … appeared first on …" to excerpts.
    .replace(/\s*The post .* appeared first on .*$/i, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, '')
  if (text.length <= maxChars) return text
  const cut = text.slice(0, maxChars - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > maxChars * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as { '#text': unknown })['#text'])
  }
  return ''
}

/** RSS 2.0 items as entries; items without a title or link are skipped. */
export function parseRssEntries(xml: string): FeedEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: false })
  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } }
  }
  const raw = doc.rss?.channel?.item
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []
  const entries: FeedEntry[] = []
  for (const item of items as Record<string, unknown>[]) {
    const title = plainExcerpt(textOf(item.title), 300)
    const link = textOf(item.link).trim()
    if (!title || !/^https?:\/\//.test(link)) continue
    const guid = textOf(item.guid).trim() || link
    const date = textOf(item.pubDate)
    const parsed = date ? new Date(date) : null
    entries.push({
      externalId: guid.slice(0, 500),
      title,
      link,
      excerpt: plainExcerpt(textOf(item.description)),
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    })
  }
  return entries
}

/** GET an allowlisted URL with a timeout and a size cap; no redirects. */
export async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'error',
    headers: { Accept: accept, 'User-Agent': FEED_USER_AGENT },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const body = await response.text()
  if (body.length > MAX_FEED_BYTES) {
    throw new Error('response too large')
  }
  return body
}
