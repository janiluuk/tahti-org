// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import type { ArtistGroupRole, Prisma } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import { publicCollectionSoundWhere } from '../collections/helpers.js'

export const COLLECTION_SLUG_PREFIX = 'group-'

export function slugifyGroupName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function canManageGroup(role: ArtistGroupRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/** A track the caller may put in a group playlist: their own ready track
 * (any visibility, like their own playlists) or anyone's public one. */
export function addableSoundWhere(userId: string, soundId: string): Prisma.SoundWhereInput {
  return {
    id: soundId,
    status: 'READY',
    OR: [{ channel: { userId } }, publicCollectionSoundWhere],
  }
}

export const groupSummaryInclude = {
  collection: {
    select: { slug: true, userId: true, _count: { select: { items: true } } },
  },
  _count: { select: { members: true } },
} satisfies Prisma.ArtistGroupInclude

type GroupWithSummary = Prisma.ArtistGroupGetPayload<{ include: typeof groupSummaryInclude }>

export async function groupSummary(group: GroupWithSummary) {
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    description: group.description,
    coverUrl: await resolveCollectionCoverUrl({
      coverUrl: group.coverUrl,
      coverKey: group.coverKey,
    }),
    isPublic: group.isPublic,
    joinPolicy: group.joinPolicy,
    submitPolicy: group.submitPolicy,
    collectionSlug: group.collection.slug,
    memberCount: group._count.members,
    itemCount: group.collection._count.items,
  }
}

type NamedUser = { username: string; displayName: string }

export function publicUser(user: NamedUser) {
  return { username: user.username, displayName: safeDisplayName(user.displayName, user.username) }
}

/** The group and the caller's role in it (null for a non-member). */
export async function loadGroupForUser(fastify: FastifyInstance, slug: string, userId: string) {
  const group = await fastify.prisma.artistGroup.findUnique({
    where: { slug },
    include: {
      ...groupSummaryInclude,
      createdBy: { select: { id: true, username: true, displayName: true } },
      members: { where: { userId }, select: { role: true } },
    },
  })
  if (!group) return null
  return { group, role: group.members[0]?.role ?? null }
}

/** Private groups read as missing to anyone who is not in them, and a block
 * between the caller and the group's founder closes the group to the caller
 * without saying why. */
export async function groupVisibleTo(
  fastify: FastifyInstance,
  loaded: NonNullable<Awaited<ReturnType<typeof loadGroupForUser>>>,
  userId: string,
): Promise<boolean> {
  if (!loaded.group.isPublic && !loaded.role) return false
  if (loaded.role) return true
  return !(await isBlockedEitherWay(fastify.prisma, loaded.group.createdBy.id, userId))
}
