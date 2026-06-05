// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RevelatorReleaseStatusSchema = z.object({
  revelatorId: z.string().nullable(),
  revelatorStatus: z.string().nullable(),
  title: z.string(),
})

export const RevelatorSubmitAcceptedSchema = z.object({
  releaseId: z.string(),
  revelatorStatus: z.literal('pending'),
})
