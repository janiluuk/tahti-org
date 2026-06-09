// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-063: country-level IP geolocation for HLS listener geo map.

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

function normalizeIp(raw: string): string {
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

function isPrivate(ip: string): boolean {
  const norm = normalizeIp(ip).toLowerCase()
  return PRIVATE_PREFIXES.some((p) => norm.startsWith(p))
}

export function countryFromIp(ip: string): string | null {
  if (!ip || isPrivate(ip)) return null
  const lookup = geoip.lookup(normalizeIp(ip))
  return lookup?.country ?? null
}
