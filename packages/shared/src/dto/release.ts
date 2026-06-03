// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RELEASE_TYPES = ['SINGLE', 'EP', 'ALBUM', 'COMPILATION', 'REMIX'] as const
export type ReleaseType = (typeof RELEASE_TYPES)[number]

export const ReleaseTypeSchema = z.enum(RELEASE_TYPES)

export const SMART_LINK_SERVICES = [
  'spotify',
  'apple',
  'tidal',
  'bandcamp',
  'soundcloud',
  'youtube',
  'deezer',
  'amazon',
  'mixcloud',
] as const

export const SmartLinkTargetsSchema = z
  .record(z.string())
  .superRefine((obj, ctx) => {
    for (const [key, value] of Object.entries(obj)) {
      if (!SMART_LINK_SERVICES.includes(key as (typeof SMART_LINK_SERVICES)[number])) {
        ctx.addIssue({ code: 'custom', message: `Unknown service: ${key}` })
        return
      }
      if (value === '' || value === null) continue
      if (typeof value !== 'string' || !value.trim()) {
        ctx.addIssue({ code: 'custom', message: `${key} must be a URL string` })
        return
      }
      try {
        const parsed = new URL(value.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          ctx.addIssue({ code: 'custom', message: `${key} must be an http(s) URL` })
        }
      } catch {
        ctx.addIssue({ code: 'custom', message: `Invalid URL for ${key}` })
      }
    }
  })
  .optional()

export const ReleaseTrackInputSchema = z.object({
  title: z.string().trim().min(1, 'track title is required').max(200),
  durationSec: z.number().int().positive().optional(),
  archiveItemId: z.string().min(1).optional(),
})

export const CreateReleaseSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  type: ReleaseTypeSchema.default('SINGLE'),
  releaseDate: z.coerce.date({ invalid_type_error: 'releaseDate is required' }),
  description: z.string().trim().max(10_000).optional(),
  artworkUrl: z.string().trim().max(2000).optional(),
  tracks: z.array(ReleaseTrackInputSchema).max(50).optional(),
})

export type CreateReleaseInput = z.infer<typeof CreateReleaseSchema>

export const PatchReleaseSchema = z.object({
  state: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  ),
  description: z.string().trim().max(10_000).optional(),
  smartLinkTargets: SmartLinkTargetsSchema,
})

export type PatchReleaseInput = z.infer<typeof PatchReleaseSchema>
