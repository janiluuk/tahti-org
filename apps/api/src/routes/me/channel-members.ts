// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ChannelMemberListSchema,
  ChannelMemberSchema,
  CreateChannelMemberSchema,
  IdParamSchema,
  ImageFromUrlSchema,
  ImageUploadCompleteResponseSchema,
  ImageUploadCompleteSchema,
  ImageUploadPrepareResponseSchema,
  ImageUploadPrepareSchema,
  ReorderChannelMembersSchema,
  UpdateChannelMemberSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, putObjectBuffer } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'
import { extFromMime, fetchImageFromUrl } from '../../lib/fetch-image-url.js'

const PRESIGN_TTL_SEC = 900

const meChannelMemberRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedChannel(userId: string) {
    return fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, user: { select: { username: true } } },
    })
  }

  async function ownedMember(userId: string, id: string) {
    return fastify.prisma.channelMember.findFirst({
      where: { id, channel: { userId } },
      include: { channel: { select: { user: { select: { username: true } } } } },
    })
  }

  // GET /api/me/channel/members — this artist's lineup/credits list, in display order
  fastify.get(
    '/api/me/channel/members',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M36: list the channel member/credits roster',
        response: openApiResponse(ChannelMemberListSchema, 'ChannelMemberList'),
      },
    },
    async (request, reply) => {
      const channel = await ownedChannel(request.sessionUser!.id)
      if (!channel) return reply.send([])
      const members = await fastify.prisma.channelMember.findMany({
        where: { channelId: channel.id },
        orderBy: { position: 'asc' },
      })
      return reply.send(members)
    },
  )

  // POST /api/me/channel/members — add a member/credit (picture attached afterward)
  fastify.post(
    '/api/me/channel/members',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([
          { status: 201, schema: ChannelMemberSchema, name: 'ChannelMember' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateChannelMemberSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const channel = await ownedChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const count = await fastify.prisma.channelMember.count({ where: { channelId: channel.id } })
      const member = await fastify.prisma.channelMember.create({
        data: {
          channelId: channel.id,
          name: parsed.data.name,
          role: parsed.data.role,
          position: count,
        },
      })
      return reply.status(201).send(member)
    },
  )

  // PATCH /api/me/channel/members/:id
  fastify.patch(
    '/api/me/channel/members/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelMemberSchema, 'ChannelMember'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = UpdateChannelMemberSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const member = await ownedMember(request.sessionUser!.id, routeParams.id)
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      const updated = await fastify.prisma.channelMember.update({
        where: { id: member.id },
        data: parsed.data,
      })
      return reply.send(updated)
    },
  )

  // DELETE /api/me/channel/members/:id
  fastify.delete(
    '/api/me/channel/members/:id',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const member = await ownedMember(request.sessionUser!.id, routeParams.id)
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      await fastify.prisma.channelMember.delete({ where: { id: member.id } })
      return reply.status(204).send()
    },
  )

  // PUT /api/me/channel/members/reorder
  fastify.put(
    '/api/me/channel/members/reorder',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const parsed = ReorderChannelMembersSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const channel = await ownedChannel(request.sessionUser!.id)
      if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

      const owned = await fastify.prisma.channelMember.findMany({
        where: { id: { in: parsed.data.ids }, channelId: channel.id },
        select: { id: true },
      })
      const ownedIds = new Set(owned.map((m) => m.id))

      await fastify.prisma.$transaction(
        parsed.data.ids
          .filter((id) => ownedIds.has(id))
          .map((id, position) =>
            fastify.prisma.channelMember.update({ where: { id }, data: { position } }),
          ),
      )
      return reply.status(204).send()
    },
  )

  // POST /api/me/channel/members/:id/picture/prepare
  fastify.post(
    '/api/me/channel/members/:id/picture/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'ChannelMemberPicturePrepare'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ImageUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const member = await ownedMember(request.sessionUser!.id, routeParams.id)
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `channel-members/${member.channel.user.username}/${member.id}-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  // POST /api/me/channel/members/:id/picture/complete
  fastify.post(
    '/api/me/channel/members/:id/picture/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(
          ImageUploadCompleteResponseSchema,
          'ChannelMemberPictureComplete',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ImageUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const member = await ownedMember(request.sessionUser!.id, routeParams.id)
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      const prefix = `channel-members/${member.channel.user.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this member' })
      }

      const pictureUrl = publicMediaUrl(parsed.data.uploadKey)
      await fastify.prisma.channelMember.update({ where: { id: member.id }, data: { pictureUrl } })
      return reply.send({ url: pictureUrl })
    },
  )

  // POST /api/me/channel/members/:id/picture/from-url — paste a URL, server fetches + rehosts
  fastify.post(
    '/api/me/channel/members/:id/picture/from-url',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'ChannelMemberPictureFromUrl'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ImageFromUrlSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const member = await ownedMember(request.sessionUser!.id, routeParams.id)
      if (!member) return reply.status(404).send({ error: 'Member not found' })

      const fetched = await fetchImageFromUrl(parsed.data.sourceUrl)
      if (!fetched.ok) return reply.status(422).send({ error: fetched.error })

      const uploadKey = `channel-members/${member.channel.user.username}/${member.id}-${nanoid(8)}.${extFromMime(fetched.contentType)}`
      await putObjectBuffer(uploadKey, fetched.bytes, fetched.contentType)

      const pictureUrl = publicMediaUrl(uploadKey)
      await fastify.prisma.channelMember.update({ where: { id: member.id }, data: { pictureUrl } })
      return reply.send({ url: pictureUrl })
    },
  )
}

export default meChannelMemberRoutes
