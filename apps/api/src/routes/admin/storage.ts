// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminSetUserQuotaSchema,
  AdminStorageOverviewSchema,
  AdminUserFilesResponseSchema,
  IdParamSchema,
  StorageQuotaViewSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { getHostDiskSpace } from '../../lib/host-disk.js'
import { listUserFilesWithRunningTotal } from '../../lib/user-file-listing.js'
import {
  computeAllUsersStorageUsedBytes,
  computeUserStorageUsedBytes,
} from '../../lib/user-storage.js'

const adminStorageRoutes: FastifyPluginAsync = async (fastify) => {
  // Overall usage across the platform + a per-user breakdown, plus the two
  // physical-capacity readings the board actually asked for: the API host's
  // local disk (also what MinIO's hot/streaming cache lives on) and Cloudflare
  // R2 (docs/storage-policy.md's long-term, per-user-quota'd object store). R2
  // doesn't have unlimited real-time analytics without the Cloudflare account
  // API (R2_API_TOKEN, separate from the S3 credentials) — this reports what we
  // track ourselves in UserStorageQuota, which is authoritative for quota
  // enforcement even if it lags Cloudflare's own dashboard slightly, and has no
  // fixed total/free reading since R2 is billed by usage, not a fixed volume.
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
      // Usage is computed live from ArchiveItem/StashFile, the same source
      // /api/me/storage uses — UserStorageQuota.usedBytes is a legacy cached
      // counter from the abandoned hard-cap model (see storage-quota.ts) that
      // nothing ever writes to, so reading it here always showed 0 regardless
      // of real uploads. softTargetBytes (docs/storage-policy.md) is now the
      // one "quota" concept; every user has one (falls back to the schema
      // default), so this covers users who never got a UserStorageQuota row.
      const [allUsers, usedByUser, localDisk] = await Promise.all([
        fastify.prisma.user.findMany({
          select: {
            id: true,
            username: true,
            displayName: true,
            isMember: true,
            softTargetBytes: true,
          },
        }),
        computeAllUsersStorageUsedBytes(fastify.prisma),
        getHostDiskSpace(),
      ])

      // Users with nothing uploaded add noise to a board-facing usage list
      // without adding information — same "usage recorded" framing the
      // client already shows for an empty list — and their soft target
      // shouldn't inflate "total quota" for users who aren't using any.
      const users = allUsers
        .filter((user) => (usedByUser.get(user.id) ?? 0n) > 0n)
        .map((user) => ({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          quotaBytes: Number(user.softTargetBytes),
          usedBytes: Number(usedByUser.get(user.id) ?? 0n),
          unlimited: user.isMember,
        }))
        .sort((a, b) => b.usedBytes - a.usedBytes)

      let totalQuotaBytes = 0
      let totalUsedBytes = 0
      for (const row of users) {
        totalQuotaBytes += row.quotaBytes
        totalUsedBytes += row.usedBytes
      }

      return reply.send({
        totalQuotaBytes,
        totalUsedBytes,
        userCount: users.length,
        users,
        localDisk: localDisk
          ? { ...localDisk, note: null }
          : {
              totalBytes: null,
              freeBytes: null,
              usedBytes: null,
              note: 'Disk reading unavailable.',
            },
        objectStorage: {
          totalBytes: null,
          freeBytes: null,
          usedBytes: totalUsedBytes,
          note: config.r2.enabled
            ? 'Cloudflare R2 is billed by usage, not a fixed volume — there is no total/free to report.'
            : 'R2 is not configured on this environment — usage shown is 0.',
        },
      })
    },
  )

  // Per-user file browser — every file that counts against the user's quota
  // (archive items + stash files, see computeUserStorageUsedBytes), oldest
  // first, with a running total so the board can see how usage built up over
  // time. Preview URLs always point at the (local MinIO) streaming copy,
  // regardless of R2 status, since that's always present once ready.
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

      const [user, quota, files] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: routeParams.id },
          select: { username: true, displayName: true, tier: true, isMember: true },
        }),
        fastify.prisma.userStorageQuota.findUnique({
          where: { userId: routeParams.id },
          select: { quotaBytes: true, usedBytes: true },
        }),
        listUserFilesWithRunningTotal(fastify.prisma, routeParams.id),
      ])
      if (!user) return reply.status(404).send({ error: 'User not found' })

      return reply.send({
        userId: routeParams.id,
        username: user.username,
        displayName: user.displayName,
        tier: user.tier,
        unlimited: user.isMember,
        quotaBytes: user.isMember ? null : Number(quota?.quotaBytes ?? 0),
        usedBytes: Number(quota?.usedBytes ?? 0),
        files: files.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
        })),
      })
    },
  )

  // Admin override for a single user's soft storage target — e.g. raising it
  // for a supporter or a legitimate heavy user (docs/storage-policy.md's
  // "hidden ceiling" review) without changing the platform-wide default.
  // Writes User.softTargetBytes directly — the same field /api/me/storage
  // reads — rather than the disused UserStorageQuota table (nothing else
  // reads that table's quotaBytes any more; see the GET handler above).
  fastify.patch(
    '/api/admin/storage/users/:id/quota',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(StorageQuotaViewSchema, 'StorageQuotaView'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsedBody = AdminSetUserQuotaSchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ error: parsedBody.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { quotaBytes } = parsedBody.data

      const existing = await fastify.prisma.user.findUnique({
        where: { id: routeParams.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      const [user, usedBytes] = await Promise.all([
        fastify.prisma.user.update({
          where: { id: routeParams.id },
          data: { softTargetBytes: BigInt(quotaBytes) },
          select: { softTargetBytes: true, isMember: true },
        }),
        computeUserStorageUsedBytes(fastify.prisma, routeParams.id),
      ])

      // A board override always takes effect — a member's usage is still
      // recorded against it — but the row keeps reading "Unlimited" for members
      // (docs/storage-policy.md), same as the overview list and /api/me/storage.
      return reply.send({
        quotaBytes: Number(user.softTargetBytes),
        usedBytes: Number(usedBytes),
        unlimited: user.isMember,
      })
    },
  )
}

export default adminStorageRoutes
