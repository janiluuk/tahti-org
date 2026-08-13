// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** 'read' covers GET/HEAD/OPTIONS; 'write' is required for any mutating request
 * made with a Bearer token (enforced in the API's auth plugin, not per-route) — see
 * requireBearerScope in apps/api/src/plugins/auth.ts. */
export const ApiTokenScopeSchema = z.enum(['read', 'write'])

export const CreateApiTokenSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(64),
  scopes: z.array(ApiTokenScopeSchema).min(1).optional(),
  /** Optional expiry; omit for a token that doesn't expire. */
  expiresInDays: z.number().int().positive().max(3650).optional(),
})
export type CreateApiTokenInput = z.infer<typeof CreateApiTokenSchema>

export const ApiTokenViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** First few characters of the token, e.g. "tahti_ab12" — the rest is never stored or shown again. */
  tokenPrefix: z.string(),
  scopes: z.array(ApiTokenScopeSchema),
  lastUsedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})
export type ApiTokenView = z.infer<typeof ApiTokenViewSchema>

export const ApiTokenListSchema = z.array(ApiTokenViewSchema)

/** Returned once, at creation — the only time the plaintext token is ever available. */
export const ApiTokenCreatedSchema = ApiTokenViewSchema.extend({
  token: z.string(),
})
export type ApiTokenCreated = z.infer<typeof ApiTokenCreatedSchema>
