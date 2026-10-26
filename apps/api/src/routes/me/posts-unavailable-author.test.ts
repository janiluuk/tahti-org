// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, processScheduledPostNotifications } from '@tahti/db'
import { executeAccountDeletion } from '../../lib/account-deletion.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'posts-unavailable-'
const log = { info: () => {}, warn: () => {}, error: () => {} } as never

describe('Scheduled posts by an unavailable author', () => {
  let followerId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: 'posts-unavail-follower',
    })
    followerId = follower.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  async function artistWithFollower(tag: string) {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}${tag}@example.com`,
      username: `posts-unavail-${tag}`,
    })
    await prisma.artistFollow.create({
      data: { followerUserId: followerId, artistUserId: artist.id },
    })
    return artist
  }

  it('closes a due post from a suspended artist without telling followers', async () => {
    const artist = await artistWithFollower('suspended')
    const post = await prisma.artistPost.create({
      data: {
        userId: artist.id,
        body: 'Due while suspended',
        publishAt: new Date(Date.now() - 1000),
      },
    })
    await prisma.user.update({ where: { id: artist.id }, data: { suspendedAt: new Date() } })

    await processScheduledPostNotifications(prisma)

    const updated = await prisma.artistPost.findUniqueOrThrow({ where: { id: post.id } })
    expect(updated.notifiedAt).not.toBeNull()
    const notices = await prisma.notification.count({
      where: { userId: followerId, actorUserId: artist.id, type: 'NEW_POST' },
    })
    expect(notices).toBe(0)
  })

  it('still notifies followers of an available artist', async () => {
    const artist = await artistWithFollower('active')
    await prisma.artistPost.create({
      data: { userId: artist.id, body: 'Due now', publishAt: new Date(Date.now() - 1000) },
    })

    await processScheduledPostNotifications(prisma)

    const notices = await prisma.notification.count({
      where: { userId: followerId, actorUserId: artist.id, type: 'NEW_POST' },
    })
    expect(notices).toBe(1)
  })

  it('account deletion drops posts scheduled for later and keeps published ones', async () => {
    const artist = await artistWithFollower('deleted')
    const published = await prisma.artistPost.create({
      data: { userId: artist.id, body: 'Already out', publishAt: new Date(Date.now() - 60_000) },
    })
    const scheduled = await prisma.artistPost.create({
      data: {
        userId: artist.id,
        body: 'Next week',
        publishAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    })

    await executeAccountDeletion(prisma, log, { userId: artist.id, actorId: followerId })

    expect(await prisma.artistPost.findUnique({ where: { id: scheduled.id } })).toBeNull()
    expect(await prisma.artistPost.findUnique({ where: { id: published.id } })).not.toBeNull()
  })
})
