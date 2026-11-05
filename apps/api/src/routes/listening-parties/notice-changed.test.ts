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
import { createPartyRelease, insertParty } from '../../test/listening-party-fixtures.js'

const PREFIX = 'lp-notice-changed-'
const HOUR = 60 * 60 * 1000

describe('listening party moved / cancelled notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const ids: Record<string, string> = {}
  let hostCookie = ''
  let partyId = ''

  const noticesFor = (name: string) =>
    prisma.notification.findMany({
      where: { userId: ids[name]!, type: 'LISTENING_PARTY_CHANGED' },
      orderBy: { createdAt: 'asc' },
      select: { title: true, body: true, url: true },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    let channelId = ''
    for (const name of ['host', 'fan', 'other']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        displayName: name === 'host' ? 'Host' : name,
        tier: 'ARTIST',
      })
      ids[name] = user.id
      if (name === 'host') channelId = user.channel!.id
    }
    hostCookie = await sessionCookieFor(prisma, ids.host!)
    const release = await createPartyRelease(prisma, ids.host!, 'Changed Album')
    partyId = (
      await insertParty(
        prisma,
        { id: ids.host!, channelId },
        release.id,
        new Date(Date.now() + 48 * HOUR),
      )
    ).id
    await prisma.listeningPartyReminder.create({ data: { partyId, userId: ids.fan! } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tells reminded listeners when the party moves, but not for a note edit', async () => {
    const note = await app.inject({
      method: 'PATCH',
      url: `/api/me/listening-parties/${partyId}`,
      headers: { cookie: hostCookie },
      payload: { hostNote: 'Bring headphones' },
    })
    expect(note.statusCode).toBe(200)
    expect(await noticesFor('fan')).toHaveLength(0)

    const startAt = new Date(Date.now() + 72 * HOUR)
    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/me/listening-parties/${partyId}`,
      headers: { cookie: hostCookie },
      payload: { startAt: startAt.toISOString() },
    })
    expect(moved.statusCode).toBe(200)
    const notices = await noticesFor('fan')
    expect(notices).toHaveLength(1)
    expect(notices[0]!.title).toBe("Host's listening party moved")
    expect(notices[0]!.body).toContain(startAt.toISOString().slice(0, 16).replace('T', ' '))
    expect(await noticesFor('other')).toHaveLength(0)
  })

  it('tells them when it is cancelled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/listening-parties/${partyId}/cancel`,
      headers: { cookie: hostCookie },
    })
    expect(res.statusCode).toBe(200)
    const notices = await noticesFor('fan')
    expect(notices.map((n) => n.title)).toEqual([
      "Host's listening party moved",
      'Host cancelled their listening party',
    ])
    expect(notices[1]!.url).toBe(`/party/${partyId}`)
  })
})
