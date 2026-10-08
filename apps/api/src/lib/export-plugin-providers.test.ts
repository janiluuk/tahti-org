// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { ExportPluginProviderListSchema } from '@tahti/shared'
import { EXPORT_PLUGIN_PROVIDERS } from './export-plugin-providers.js'

describe('EXPORT_PLUGIN_PROVIDERS', () => {
  it('lists revelator with real submit/status/webhook paths', () => {
    const body = ExportPluginProviderListSchema.parse({
      providers: EXPORT_PLUGIN_PROVIDERS,
    })

    const revelator = body.providers.find((provider) => provider.id === 'revelator')
    expect(revelator).toBeDefined()
    expect(revelator?.capabilities).toEqual({
      submit: true,
      status: true,
      webhook: true,
    })
    expect(revelator?.submitPath).toBe('/api/me/releases/:id/revelator/submit')
    expect(revelator?.statusPath).toBe('/api/me/releases/:id/revelator')
    expect(revelator?.webhookPath).toBe('/api/webhooks/export/revelator')

    const hearthis = body.providers.find((provider) => provider.id === 'hearthis-export')
    expect(hearthis?.capabilities.submit).toBe(true)
    expect(hearthis?.submitPath).toBe('/api/me/sound/:id/export/hearthis')

    for (const provider of body.providers) {
      expect(Boolean(provider.submitPath), `${provider.id} submit`).toBe(
        provider.capabilities.submit,
      )
      expect(Boolean(provider.statusPath), `${provider.id} status`).toBe(
        provider.capabilities.status,
      )
      expect(Boolean(provider.webhookPath), `${provider.id} webhook`).toBe(
        provider.capabilities.webhook,
      )
    }
  })
})
