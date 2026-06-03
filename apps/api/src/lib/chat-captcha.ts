// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createClient } from 'redis'
import { config } from '../config.js'

const TTL_SEC = 24 * 3600
const KEY = (channelId: string, fingerprint: string) =>
  `chat:captcha_ok:${channelId}:${fingerprint}`

let redis: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (config.nodeEnv === 'test') return null
  if (!redis) {
    redis = createClient({ url: config.redisUrl })
    await redis.connect()
  }
  return redis
}

/** M11: token join verified hCaptcha — allow first chat publish without re-solving. */
export async function markChatCaptchaVerified(
  channelId: string,
  fingerprint: string,
): Promise<void> {
  const rd = await getRedis()
  if (!rd) return
  await rd.set(KEY(channelId, fingerprint), '1', { EX: TTL_SEC })
}

export async function isChatCaptchaVerified(
  channelId: string,
  fingerprint: string,
): Promise<boolean> {
  if (config.nodeEnv === 'test') return true
  const rd = await getRedis()
  if (!rd) return false
  return (await rd.get(KEY(channelId, fingerprint))) === '1'
}
