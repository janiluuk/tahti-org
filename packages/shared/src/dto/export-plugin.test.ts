// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  EXPORT_PLUGIN_CONTRACT_VERSION,
  ExportPluginProviderListSchema,
  ExportWebhookAcceptedSchema,
} from './export-plugin.js'

describe('export plugin contract', () => {
  it('accepts the versioned provider metadata exchanged with Tahti Player', () => {
    const parsed = ExportPluginProviderListSchema.parse({
      providers: [
        {
          contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
          id: 'revelator',
          name: 'Revelator',
          description: 'DSP delivery via Revelator.',
          capabilities: {
            submit: true,
            status: true,
            webhook: true,
          },
          submitPath: '/api/me/releases/:id/revelator/submit',
          statusPath: '/api/me/releases/:id/revelator',
          webhookPath: '/api/webhooks/export/revelator',
        },
      ],
    })

    expect(parsed.providers[0]?.id).toBe('revelator')
    expect(parsed.providers[0]?.capabilities.submit).toBe(true)
    expect(parsed.providers[0]?.webhookPath).toContain('/api/webhooks/export/')
  })

  it('accepts deep-link-only stubs with null route paths', () => {
    const parsed = ExportPluginProviderListSchema.parse({
      providers: [
        {
          contractVersion: EXPORT_PLUGIN_CONTRACT_VERSION,
          id: 'spotify',
          name: 'Spotify',
          description: 'Storefront target reached through Revelator.',
          capabilities: {
            submit: false,
            status: false,
            webhook: false,
          },
          submitPath: null,
          statusPath: null,
          webhookPath: null,
        },
      ],
    })

    expect(parsed.providers[0]?.capabilities).toEqual({
      submit: false,
      status: false,
      webhook: false,
    })
  })

  it('rejects an unknown contract version', () => {
    expect(ExportPluginProviderListSchema.safeParse({ providers: [] }).success).toBe(true)
    expect(
      ExportPluginProviderListSchema.safeParse({
        providers: [
          {
            contractVersion: 2,
            id: 'revelator',
            name: 'Revelator',
            description: '',
            capabilities: { submit: true, status: true, webhook: true },
            submitPath: '/api/me/releases/:id/revelator/submit',
            statusPath: '/api/me/releases/:id/revelator',
            webhookPath: null,
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('accepts the webhook ack shape', () => {
    expect(
      ExportWebhookAcceptedSchema.parse({
        ok: true,
        provider: 'revelator',
        accepted: true,
      }),
    ).toEqual({ ok: true, provider: 'revelator', accepted: true })
  })
})
