// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RADIO_SUBMISSION_MAX_TRACKS = 5

export const RADIO_SUBMISSION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type RadioSubmissionStatus = (typeof RADIO_SUBMISSION_STATUSES)[number]

export const SubmitRadioTracksSchema = z.object({
  archiveItemIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one track')
    .max(
      RADIO_SUBMISSION_MAX_TRACKS,
      `You can submit at most ${RADIO_SUBMISSION_MAX_TRACKS} tracks at once`,
    ),
  note: z.string().trim().max(500).optional(),
})
export type SubmitRadioTracksInput = z.infer<typeof SubmitRadioTracksSchema>

export const RejectRadioSubmissionSchema = z.object({
  rejectionNote: z.string().trim().max(1000).optional(),
})
export type RejectRadioSubmissionInput = z.infer<typeof RejectRadioSubmissionSchema>

export const RadioSubmissionItemViewSchema = z.object({
  id: z.string(),
  status: z.enum(RADIO_SUBMISSION_STATUSES),
  positionInBatch: z.number().int(),
  rejectionNote: z.string().nullable(),
  reviewedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  archiveItem: z.object({
    id: z.string(),
    title: z.string(),
    artistName: z.string().nullable(),
    durationSec: z.number().int().nullable(),
    bannerUrl: z.string().nullable(),
  }),
  submitter: z
    .object({
      id: z.string(),
      username: z.string(),
      displayName: z.string(),
    })
    .optional(),
  batchId: z.string().optional(),
  batchNote: z.string().nullable().optional(),
})
export type RadioSubmissionItemView = z.infer<typeof RadioSubmissionItemViewSchema>

export const RadioSubmissionListSchema = z.object({
  items: z.array(RadioSubmissionItemViewSchema),
})
