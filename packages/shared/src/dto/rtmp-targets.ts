// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RtmpProviderSchema = z.enum([
  'YOUTUBE',
  'TWITCH',
  'FACEBOOK',
  'KICK',
  'TIKTOK',
  'MIXCLOUD_LIVE',
  'INSTAGRAM',
  'CUSTOM',
])

export type RtmpProvider = z.infer<typeof RtmpProviderSchema>

export const CreateRtmpTargetSchema = z.object({
  provider: z
    .string()
    .optional()
    .transform((v) => (v ?? 'CUSTOM').toUpperCase())
    .pipe(RtmpProviderSchema),
  label: z.string().trim().min(1, 'label is required').max(64),
  streamKey: z.string().trim().min(1, 'streamKey is required'),
  rtmpUrl: z.string().trim().optional(),
  alwaysMirror: z.boolean().optional(),
})

export type CreateRtmpTargetInput = z.infer<typeof CreateRtmpTargetSchema>

export const PatchRtmpTargetSchema = z.object({
  enabled: z.boolean().optional(),
  streamKey: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).max(64).optional(),
})

export type PatchRtmpTargetInput = z.infer<typeof PatchRtmpTargetSchema>
