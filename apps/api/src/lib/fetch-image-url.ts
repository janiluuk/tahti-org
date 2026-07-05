// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import dns from 'node:dns/promises'

const FETCH_TIMEOUT_MS = 8000
const MAX_BYTES = 15 * 1024 * 1024
export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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
  if (n === null) return true // unparsable — fail closed
  const inRange = (base: string, maskBits: number) => {
    const b = ipv4ToInt(base)!
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved
  )
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
  const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4mapped) return isPrivateIpv4(v4mapped[1]!)
  return false
}

function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIpv6(ip) : isPrivateIpv4(ip)
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function extFromMime(contentType: string): string {
  return EXT_BY_MIME[contentType] ?? 'jpg'
}

export type FetchImageResult =
  | { ok: true; bytes: Buffer; contentType: string }
  | { ok: false; error: string }

/**
 * Fetch a user-supplied image URL server-side with SSRF guards: only http(s), no
 * redirects (would bypass the resolved-IP check), resolved address must not be
 * private/loopback/link-local, allowlisted image MIME types, and a size cap.
 */
export async function fetchImageFromUrl(sourceUrl: string): Promise<FetchImageResult> {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL must be http:// or https://' }
  }

  let addresses: string[]
  try {
    const records = await dns.lookup(parsed.hostname, { all: true })
    addresses = records.map((r) => r.address)
  } catch {
    return { ok: false, error: 'Could not resolve host' }
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    return { ok: false, error: 'URL points to a disallowed address' }
  }

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'manual',
    })
  } catch {
    return { ok: false, error: 'Could not fetch that URL' }
  }
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, error: 'Redirects are not allowed for image URLs' }
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: 'Could not fetch that URL' }
  }

  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!ALLOWED_IMAGE_MIME.has(contentType)) {
    return { ok: false, error: 'URL does not point to a JPEG, PNG, WebP, or GIF' }
  }
  const declaredLength = Number(res.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BYTES) {
    return { ok: false, error: 'Image is too large (max 15 MB)' }
  }

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => undefined)
      return { ok: false, error: 'Image is too large (max 15 MB)' }
    }
    chunks.push(value)
  }
  return { ok: true, bytes: Buffer.concat(chunks), contentType }
}
