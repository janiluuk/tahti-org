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

const PREFIX = 'jam-blocks-'

describe('Tahti Jam and account blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostId: string
  let hostCookie: string
  let guestId: string
  let guestCookie: string
  let otherCookie: string

  const startJam = async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug: `${PREFIX}playlist` },
    })
    expect(res.statusCode).toBe(201)
    return res.json() as { id: string; code: string }
  }

  const join = (code: string, cookie: string) =>
    app.inject({ method: 'POST', url: `/api/v1/jam/${code}/join`, headers: { cookie } })

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
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    hostId = host.id
    guestId = guest.id
    hostCookie = await sessionCookieFor(prisma, host.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
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

  it('answers "not found" to an account the host blocked, and to one that blocked the host', async () => {
    const jam = await startJam()

    await prisma.userBlock.create({ data: { blockerUserId: hostId, blockedUserId: guestId } })
    expect((await join(jam.code, guestCookie)).statusCode).toBe(404)
    await prisma.userBlock.deleteMany({ where: { blockerUserId: hostId } })

    await prisma.userBlock.create({ data: { blockerUserId: guestId, blockedUserId: hostId } })
    expect((await join(jam.code, guestCookie)).statusCode).toBe(404)
    await prisma.userBlock.deleteMany({ where: { blockerUserId: guestId } })

    const joined = await join(jam.code, guestCookie)
    expect(joined.statusCode).toBe(200)
    expect(joined.json().participants).toHaveLength(2)
  })

  it('still lets everyone else in, and the host back into their own jam', async () => {
    const jam = await startJam()
    await prisma.userBlock.create({ data: { blockerUserId: hostId, blockedUserId: guestId } })
    try {
      expect((await join(jam.code, otherCookie)).statusCode).toBe(200)
      expect((await join(jam.code, hostCookie)).statusCode).toBe(200)
    } finally {
      await prisma.userBlock.deleteMany({ where: { blockerUserId: hostId } })
    }
  })
})
