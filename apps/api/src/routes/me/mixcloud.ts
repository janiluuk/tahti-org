// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { buildMixcloudAuthorizeUrl, exchangeMixcloudCode } from '@tahti/mixcloud'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { mediaQueue } from '../../lib/queue.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'

const OAUTH_STATE_MAX_AGE_SEC = 600

// M7 — Mixcloud OAuth + archive mix upload
const mixcloudRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/mixcloud', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { mixcloudAccessTokenEnc: true },
    })
    const configured = Boolean(config.mixcloud.clientId && config.mixcloud.clientSecret)
    return reply.send({
      connected: Boolean(row?.mixcloudAccessTokenEnc),
      configured,
    })
  })

  fastify.get(
    '/api/me/mixcloud/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.mixcloud.clientId) {
        return reply.status(503).send({ error: 'Mixcloud OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.mixcloud.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      const url = buildMixcloudAuthorizeUrl(config.mixcloud.clientId, config.mixcloud.redirectUri)
      return reply.redirect(302, url)
    },
  )

  fastify.get('/api/me/mixcloud/oauth/callback', async (request, reply) => {
    const code = (request.query as { code?: string }).code
    if (!code) {
      return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
    }

    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) {
      return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=login`)
    }

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true } } },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=login`)
    }

    try {
      const { accessToken } = await exchangeMixcloudCode({
        code,
        redirectUri: config.mixcloud.redirectUri,
      })
      await fastify.prisma.user.update({
        where: { id: session.user.id },
        data: { mixcloudAccessTokenEnc: encryptStreamKey(accessToken) },
      })
      reply.clearCookie(config.mixcloud.oauthStateCookie, { path: '/' })
      return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=connected`)
    } catch {
      return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
    }
  })

  fastify.delete('/api/me/mixcloud', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { mixcloudAccessTokenEnc: null },
    })
    return reply.send({ connected: false })
  })

  fastify.post(
    '/api/me/archive/:itemId/mixcloud',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { itemId } = request.params as { itemId: string }

      const me = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { mixcloudAccessTokenEnc: true },
      })

      if (config.mixcloud.clientId && !me?.mixcloudAccessTokenEnc) {
        return reply.status(403).send({
          error: 'Connect your Mixcloud account first',
          connectPath: '/api/me/mixcloud/oauth/start',
        })
      }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { id: true, status: true, mp3Key: true, rawKey: true, mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (item.status !== 'READY') {
        return reply.status(409).send({ error: 'Archive item is not ready for upload' })
      }
      if (item.mixUpload) {
        return reply.status(409).send({
          error: 'Already queued',
          status: item.mixUpload.status,
          mixcloudUrl: item.mixUpload.mixcloudUrl,
        })
      }

      const upload = await fastify.prisma.mixUpload.create({
        data: { userId: user.id, archiveItemId: itemId, status: 'PENDING' },
      })

      await mediaQueue.add('mixcloud-upload', { mixUploadId: upload.id })

      return reply.status(202).send({ mixUploadId: upload.id, status: 'pending' })
    },
  )

  fastify.get(
    '/api/me/archive/:itemId/mixcloud',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { itemId } = request.params as { itemId: string }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (!item.mixUpload) return reply.status(404).send({ error: 'No Mixcloud upload found' })

      return reply.send({
        status: item.mixUpload.status,
        mixcloudUrl: item.mixUpload.mixcloudUrl,
        error: item.mixUpload.error,
        completedAt: item.mixUpload.completedAt,
      })
    },
  )
}

export default mixcloudRoutes
