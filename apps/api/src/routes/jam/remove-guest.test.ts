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

const PREFIX = 'jam-remove-guest-'

describe('removing a guest from a Tahti Jam', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostId: string
  let hostCookie: string
  let guestCookie: string
  let guestId: string

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
    guestId = guest.id
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

  const call = (method: 'POST' | 'DELETE' | 'GET', url: string, cookie: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  it('takes the guest out, ends their control, and keeps them out of the same link', async () => {
    const jam = (
      await call('POST', '/api/v1/jam', hostCookie, { collectionSlug: `${PREFIX}playlist` })
    ).json() as { id: string; code: string }
    expect((await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)).statusCode).toBe(200)
    await prisma.jamParticipant.updateMany({
      where: { sessionId: jam.id, userId: guestId },
      data: { canControl: true },
    })

    const self = await call('DELETE', `/api/v1/jam/${jam.id}/participants/${hostId}`, hostCookie)
    expect(self.statusCode).toBe(400)
    const byGuest = await call(
      'DELETE',
      `/api/v1/jam/${jam.id}/participants/${hostId}`,
      guestCookie,
    )
    expect(byGuest.statusCode).toBe(403)

    const removed = await call(
      'DELETE',
      `/api/v1/jam/${jam.id}/participants/${guestId}`,
      hostCookie,
    )
    expect(removed.statusCode).toBe(200)
    expect((removed.json().participants as Array<{ userId: string }>).map((p) => p.userId)).toEqual(
      [hostId],
    )

    expect((await call('GET', `/api/v1/jam/${jam.id}`, guestCookie)).statusCode).toBe(404)
    const push = await call('POST', `/api/v1/jam/${jam.id}/state`, guestCookie, {
      isPlaying: true,
      currentTrack: null,
      positionSec: 0,
    })
    expect(push.statusCode).toBe(403)
    expect((await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)).statusCode).toBe(404)

    const again = await call('DELETE', `/api/v1/jam/${jam.id}/participants/${guestId}`, hostCookie)
    expect(again.statusCode).toBe(404)
  })

  it('still lets a guest who left on their own come back', async () => {
    const jam = (
      await call('POST', '/api/v1/jam', hostCookie, { collectionSlug: `${PREFIX}playlist` })
    ).json() as { id: string; code: string }
    await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)
    expect((await call('POST', `/api/v1/jam/${jam.id}/leave`, guestCookie)).statusCode).toBe(204)
    expect((await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)).statusCode).toBe(200)
  })
})
