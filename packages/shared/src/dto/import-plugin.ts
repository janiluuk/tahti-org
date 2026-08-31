// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Versioned boundary shared by Tahti core and external import clients. */
export const IMPORT_PLUGIN_CONTRACT_VERSION = 1 as const

export const ImportPluginKindSchema = z.enum(['oauth', 'upload', 'search', 'tool'])

export const ImportPluginCapabilitiesSchema = z.object({
  configure: z.boolean(),
  connectionTest: z.boolean(),
  fileList: z.boolean(),
  import: z.boolean(),
})

export const ImportPluginProviderSchema = z.object({
  contractVersion: z.literal(IMPORT_PLUGIN_CONTRACT_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: ImportPluginKindSchema,
  capabilities: ImportPluginCapabilitiesSchema,
  oauthStartPath: z.string().nullable(),
  statusPath: z.string(),
})

export const ImportPluginProviderListSchema = z.object({
  providers: z.array(ImportPluginProviderSchema),
})

export type ImportPluginProvider = z.infer<typeof ImportPluginProviderSchema>
export type ImportPluginProviderList = z.infer<typeof ImportPluginProviderListSchema>
