// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'upcoming-events-'
const DAY = 24 * 60 * 60 * 1000

describe('GET /api/v1/events/upcoming', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { displayName: 'Night Owls' },
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}gone@example.com`,
      username: `${PREFIX}gone`,
    })
    await prisma.user.update({ where: { id: suspended.id }, data: { deletedAt: new Date() } })
    const base = { place: 'Kuudes Linja', location: 'Helsinki' }
    await prisma.artistEvent.createMany({
      data: [
        {
          ...base,
          userId: artist.id,
          title: `${PREFIX}later`,
          startAt: new Date(Date.now() + 9 * DAY),
        },
        {
          ...base,
          userId: artist.id,
          title: `${PREFIX}sooner`,
          startAt: new Date(Date.now() + 2 * DAY),
        },
        { ...base, userId: artist.id, title: `${PREFIX}past`, startAt: new Date(Date.now() - DAY) },
        {
          ...base,
          userId: suspended.id,
          title: `${PREFIX}hidden`,
          startAt: new Date(Date.now() + DAY),
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const ours = (body: Array<{ title: string }>) =>
    body.filter((e) => e.title.startsWith(PREFIX)).map((e) => e.title)

  it('lists upcoming events of available artists, soonest first', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/events/upcoming?limit=50' })

    expect(res.statusCode).toBe(200)
    expect(ours(res.json())).toEqual([`${PREFIX}sooner`, `${PREFIX}later`])
    const first = res.json().find((e: { title: string }) => e.title === `${PREFIX}sooner`)
    expect(first).toMatchObject({
      artistDisplayName: 'Night Owls',
      artistUsername: `${PREFIX}artist`,
      channelSlug: expect.any(String),
      place: 'Kuudes Linja',
    })
    expect(first).not.toHaveProperty('userId')
  })

  it('rejects an out-of-range limit', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/events/upcoming?limit=500' })
    expect(res.statusCode).toBe(400)
  })
})
