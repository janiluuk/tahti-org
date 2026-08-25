// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { GreenRoomInvitePool, GreenRoomInviteSource, Prisma, PrismaClient } from '@tahti/db'
import type { GreenRoomCandidateView, GreenRoomInviteView } from '@tahti/shared'
import { liveHlsUrl } from './stream-quality.js'
import { config } from '../config.js'

const userSelect = { id: true, username: true, displayName: true } as const

export async function getActiveBroadcast(prisma: PrismaClient, channelId: string) {
  return prisma.broadcast.findFirst({
    where: { channelId, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      greenRoomEnabled: true,
      channel: {
        select: {
          state: true,
          slug: true,
          greenRoomDefaultInvitePool: true,
          userId: true,
          user: { select: { username: true, displayName: true } },
        },
      },
    },
  })
}

export async function listGreenRoomCandidates(
  prisma: PrismaClient,
  channelId: string,
  artistUserId: string,
  pool: GreenRoomInvitePool,
): Promise<GreenRoomCandidateView[]> {
  // EVERYONE grants access dynamically per-request (see resolveGreenRoomAccess) —
  // there is no fixed audience to pre-populate an invite list from.
  if (pool === 'MANUAL_ONLY' || pool === 'EVERYONE') return []

  const candidates: GreenRoomCandidateView[] = []
  const seen = new Set<string>()

  if (pool === 'MODERATORS_AND_SUBS') {
    const moderators = await prisma.channelModerator.findMany({
      where: { channelId },
      orderBy: { grantedAt: 'asc' },
      include: { user: { select: userSelect } },
    })
    for (const mod of moderators) {
      if (mod.userId === artistUserId || seen.has(mod.userId)) continue
      seen.add(mod.userId)
      candidates.push({
        userId: mod.user.id,
        username: mod.user.username,
        displayName: mod.user.displayName,
        kind: 'MODERATOR',
      })
    }
  }

  if (pool === 'MODERATORS_AND_SUBS' || pool === 'SUBS_ONLY') {
    const subs = await prisma.fanSubscription.findMany({
      where: { artistUserId, state: 'ACTIVE' },
      orderBy: { startedAt: 'asc' },
      include: { subscriber: { select: userSelect } },
    })
    for (const sub of subs) {
      if (sub.subscriberUserId === artistUserId || seen.has(sub.subscriberUserId)) continue
      seen.add(sub.subscriberUserId)
      candidates.push({
        userId: sub.subscriber.id,
        username: sub.subscriber.username,
        displayName: sub.subscriber.displayName,
        kind: 'FAN_SUB',
      })
    }
  }

  return candidates
}

function mapInvite(
  row: Prisma.BroadcastGreenRoomInviteGetPayload<{
    include: { user: { select: typeof userSelect } }
  }>,
): GreenRoomInviteView {
  return {
    userId: row.user.id,
    username: row.user.username,
    displayName: row.user.displayName,
    source: row.source,
    invitedAt: row.invitedAt.toISOString(),
    joinedAt: row.joinedAt?.toISOString() ?? null,
  }
}

export async function listGreenRoomInvites(
  prisma: PrismaClient,
  broadcastId: string,
): Promise<GreenRoomInviteView[]> {
  const rows = await prisma.broadcastGreenRoomInvite.findMany({
    where: { broadcastId },
    orderBy: [{ joinedAt: 'desc' }, { invitedAt: 'asc' }],
    include: { user: { select: userSelect } },
  })
  return rows.map(mapInvite)
}

export async function syncGreenRoomInvites(
  prisma: PrismaClient,
  channelId: string,
  artistUserId: string,
  broadcastId: string,
  pool: GreenRoomInvitePool,
) {
  const candidates = await listGreenRoomCandidates(prisma, channelId, artistUserId, pool)
  if (candidates.length === 0) return

  await prisma.broadcastGreenRoomInvite.createMany({
    data: candidates.map((c) => ({
      broadcastId,
      userId: c.userId,
      source: c.kind === 'MODERATOR' ? ('MODERATOR' as GreenRoomInviteSource) : 'FAN_SUB',
    })),
    skipDuplicates: true,
  })
}

export async function initGreenRoomForBroadcast(
  prisma: PrismaClient,
  channelId: string,
  broadcastId: string,
) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      userId: true,
      greenRoomDefaultEnabled: true,
      greenRoomDefaultInvitePool: true,
    },
  })
  if (!channel?.greenRoomDefaultEnabled) return

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { greenRoomEnabled: true },
  })

  await syncGreenRoomInvites(
    prisma,
    channelId,
    channel.userId,
    broadcastId,
    channel.greenRoomDefaultInvitePool,
  )
}

export async function resolveGreenRoomAccess(prisma: PrismaClient, slug: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: {
      id: true,
      state: true,
      userId: true,
      greenRoomDefaultInvitePool: true,
      user: { select: { username: true, displayName: true } },
    },
  })
  if (!channel) return null

  if (channel.userId === userId) {
    return {
      hasAccess: true,
      channelState: channel.state,
      greenRoomEnabled: true,
      joinedAt: null as string | null,
      hlsUrl:
        channel.state === 'PREVIEW' || channel.state === 'LIVE'
          ? liveHlsUrl(config.hlsBaseUrl, slug, 'STUDIO')
          : null,
      artistUsername: channel.user.username,
      artistDisplayName: channel.user.displayName,
    }
  }

  const broadcast = await prisma.broadcast.findFirst({
    where: { channelId: channel.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, greenRoomEnabled: true },
  })

  if (!broadcast?.greenRoomEnabled || channel.state !== 'PREVIEW') {
    return {
      hasAccess: false,
      channelState: channel.state,
      greenRoomEnabled: broadcast?.greenRoomEnabled ?? false,
      joinedAt: null as string | null,
      hlsUrl: null as string | null,
      artistUsername: channel.user.username,
      artistDisplayName: channel.user.displayName,
    }
  }

  const invite = await prisma.broadcastGreenRoomInvite.findUnique({
    where: { broadcastId_userId: { broadcastId: broadcast.id, userId } },
    select: { joinedAt: true },
  })

  if (!invite) {
    // EVERYONE never pre-populates an invite row (see listGreenRoomCandidates) —
    // any signed-in listener is granted access on request; /join stamps the
    // PUBLIC invite row the first time they actually join.
    if (channel.greenRoomDefaultInvitePool === 'EVERYONE') {
      return {
        hasAccess: true,
        channelState: channel.state,
        greenRoomEnabled: true,
        joinedAt: null as string | null,
        hlsUrl: liveHlsUrl(config.hlsBaseUrl, slug, 'STUDIO'),
        artistUsername: channel.user.username,
        artistDisplayName: channel.user.displayName,
      }
    }
    return {
      hasAccess: false,
      channelState: channel.state,
      greenRoomEnabled: true,
      joinedAt: null as string | null,
      hlsUrl: null as string | null,
      artistUsername: channel.user.username,
      artistDisplayName: channel.user.displayName,
    }
  }

  return {
    hasAccess: true,
    channelState: channel.state,
    greenRoomEnabled: true,
    joinedAt: invite.joinedAt?.toISOString() ?? null,
    hlsUrl: liveHlsUrl(config.hlsBaseUrl, slug, 'STUDIO'),
    artistUsername: channel.user.username,
    artistDisplayName: channel.user.displayName,
  }
}
