// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The plugin marketplace for import/export sources and fingerprinting
// providers — see packages/shared/src/integration-providers.ts for the
// registry. OAuth-based providers (Mixcloud/SoundCloud/Google Drive-style)
// keep using their existing connect/disconnect routes; this only manages
// API-key-style credentials.

import type { FastifyPluginAsync } from 'fastify'
import {
  INTEGRATION_PROVIDERS,
  InstallIntegrationSchema,
  IntegrationListResponseSchema,
  IntegrationSlugParamSchema,
  findIntegrationProvider,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import {
  getUserIntegrationCredential,
  removeUserIntegrationCredential,
  upsertUserIntegrationCredential,
} from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

// User columns read to determine OAuth "connected?" state — must cover every
// oauthStatusField in the registry.
const OAUTH_STATUS_SELECT = {
  soundcloudAccessTokenEnc: true,
  googleDriveAccessTokenEnc: true,
} as const

const meIntegrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/integrations',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['integrations'],
        response: openApiResponse(IntegrationListResponseSchema, 'IntegrationList'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id

      const [user, credentials] = await Promise.all([
        fastify.prisma.user.findUnique({ where: { id: userId }, select: OAUTH_STATUS_SELECT }),
        fastify.prisma.integrationCredential.findMany({
          where: { userId, enabled: true },
          select: { providerSlug: true },
        }),
      ])
      const installedSlugs = new Set(credentials.map((c) => c.providerSlug))
      const oauthColumns: Record<string, unknown> = user ?? {}

      const integrations = INTEGRATION_PROVIDERS.map((provider) => ({
        slug: provider.slug,
        name: provider.name,
        description: provider.description,
        scope: provider.scope,
        authKind: provider.authKind,
        installed: provider.authKind === 'API_KEY' && installedSlugs.has(provider.slug),
        connected:
          provider.authKind === 'OAUTH' &&
          Boolean(provider.oauthStatusField && oauthColumns[provider.oauthStatusField]),
      }))

      return reply.send({ integrations })
    },
  )

  fastify.post(
    '/api/me/integrations/:slug/install',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IntegrationSlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const provider = findIntegrationProvider(routeParams.slug)
      if (!provider) return reply.status(404).send({ error: 'Unknown integration' })
      if (provider.authKind === 'OAUTH') {
        return reply
          .status(400)
          .send({ error: 'This integration connects via OAuth — use its connect flow instead' })
      }

      const parsed = InstallIntegrationSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const expectedKeys = new Set((provider.fields ?? []).map((f) => f.key))
      const givenKeys = Object.keys(parsed.data.fields)
      const unknownKey = givenKeys.find((k) => !expectedKeys.has(k))
      if (unknownKey) {
        return reply.status(400).send({ error: `Unexpected field: ${unknownKey}` })
      }
      const missingKey = [...expectedKeys].find((k) => !parsed.data.fields[k]?.trim())
      if (missingKey) {
        return reply.status(400).send({ error: `Missing field: ${missingKey}` })
      }

      await upsertUserIntegrationCredential(
        fastify.prisma,
        request.sessionUser!.id,
        provider.slug,
        parsed.data.fields,
      )
      return reply.status(204).send()
    },
  )

  fastify.delete(
    '/api/me/integrations/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IntegrationSlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const provider = findIntegrationProvider(routeParams.slug)
      if (!provider) return reply.status(404).send({ error: 'Unknown integration' })
      if (provider.authKind === 'OAUTH') {
        return reply
          .status(400)
          .send({ error: 'This integration connects via OAuth — use its disconnect flow instead' })
      }

      await removeUserIntegrationCredential(fastify.prisma, request.sessionUser!.id, provider.slug)
      return reply.status(204).send()
    },
  )
}

export default meIntegrationsRoutes
