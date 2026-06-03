// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** M18: Tor/datacenter/bot traffic may download but does not count toward grants. */

const BOT_UA = /(bot|crawler|spider|curl|wget|python-requests|scrapy|headless|java\/)/i

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const octet = Number(p)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    n = (n << 8) + octet
  }
  return n >>> 0
}

function cidrMatch(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = bitsStr ? Number(bitsStr) : 32
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(base)
  if (ipInt === null || baseInt === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

export function evaluateDownloadCountPolicy(params: {
  clientIp: string
  userAgent?: string | null
  noCountCidrs?: string[]
  trustOverrideIps?: string[]
}): { shouldCount: boolean; reason: string | null } {
  const ip = params.clientIp.trim()
  const trust = new Set((params.trustOverrideIps ?? []).map((s) => s.trim()).filter(Boolean))

  if (trust.has(ip)) {
    return { shouldCount: true, reason: null }
  }

  for (const cidr of params.noCountCidrs ?? []) {
    const trimmed = cidr.trim()
    if (!trimmed) continue
    if (cidrMatch(ip, trimmed)) {
      return { shouldCount: false, reason: 'tor_or_datacenter' }
    }
  }

  const ua = params.userAgent ?? ''
  if (ua && BOT_UA.test(ua)) {
    return { shouldCount: false, reason: 'bot_ua' }
  }

  return { shouldCount: true, reason: null }
}
