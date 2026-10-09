// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { IMPORT_PLUGIN_PROVIDERS } from './import-plugin-providers.js'
import { EXPORT_PLUGIN_PROVIDERS } from './export-plugin-providers.js'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
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
    ['DELETE', '/api/me/spotify-profile', '204', 'imports'] as const,
    ['GET', '/api/me/import-plugins', '200', 'imports'] as const,
    ['GET', '/api/me/export-plugins', '200', 'releases'] as const,
    ['GET', '/api/me/mixcloud', '200', 'imports'] as const,
    ['POST', '/api/me/sound/:itemId/mixcloud', '202', 'releases'] as const,
    ['POST', '/api/me/releases/:id/revelator/submit', '202', 'releases'] as const,
    ['GET', '/api/me/integrations', '200', 'integrations'] as const,
    ['POST', '/api/me/integrations/:slug/install', '204', 'integrations'] as const,
    ['DELETE', '/api/me/integrations/:slug', '204', 'integrations'] as const,
    ['POST', '/api/me/sound/:id/export/hearthis', '202', 'releases'] as const,
    ['POST', '/api/uploads/complete', '201', 'imports'] as const,
    ['POST', '/api/me/stash', '201', 'imports'] as const,
    ['POST', '/api/me/stash/prepare', '200', 'imports'] as const,
    ['GET', '/api/me/stash/:id/download', '200', 'imports'] as const,
    ['POST', '/api/me/stash/:id/share', '201', 'imports'] as const,
    ['GET', '/api/v1/imports/spotify/me-tracks', '200', 'imports'] as const,
    ['GET', '/api/v1/imports/mixcloud/me-tracks', '200', 'imports'] as const,
    ['GET', '/api/v1/imports/hearthis/me-tracks', '200', 'imports'] as const,
    ['POST', '/api/me/integrations/lastfm/prepare', '200', 'integrations'] as const,
    ['GET', '/api/me/integrations/lastfm/oauth/start', '302', 'integrations'] as const,
    ['DELETE', '/api/me/stash/:id', '200', 'imports'] as const,
    ['DELETE', '/api/me/stash/shares/:shareId', '200', 'imports'] as const,
    ['GET', '/api/me/releases/:id/revelator/royalties', '200', 'releases'] as const,
    ['GET', '/api/me/revelator/royalties', '200', 'releases'] as const,
    ['GET', '/api/me/distribution/status', '200', 'releases'] as const,
    ['POST', '/api/webhooks/export/:provider', '200', 'webhooks'] as const,
    ['GET', '/api/me/sound/:id/shares', '200', 'channel'] as const,
    ['POST', '/api/me/sound/:id/share', '201', 'channel'] as const,
    ['DELETE', '/api/me/sound/shares/:shareId', '204', 'channel'] as const,
    ['POST', '/api/listen-events', '200', 'engagement'] as const,
    ['GET', '/api/admin/discord-bot', '200', 'admin'] as const,
    ['PUT', '/api/admin/discord-bot', '200', 'admin'] as const,
    ['POST', '/api/admin/discord-bot/restart', '200', 'admin'] as const,
    ['GET', '/api/v1/internal/discord-bot/credentials', '200', 'internal'] as const,
    ['POST', '/api/v1/internal/discord-bot/heartbeat', '200', 'internal'] as const,
    ['GET', '/api/v1/themes/gallery', '200', 'themes'] as const,
    ['GET', '/api/me/themes', '200', 'themes'] as const,
    ['POST', '/api/me/themes', '201', 'themes'] as const,
    ['PATCH', '/api/me/themes/:id', '200', 'themes'] as const,
    ['DELETE', '/api/me/themes/:id', '204', 'themes'] as const,
    ['POST', '/api/me/themes/:id/submit-public', '200', 'themes'] as const,
    ['GET', '/api/admin/themes', '200', 'admin'] as const,
    ['POST', '/api/admin/themes/:id/approve', '200', 'admin'] as const,
    ['POST', '/api/admin/themes/:id/reject', '200', 'admin'] as const,
    ['POST', '/api/v1/jam', '201', 'jam'] as const,
    ['POST', '/api/v1/jam/:code/join', '200', 'jam'] as const,
    ['GET', '/api/v1/jam/:id', '200', 'jam'] as const,
    ['GET', '/api/v1/jam/:id/events', '200', 'jam'] as const,
    ['POST', '/api/v1/jam/:id/state', '200', 'jam'] as const,
    ['POST', '/api/v1/jam/:id/leave', '204', 'jam'] as const,
    ['DELETE', '/api/v1/jam/:id', '204', 'jam'] as const,
    ['GET', '/api/addons/store', '200', 'addons'] as const,
    ['GET', '/api/me/addons/installs', '200', 'addons'] as const,
    ['POST', '/api/me/addons/installs', '201', 'addons'] as const,
    ['PATCH', '/api/me/addons/installs/:id', '200', 'addons'] as const,
    ['DELETE', '/api/me/addons/installs/:id', '204', 'addons'] as const,
    ['GET', '/api/me/channel/addons/installs', '200', 'addons'] as const,
    ['POST', '/api/me/channel/addons/installs', '201', 'addons'] as const,
    ['PATCH', '/api/me/channel/addons/installs/:id', '200', 'addons'] as const,
    ['DELETE', '/api/me/channel/addons/installs/:id', '204', 'addons'] as const,
    ['GET', '/api/comments/track/:id', '200', 'comments'] as const,
    ['POST', '/api/comments/track/:id', '201', 'comments'] as const,
    ['GET', '/api/comments/channel/:slug', '200', 'comments'] as const,
    ['POST', '/api/comments/channel/:slug', '201', 'comments'] as const,
    ['DELETE', '/api/comments/:id', '204', 'comments'] as const,
    ['GET', '/api/reactions/track/:id', '200', 'engagement'] as const,
    ['POST', '/api/reactions/track/:id', '201', 'engagement'] as const,
    ['POST', '/api/v1/listen/heartbeat', '204', 'engagement'] as const,
    ['GET', '/api/me/mentions/settings', '200', 'mentions'] as const,
    ['GET', '/api/me/mentions', '200', 'mentions'] as const,
    ['PATCH', '/api/me/mentions/settings', '200', 'mentions'] as const,
    ['POST', '/api/me/mentions/mute/:handle', '201', 'mentions'] as const,
    ['DELETE', '/api/me/mentions/mute/:handle', '200', 'mentions'] as const,
    ['GET', '/api/me/social', '200', 'releases'] as const,
    ['PUT', '/api/me/social/mastodon', '200', 'releases'] as const,
    ['PUT', '/api/me/social/bluesky', '200', 'releases'] as const,
    ['POST', '/api/me/social/post', '201', 'releases'] as const,
    ['DELETE', '/api/me/social/mastodon', '200', 'releases'] as const,
    ['DELETE', '/api/me/social/bluesky', '200', 'releases'] as const,
    ['GET', '/api/me/social/twitter/oauth/start', '302', 'releases'] as const,
    ['GET', '/api/me/social/twitter/oauth/callback', '302', 'releases'] as const,
    ['DELETE', '/api/me/social/twitter', '200', 'releases'] as const,
    ['GET', '/api/me/social/instagram/oauth/start', '302', 'releases'] as const,
    ['GET', '/api/me/social/instagram/oauth/callback', '302', 'releases'] as const,
    ['DELETE', '/api/me/social/instagram', '200', 'releases'] as const,
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
