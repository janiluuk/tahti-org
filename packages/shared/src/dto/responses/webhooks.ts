// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const StripeWebhookAckSchema = z.object({
  received: z.boolean(),
})

export const StripeWebhookErrorSchema = z.object({
  error: z.string(),
  received: z.boolean().optional(),
})
