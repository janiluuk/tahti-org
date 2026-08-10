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
  /** message.ts's publish gate is a soft secondary check behind an already-
   * gated join, so it fails open (assume verified) if Redis is unreachable —
   * token.ts's join gate is the *primary* anti-bot control, so it passes
   * `failOpen: false` to fail closed there instead (falls through to a real
   * hCaptcha solve, same as if this cache didn't exist) rather than silently
   * disabling the captcha requirement for everyone during a Redis outage. */
  opts: { failOpen?: boolean } = {},
): Promise<boolean> {
  const rd = await getRedisClient()
  if (!rd) return opts.failOpen ?? true
  return (await rd.get(KEY(channelId, fingerprint))) === '1'
}
