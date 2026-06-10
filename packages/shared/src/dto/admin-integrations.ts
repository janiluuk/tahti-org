// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminIntegrationStatusSchema = z.object({
  id: z.enum(['mixcloud', 'revelator']),
  label: z.string(),
  configured: z.boolean(),
  mode: z.enum(['live', 'stub']),
  detail: z.string().optional(),
})

export const AdminIntegrationsStatusSchema = z.object({
  integrations: z.array(AdminIntegrationStatusSchema),
})

export type AdminIntegrationStatus = z.infer<typeof AdminIntegrationStatusSchema>
export type AdminIntegrationsStatus = z.infer<typeof AdminIntegrationsStatusSchema>
