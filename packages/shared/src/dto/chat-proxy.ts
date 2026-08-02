// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Centrifugo publish proxy body for channel chat. */
export const ChatPublishProxySchema = z.object({
  channel: z.string(),
  user: z.string().optional(),
  /** Connection JWT `meta` — includes `userId` when the chatter is signed in. */
  meta: z
    .union([
      z
        .object({
          userId: z.string().optional(),
        })
        .passthrough(),
      z.string(),
    ])
    .optional(),
  data: z
    .object({
      text: z.string().max(500, 'message too long'),
      handle: z.string().optional(),
    })
    .passthrough()
    .optional(),
})

export type ChatPublishProxyInput = z.infer<typeof ChatPublishProxySchema>

export function chatProxyMetaUserId(meta: ChatPublishProxyInput['meta']): string | null {
  if (!meta) return null
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta) as { userId?: unknown }
      return typeof parsed.userId === 'string' && parsed.userId.length > 0 ? parsed.userId : null
    } catch {
      return null
    }
  }
  return typeof meta.userId === 'string' && meta.userId.length > 0 ? meta.userId : null
}
