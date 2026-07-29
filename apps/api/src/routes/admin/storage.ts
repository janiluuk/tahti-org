// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminStorageOverviewSchema,
  AdminUserFilesResponseSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { presignedGetUrl } from '../../lib/minio.js'

const adminStorageRoutes: FastifyPluginAsync = async (fastify) => {
  // Overall R2 usage across the platform + a per-user breakdown. R2 doesn't
  // have unlimited real-time analytics without the Cloudflare account API
  // (R2_API_TOKEN, separate from the S3 credentials) — this reports what we
  // track ourselves in UserStorageQuota, which is authoritative for quota
  // enforcement even if it lags Cloudflare's own dashboard slightly.
  fastify.get(
    '/api/admin/storage',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminStorageOverviewSchema, 'AdminStorageOverview'),
      },
    },
    async (_request, reply) => {
      const rows = await fastify.prisma.userStorageQuota.findMany({
        orderBy: { usedBytes: 'desc' },
        select: {
          quotaBytes: true,
          usedBytes: true,
          user: { select: { id: true, username: true, displayName: true } },
        },
      })

      let totalQuotaBytes = 0
      let totalUsedBytes = 0
      const users = rows.map((row) => {
        totalQuotaBytes += Number(row.quotaBytes)
        totalUsedBytes += Number(row.usedBytes)
        return {
          userId: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName,
          quotaBytes: Number(row.quotaBytes),
          usedBytes: Number(row.usedBytes),
        }
      })

      return reply.send({
        totalQuotaBytes,
        totalUsedBytes,
        userCount: users.length,
        users,
      })
    },
  )

  // Per-user file browser — scoped to release tracks, the only content type
  // that writes through to R2 so far. Preview URL always points at the
  // (local MinIO) streaming copy, regardless of R2 status, since that's
  // always present once a track is READY.
  fastify.get(
    '/api/admin/storage/users/:id/files',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminUserFilesResponseSchema, 'AdminUserFiles'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const user = await fastify.prisma.user.findUnique({
        where: { id: routeParams.id },
        select: { username: true, displayName: true },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      const tracks = await fastify.prisma.releaseTrack.findMany({
        where: { release: { userId: routeParams.id } },
        select: {
          id: true,
          title: true,
          durationSec: true,
          r2Key: true,
          r2SizeBytes: true,
          streamKey: true,
          release: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const files = await Promise.all(
        tracks.map(async (track) => ({
          trackId: track.id,
          title: track.title,
          releaseTitle: track.release.title,
          durationSec: track.durationSec,
          inR2: track.r2Key != null,
          sizeBytes: track.r2SizeBytes,
          previewUrl: track.streamKey ? await presignedGetUrl(track.streamKey, 3600) : null,
        })),
      )

      return reply.send({ username: user.username, displayName: user.displayName, files })
    },
  )
}

export default adminStorageRoutes
