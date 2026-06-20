// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import {
  CloudImportJobListSchema,
  CloudImportJobStatusSchema,
  GoogleDriveConnectStatusSchema,
  GoogleDriveImportRequestSchema,
  GoogleDriveImportResponseSchema,
  GoogleDrivePickerConfigSchema,
  exchangeGoogleDriveCode,
  titleFromDriveFileName,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'
import {
  buildGoogleDriveAuthorizeUrl,
  clearGoogleDriveConnection,
  getValidGoogleDriveAccessToken,
  googleDriveConfigured,
  googleDrivePickerConfigured,
} from '../../lib/google-drive-session.js'
import { enqueueCloudImportGoogleDrive } from '../../lib/queue.js'

const OAUTH_STATE_MAX_AGE_SEC = 600

const googleDriveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/google-drive',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-080: Google Drive import connection status',
        response: openApiResponse(GoogleDriveConnectStatusSchema, 'GoogleDriveConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { googleDriveAccessTokenEnc: true },
      })
      return reply.send({
        connected: Boolean(row?.googleDriveAccessTokenEnc),
        configured: googleDriveConfigured(),
      })
    },
  )

  fastify.get(
    '/api/me/google-drive/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!googleDriveConfigured()) {
        return reply.status(503).send({ error: 'Google Drive OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.googleDrive.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      return reply.redirect(302, buildGoogleDriveAuthorizeUrl(state))
    },
  )

  fastify.get('/api/me/google-drive/oauth/callback', async (request, reply) => {
    const query = request.query as Record<string, string>
    const code = query.code
    const state = query.state

    const cookieState = request.cookies[config.googleDrive.oauthStateCookie]
    if (!code || !state || state !== cookieState) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/google-drive?gd=error`)
    }

    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/google-drive?gd=login`)
    }

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true } } },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/google-drive?gd=login`)
    }

    try {
      const tokenData = await exchangeGoogleDriveCode(
        {
          clientId: config.googleDrive.clientId,
          clientSecret: config.googleDrive.clientSecret,
        },
        code,
        config.googleDrive.redirectUri,
      )

      await fastify.prisma.user.update({
        where: { id: session.user.id },
        data: {
          googleDriveAccessTokenEnc: encryptStreamKey(tokenData.access_token),
          ...(tokenData.refresh_token
            ? { googleDriveRefreshTokenEnc: encryptStreamKey(tokenData.refresh_token) }
            : {}),
        },
      })

      reply.clearCookie(config.googleDrive.oauthStateCookie, { path: '/' })
      return reply.redirect(
        302,
        `${config.appUrl}/dashboard/upload/import/google-drive?gd=connected`,
      )
    } catch {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/google-drive?gd=error`)
    }
  })

  fastify.delete(
    '/api/me/google-drive',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-083: disconnect Google Drive import',
        response: openApiResponse(GoogleDriveConnectStatusSchema, 'GoogleDriveConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await clearGoogleDriveConnection(fastify.prisma, user.id)
      return reply.send({
        connected: false,
        configured: googleDriveConfigured(),
      })
    },
  )

  fastify.get(
    '/api/me/google-drive/picker-config',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Short-lived access token + Picker API keys for the import UI',
        response: openApiResponse(GoogleDrivePickerConfigSchema, 'GoogleDrivePickerConfig'),
      },
    },
    async (request, reply) => {
      if (!googleDrivePickerConfigured()) {
        return reply.status(503).send({ error: 'Google Drive Picker is not configured' })
      }

      const user = request.sessionUser!
      let accessToken: string
      try {
        accessToken = await getValidGoogleDriveAccessToken(fastify.prisma, user.id)
      } catch {
        return reply.status(403).send({ error: 'Google Drive account not connected' })
      }

      return reply.send({
        clientId: config.googleDrive.clientId,
        developerKey: config.googleDrive.developerKey,
        accessToken,
      })
    },
  )

  fastify.post(
    '/api/me/google-drive/import',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Queue Google Drive files for server-side import to archive',
        response: openApiResponse(GoogleDriveImportResponseSchema, 'GoogleDriveImportResponse'),
      },
    },
    async (request, reply) => {
      const parsed = GoogleDriveImportRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }

      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { googleDriveAccessTokenEnc: true },
      })
      if (!row?.googleDriveAccessTokenEnc) {
        return reply.status(403).send({ error: 'Google Drive account not connected' })
      }

      const imports = []
      for (const file of parsed.data.files) {
        const job = await fastify.prisma.cloudImportJob.create({
          data: {
            userId: user.id,
            source: 'GOOGLE_DRIVE',
            externalFileId: file.fileId,
            fileName: file.name,
            status: 'QUEUED',
          },
        })
        await enqueueCloudImportGoogleDrive(job.id)
        imports.push({
          cloudImportJobId: job.id,
          title: titleFromDriveFileName(file.name),
          status: 'queued' as const,
        })
      }

      return reply.status(202).send({ imports })
    },
  )

  fastify.get(
    '/api/me/cloud-import/jobs',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Recent cloud import jobs for progress UI',
        response: openApiResponse(CloudImportJobListSchema, 'CloudImportJobList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const jobs = await fastify.prisma.cloudImportJob.findMany({
        where: { userId: user.id },
        orderBy: { queuedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          source: true,
          fileName: true,
          status: true,
          error: true,
          archiveItemId: true,
          bytesTransferred: true,
          queuedAt: true,
          completedAt: true,
        },
      })

      return reply.send({
        jobs: jobs.map((job) => ({
          id: job.id,
          source: job.source,
          fileName: job.fileName,
          status: job.status,
          error: job.error,
          archiveItemId: job.archiveItemId,
          bytesTransferred: job.bytesTransferred !== null ? Number(job.bytesTransferred) : null,
          queuedAt: job.queuedAt,
          completedAt: job.completedAt,
        })),
      })
    },
  )

  fastify.get(
    '/api/me/cloud-import/jobs/:jobId',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Single cloud import job status',
        response: openApiResponse(CloudImportJobStatusSchema, 'CloudImportJobStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const { jobId } = request.params as { jobId: string }
      const job = await fastify.prisma.cloudImportJob.findFirst({
        where: { id: jobId, userId: user.id },
        select: {
          id: true,
          source: true,
          fileName: true,
          status: true,
          error: true,
          archiveItemId: true,
          bytesTransferred: true,
          queuedAt: true,
          completedAt: true,
        },
      })
      if (!job) return reply.status(404).send({ error: 'Import job not found' })

      return reply.send({
        id: job.id,
        source: job.source,
        fileName: job.fileName,
        status: job.status,
        error: job.error,
        archiveItemId: job.archiveItemId,
        bytesTransferred: job.bytesTransferred !== null ? Number(job.bytesTransferred) : null,
        queuedAt: job.queuedAt,
        completedAt: job.completedAt,
      })
    },
  )
}

export default googleDriveRoutes
