// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@tahti/db'
import {
  CreateDiscussionPostSchema,
  DiscussionParticipationSchema,
  DiscussionPostViewSchema,
  DiscussionPostsPageSchema,
  DiscussionsReadAllSchema,
  DiscussionTopicDetailSchema,
  DiscussionTopicListSchema,
  DiscussionPostRemovedSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
  SetDiscussionFollowSchema,
  SetDiscussionMuteSchema,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { DISCUSSION_TOPIC_SELECT, toDiscussionTopicView } from '../../lib/discussion-view.js'
import { userName } from '../../lib/safe-names.js'
import { auditLog } from '../../lib/audit.js'
import {
  notifyDiscussionMentions,
  notifyDiscussionParticipants,
} from '../../lib/discussion-notifications.js'

/** Replies per page: the topic read sends the latest page, older pages come
 * from GET .../posts?before=<postId>. */
const POSTS_PAGE = 100

const POST_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  author: { select: { username: true, displayName: true } },
} as const

function toPostView(
  post: {
    id: bigint
    body: string
    createdAt: Date
    editedAt: Date | null
    authorId: string | null
    author: { username: string; displayName: string } | null
  },
  userId: string,
) {
  return {
    id: post.id.toString(),
    body: post.body,
    author: post.author ? userName(post.author) : 'Deleted account',
    createdAt: post.createdAt.toISOString(),
    mine: post.authorId === userId,
    editedAt: post.editedAt?.toISOString() ?? null,
  }
}

const PostsPageQuerySchema = z.object({
  before: z.string().regex(/^\d{1,18}$/),
})

const PostParamsSchema = z.object({
  id: z.string().min(1).max(64),
  postId: z.string().regex(/^\d{1,18}$/),
})

const discussionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/governance/discussions — every topic, pinned first, then the
  // most recently active; with whether the caller follows / muted each.
  fastify.get(
    '/api/v1/governance/discussions',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionTopicListSchema, 'DiscussionTopicList'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const rows = await fastify.prisma.discussionTopic.findMany({
        orderBy: [{ pinned: 'desc' }, { lastPostAt: 'desc' }],
        take: 200,
        select: {
          ...DISCUSSION_TOPIC_SELECT,
          participants: { where: { userId }, select: { mutedAt: true } },
          posts: {
            orderBy: { id: 'desc' },
            take: 1,
            select: { author: { select: { username: true, displayName: true } } },
          },
        },
      })
      const unread = await fastify.prisma.$queryRaw<{ topicId: string; unread: bigint }[]>(
        Prisma.sql`
          SELECT p."topicId", COUNT(*) AS unread
          FROM "governance"."DiscussionPost" p
          JOIN "governance"."DiscussionParticipant" dp
            ON dp."topicId" = p."topicId" AND dp."userId" = ${userId}
          WHERE p."createdAt" > COALESCE(dp."lastReadAt", dp."joinedAt")
            AND (p."authorId" IS NULL OR p."authorId" <> ${userId})
          GROUP BY p."topicId"`,
      )
      const unreadByTopic = new Map(unread.map((row) => [row.topicId, Number(row.unread)]))
      return reply.send({
        topics: rows.map((row) => ({
          ...toDiscussionTopicView(row),
          following: row.participants.length > 0,
          muted: Boolean(row.participants[0]?.mutedAt),
          unreadCount: unreadByTopic.get(row.id) ?? 0,
          lastReplyBy: row.posts[0]
            ? row.posts[0].author
              ? userName(row.posts[0].author)
              : 'Deleted account'
            : null,
        })),
      })
    },
  )

  // GET /api/v1/governance/discussions/:id — the topic and its posts, oldest first.
  fastify.get(
    '/api/v1/governance/discussions/:id',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionTopicDetailSchema, 'DiscussionTopicDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const userId = request.sessionUser!.id
      const row = await fastify.prisma.discussionTopic.findUnique({
        where: { id: routeParams.id },
        select: {
          ...DISCUSSION_TOPIC_SELECT,
          participants: { where: { userId }, select: { mutedAt: true } },
          posts: {
            orderBy: { id: 'desc' },
            take: POSTS_PAGE + 1,
            select: POST_SELECT,
          },
        },
      })
      if (!row) return reply.status(404).send({ error: 'Topic not found' })
      await fastify.prisma.discussionParticipant.updateMany({
        where: { topicId: row.id, userId },
        data: { lastReadAt: new Date() },
      })
      return reply.send({
        ...toDiscussionTopicView(row),
        following: row.participants.length > 0,
        muted: Boolean(row.participants[0]?.mutedAt),
        posts: row.posts
          .slice(0, POSTS_PAGE)
          .reverse()
          .map((post) => toPostView(post, userId)),
        hasEarlierPosts: row.posts.length > POSTS_PAGE,
      })
    },
  )

  // GET /api/v1/governance/discussions/:id/posts?before=<postId> — the page of
  // replies before a given one, oldest first, for "Show earlier replies".
  fastify.get(
    '/api/v1/governance/discussions/:id/posts',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionPostsPageSchema, 'DiscussionPostsPage'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const query = PostsPageQuerySchema.safeParse(request.query)
      if (!query.success) return reply.status(400).send({ error: 'Invalid before cursor' })
      const topic = await fastify.prisma.discussionTopic.findUnique({
        where: { id: routeParams.id },
        select: { id: true },
      })
      if (!topic) return reply.status(404).send({ error: 'Topic not found' })
      const rows = await fastify.prisma.discussionPost.findMany({
        where: { topicId: topic.id, id: { lt: BigInt(query.data.before) } },
        orderBy: { id: 'desc' },
        take: POSTS_PAGE + 1,
        select: POST_SELECT,
      })
      const userId = request.sessionUser!.id
      return reply.send({
        posts: rows
          .slice(0, POSTS_PAGE)
          .reverse()
          .map((post) => toPostView(post, userId)),
        hasEarlierPosts: rows.length > POSTS_PAGE,
      })
    },
  )

  // POST /api/v1/governance/discussions/:id/posts — reply to a topic. The
  // replier follows the topic from then on. A CLOSED topic takes no replies.
  fastify.post(
    '/api/v1/governance/discussions/:id/posts',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: DiscussionPostViewSchema, name: 'DiscussionPost' },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CreateDiscussionPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!
      const topic = await fastify.prisma.discussionTopic.findUnique({
        where: { id: routeParams.id },
        select: { id: true, title: true, status: true },
      })
      if (!topic) return reply.status(404).send({ error: 'Topic not found' })
      if (topic.status === 'CLOSED') {
        return reply.status(409).send({ error: 'This topic is closed to replies' })
      }
      const now = new Date()
      const [post] = await fastify.prisma.$transaction([
        fastify.prisma.discussionPost.create({
          data: { topicId: topic.id, authorId: user.id, body: parsed.data.body, createdAt: now },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { username: true, displayName: true } },
          },
        }),
        fastify.prisma.discussionTopic.update({
          where: { id: topic.id },
          data: { lastPostAt: now },
        }),
        fastify.prisma.discussionParticipant.upsert({
          where: { topicId_userId: { topicId: topic.id, userId: user.id } },
          create: { topicId: topic.id, userId: user.id, lastReadAt: now },
          update: { lastReadAt: now },
        }),
      ])
      await notifyDiscussionParticipants(fastify.prisma, topic, user.id).catch((err: unknown) => {
        request.log.error({ err, topicId: topic.id }, 'discussion reply notification failed')
      })
      await notifyDiscussionMentions(fastify.prisma, topic, post, user.id).catch((err: unknown) => {
        request.log.error({ err, topicId: topic.id }, 'discussion mention notification failed')
      })
      return reply.status(201).send({
        id: post.id.toString(),
        body: post.body,
        author: post.author ? userName(post.author) : 'Deleted account',
        createdAt: post.createdAt.toISOString(),
        mine: true,
        editedAt: null,
      })
    },
  )

  // PUT /api/v1/governance/discussions/:id/follow — follow a topic without
  // replying, or stop following it. Replying follows it again.
  fastify.put(
    '/api/v1/governance/discussions/:id/follow',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionParticipationSchema, 'DiscussionParticipation'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = SetDiscussionFollowSchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
      const userId = request.sessionUser!.id
      const topicId = routeParams.id
      const topic = await fastify.prisma.discussionTopic.findUnique({
        where: { id: topicId },
        select: { id: true },
      })
      if (!topic) return reply.status(404).send({ error: 'Topic not found' })
      if (!parsed.data.following) {
        await fastify.prisma.discussionParticipant.deleteMany({ where: { topicId, userId } })
        return reply.send({ following: false, muted: false })
      }
      const row = await fastify.prisma.discussionParticipant.upsert({
        where: { topicId_userId: { topicId, userId } },
        create: { topicId, userId, lastReadAt: new Date() },
        update: {},
        select: { mutedAt: true },
      })
      return reply.send({ following: true, muted: Boolean(row.mutedAt) })
    },
  )

  // PUT /api/v1/governance/discussions/:id/mute — stop (or resume) reply
  // notices for a topic while still following it.
  fastify.put(
    '/api/v1/governance/discussions/:id/mute',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionParticipationSchema, 'DiscussionParticipation'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = SetDiscussionMuteSchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })
      const userId = request.sessionUser!.id
      const topicId = routeParams.id
      const topic = await fastify.prisma.discussionTopic.findUnique({
        where: { id: topicId },
        select: { id: true },
      })
      if (!topic) return reply.status(404).send({ error: 'Topic not found' })
      const mutedAt = parsed.data.muted ? new Date() : null
      await fastify.prisma.discussionParticipant.upsert({
        where: { topicId_userId: { topicId, userId } },
        create: { topicId, userId, mutedAt },
        update: { mutedAt },
      })
      return reply.send({ following: true, muted: parsed.data.muted })
    },
  )

  // PATCH /api/v1/governance/discussions/:id/posts/:postId — the author fixes
  // their own reply while the topic is open. The reply is marked edited.
  fastify.patch(
    '/api/v1/governance/discussions/:id/posts/:postId',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionPostViewSchema, 'DiscussionPost'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(PostParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CreateDiscussionPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!
      const postId = BigInt(routeParams.postId)
      const post = await fastify.prisma.discussionPost.findFirst({
        where: { id: postId, topicId: routeParams.id },
        select: { authorId: true, topic: { select: { status: true } } },
      })
      if (!post) return reply.status(404).send({ error: 'Post not found' })
      if (post.authorId !== user.id) {
        return reply.status(403).send({ error: 'You can only edit your own reply' })
      }
      if (post.topic.status === 'CLOSED') {
        return reply.status(409).send({ error: 'This topic is closed; its replies are kept' })
      }
      const updated = await fastify.prisma.discussionPost.update({
        where: { id: postId },
        data: { body: parsed.data.body, editedAt: new Date() },
        select: {
          id: true,
          body: true,
          createdAt: true,
          editedAt: true,
          author: { select: { username: true, displayName: true } },
        },
      })
      return reply.send({
        id: updated.id.toString(),
        body: updated.body,
        author: updated.author ? userName(updated.author) : 'Deleted account',
        createdAt: updated.createdAt.toISOString(),
        mine: true,
        editedAt: updated.editedAt?.toISOString() ?? null,
      })
    },
  )

  // DELETE /api/v1/governance/discussions/:id/posts/:postId — the author
  // removes their own reply while the topic is open; the board removes any
  // reply at any time (personal data or abuse can be noticed after closing).
  fastify.delete(
    '/api/v1/governance/discussions/:id/posts/:postId',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionPostRemovedSchema, 'DiscussionPostRemoved'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(PostParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!
      const postId = BigInt(routeParams.postId)
      const post = await fastify.prisma.discussionPost.findFirst({
        where: { id: postId, topicId: routeParams.id },
        select: { authorId: true, topic: { select: { status: true } } },
      })
      if (!post) return reply.status(404).send({ error: 'Post not found' })
      const byAuthor = post.authorId === user.id
      if (!byAuthor && !user.isBoard) {
        return reply.status(403).send({ error: 'You can only remove your own reply' })
      }
      if (post.topic.status === 'CLOSED' && !user.isBoard) {
        return reply.status(409).send({ error: 'This topic is closed; its replies are kept' })
      }
      await fastify.prisma.discussionPost.delete({ where: { id: postId } })
      await auditLog(fastify.prisma, {
        action: 'DISCUSSION_POST_REMOVE',
        actorId: user.id,
        targetId: routeParams.id,
        meta: { postId: routeParams.postId, byAuthor },
      })
      return reply.send({ ok: true })
    },
  )

  // POST /api/v1/governance/discussions/read-all — marks every followed
  // topic read, so the list's new-reply counts go back to zero.
  fastify.post(
    '/api/v1/governance/discussions/read-all',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionsReadAllSchema, 'DiscussionsReadAll'),
      },
    },
    async (request, reply) => {
      const { count } = await fastify.prisma.discussionParticipant.updateMany({
        where: { userId: request.sessionUser!.id },
        data: { lastReadAt: new Date() },
      })
      return reply.send({ marked: count })
    },
  )
}

export default discussionRoutes
