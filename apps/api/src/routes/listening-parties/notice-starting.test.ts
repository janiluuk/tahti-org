// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { notifyListeningPartyStarting, prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import { createPartyRelease, insertParty } from '../../test/listening-party-fixtures.js'

const PREFIX = 'lp-notice-starting-'

describe('notifyListeningPartyStarting', () => {
  const ids: Record<string, string> = {}
  let partyId = ''

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    let channelId = ''
    for (const name of ['host', 'fan', 'blocker', 'gone', 'quiet']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        tier: 'ARTIST',
      })
      ids[name] = user.id
      if (name === 'host') channelId = user.channel!.id
    }
    const release = await createPartyRelease(prisma, ids.host!, 'Starting Album')
    partyId = (await insertParty(prisma, { id: ids.host!, channelId }, release.id, new Date())).id
    await prisma.listeningPartyReminder.createMany({
      data: ['fan', 'blocker', 'gone'].map((name) => ({ partyId, userId: ids[name]! })),
    })
    await prisma.userBlock.create({
      data: { blockerUserId: ids.blocker!, blockedUserId: ids.host! },
    })
    await prisma.user.update({ where: { id: ids.gone }, data: { suspendedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('tells only reminded, available, unblocked listeners', async () => {
    const told = await notifyListeningPartyStarting(
      prisma,
      { id: ids.host!, username: `${PREFIX}host`, displayName: 'Host' },
      { id: partyId, startAt: new Date(), release: { title: 'Starting Album' } },
    )
    expect(told).toBe(1)
    const notices = await prisma.notification.findMany({
      where: { type: 'LISTENING_PARTY_STARTING', actorUserId: ids.host },
      select: { userId: true, title: true, url: true },
    })
    expect(notices).toEqual([
      { userId: ids.fan, title: "Host's listening party is starting", url: `/party/${partyId}` },
    ])
  })
})
