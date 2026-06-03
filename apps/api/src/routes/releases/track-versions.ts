// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ReleaseIdTrackIdParamsSchema,
  ReleaseTrackVersionCompleteSchema,
  ReleaseTrackVersionCreatedSchema,
  ReleaseTrackVersionListSchema,
  ReleaseTrackVersionParamsSchema,
  ReleaseTrackVersionPrepareResponseSchema,
  ReleaseTrackVersionPrepareSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { ensureInitialReleaseTrackVersion, syncActiveVersionToTrack } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { enqueueReleaseTrackVersionTranscode } from '../../lib/queue.js'
import { serializeReleaseTrackVersion } from '../../lib/release-track-versions.js'

const PRESIGN_TTL_SEC = 900
const ACCEPTED_FORMATS = ['audio/wav', 'audio/flac', 'audio/mpeg', 'audio/aac', 'audio/x-aiff']

const releaseTrackVersionRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedTrack(userId: string, releaseId: string, trackId: string) {
    return fastify.prisma.releaseTrack.findFirst({
      where: { id: trackId, releaseId, release: { userId } },
      select: {
        id: true,
        release: { select: { userId: true, id: true, user: { select: { username: true } } } },
      },
    })
  }

  fastify.get(
    '/api/me/releases/:releaseId/tracks/:trackId/versions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseTrackVersionListSchema, 'ReleaseTrackVersionList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams

      const track = await ownedTrack(user.id, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      await ensureInitialReleaseTrackVersion(fastify.prisma, trackId)

      const versions = await fastify.prisma.releaseTrackVersion.findMany({
        where: { releaseTrackId: trackId },
        orderBy: { versionNumber: 'asc' },
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          status: true,
          isActive: true,
          durationSec: true,
          createdAt: true,
        },
      })

      return reply.send(versions.map(serializeReleaseTrackVersion))
    },
  )

  fastify.post(
    '/api/me/releases/:releaseId/tracks/:trackId/versions/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(
          ReleaseTrackVersionPrepareResponseSchema,
          'ReleaseTrackVersionPrepare',
        ),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseTrackVersionPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams
      const track = await ownedTrack(user.id, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      if (!ACCEPTED_FORMATS.includes(parsed.data.contentType)) {
        return reply.status(400).send({
          error: `Unsupported format. Accepted: ${ACCEPTED_FORMATS.join(', ')}`,
        })
      }

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'mp3'
      const uploadId = `releases/${track.release.user.username}/${releaseId}/${trackId}-v-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadId, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadId, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/releases/:releaseId/tracks/:trackId/versions/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponses([
          {
            status: 201,
            schema: ReleaseTrackVersionCreatedSchema,
            name: 'ReleaseTrackVersionCreated',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseTrackVersionCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams
      const track = await ownedTrack(user.id, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const prefix = `releases/${track.release.user.username}/${releaseId}/${trackId}-v-`
      if (!parsed.data.uploadId.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this track' })
      }

      await ensureInitialReleaseTrackVersion(fastify.prisma, trackId)

      const count = await fastify.prisma.releaseTrackVersion.count({
        where: { releaseTrackId: trackId },
      })

      const version = await fastify.prisma.releaseTrackVersion.create({
        data: {
          releaseTrackId: trackId,
          versionNumber: count + 1,
          versionLabel: parsed.data.versionLabel.trim(),
          sourceKey: parsed.data.uploadId,
          status: 'PENDING',
          isActive: false,
        },
        select: { id: true, versionNumber: true, versionLabel: true, status: true },
      })

      await enqueueReleaseTrackVersionTranscode(version.id)

      return reply.status(201).send({
        versionId: version.id,
        versionNumber: version.versionNumber,
        versionLabel: version.versionLabel,
        status: version.status,
      })
    },
  )

  fastify.post(
    '/api/me/releases/:releaseId/tracks/:trackId/versions/:versionId/activate',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseTrackVersionListSchema, 'ReleaseTrackVersionList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackVersionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId, versionId } = routeParams

      const track = await ownedTrack(user.id, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const version = await fastify.prisma.releaseTrackVersion.findFirst({
        where: { id: versionId, releaseTrackId: trackId },
      })
      if (!version) return reply.status(404).send({ error: 'Version not found' })
      if (version.status !== 'READY') {
        return reply.status(400).send({ error: 'Version is not ready yet' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.releaseTrackVersion.updateMany({
          where: { releaseTrackId: trackId },
          data: { isActive: false },
        }),
        fastify.prisma.releaseTrackVersion.update({
          where: { id: versionId },
          data: { isActive: true },
        }),
      ])

      await syncActiveVersionToTrack(fastify.prisma, trackId)

      const versions = await fastify.prisma.releaseTrackVersion.findMany({
        where: { releaseTrackId: trackId },
        orderBy: { versionNumber: 'asc' },
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          status: true,
          isActive: true,
          durationSec: true,
          createdAt: true,
        },
      })

      return reply.send(versions.map(serializeReleaseTrackVersion))
    },
  )
}

export default releaseTrackVersionRoutes
