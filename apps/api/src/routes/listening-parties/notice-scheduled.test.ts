// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'lp-notice-scheduled-'
const HOUR = 60 * 60 * 1000

describe('listening party scheduled notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const ids: Record<string, string> = {}
  let hostCookie = ''
  let releaseId = ''

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['host', 'fan', 'blocked', 'stranger']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        displayName: name === 'host' ? 'host@example.com' : name,
        tier: 'ARTIST',
      })
      ids[name] = user.id
    }
    hostCookie = await sessionCookieFor(prisma, ids.host!)
    await prisma.artistFollow.createMany({
      data: [
        { followerUserId: ids.fan!, artistUserId: ids.host! },
        { followerUserId: ids.blocked!, artistUserId: ids.host! },
      ],
    })
    await prisma.userBlock.create({
      data: { blockerUserId: ids.host!, blockedUserId: ids.blocked! },
    })
    const release = await prisma.release.create({
      data: {
        userId: ids.host!,
        title: 'Notice Album',
        type: 'ALBUM',
        releaseDate: new Date(Date.now() + 30 * 24 * HOUR),
        smartLinkSlug: `lp-notice-${Date.now()}`,
        tracks: {
          create: [
            {
              position: 1,
              title: 'One',
              durationSec: 120,
              streamKey: 'streams/n-1.opus',
              status: 'READY',
            },
          ],
        },
      },
    })
    releaseId = release.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("tells the host's followers, except a blocked one, with a link to the party", async () => {
    const startAt = new Date(Date.now() + 48 * HOUR)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/listening-parties',
      headers: { cookie: hostCookie },
      payload: { releaseId, startAt: startAt.toISOString() },
    })
    expect(res.statusCode).toBe(201)
    const partyId = (res.json() as { id: string }).id
    const notices = await prisma.notification.findMany({
      where: { type: 'LISTENING_PARTY_SCHEDULED', actorUserId: ids.host },
      select: { userId: true, title: true, body: true, url: true },
    })
    expect(notices.map((n) => n.userId)).toEqual([ids.fan])
    expect(notices[0]!.url).toBe(`/party/${partyId}`)
    expect(notices[0]!.title).not.toContain('@')
    expect(notices[0]!.body).toBe(
      `"Notice Album" · ${startAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    )
  })
})
