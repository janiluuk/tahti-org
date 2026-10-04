// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, ensureInitialVersion } from '@tahti/db'
import { announceNewPublicTrack, isFirstTranscode } from './new-track-announcement.js'

const PREFIX = 'new-track-announce-'

async function makeUser(tag: string, displayName: string) {
  return prisma.user.create({
    data: {
      email: `${PREFIX}${tag}@example.com`,
      username: `${PREFIX}${tag}`,
      displayName,
      passwordHash: 'x',
    },
  })
}

describe('announcing a new public upload', () => {
  let artistId: string
  let followerId: string
  let channelId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const artist = await makeUser('artist', 'artist@example.com')
    const follower = await makeUser('fan', 'Fan')
    artistId = artist.id
    followerId = follower.id
    const channel = await prisma.channel.create({
      data: {
        userId: artist.id,
        slug: `${PREFIX}artist`,
        liveSourceMount: `/live/${PREFIX}artist`,
        liveSourcePass: 'x',
        liveSourcePassHash: 'x',
        rtmpStreamKey: `${PREFIX}key`,
        rtmpStreamKeyHash: 'x',
      },
    })
    channelId = channel.id
    await prisma.artistFollow.create({
      data: { followerUserId: follower.id, artistUserId: artist.id },
    })
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: followerId } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.$disconnect()
  })

  const sound = (title: string, isPublic: boolean) =>
    prisma.sound.create({
      data: {
        channelId,
        title,
        rawKey: `raw/${title}.wav`,
        mp3Key: `mp3/${title}.mp3`,
        status: 'READY',
        isPublic,
      },
    })

  it('notifies followers of a public track, naming the artist by username, not email', async () => {
    const track = await sound('first-light', true)
    expect(await isFirstTranscode(prisma, track.id, 'PENDING')).toBe(true)
    await announceNewPublicTrack(prisma, track.id)
    const notes = await prisma.notification.findMany({
      where: { userId: followerId, type: 'NEW_TRACK', actorUserId: artistId },
    })
    expect(notes.map((n) => [n.title, n.body])).toEqual([
      [`${PREFIX}artist shared a new track`, 'first-light'],
    ])
    expect(await isFirstTranscode(prisma, track.id, 'READY')).toBe(false)
    await prisma.sound.update({ where: { id: track.id }, data: { fileSizeBytes: BigInt(1000) } })
    await ensureInitialVersion(prisma, track.id)
    expect(await isFirstTranscode(prisma, track.id, 'ERROR')).toBe(false)
  })

  it('stays quiet for a private upload', async () => {
    const track = await sound('demo-cut', false)
    await announceNewPublicTrack(prisma, track.id)
    const notes = await prisma.notification.findMany({
      where: { userId: followerId, body: 'demo-cut' },
    })
    expect(notes).toEqual([])
  })
})
