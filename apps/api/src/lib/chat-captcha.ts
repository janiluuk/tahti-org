// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { getRedisClient } from './redis.js'

const TTL_SEC = 24 * 3600
const KEY = (channelId: string, fingerprint: string) =>
  `chat:captcha_ok:${channelId}:${fingerprint}`

/** M11: token join verified hCaptcha — allow first chat publish without re-solving. */
export async function markChatCaptchaVerified(
  channelId: string,
  fingerprint: string,
): Promise<void> {
  const rd = await getRedisClient()
  if (!rd) return
  await rd.set(KEY(channelId, fingerprint), '1', { EX: TTL_SEC })
}

export async function isChatCaptchaVerified(
  channelId: string,
  fingerprint: string,
): Promise<boolean> {
  const rd = await getRedisClient()
  if (!rd) return true
  return (await rd.get(KEY(channelId, fingerprint))) === '1'
}
