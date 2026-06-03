// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MotionChoiceSchema = z.enum(['YES', 'NO', 'ABSTAIN'])
export type MotionChoice = z.infer<typeof MotionChoiceSchema>

export const CreateMotionSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200),
    description: z.string().trim().min(1, 'description is required').max(10_000),
    openAt: z.coerce.date(),
    closeAt: z.coerce.date(),
    advisory: z.boolean().optional(),
  })
  .refine((d) => d.closeAt > d.openAt, {
    message: 'closeAt must be after openAt',
    path: ['closeAt'],
  })

export type CreateMotionInput = z.infer<typeof CreateMotionSchema>

export const PatchMotionSchema = z.object({
  state: z.enum(['OPEN', 'CLOSED']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
})

export type PatchMotionInput = z.infer<typeof PatchMotionSchema>

export const VoteMotionSchema = z.object({
  choice: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), MotionChoiceSchema),
})

export type VoteMotionInput = z.infer<typeof VoteMotionSchema>
