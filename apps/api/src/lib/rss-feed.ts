// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import dns from 'node:dns/promises'
import { XMLParser } from 'fast-xml-parser'

const FETCH_TIMEOUT_MS = 8000
const MAX_BYTES = 512 * 1024

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const v = Number(p)
    if (!Number.isInteger(v) || v < 0 || v > 255) return null
    n = (n << 8) | v
  }
  return n >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true
  const inRange = (base: string, maskBits: number) => {
    const b = ipv4ToInt(base)!
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) ||
    inRange('192.0.2.0', 24) ||
    inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) ||
    inRange('198.51.100.0', 24) ||
    inRange('203.0.113.0', 24) ||
    inRange('224.0.0.0', 4) ||
    inRange('240.0.0.0', 4)
  )
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIpv4(v4mapped[1]!)
  return false
}

export function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIpv6(ip) : isPrivateIpv4(ip)
}

function isAllowedFeedType(contentType: string): boolean {
  if (!contentType) return true
  return (
    contentType.includes('xml') ||
    contentType.includes('rss') ||
    contentType.includes('atom') ||
    contentType.startsWith('text/plain')
  )
}

export type GuardedFeedResult =
  { ok: true; xml: string } | { ok: false; status: number; error: string }

/** Fetches a public RSS/Atom document, guarded against SSRF: http(s) only, no
 * redirects, every resolved address checked against the private-IP ranges
 * (not just the literal hostname — a DNS-rebinding attacker controls that).
 * Shared by the authenticated preview proxy (me/rss-feed.ts) and the public
 * per-channel news feed (routes/profile/public.ts), so both enforce the same
 * guard from one place. */
export async function fetchGuardedFeed(urlValue: string): Promise<GuardedFeedResult> {
  let parsed: URL
  try {
    parsed = new URL(urlValue)
  } catch {
    return { ok: false, status: 400, error: 'Invalid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'URL must be http:// or https://' }
  }

  let addresses: string[]
  try {
    const records = await dns.lookup(parsed.hostname, { all: true })
    addresses = records.map((record) => record.address)
  } catch {
    return { ok: false, status: 400, error: 'Could not resolve host' }
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    return { ok: false, status: 400, error: 'URL points to a disallowed address' }
  }

  let upstream: Response
  try {
    upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'manual',
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    })
  } catch {
    return { ok: false, status: 502, error: 'Could not fetch that URL' }
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return { ok: false, status: 400, error: 'Redirects are not allowed' }
  }
  if (!upstream.ok) {
    return { ok: false, status: 502, error: 'Could not fetch that URL' }
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!isAllowedFeedType(contentType)) {
    return { ok: false, status: 415, error: 'URL does not point to an RSS or Atom feed' }
  }
  const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BYTES) {
    return { ok: false, status: 413, error: 'Feed is too large' }
  }

  const xml = await upstream.text()
  if (xml.length > MAX_BYTES) {
    return { ok: false, status: 413, error: 'Feed is too large' }
  }
  return { ok: true, xml }
}

export interface FeedItem {
  title: string
  link: string
  pubDate: string | null
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return textOf((value as Record<string, unknown>)['#text'])
  }
  return ''
}

/** Atom <link> is an element with an href attribute (and may repeat with
 * different @rel values); RSS <link> is plain text content. */
function linkOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const alternate = value.find(
      (v) =>
        typeof v === 'object' && v !== null && (v as Record<string, unknown>)['@_rel'] !== 'self',
    )
    return linkOf(alternate ?? value[0])
  }
  if (value && typeof value === 'object') {
    const href = (value as Record<string, unknown>)['@_href']
    if (typeof href === 'string') return href
  }
  return ''
}

/** Parses RSS 2.0 `<item>` or Atom `<entry>` elements into a flat, render-
 * ready list. Best-effort: malformed or unrecognized XML yields an empty
 * list rather than throwing. */
export function parseFeedItems(xml: string, limit = 8): FeedItem[] {
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch {
    return []
  }
  if (!doc || typeof doc !== 'object') return []

  const root = doc as Record<string, unknown>
  const rss = root.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  const feed = root.feed as Record<string, unknown> | undefined

  const rawItems = channel?.item ?? feed?.entry
  const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

  return list
    .slice(0, limit)
    .map((entry): FeedItem | null => {
      const e = entry as Record<string, unknown>
      const title = textOf(e.title).trim()
      const link = linkOf(e.link).trim()
      if (!title || !link) return null
      const pubDate = textOf(e.pubDate || e.published || e.updated).trim()
      return { title, link, pubDate: pubDate || null }
    })
    .filter((item): item is FeedItem => item !== null)
}
