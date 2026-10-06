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

const PREFIX = 'jam-host-leave-'

describe('the host leaving a Tahti Jam', () => {
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

  it('ends the jam for everyone', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug: `${PREFIX}playlist` },
    })
    const jam = created.json() as { id: string; code: string }
    await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${jam.code}/join`,
      headers: { cookie: guestCookie },
    })

    const left = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${jam.id}/leave`,
      headers: { cookie: hostCookie },
    })
    expect(left.statusCode).toBe(204)

    const row = await prisma.jamSession.findUniqueOrThrow({ where: { id: jam.id } })
    expect(row.endedAt).not.toBeNull()
    expect(row.isPlaying).toBe(false)

    const state = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${jam.id}`,
      headers: { cookie: guestCookie },
    })
    expect(state.statusCode).toBe(404)
    const rejoin = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${jam.code}/join`,
      headers: { cookie: guestCookie },
    })
    expect(rejoin.statusCode).toBe(404)
  })
})
