// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** nginx-rtmp form callback: stream name is `slug__secret`. */
export const RtmpWebhookBodySchema = z
  .object({
    name: z.string().min(1, 'name is required'),
  })
  .passthrough()

export type RtmpWebhookBody = z.infer<typeof RtmpWebhookBodySchema>

/** Icecast source auth callbacks. */
export const IcecastConnectSchema = z
  .object({
    mount: z.string().min(1, 'mount is required'),
    pass: z.string().optional(),
    user: z.string().optional(),
  })
  .passthrough()

export const IcecastDisconnectSchema = z
  .object({
    mount: z.string().min(1, 'mount is required'),
  })
  .passthrough()

export const ItemReadyWebhookSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
})
