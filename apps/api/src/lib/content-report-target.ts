// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export type ContentReportTarget = {
  /** What the board sees in the queue: a title, or who wrote the comment. */
  label: string
  /** Path of the page the target lives on, in the web app. */
  url: string
  /** The reported text itself, for comments. */
  excerpt: string | null
}

const EXCERPT_LENGTH = 280

/** Looks up what a report points at. Channels and collections are reported by
 * slug, everything else by id. Returns null when there is no such thing. */
export async function resolveContentReportTarget(
  prisma: PrismaClient,
  targetType: string,
  targetId: string,
): Promise<ContentReportTarget | null> {
  switch (targetType) {
    case 'SOUND_ITEM': {
      const sound = await prisma.sound.findUnique({
        where: { id: targetId },
        select: { id: true, title: true },
      })
      return sound && { label: sound.title, url: `/t/${sound.id}`, excerpt: null }
    }
    case 'RELEASE': {
      const release = await prisma.release.findUnique({
        where: { id: targetId },
        select: { title: true, smartLinkSlug: true },
      })
      return release && { label: release.title, url: `/r/${release.smartLinkSlug}`, excerpt: null }
    }
    case 'CHANNEL': {
      const channel = await prisma.channel.findFirst({
        where: { OR: [{ slug: targetId }, { id: targetId }] },
        select: { slug: true },
      })
      return channel && { label: channel.slug, url: `/channel/${channel.slug}`, excerpt: null }
    }
    case 'COLLECTION': {
      const collection = await prisma.collection.findFirst({
        where: { OR: [{ slug: targetId }, { id: targetId }] },
        select: { slug: true, name: true },
      })
      return collection && { label: collection.name, url: `/c/${collection.slug}`, excerpt: null }
    }
    case 'COMMENT': {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          body: true,
          author: { select: { username: true } },
          sound: { select: { id: true } },
          channel: { select: { slug: true } },
        },
      })
      if (!comment) return null
      return {
        label: `Comment by @${comment.author.username}`,
        url: comment.sound
          ? `/t/${comment.sound.id}`
          : comment.channel
            ? `/channel/${comment.channel.slug}`
            : '/',
        excerpt: comment.body.slice(0, EXCERPT_LENGTH),
      }
    }
    case 'MOTION_COMMENT': {
      if (!/^\d+$/.test(targetId)) return null
      const comment = await prisma.motionComment.findUnique({
        where: { id: BigInt(targetId) },
        select: { body: true, motionId: true },
      })
      return (
        comment && {
          label: 'Motion comment',
          url: `/governance/motions/${comment.motionId}`,
          excerpt: comment.body.slice(0, EXCERPT_LENGTH),
        }
      )
    }
    default:
      return null
  }
}
