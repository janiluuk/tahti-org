// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import {
  lookupAcoustidTrack,
  type AcoustidLookupFn,
  type LiveFingerprintSegment,
} from '@tahti/shared'
import { config } from '../config.js'
import { getRedisClient } from './redis.js'

function fingerprintCacheKey(fingerprint: string): string {
  const hash = createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)
  return `acoustid:fp:${hash}`
}

/** Redis-backed AcoustID lookup for live tracklist polling (24h TTL per fingerprint). */
export async function createAcoustidLookup(): Promise<AcoustidLookupFn> {
  const apiKey = config.acoustidApiKey
  const baseLookup: AcoustidLookupFn = (seg: LiveFingerprintSegment) =>
    lookupAcoustidTrack(seg, { apiKey })

  const redis = await getRedisClient()
  if (!redis || !apiKey) return baseLookup

  return async (seg: LiveFingerprintSegment) => {
    const key = fingerprintCacheKey(seg.fingerprint)
    try {
      const cached = await redis.get(key)
      if (cached === '__null__') return null
      if (cached) {
        return JSON.parse(cached) as { title: string; artist?: string }
      }

      const result = await baseLookup(seg)
      await redis.set(key, result ? JSON.stringify(result) : '__null__', { EX: 86_400 })
      return result
    } catch {
      return baseLookup(seg)
    }
  }
}
