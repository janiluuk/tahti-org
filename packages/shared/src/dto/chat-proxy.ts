// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Centrifugo publish proxy body for channel chat. */
export const ChatPublishProxySchema = z.object({
  user: z.string().optional(),
  data: z
    .object({
      text: z.string().max(500, 'message too long'),
    })
    .optional(),
})

export type ChatPublishProxyInput = z.infer<typeof ChatPublishProxySchema>
