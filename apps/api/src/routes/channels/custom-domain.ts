// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-051: custom domain resolution (public) + management (auth).
//
// GET  /api/v1/custom-domain/resolve?host=artist.example.com  → { slug }  (public, CDN-cacheable)
// POST /api/me/channel/custom-domain                           → set + return verification token
// POST /api/me/channel/custom-domain/verify                   → DNS TXT check → mark verified
// DELETE /api/me/channel/custom-domain                         → clear custom domain

import dns from 'node:dns/promises'
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'

const customDomainRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Public resolve ────────────────────────────────────────────────────────
  fastify.get(
    '/api/v1/custom-domain/resolve',
    {
      schema: {
        tags: ['channel'],
        description: 'PLAT-051: resolve a custom domain to a channel slug',
        querystring: {
          type: 'object',
          properties: { host: { type: 'string' } },
          required: ['host'],
        },
        response: {
          200: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { host } = request.query as { host: string }
      const channel = await fastify.prisma.channel.findFirst({
        where: { customDomain: host, customDomainVerified: true },
        select: { slug: true },
      })
      if (!channel) return reply.status(404).send({ error: 'not found' })
      return reply.header('Cache-Control', 'public, max-age=300').send({ slug: channel.slug })
    },
  )

  // ── Set custom domain (paid tier only) ───────────────────────────────────
  fastify.post(
    '/api/me/channel/custom-domain',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-051: set a custom domain for the channel (paid tier)',
        body: {
          type: 'object',
          properties: { domain: { type: 'string', minLength: 3, maxLength: 253 } },
          required: ['domain'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              domain: { type: 'string' },
              txtRecord: { type: 'string' },
              txtHost: { type: 'string' },
            },
          },
          402: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      if (!isUnlimitedLiveTier(user.tier)) {
        return reply.status(402).send({ error: 'Custom domains require a paid membership.' })
      }

      const { domain } = request.body as { domain: string }
      const cleaned = domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')

      // Disallow tahti.live subdomains
      if (cleaned.endsWith('.tahti.live') || cleaned === 'tahti.live') {
        return reply.status(409).send({ error: 'Cannot use tahti.live as a custom domain.' })
      }

      // Check domain not already claimed by another channel
      const existing = await fastify.prisma.channel.findFirst({
        where: { customDomain: cleaned, NOT: { userId: user.id } },
      })
      if (existing) {
        return reply.status(409).send({ error: 'Domain already in use by another channel.' })
      }

      const channel = await fastify.prisma.channel.update({
        where: { userId: user.id },
        data: { customDomain: cleaned, customDomainVerified: false },
        select: { id: true },
      })

      return reply.send({
        domain: cleaned,
        txtRecord: `tahti-channel=${channel.id}`,
        txtHost: `_tahti-verify.${cleaned}`,
      })
    },
  )

  // ── Verify domain via DNS TXT record ─────────────────────────────────────
  fastify.post(
    '/api/me/channel/custom-domain/verify',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-051: verify custom domain ownership via TXT record',
        response: {
          200: { type: 'object', properties: { verified: { type: 'boolean' } } },
          400: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, customDomain: true, customDomainVerified: true },
      })

      if (!channel?.customDomain) {
        return reply.status(400).send({ error: 'No custom domain set.' })
      }
      if (channel.customDomainVerified) {
        return reply.send({ verified: true })
      }

      const txtHost = `_tahti-verify.${channel.customDomain}`
      const expected = `tahti-channel=${channel.id}`

      try {
        const records = await dns.resolveTxt(txtHost)
        const flat = records.flat()
        if (!flat.includes(expected)) {
          return reply
            .status(400)
            .send({ error: `TXT record not found. Add: ${txtHost} → ${expected}` })
        }
      } catch {
        return reply
          .status(400)
          .send({ error: `Could not resolve ${txtHost}. Check DNS and try again.` })
      }

      await fastify.prisma.channel.update({
        where: { userId: user.id },
        data: { customDomainVerified: true },
      })

      return reply.send({ verified: true })
    },
  )

  // ── Remove custom domain ─────────────────────────────────────────────────
  fastify.delete(
    '/api/me/channel/custom-domain',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-051: remove custom domain from channel',
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.channel.update({
        where: { userId: user.id },
        data: { customDomain: null, customDomainVerified: false },
      })
      return reply.send({ ok: true })
    },
  )
}

export default customDomainRoutes
