// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// Never carries actual secret values back to the client — installed/connected
// booleans only. See packages/shared/src/integration-providers.ts for the
// registry this is a per-user view over.
export const IntegrationViewSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  scope: z.enum(['IMPORT', 'EXPORT', 'FINGERPRINT']),
  authKind: z.enum(['API_KEY', 'OAUTH']),
  installed: z.boolean(),
  connected: z.boolean(),
})
export type IntegrationView = z.infer<typeof IntegrationViewSchema>

export const IntegrationListResponseSchema = z.object({
  integrations: z.array(IntegrationViewSchema),
})

export const InstallIntegrationSchema = z.object({
  fields: z.record(z.string(), z.string()),
})
export type InstallIntegrationInput = z.infer<typeof InstallIntegrationSchema>

export const IntegrationSlugParamSchema = z.object({
  slug: z.string().min(1),
})
