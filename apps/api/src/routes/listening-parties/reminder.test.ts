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

const PREFIX = 'lp-reminder-'
const HOUR = 60 * 60 * 1000

describe('/api/v1/listening-parties/:id/reminder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  let scheduledId = ''
  let liveId = ''

  const call = (method: 'GET' | 'POST' | 'DELETE', partyId: string, who?: string) =>
    app.inject({
      method,
      url: `/api/v1/listening-parties/${partyId}/reminder`,
      headers: who ? { cookie: cookies[who]! } : {},
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    let hostChannelId = ''
    for (const name of ['host', 'fan', 'fan2', 'blocked']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        tier: 'ARTIST',
      })
      ids[name] = user.id
      cookies[name] = await sessionCookieFor(prisma, user.id)
      if (name === 'host') hostChannelId = user.channel!.id
    }
    await prisma.userBlock.create({
      data: { blockerUserId: ids.host!, blockedUserId: ids.blocked! },
    })
    const host = { id: ids.host!, channelId: hostChannelId }
    const release = await createPartyRelease(prisma, ids.host!, 'Reminder Album')
    scheduledId = (await insertParty(prisma, host, release.id, new Date(Date.now() + 24 * HOUR))).id
    liveId = (await insertParty(prisma, host, release.id, new Date(Date.now() - 60 * 1000))).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('counts reminders and says whether you asked', async () => {
    expect((await call('POST', scheduledId, 'fan')).json()).toEqual({ reminded: true, count: 1 })
    expect((await call('POST', scheduledId, 'fan')).json()).toEqual({ reminded: true, count: 1 })
    expect((await call('POST', scheduledId, 'fan2')).json()).toEqual({ reminded: true, count: 2 })
    expect((await call('GET', scheduledId)).json()).toEqual({ reminded: false, count: 2 })
    expect((await call('GET', scheduledId, 'fan')).json()).toEqual({ reminded: true, count: 2 })
    expect((await call('DELETE', scheduledId, 'fan')).json()).toEqual({
      reminded: false,
      count: 1,
    })
  })

  it('takes no reminders once a party has started', async () => {
    expect((await call('POST', liveId, 'fan')).statusCode).toBe(409)
  })

  it('needs a session to ask, and hides the party across a block', async () => {
    expect((await call('POST', scheduledId)).statusCode).toBe(401)
    expect((await call('POST', scheduledId, 'blocked')).statusCode).toBe(404)
    expect((await call('GET', 'no-such-party')).statusCode).toBe(404)
  })
})
