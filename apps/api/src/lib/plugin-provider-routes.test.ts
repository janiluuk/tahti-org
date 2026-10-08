// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { IMPORT_PLUGIN_PROVIDERS } from './import-plugin-providers.js'
import { EXPORT_PLUGIN_PROVIDERS } from './export-plugin-providers.js'

type Method = 'get' | 'post'
type OpenApiOperation = { tags?: string[]; summary?: string; description?: string }
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

  it.each(advertised)('$provider $field → $method $path', ({ method, path }) => {
    const documented = Object.keys(paths).find(
      (candidate) => samePath(path, candidate) && paths[candidate]?.[method],
    )
    const operation = documented ? paths[documented]?.[method] : undefined
    expect(operation, `${method.toUpperCase()} ${path} is not a documented route`).toBeDefined()
    expect(operation?.tags?.length, `${path} has no OpenAPI tag`).toBeGreaterThan(0)
    expect(
      operation?.summary ?? operation?.description,
      `${path} has no OpenAPI summary or description`,
    ).toBeTruthy()
  })
})
