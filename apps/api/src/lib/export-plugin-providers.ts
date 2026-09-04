// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ExportPluginProvider } from '@tahti/shared'
import { EXPORT_PLUGIN_CONTRACT_VERSION } from '@tahti/shared'

/**
 * Core-owned export-provider metadata for Tahti Player / Nuclear clients.
 * Credentials stay in `/api/me/integrations`; this registry is route + capability
 * discovery only.
 *
 * Revelator is the live DSP delivery path. Storefront IDs (spotify, apple, …)
 * remain deep-link stubs until a provider-specific submit exists — they still
 * go through Revelator in Studio distribution.
 */
export const EXPORT_PLUGIN_PROVIDERS: ExportPluginProvider[] = [
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'revelator',
    name: 'Revelator',
    description:
      'Submit a release for DSP delivery (Spotify, Apple Music, Deezer, YouTube Music, and peers).',
    capabilities: {
      submit: true,
      status: true,
      webhook: true,
    },
    submitPath: '/api/me/releases/:id/revelator/submit',
    statusPath: '/api/me/releases/:id/revelator',
    webhookPath: '/api/webhooks/export/revelator',
  },
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'spotify',
    name: 'Spotify',
    description: 'Storefront target reached through Revelator — open Studio distribution.',
    capabilities: {
      submit: false,
      status: false,
      webhook: false,
    },
    submitPath: null,
    statusPath: null,
    webhookPath: null,
  },
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'apple',
    name: 'Apple Music',
    description: 'Storefront target reached through Revelator — open Studio distribution.',
    capabilities: {
      submit: false,
      status: false,
      webhook: false,
    },
    submitPath: null,
    statusPath: null,
    webhookPath: null,
  },
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'deezer',
    name: 'Deezer',
    description: 'Storefront target reached through Revelator — open Studio distribution.',
    capabilities: {
      submit: false,
      status: false,
      webhook: false,
    },
    submitPath: null,
    statusPath: null,
    webhookPath: null,
  },
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'youtube',
    name: 'YouTube Music',
    description: 'Storefront target reached through Revelator — open Studio distribution.',
    capabilities: {
      submit: false,
      status: false,
      webhook: false,
    },
    submitPath: null,
    statusPath: null,
    webhookPath: null,
  },
  {
    contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
    id: 'hearthis-export',
    name: 'hearthis.at',
    description:
      'Push a track to a hearthis.at Premium account. Credentials via /api/me/integrations; submit route not yet wired.',
    capabilities: {
      submit: false,
      status: false,
      webhook: false,
    },
    submitPath: null,
    statusPath: null,
    webhookPath: null,
  },
]
