// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { userName } from './safe-names.js'

/** The columns `resolveMentionSources` needs from each mention row. */
export const mentionSourceSelect = {
  id: true,
  surface: true,
  sourceId: true,
  createdAt: true,
  mentioner: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      channel: { select: { slug: true } },
    },
  },
} as const

type MentionRow = {
  id: string
  surface: string
  sourceId: string
  createdAt: Date
  mentioner: {
    username: string
    displayName: string
    avatarUrl: string | null
    channel: { slug: string } | null
  }
}

export type ResolvedMention = {
  id: string
  surface: string
  sourceId: string
  createdAt: Date
  mentioner: { username: string; displayName: string; avatarUrl: string | null }
  sourceTitle: string | null
  sourceUrl: string | null
}

/** Adds where each mention happened: a title and an in-app path, or nulls when
 * the source is private, unpublished or gone. Tracks and releases are looked
 * up in one query each; a bio, announcement, newsletter or chat mention
 * resolves from the mentioner or the chat's channel. */
export async function resolveMentionSources(
  prisma: PrismaClient,
  mentions: MentionRow[],
): Promise<ResolvedMention[]> {
  const idsFor = (surface: string) =>
    mentions.filter((m) => m.surface === surface).map((m) => m.sourceId)
  const soundIds = idsFor('TRACKLIST')
  const releaseIds = idsFor('RELEASE')
  // A chat mention's sourceId is `chat:${channelId}:${ts}:${mentionerId}`.
  const chatChannelIds = idsFor('CHAT')
    .map((sourceId) => sourceId.split(':')[1])
    .filter((id): id is string => Boolean(id))

  const [sounds, releases, chatChannels] = await Promise.all([
    soundIds.length > 0
      ? prisma.sound.findMany({
          where: { id: { in: soundIds }, isPublic: true, status: 'READY' },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    releaseIds.length > 0
      ? prisma.release.findMany({
          where: { id: { in: releaseIds }, state: 'PUBLISHED' },
          select: { id: true, title: true, smartLinkSlug: true },
        })
      : Promise.resolve([]),
    chatChannelIds.length > 0
      ? prisma.channel.findMany({
          where: { id: { in: chatChannelIds } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
  ])
  const soundById = new Map(sounds.map((s) => [s.id, s]))
  const releaseById = new Map(releases.map((r) => [r.id, r]))
  const chatChannelById = new Map(chatChannels.map((c) => [c.id, c]))

  return mentions.map((m) => {
    const name = userName(m.mentioner)
    const base = {
      id: m.id,
      surface: m.surface,
      sourceId: m.sourceId,
      createdAt: m.createdAt,
      mentioner: {
        username: m.mentioner.username,
        displayName: name,
        avatarUrl: m.mentioner.avatarUrl,
      },
    }
    switch (m.surface) {
      case 'BIO':
      case 'NEWSLETTER':
        return { ...base, sourceTitle: name, sourceUrl: `/u/${m.mentioner.username}` }
      case 'TRACKLIST': {
        const sound = soundById.get(m.sourceId)
        return {
          ...base,
          sourceTitle: sound?.title ?? null,
          sourceUrl: sound ? `/t/${sound.id}` : null,
        }
      }
      case 'RELEASE': {
        const release = releaseById.get(m.sourceId)
        return {
          ...base,
          sourceTitle: release?.title ?? null,
          sourceUrl: release ? `/r/${release.smartLinkSlug}` : null,
        }
      }
      case 'ANNOUNCEMENT': {
        const slug = m.mentioner.channel?.slug
        return { ...base, sourceTitle: name, sourceUrl: slug ? `/channel/${slug}` : null }
      }
      case 'CHAT': {
        const channelId = m.sourceId.split(':')[1]
        const channel = channelId ? chatChannelById.get(channelId) : undefined
        return { ...base, sourceTitle: name, sourceUrl: channel ? `/chat/${channel.slug}` : null }
      }
      default:
        return { ...base, sourceTitle: null, sourceUrl: null }
    }
  })
}
