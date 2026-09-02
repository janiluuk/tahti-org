// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { IMPORT_PLUGIN_CONTRACT_VERSION, ImportPluginProviderListSchema } from './import-plugin.js'

describe('import plugin contract', () => {
  it('accepts the versioned provider metadata exchanged with Tahti Player', () => {
    const parsed = ImportPluginProviderListSchema.parse({
      providers: [
        {
          contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
          id: 'google-drive',
          name: 'Google Drive',
          description: 'Import audio files.',
          kind: 'oauth',
          capabilities: {
            configure: true,
            connectionTest: true,
            fileList: true,
            import: true,
          },
          oauthStartPath: '/api/me/google-drive/oauth/start',
          statusPath: '/api/me/google-drive',
        },
      ],
    })

    expect(parsed.providers[0]?.id).toBe('google-drive')
    expect(parsed.providers[0]?.capabilities.search).toBe(false)
    expect(parsed.providers[0]?.capabilities.playback).toBe(false)
  })

  it('accepts search and tool providers without a status or oauth path', () => {
    const parsed = ImportPluginProviderListSchema.parse({
      providers: [
        {
          contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
          id: 'hearthis',
          name: 'hearthis.at',
          description: 'Search public catalogue.',
          kind: 'search',
          capabilities: {
            configure: true,
            connectionTest: false,
            fileList: false,
            import: true,
            search: true,
            playback: true,
          },
          oauthStartPath: null,
          statusPath: null,
          searchPath: '/api/v1/imports/hearthis/search',
          importPath: '/api/v1/imports/hearthis/add',
        },
        {
          contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
          id: 'url',
          name: 'URL / DSP paste',
          description: 'Paste DSP URLs.',
          kind: 'tool',
          capabilities: {
            configure: false,
            connectionTest: false,
            fileList: false,
            import: false,
          },
          oauthStartPath: null,
          statusPath: null,
        },
      ],
    })

    expect(parsed.providers.map((provider) => provider.kind)).toEqual([
      'search',
      'tool',
    ])
  })

  it('rejects an unknown contract version', () => {
    const result = ImportPluginProviderListSchema.safeParse({ providers: [] })
    expect(result.success).toBe(true)
    expect(
      ImportPluginProviderListSchema.safeParse({
        providers: [
          {
            contractVersion: 2,
            id: 'google-drive',
            name: 'Google Drive',
            description: '',
            kind: 'oauth',
            capabilities: {
              configure: true,
              connectionTest: true,
              fileList: true,
              import: true,
            },
            oauthStartPath: null,
            statusPath: '/api/me/google-drive',
          },
        ],
      }).success,
    ).toBe(false)
  })
})
