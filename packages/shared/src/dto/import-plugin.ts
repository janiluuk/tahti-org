// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/**
 * Versioned boundary shared by Tahti core and Tahti Player / Nuclear clients.
 *
 * Providers are intentionally split by kind so clients do not force OAuth,
 * search, and link/tool sources into one start/status/import shape:
 * - oauth: connect/disconnect + optional catalog/import routes
 * - search: search-then-add (no OAuth lifecycle)
 * - tool / upload: paste-a-link or local upload surfaces
 *
 * Export/delivery (Revelator DSP submit/status/webhook) is a separate contract
 * — see `dto/export-plugin.ts` and `GET /api/me/export-plugins`.
 */
export const IMPORT_PLUGIN_CONTRACT_VERSION = 1 as const

export const ImportPluginKindSchema = z.enum(['oauth', 'upload', 'search', 'tool'])

export const ImportPluginCapabilitiesSchema = z.object({
  configure: z.boolean(),
  connectionTest: z.boolean(),
  fileList: z.boolean(),
  import: z.boolean(),
  search: z.boolean().default(false),
  playback: z.boolean().default(false),
})

export const ImportPluginProviderSchema = z.object({
  contractVersion: z.literal(IMPORT_PLUGIN_CONTRACT_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: ImportPluginKindSchema,
  capabilities: ImportPluginCapabilitiesSchema,
  oauthStartPath: z.string().nullable(),
  /** Connection/status probe. Null for sources with no account connection. */
  statusPath: z.string().nullable(),
  /** Public or app-token search route, when the kind supports search. */
  searchPath: z.string().nullable().optional(),
  /** Catalog listing route (albums/tracks/files), when fileList is true. */
  listPath: z.string().nullable().optional(),
  /** Import/add mutation route, when import is true. */
  importPath: z.string().nullable().optional(),
})

export const ImportPluginProviderListSchema = z.object({
  providers: z.array(ImportPluginProviderSchema),
})

export type ImportPluginProvider = z.infer<typeof ImportPluginProviderSchema>
export type ImportPluginProviderList = z.infer<typeof ImportPluginProviderListSchema>
