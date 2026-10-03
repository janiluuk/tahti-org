// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channel-events-test-'

describe('GET /api/channels/:slug/events', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function artistWithEvent(name: string) {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}${name}@example.com`,
      username: `${PREFIX}${name}`,
    })
    await prisma.artistEvent.create({
      data: {
        userId: artist.id,
        title: 'Upcoming gig',
        place: 'Club',
        location: 'Helsinki',
        startAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    })
    return artist
  }

  it('lists upcoming events of an available artist', async () => {
    await artistWithEvent('active')
    const res = await app.inject({ method: 'GET', url: `/api/channels/${PREFIX}active/events` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })

  it('lists no events for a suspended or deleted artist', async () => {
    const suspended = await artistWithEvent('suspended')
    const deleted = await artistWithEvent('deleted')
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })
    await prisma.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })

    for (const name of ['suspended', 'deleted']) {
      const res = await app.inject({ method: 'GET', url: `/api/channels/${PREFIX}${name}/events` })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
    }
  })
})
