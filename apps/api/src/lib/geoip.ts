// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-061: country-level IP geolocation via geoip-lite (MaxMind GeoLite2, no external API).
//
// geoip-lite v2 loads city databases (105 MB) synchronously at import time, which blocks
// the event loop for 10–30 s on CI disk I/O. Lazy-load via createRequire so the blocking
// work happens on first use instead of server startup.

import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

type GeoipModule = { lookup: (ip: string) => { country?: string } | null }

let _geoip: GeoipModule | null | undefined

function getGeoip(): GeoipModule | null {
  if (_geoip === undefined) {
    try {
      _geoip = _require('geoip-lite') as GeoipModule
    } catch {
      _geoip = null
    }
  }
  return _geoip
}

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
  const geoip = getGeoip()
  if (!geoip) return null
  const lookup = geoip.lookup(normalizeIp(ip))
  return lookup?.country ?? null
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

/** ISO 3166-1 alpha-2 → English country name (PLAT-064). */
export function countryDisplayName(countryCode: string): string {
  try {
    return regionNames.of(countryCode) ?? countryCode
  } catch {
    return countryCode
  }
}
