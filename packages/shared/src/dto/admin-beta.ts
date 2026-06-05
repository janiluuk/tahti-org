// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BetaApplicationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED'])

export const AdminBetaApplicationListQuerySchema = z.object({
  status: BetaApplicationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const AdminBetaApplicationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  artistType: z.string(),
  links: z.string().nullable(),
  message: z.string().nullable(),
  source: z.string(),
  status: BetaApplicationStatusSchema,
  userId: z.string().nullable(),
  username: z.string().nullable(),
  hasPassword: z.boolean(),
  setupUrl: z.string().nullable(),
  reviewedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const AdminBetaApplicationListSchema = z.object({
  applications: z.array(AdminBetaApplicationRowSchema),
})

export const BetaApplicationIdParamSchema = z.object({
  id: z.string().min(1),
})

export const AdminBetaApproveSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username too long')
    .regex(/^[a-z0-9_-]+$/, 'Username may only contain lowercase letters, numbers, - and _'),
  displayName: z.string().trim().min(1).max(64).optional(),
})

export const AdminBetaApproveResponseSchema = z.object({
  ok: z.literal(true),
  userId: z.string(),
  setupUrl: z.string(),
})

export const AdminBetaRejectResponseSchema = z.object({
  ok: z.literal(true),
})

export const AdminBetaResendSetupResponseSchema = z.object({
  ok: z.literal(true),
  setupUrl: z.string(),
})

export const SetupPasswordQuerySchema = z.object({
  token: z.string().min(1),
})

export const SetupPasswordInfoSchema = z.object({
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
})

export const SetupPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
})

export const SetupPasswordResponseSchema = z.object({
  ok: z.literal(true),
  user: z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    displayName: z.string(),
  }),
})
