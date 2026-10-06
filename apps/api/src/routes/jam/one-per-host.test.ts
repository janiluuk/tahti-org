// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'jam-one-per-host-'

describe('starting a second Tahti Jam', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostId: string
  let hostCookie: string
  let guestCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: `${PREFIX}host`,
    })
    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: `${PREFIX}guest`,
    })
    hostId = host.id
    hostCookie = await sessionCookieFor(prisma, host.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)
    await prisma.collection.create({
      data: { userId: hostId, slug: `${PREFIX}playlist`, name: 'Jam', isPublic: true },
    })
  })

  afterAll(async () => {
    await prisma.jamSession.deleteMany({ where: { hostUserId: hostId } })
    await prisma.collection.deleteMany({ where: { userId: hostId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const start = async (cookie: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie },
      payload: { collectionSlug: `${PREFIX}playlist` },
    })
    expect(res.statusCode).toBe(201)
    return res.json() as { id: string; code: string }
  }

  it("ends the host's earlier jam and leaves other hosts' jams alone", async () => {
    const first = await start(hostCookie)
    const guestsOwn = await start(guestCookie)
    const second = await start(hostCookie)

    const rows = await prisma.jamSession.findMany({
      where: { id: { in: [first.id, guestsOwn.id, second.id] } },
      select: { id: true, endedAt: true },
    })
    const ended = (id: string) => rows.find((r) => r.id === id)?.endedAt !== null
    expect(ended(first.id)).toBe(true)
    expect(ended(guestsOwn.id)).toBe(false)
    expect(ended(second.id)).toBe(false)

    const oldLink = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${first.code}/join`,
      headers: { cookie: guestCookie },
    })
    expect(oldLink.statusCode).toBe(404)
    await prisma.jamSession.deleteMany({ where: { id: guestsOwn.id } })
  })
})
