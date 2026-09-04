// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import dns from 'node:dns/promises'
import { requireAuth } from '../../plugins/auth.js'

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

function isPrivateIp(ip: string): boolean {
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

const meRssFeedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/rss-feed?url= — fetch a public RSS/Atom document for the
  // Listen News widget. SSRF-guarded: http(s) only, no redirects, no private IPs.
  fastify.get(
    '/api/me/rss-feed',
    {
      preHandler: requireAuth,
      schema: { tags: ['channel'], description: 'Proxy a public RSS or Atom feed' },
    },
    async (request, reply) => {
      const urlValue = (request.query as { url?: string })?.url?.trim()
      if (!urlValue) {
        return reply.status(400).send({ error: 'url is required' })
      }

      let parsed: URL
      try {
        parsed = new URL(urlValue)
      } catch {
        return reply.status(400).send({ error: 'Invalid URL' })
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return reply.status(400).send({ error: 'URL must be http:// or https://' })
      }

      let addresses: string[]
      try {
        const records = await dns.lookup(parsed.hostname, { all: true })
        addresses = records.map((record) => record.address)
      } catch {
        return reply.status(400).send({ error: 'Could not resolve host' })
      }
      if (addresses.length === 0 || addresses.some(isPrivateIp)) {
        return reply.status(400).send({ error: 'URL points to a disallowed address' })
      }

      let upstream: Response
      try {
        upstream = await fetch(parsed.toString(), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: 'manual',
          headers: {
            Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          },
        })
      } catch {
        return reply.status(502).send({ error: 'Could not fetch that URL' })
      }
      if (upstream.status >= 300 && upstream.status < 400) {
        return reply.status(400).send({ error: 'Redirects are not allowed' })
      }
      if (!upstream.ok) {
        return reply.status(502).send({ error: 'Could not fetch that URL' })
      }

      const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
      if (!isAllowedFeedType(contentType)) {
        return reply.status(415).send({ error: 'URL does not point to an RSS or Atom feed' })
      }
      const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
      if (declaredLength > MAX_BYTES) {
        return reply.status(413).send({ error: 'Feed is too large' })
      }

      const xml = await upstream.text()
      if (xml.length > MAX_BYTES) {
        return reply.status(413).send({ error: 'Feed is too large' })
      }
      return reply.send({ xml })
    },
  )
}

export default meRssFeedRoutes
