// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { hlsEgressRedisKey } from '@tahti/shared'
import { getRedisClient } from './redis.js'

/** STREAM-006: measured live HLS bytes from Caddy access logs (via worker cron). */
export async function fetchMeasuredHlsEgressByDate(
  slug: string,
  dates: string[],
): Promise<Record<string, number>> {
  const out = Object.fromEntries(dates.map((d) => [d, 0]))
  const client = await getRedisClient()
  if (!client) return out

  await Promise.all(
    dates.map(async (date) => {
      const raw = await client.get(hlsEgressRedisKey(slug, date))
      if (raw) out[date] = parseInt(raw, 10) || 0
    }),
  )
  return out
}
