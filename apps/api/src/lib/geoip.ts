// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-061: country-level IP geolocation via geoip-lite (MaxMind GeoLite2, no external API).

import geoip from 'geoip-lite'

const PRIVATE_PREFIXES = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '127.',
  '::1',
  'fc',
  'fd',
]

/** Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4). */
function normalizeIp(raw: string): string {
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

function isPrivate(ip: string): boolean {
  const norm = normalizeIp(ip).toLowerCase()
  return PRIVATE_PREFIXES.some((p) => norm.startsWith(p))
}

/**
 * Returns the ISO 3166-1 alpha-2 country code for `ip`, or `null` for private/
 * loopback addresses and IPs that don't match the database.
 */
export function countryFromIp(ip: string): string | null {
  if (!ip || isPrivate(ip)) return null
  const lookup = geoip.lookup(normalizeIp(ip))
  return lookup?.country ?? null
}
