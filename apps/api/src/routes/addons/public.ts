// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Rendering feeds — what a page fetches to render OTHER people's installed
// widgets. Distinct from routes/me/addons.ts (which manages "my"
// installs): these never require owning the install, only being allowed to
// see the surface at all (public for a channel page / homepage, requireAuth
// for a listener's own Discover page).

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Addon } from '@tahti/db'
import {
  AddonBundleHashParamSchema,
  AddonRenderListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { getObjectBuffer } from '../../lib/minio.js'
import { resolveAddonRenderSet } from '../../lib/addons.js'

function sandboxUrl(bundleHash: string): string {
  return `/widget-sandbox/${bundleHash}`
}

async function resolveVersionHash(
  fastify: FastifyInstance,
  widget: Pick<Addon, 'id' | 'currentVersion' | 'bundleHash'>,
  pinnedVersion: string | null,
): Promise<{ version: string; bundleHash: string }> {
  if (!pinnedVersion || pinnedVersion === widget.currentVersion) {
    return { version: widget.currentVersion, bundleHash: widget.bundleHash }
  }
  const pinned = await fastify.prisma.addonVersion.findUnique({
    where: { widgetId_version: { widgetId: widget.id, version: pinnedVersion } },
  })
  // Pinned version was deleted from history somehow — fall back to current
  // rather than serving a broken/missing bundle.
  if (!pinned) return { version: widget.currentVersion, bundleHash: widget.bundleHash }
  return { version: pinned.version, bundleHash: pinned.bundleHash }
}

const addonPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/channels/:slug/addons — public, no auth
  fastify.get(
    '/api/v1/channels/:slug/addons',
    {
      schema: {
        tags: ['addons'],
        response: openApiResponse(AddonRenderListSchema, 'ChannelAddonRenderList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, slug: true, state: true, user: { select: { displayName: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { explicitInstalls, defaultOnlyWidgets } = await resolveAddonRenderSet(
        fastify.prisma,
        'ARTIST',
        { channelId: channel.id },
      )
      const context = {
        channelSlug: channel.slug,
        displayName: channel.user.displayName,
        isLive: channel.state === 'LIVE',
      }

      const fromInstalls = await Promise.all(
        explicitInstalls.map(async (install) => {
          const { version, bundleHash } = await resolveVersionHash(
            fastify,
            install.widget,
            install.pinnedVersion,
          )
          return {
            installId: install.id,
            widgetSlug: install.widget.slug,
            name: install.widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: install.position,
            config: install.configJson,
            context,
          }
        }),
      )
      const fromDefaults = await Promise.all(
        defaultOnlyWidgets.map(async (widget, index) => {
          const { version, bundleHash } = await resolveVersionHash(fastify, widget, null)
          return {
            installId: `default:${widget.id}`,
            widgetSlug: widget.slug,
            name: widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: explicitInstalls.length + index,
            config: widget.defaultConfigJson ?? {},
            context,
          }
        }),
      )
      return reply.send({ widgets: [...fromInstalls, ...fromDefaults] })
    },
  )

  // GET /api/v1/addons/homepage — public, no auth
  fastify.get(
    '/api/v1/addons/homepage',
    {
      schema: {
        tags: ['addons'],
        response: openApiResponse(AddonRenderListSchema, 'HomepageAddonRenderList'),
      },
    },
    async (_request, reply) => {
      const { explicitInstalls, defaultOnlyWidgets } = await resolveAddonRenderSet(
        fastify.prisma,
        'ADMIN',
        { adminSurface: 'homepage' },
      )
      const context = { surface: 'homepage' }

      const fromInstalls = await Promise.all(
        explicitInstalls.map(async (install) => {
          const { version, bundleHash } = await resolveVersionHash(
            fastify,
            install.widget,
            install.pinnedVersion,
          )
          return {
            installId: install.id,
            widgetSlug: install.widget.slug,
            name: install.widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: install.position,
            config: install.configJson,
            context,
          }
        }),
      )
      const fromDefaults = await Promise.all(
        defaultOnlyWidgets.map(async (widget, index) => {
          const { version, bundleHash } = await resolveVersionHash(fastify, widget, null)
          return {
            installId: `default:${widget.id}`,
            widgetSlug: widget.slug,
            name: widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: explicitInstalls.length + index,
            config: widget.defaultConfigJson ?? {},
            context,
          }
        }),
      )
      return reply.send({ widgets: [...fromInstalls, ...fromDefaults] })
    },
  )

  // GET /api/v1/addons/discover — the caller's own enabled listener
  // widgets, kept separate from /api/me/addons/installs (install
  // management) so this render-only shape can never leak management fields.
  fastify.get(
    '/api/v1/addons/discover',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        response: openApiResponse(AddonRenderListSchema, 'DiscoverAddonRenderList'),
      },
    },
    async (request, reply) => {
      const { explicitInstalls, defaultOnlyWidgets } = await resolveAddonRenderSet(
        fastify.prisma,
        'LISTENER',
        { listenerUserId: request.sessionUser!.id },
      )

      const fromInstalls = await Promise.all(
        explicitInstalls.map(async (install) => {
          const { version, bundleHash } = await resolveVersionHash(
            fastify,
            install.widget,
            install.pinnedVersion,
          )
          return {
            installId: install.id,
            widgetSlug: install.widget.slug,
            name: install.widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: install.position,
            config: install.configJson,
            context: {},
          }
        }),
      )
      const fromDefaults = await Promise.all(
        defaultOnlyWidgets.map(async (widget, index) => {
          const { version, bundleHash } = await resolveVersionHash(fastify, widget, null)
          return {
            installId: `default:${widget.id}`,
            widgetSlug: widget.slug,
            name: widget.name,
            sandboxUrl: sandboxUrl(bundleHash),
            version,
            position: explicitInstalls.length + index,
            config: widget.defaultConfigJson ?? {},
            context: {},
          }
        }),
      )
      return reply.send({ widgets: [...fromInstalls, ...fromDefaults] })
    },
  )

  // GET /api/v1/addons/bundle/:bundleHash — proxied by apps/web's own
  // /widget-sandbox/bundle/[bundleHash] route, then loaded there via
  // <script src integrity="sha256-..."> (see bundleHashToIntegrity in
  // @tahti/shared) so the browser's own SRI check enforces that these are
  // really the approved bytes. Public and unauthenticated by design — a
  // widget bundle is static, reviewed, non-secret code; the hash is an
  // integrity check, not a capability token.
  fastify.get('/api/v1/addons/bundle/:bundleHash', async (request, reply) => {
    const routeParams = parseRouteParams(AddonBundleHashParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const version = await fastify.prisma.addonVersion.findFirst({
      where: { bundleHash: routeParams.bundleHash },
      select: { bundleKey: true },
    })
    if (!version) return reply.status(404).send({ error: 'Bundle not found' })

    let bytes: Buffer
    try {
      bytes = await getObjectBuffer(version.bundleKey)
    } catch {
      return reply.status(404).send({ error: 'Bundle not found' })
    }

    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    return reply.type('application/javascript').send(bytes)
  })
}

export default addonPublicRoutes
