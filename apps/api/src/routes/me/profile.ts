// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MetaStreamOptResponseSchema,
  MetaStreamOptSchema,
  ProfileFieldsSchema,
  ProfilePatchSchema,
  openApiResponse,
  parseAvatarTheme,
  parseLogoPlacement,
} from '@tahti/shared'
import { parseHearthisUsername } from '@tahti/hearthis'
import { requireAuth } from '../../plugins/auth.js'
import { recordMentions } from '../../lib/mentions.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  avatarPosterUrl: true,
  avatarThemeJson: true,
  logoUrl: true,
  logoPlacement: true,
  tipJarUrl: true,
  countryCode: true,
  pronouns: true,
  defaultLocation: true,
  socialLinks: true,
  publicAttribution: true,
  showJoinDate: true,
  showFollowers: true,
  showFollowing: true,
  showDailyListeners: true,
  chatEnabled: true,
  createdAt: true,
} as const

function serializeProfile(
  profile: {
    id: string
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
    avatarPosterUrl: string | null
    avatarThemeJson: string | null
    logoUrl: string | null
    logoPlacement: string | null
    tipJarUrl: string | null
    countryCode: string | null
    pronouns: string | null
    defaultLocation: string | null
    socialLinks: unknown
    publicAttribution: boolean
    showJoinDate: boolean
    showFollowers: boolean
    showFollowing: boolean
    showDailyListeners: boolean
    chatEnabled: boolean
    createdAt: Date
  },
  artistKind: 'SINGLE' | 'COLLECTIVE',
) {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    avatarPosterUrl: profile.avatarPosterUrl,
    avatarTheme: parseAvatarTheme(profile.avatarThemeJson),
    logoUrl: profile.logoUrl,
    logoPlacement: parseLogoPlacement(profile.logoPlacement),
    tipJarUrl: profile.tipJarUrl,
    countryCode: profile.countryCode,
    pronouns: profile.pronouns,
    defaultLocation: profile.defaultLocation,
    socialLinks: profile.socialLinks,
    publicAttribution: profile.publicAttribution,
    showJoinDate: profile.showJoinDate,
    showFollowers: profile.showFollowers,
    showFollowing: profile.showFollowing,
    showDailyListeners: profile.showDailyListeners,
    chatEnabled: profile.chatEnabled,
    createdAt: profile.createdAt.toISOString(),
    artistKind,
  }
}

// PATCH /api/me/profile — update bio, display name, social links, tip jar, meta-stream opt-out
const meProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/profile — current profile fields, for the settings form
  fastify.get(
    '/api/me/profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ProfileFieldsSchema, 'ProfileFields'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const profile = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: profileSelect,
      })
      if (!profile) return reply.status(404).send({ error: 'User not found' })
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { artistKind: true },
      })
      return reply.send(serializeProfile(profile, channel?.artistKind ?? 'SINGLE'))
    },
  )

  fastify.patch(
    '/api/me/profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ProfileFieldsSchema, 'ProfileFields'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ProfilePatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}

      if (body.displayName !== undefined) data.displayName = body.displayName
      if (body.bio !== undefined) data.bio = body.bio.trim() || null
      if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl.trim() || null
      if (body.avatarPosterUrl !== undefined)
        data.avatarPosterUrl = body.avatarPosterUrl?.trim() || null
      if (body.avatarTheme !== undefined) {
        data.avatarThemeJson = body.avatarTheme ? JSON.stringify(body.avatarTheme) : null
      }
      if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl?.trim() || null
      if (body.logoPlacement !== undefined) data.logoPlacement = body.logoPlacement
      if (body.tipJarUrl !== undefined) data.tipJarUrl = body.tipJarUrl.trim() || null
      if (body.countryCode !== undefined) data.countryCode = body.countryCode?.toUpperCase() ?? null
      if (body.pronouns !== undefined) data.pronouns = body.pronouns?.trim() || null
      if (body.defaultLocation !== undefined)
        data.defaultLocation = body.defaultLocation?.trim() || null
      if (body.socialLinks !== undefined) {
        data.socialLinks = body.socialLinks
        // The hearthis.at import feature reads User.hearthisUsername directly
        // (apps/api/src/routes/imports/hearthis.ts) rather than re-parsing the
        // social-links blob on every request — keep it in sync here, the one
        // place that field gets written.
        const hearthisAt = (body.socialLinks as Record<string, string> | undefined)?.hearthisAt
        if (hearthisAt !== undefined) {
          data.hearthisUsername = hearthisAt.trim() ? parseHearthisUsername(hearthisAt) : null
        }
      }
      if (body.publicAttribution !== undefined) data.publicAttribution = body.publicAttribution
      if (body.showJoinDate !== undefined) data.showJoinDate = body.showJoinDate
      if (body.showFollowers !== undefined) data.showFollowers = body.showFollowers
      if (body.showFollowing !== undefined) data.showFollowing = body.showFollowing
      if (body.showDailyListeners !== undefined) data.showDailyListeners = body.showDailyListeners
      if (body.chatEnabled !== undefined) data.chatEnabled = body.chatEnabled

      const updated =
        Object.keys(data).length > 0
          ? await fastify.prisma.user.update({
              where: { id: user.id },
              data,
              select: profileSelect,
            })
          : await fastify.prisma.user.findUniqueOrThrow({
              where: { id: user.id },
              select: profileSelect,
            })

      let artistKind: 'SINGLE' | 'COLLECTIVE' = 'SINGLE'
      if (body.artistKind !== undefined) {
        const channel = await fastify.prisma.channel.updateMany({
          where: { userId: user.id },
          data: { artistKind: body.artistKind },
        })
        if (channel.count === 0) {
          return reply.status(404).send({ error: 'Channel not found' })
        }
        artistKind = body.artistKind
      } else {
        const channel = await fastify.prisma.channel.findUnique({
          where: { userId: user.id },
          select: { artistKind: true },
        })
        artistKind = channel?.artistKind ?? 'SINGLE'
      }

      if (body.bio) {
        recordMentions(fastify.prisma, user.id, body.bio, 'BIO', user.id).catch((e) =>
          fastify.log.warn(e, 'mention record failed'),
        )
      }

      return reply.send(serializeProfile(updated, artistKind))
    },
  )

  // GET /api/me/channel/meta-stream — current opt-out state
  fastify.get(
    '/api/me/channel/meta-stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(MetaStreamOptResponseSchema, 'MetaStreamOpt'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { metaStreamOptOut: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send({ metaStreamOptOut: channel.metaStreamOptOut })
    },
  )

  // PATCH /api/me/channel/meta-stream — toggle Tahti Radio opt-out
  fastify.patch(
    '/api/me/channel/meta-stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(MetaStreamOptResponseSchema, 'MetaStreamOpt'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = MetaStreamOptSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { optOut } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { metaStreamOptOut: optOut },
      })

      return reply.send({ metaStreamOptOut: optOut })
    },
  )
}

export default meProfileRoutes
