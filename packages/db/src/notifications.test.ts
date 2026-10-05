// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  notifyArtistOfNewComment,
  notifyArtistOfNewFollower,
  notifyArtistOfNewLike,
  notifyArtistOfNewRepost,
  notifyArtistOfRadioSubmissionRejected,
  notifyBoardOfMissedLiveShow,
  notifyFollowersOfLiveChannel,
  notifyFollowersOfNewPost,
  notifyPlaylistOfNewTrack,
  notifyUserOfNewMessage,
  notifyUsersOfChatMention,
} from './notifications.js'

function fakePrisma(recent: { id: string } | null = null, blocked = false) {
  const create = vi.fn().mockResolvedValue({})
  const findFirst = vi.fn().mockResolvedValue(recent)
  const findBlock = vi.fn().mockResolvedValue(blocked ? { blockerUserId: 'artist-1' } : null)
  return {
    prisma: {
      notification: { create, findFirst },
      userBlock: { findFirst: findBlock },
    } as unknown as PrismaClient,
    create,
    findFirst,
  }
}

const actor = { id: 'fan-1', username: 'fan', displayName: 'Fan' }
const item = { id: 'sound-1', title: 'Night Drive', channelSlug: 'artist-channel' }

describe('notification target urls', () => {
  it('links a new like to the loved track', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfNewLike(prisma, 'artist-1', actor, item)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NEW_LIKE', url: '/t/sound-1' }),
    })
  })

  it('links a new repost to the reposted track', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfNewRepost(prisma, 'artist-1', actor, item)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NEW_REPOST', url: '/t/sound-1' }),
    })
  })

  it('links a rejected radio submission to the Tahti Radio submissions tab', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfRadioSubmissionRejected(
      prisma,
      'artist-1',
      'Night Drive',
      'Too quiet for rotation',
    )
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RADIO_SUBMISSION_REJECTED',
        title: '"Night Drive" was not added to Tahti Radio',
        url: '/studio/channel?tab=tahti-radio',
      }),
    })
  })
})

describe('notification titles never carry an email address', () => {
  const emailActor = { id: 'fan-2', username: 'quietfan', displayName: 'fan@example.com' }

  function fanOutPrisma() {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const create = vi.fn().mockResolvedValue({})
    const prisma = {
      notification: { create, createMany, findFirst: vi.fn().mockResolvedValue(null) },
      artistFollow: { findMany: vi.fn().mockResolvedValue([{ followerUserId: 'follower-1' }]) },
      collectionItem: { findMany: vi.fn().mockResolvedValue([]) },
      collectionSubscription: { findMany: vi.fn().mockResolvedValue([]) },
      userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient
    const titles = () =>
      [
        ...create.mock.calls.map(([arg]) => (arg as { data: { title: string } }).data.title),
        ...createMany.mock.calls.flatMap(([arg]) =>
          (arg as { data: Array<{ title: string }> }).data.map((d) => d.title),
        ),
      ] as string[]
    return { prisma, titles }
  }

  it.each([
    [
      'new follower',
      (p: PrismaClient) => notifyArtistOfNewFollower(p, 'artist-1', emailActor),
      'quietfan followed you',
    ],
    [
      'new like',
      (p: PrismaClient) => notifyArtistOfNewLike(p, 'artist-1', emailActor, item),
      'quietfan loved "Night Drive"',
    ],
    [
      'new repost',
      (p: PrismaClient) => notifyArtistOfNewRepost(p, 'artist-1', emailActor, item),
      'quietfan reposted "Night Drive"',
    ],
    [
      'new comment',
      (p: PrismaClient) =>
        notifyArtistOfNewComment(
          p,
          'artist-1',
          emailActor,
          { body: 'Nice' },
          { channelSlug: 'ch' },
        ),
      'quietfan commented on your channel',
    ],
    [
      'new message',
      (p: PrismaClient) => notifyUserOfNewMessage(p, 'artist-1', emailActor, 'conv-1', 'Hi'),
      'quietfan sent you a message',
    ],
    [
      'chat mention',
      (p: PrismaClient) => notifyUsersOfChatMention(p, ['artist-1'], emailActor, 'ch', 'Hi'),
      'quietfan mentioned you in chat',
    ],
    [
      'new post',
      (p: PrismaClient) => notifyFollowersOfNewPost(p, emailActor, { title: null, body: 'News' }),
      'quietfan posted an update',
    ],
    [
      'live channel',
      (p: PrismaClient) => notifyFollowersOfLiveChannel(p, emailActor, { slug: 'ch' }),
      'quietfan is live',
    ],
    [
      'playlist add',
      (p: PrismaClient) =>
        notifyPlaylistOfNewTrack(
          p,
          { id: 'c1', slug: 'mix', name: 'Mix', ownerUsername: 'owner', ownerUserId: 'owner-1' },
          emailActor,
          { title: 'Night Drive' },
        ),
      'quietfan added "Night Drive" to Mix',
    ],
    [
      'missed live show',
      (p: PrismaClient) =>
        notifyBoardOfMissedLiveShow(
          p,
          { id: 's1', title: 'Show', startAt: new Date('2026-10-01T18:00:00Z') },
          emailActor,
          ['board-1'],
        ),
      'quietfan missed a scheduled show',
    ],
  ])('names the actor by username for a %s', async (_name, notify, title) => {
    const { prisma, titles } = fanOutPrisma()
    await notify(prisma)
    expect(titles()).toEqual([title])
  })
})

describe('follow, love and repost notices are not repeated within a day', () => {
  it('stays quiet when the same person already triggered it today', async () => {
    const { prisma, create, findFirst } = fakePrisma({ id: 'n1' })
    await notifyArtistOfNewFollower(prisma, 'artist-1', actor)
    await notifyArtistOfNewLike(prisma, 'artist-1', actor, item)
    await notifyArtistOfNewRepost(prisma, 'artist-1', actor, item)
    expect(create).not.toHaveBeenCalled()
    expect(findFirst).toHaveBeenCalledTimes(3)
    expect(findFirst.mock.calls[1]?.[0].where).toMatchObject({
      userId: 'artist-1',
      actorUserId: 'fan-1',
      type: 'NEW_LIKE',
      url: '/t/sound-1',
    })
  })

  it('still notifies the first time', async () => {
    const { prisma, create } = fakePrisma(null)
    await notifyArtistOfNewFollower(prisma, 'artist-1', actor)
    await notifyArtistOfNewLike(prisma, 'artist-1', actor, item)
    await notifyArtistOfNewRepost(prisma, 'artist-1', actor, item)
    expect(create).toHaveBeenCalledTimes(3)
  })
})

describe('notices from a blocked account', () => {
  it('are not sent for a follow, love or repost', async () => {
    const { prisma, create } = fakePrisma(null, true)
    await notifyArtistOfNewFollower(prisma, 'artist-1', actor)
    await notifyArtistOfNewLike(prisma, 'artist-1', actor, item)
    await notifyArtistOfNewRepost(prisma, 'artist-1', actor, item)
    expect(create).not.toHaveBeenCalled()
  })
})
