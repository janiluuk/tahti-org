// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  tier: z.string(),
  emailVerifiedAt: z.coerce.date().nullable(),
  isMember: z.boolean(),
  isBoard: z.boolean(),
  membership: z
    .object({
      status: z.string(),
      activatedAt: z.coerce.date().nullable(),
    })
    .nullable(),
  channel: z
    .object({
      slug: z.string(),
      state: z.string(),
      goneLiveAt: z.coerce.date().nullable(),
      nextBroadcastAt: z.coerce.date().nullable(),
      customDomain: z.string().nullable(),
      customDomainVerified: z.boolean(),
    })
    .nullable(),
  storage: z.object({
    usedBytes: z.string(),
    /** Soft target for free-tier nudges only; omitted for members. */
    softTargetBytes: z.string().optional(),
    showSoftTarget: z.boolean(),
  }),
})

export const AuthUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  tier: z.string(),
})

export const AuthLoginResponseSchema = z.object({
  user: AuthUserSummarySchema.optional(),
  requiresTotp: z.boolean().optional(),
  challengeId: z.string().optional(),
  accessToken: z.string().optional(),
  expiresIn: z.number().int().min(1).optional(),
  refreshToken: z.string().optional(),
})

export const AuthTokenRefreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().min(1),
  refreshToken: z.string().optional(),
})

export const AuthSessionListItemSchema = z.object({
  id: z.string(),
  deviceLabel: z.string().nullable(),
  createdAt: z.coerce.date(),
  lastUsedAt: z.coerce.date().nullable(),
  current: z.boolean(),
})

export const AuthSessionListResponseSchema = z.object({
  sessions: z.array(AuthSessionListItemSchema),
})

export const TotpStatusResponseSchema = z.object({
  enabled: z.boolean(),
})

export const TotpSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
})

export const TotpConfirmResponseSchema = z.object({
  backupCodes: z.array(z.string()),
})

export const AuthRegisterResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
})

export const AuthMessageResponseSchema = z.object({
  message: z.string(),
})
