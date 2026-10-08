// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { IMPORT_PLUGIN_PROVIDERS } from './import-plugin-providers.js'
import { EXPORT_PLUGIN_PROVIDERS } from './export-plugin-providers.js'

type Method = 'get' | 'post'
type OpenApiOperation = {
  tags?: string[]
  summary?: string
  description?: string
  responses?: Record<string, unknown>
}
type OpenApiPaths = Record<string, Partial<Record<Method, OpenApiOperation>>>

const isParam = (segment: string) => segment.startsWith(':') || segment.startsWith('{')

/**
 * A catalog path matches a documented one when every segment is equal or a
 * parameter on either side: `/api/me/sound/:id/x` ↔ `/api/me/sound/{id}/x`, and
 * the concrete `/api/webhooks/export/revelator` ↔ `/api/webhooks/export/{provider}`.
 */
function samePath(advertisedPath: string, documentedPath: string): boolean {
  const a = advertisedPath.split('/')
  const b = documentedPath.split('/')
  return (
    a.length === b.length && a.every((seg, i) => seg === b[i] || isParam(seg) || isParam(b[i]!))
  )
}

/**
 * The plugin catalogs are how Tahti Player finds these routes, so a path in a
 * catalog that no route answers is a broken button in the player. Every path a
 * provider advertises must be a registered route with OpenAPI docs.
 */
describe('plugin provider catalogs point at real, documented routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let paths: OpenApiPaths

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    paths = (app.swagger() as { paths?: OpenApiPaths }).paths ?? {}
  })

  afterAll(async () => {
    await app.close()
  })

  const advertised: Array<{ provider: string; field: string; method: Method; path: string }> = []
  for (const provider of IMPORT_PLUGIN_PROVIDERS) {
    const fields: Array<[string, Method, string | null | undefined]> = [
      ['oauthStartPath', 'get', provider.oauthStartPath],
      ['statusPath', 'get', provider.statusPath],
      ['listPath', 'get', provider.listPath],
      ['searchPath', 'get', provider.searchPath],
      ['importPath', 'post', provider.importPath],
    ]
    for (const [field, method, path] of fields) {
      if (path) advertised.push({ provider: `import:${provider.id}`, field, method, path })
    }
  }
  for (const provider of EXPORT_PLUGIN_PROVIDERS) {
    const fields: Array<[string, Method, string | null]> = [
      ['submitPath', 'post', provider.submitPath],
      ['statusPath', 'get', provider.statusPath],
      ['webhookPath', 'post', provider.webhookPath],
    ]
    for (const [field, method, path] of fields) {
      if (path) advertised.push({ provider: `export:${provider.id}`, field, method, path })
    }
  }

  it('advertises at least the OAuth, search, upload and export paths', () => {
    expect(advertised.length).toBeGreaterThan(20)
  })

  function operationFor(method: Method, path: string): OpenApiOperation | undefined {
    const documented = Object.keys(paths).find(
      (candidate) => samePath(path, candidate) && paths[candidate]?.[method],
    )
    return documented ? paths[documented]?.[method] : undefined
  }

  it.each(advertised)('$provider $field → $method $path', ({ method, path }) => {
    const operation = operationFor(method, path)
    expect(operation, `${method.toUpperCase()} ${path} is not a documented route`).toBeDefined()
    expect(operation?.tags?.length, `${path} has no OpenAPI tag`).toBeGreaterThan(0)
    expect(
      operation?.summary ?? operation?.description,
      `${path} has no OpenAPI summary or description`,
    ).toBeTruthy()
  })

  /**
   * Queued Drive/SoundCloud import and hearthis-export send 202; search/add
   * sends 201; prepare-upload sends 200. OpenAPI must document that status,
   * not a default 200 that clients then treat as the success body.
   */
  it.each([
    ['POST', '/api/me/google-drive/import', '202', 'imports'] as const,
    ['POST', '/api/me/soundcloud/import', '202', 'imports'] as const,
    ['POST', '/api/v1/imports/spotify/add', '201', 'imports'] as const,
    ['POST', '/api/v1/imports/mixcloud/add', '201', 'imports'] as const,
    ['POST', '/api/v1/imports/hearthis/add', '201', 'imports'] as const,
    ['POST', '/api/uploads/prepare', '200', 'imports'] as const,
    ['GET', '/api/me/stash', '200', 'imports'] as const,
    ['GET', '/api/me/spotify-profile', '200', 'imports'] as const,
    ['POST', '/api/me/sound/:id/export/hearthis', '202', 'releases'] as const,
  ])('%s %s documents %s under %s', (method, path, status, tag) => {
    const operation = operationFor(method.toLowerCase() as Method, path)
    expect(operation, `${method} ${path} is not documented`).toBeDefined()
    expect(operation?.tags).toContain(tag)
    expect(
      operation?.responses?.[status],
      `${method} ${path} should document ${status}`,
    ).toBeDefined()
  })

  it('documents the SoundCloud desktop download as a 302 (not hidden)', () => {
    const operation = operationFor('get', '/api/v1/imports/soundcloud/tracks/:trackId/download')
    expect(operation, 'SoundCloud download route is hidden or missing from OpenAPI').toBeDefined()
    expect(operation?.tags).toContain('imports')
    expect(operation?.responses?.['302']).toBeDefined()
  })
})
