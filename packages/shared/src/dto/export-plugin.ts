// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/**
 * Versioned boundary shared by Tahti core and Tahti Player / Nuclear clients
 * for DSP / distribution export adapters (submit → status → webhook).
 *
 * Distinct from import-plugin contracts: export providers push releases out;
 * they do not share OAuth/search/tool import shapes.
 */
export const EXPORT_PLUGIN_CONTRACT_VERSION = 1 as const

export const ExportPluginCapabilitiesSchema = z.object({
  submit: z.boolean(),
  status: z.boolean(),
  webhook: z.boolean(),
})

export const ExportPluginProviderSchema = z.object({
  contractVersion: z.literal(EXPORT_PLUGIN_CONTRACT_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  capabilities: ExportPluginCapabilitiesSchema,
  /** POST path to queue delivery. May include `:id` for the release. Null when deep-link only. */
  submitPath: z.string().nullable(),
  /** GET path for delivery status. May include `:id` for the release. */
  statusPath: z.string().nullable(),
  /** POST path for provider callbacks (internal/signed auth). */
  webhookPath: z.string().nullable(),
})

export const ExportPluginProviderListSchema = z.object({
  providers: z.array(ExportPluginProviderSchema),
})

export const ExportWebhookAcceptedSchema = z.object({
  ok: z.literal(true),
  provider: z.string().min(1),
  accepted: z.literal(true),
})

export type ExportPluginProvider = z.infer<typeof ExportPluginProviderSchema>
export type ExportPluginProviderList = z.infer<typeof ExportPluginProviderListSchema>
export type ExportWebhookAccepted = z.infer<typeof ExportWebhookAcceptedSchema>
