// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { TOR_EXIT_REDIS_KEY } from '@tahti/shared'
import { loadBundledTorExitCidrs } from '@tahti/shared/bundled-tor-exits'
import { config } from '../config.js'
import { getRedisClient } from './redis.js'

let redisCache: { cidrs: string[]; at: number } | null = null
const REDIS_TTL_MS = 60 * 60 * 1000

async function loadRedisTorExitCidrs(): Promise<string[]> {
  const now = Date.now()
  if (redisCache && now - redisCache.at < REDIS_TTL_MS) return redisCache.cidrs
  try {
    const rd = await getRedisClient()
    if (!rd) return []
    const raw = await rd.get(TOR_EXIT_REDIS_KEY)
    if (!raw) {
      redisCache = { cidrs: [], at: now }
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    const cidrs = Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : []
    redisCache = { cidrs, at: now }
    return cidrs
  } catch {
    return []
  }
}

/** Env CIDRs + bundled Tor exits + daily Redis sync (M18). */
export async function getDownloadNoCountCidrs(): Promise<string[]> {
  const merged = new Set<string>([
    ...config.download.noCountCidrs,
    ...loadBundledTorExitCidrs(),
    ...(await loadRedisTorExitCidrs()),
  ])
  return [...merged]
}
