// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-063: fetch per-country HLS listener counts from Redis geo hashes.

import { hlsListenerGeoRedisKey } from '@tahti/shared'
import { getRedisClient } from './redis.js'

/** Aggregate HLS listener counts by country for a channel slug over UTC dates. */
export async function fetchMeasuredHlsListenersByCountry(
  slug: string,
  dates: string[],
): Promise<Record<string, number>> {
  const client = await getRedisClient()
  if (!client) return {}

  const totals: Record<string, number> = {}
  await Promise.all(
    dates.map(async (date) => {
      const raw = await client.hGetAll(hlsListenerGeoRedisKey(slug, date))
      for (const [cc, val] of Object.entries(raw)) {
        totals[cc] = (totals[cc] ?? 0) + (parseInt(val, 10) || 0)
      }
    }),
  )
  return totals
}
