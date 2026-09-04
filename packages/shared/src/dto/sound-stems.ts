// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const STEM_SETS = ['TWO_STEM', 'FOUR_STEM'] as const
export const StemSetSchema = z.enum(STEM_SETS)
export type StemSetInput = z.infer<typeof StemSetSchema>

export const STEM_SET_LABELS: Record<StemSetInput, string> = {
  TWO_STEM: 'Vocals + instrumental',
  FOUR_STEM: 'Vocals, drums, bass, other',
}

export const RequestStemsSchema = z.object({
  stemSet: StemSetSchema,
})

export const STEM_JOB_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'ERROR'] as const
export const StemJobStatusSchema = z.enum(STEM_JOB_STATUSES)

export const StemFileSchema = z.object({
  label: z.string(),
  url: z.string().url(),
})

export const StemJobViewSchema = z.object({
  stemSet: StemSetSchema,
  status: StemJobStatusSchema,
  errorMessage: z.string().nullable(),
  files: z.array(StemFileSchema),
})

export const SoundStemsResponseSchema = z.object({
  jobs: z.array(StemJobViewSchema),
})

export const SoundDownloadResponseSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
})
