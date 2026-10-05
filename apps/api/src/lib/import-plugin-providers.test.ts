// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { ImportPluginProviderListSchema } from '@tahti/shared'
import { IMPORT_PLUGIN_PROVIDERS } from './import-plugin-providers.js'

describe('IMPORT_PLUGIN_PROVIDERS', () => {
  it('lists oauth, search, and tool/upload kinds with matching path rules', () => {
    const body = ImportPluginProviderListSchema.parse({
      providers: IMPORT_PLUGIN_PROVIDERS,
    })

    const byKind = {
      oauth: body.providers
        .filter((provider) => provider.kind === 'oauth')
        .map((provider) => provider.id),
      search: body.providers
        .filter((provider) => provider.kind === 'search')
        .map((provider) => provider.id),
      tool: body.providers
        .filter((provider) => provider.kind === 'tool')
        .map((provider) => provider.id),
      upload: body.providers
        .filter((provider) => provider.kind === 'upload')
        .map((provider) => provider.id),
    }

    expect(byKind.oauth).toEqual(
      expect.arrayContaining(['google-drive', 'bandcamp', 'soundcloud', 'mixcloud']),
    )
    expect(byKind.search).toEqual(expect.arrayContaining(['spotify', 'hearthis', 'mixcloud-embed']))
    const mixcloudEmbed = body.providers.find((provider) => provider.id === 'mixcloud-embed')
    expect(mixcloudEmbed?.searchPath).toBe('/api/v1/imports/mixcloud/search')
    expect(mixcloudEmbed?.importPath).toBe('/api/v1/imports/mixcloud/add')
    expect(mixcloudEmbed?.capabilities.search).toBe(true)
    expect(byKind.tool).toEqual(expect.arrayContaining(['url', 'radio']))
    expect(byKind.upload).toEqual(expect.arrayContaining(['upload', 'stash']))

    for (const provider of body.providers) {
      if (provider.kind === 'oauth') {
        expect(provider.oauthStartPath).toBeTruthy()
        expect(provider.statusPath).toBeTruthy()
      } else {
        expect(provider.oauthStartPath).toBeNull()
      }
      if (provider.capabilities.import) {
        expect(provider.importPath).toBeTruthy()
      }
      if (provider.capabilities.search) {
        expect(provider.searchPath).toBeTruthy()
      }
      if (provider.capabilities.fileList) {
        expect(provider.listPath).toBeTruthy()
      }
    }

    const bandcamp = body.providers.find((provider) => provider.id === 'bandcamp')
    expect(bandcamp?.capabilities.import).toBe(false)
    expect(bandcamp?.importPath).toBeNull()

    const googleDrive = body.providers.find((provider) => provider.id === 'google-drive')
    expect(googleDrive?.importPath).toBe('/api/me/google-drive/import')
  })
})
