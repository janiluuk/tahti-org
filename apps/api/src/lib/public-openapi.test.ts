// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { renderPublicApiDocsHtml, toPublicOpenApi } from './public-openapi.js'

describe('toPublicOpenApi', () => {
  it('drops admin and internal paths/tags, keeps public routes', () => {
    const publicSpec = toPublicOpenApi(
      {
        openapi: '3.1.0',
        info: { title: 'Tahti API', version: '1' },
        tags: [
          { name: 'channel' },
          { name: 'admin' },
          { name: 'internal' },
          { name: 'transparency' },
        ],
        paths: {
          '/api/v1/channels': {
            get: { tags: ['channel'], summary: 'Directory' },
          },
          '/api/admin/stats': {
            get: { tags: ['admin'], summary: 'Board stats' },
          },
          '/internal/rtmp/on_publish': {
            post: { tags: ['internal'], summary: 'Ingest' },
          },
          '/api/v1/transparency/ytd': {
            get: { tags: ['transparency'], summary: 'YTD' },
          },
          '/metrics': {
            get: { tags: ['admin'], summary: 'Prometheus' },
          },
        },
      },
      { serverUrl: 'https://api.tahti.live', generatedAt: '2026-01-01T00:00:00.000Z' },
    )

    expect(Object.keys(publicSpec.paths ?? {}).sort()).toEqual([
      '/api/v1/channels',
      '/api/v1/transparency/ytd',
    ])
    expect(publicSpec.tags?.map((t) => t.name).sort()).toEqual(['channel', 'transparency'])
    expect(publicSpec.servers?.[0]?.url).toBe('https://api.tahti.live')
    expect(String(publicSpec.info?.description)).toContain('Generated 2026-01-01T00:00:00.000Z')
  })
})

describe('renderPublicApiDocsHtml', () => {
  it('embeds Scalar pointing at the OpenAPI URL', () => {
    const html = renderPublicApiDocsHtml('/api/openapi.json')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('@scalar/api-reference')
    expect(html).toContain('/api/openapi.json')
    expect(html).toContain('Tahti API')
  })
})
