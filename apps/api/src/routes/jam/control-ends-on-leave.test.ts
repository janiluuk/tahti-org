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

const PREFIX = 'jam-control-leave-'

describe('a guest with control leaving a Tahti Jam', () => {
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

  const call = (method: 'POST' | 'PATCH', url: string, cookie: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

  it('comes back as a plain guest', async () => {
    const jam = (
      await call('POST', '/api/v1/jam', hostCookie, { collectionSlug: `${PREFIX}playlist` })
    ).json() as { id: string; code: string }
    await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)
    const granted = await call(
      'PATCH',
      `/api/v1/jam/${jam.id}/participants/${guestId}`,
      hostCookie,
      { canControl: true },
    )
    expect(granted.statusCode).toBe(200)

    expect((await call('POST', `/api/v1/jam/${jam.id}/leave`, guestCookie)).statusCode).toBe(204)
    const back = await call('POST', `/api/v1/jam/${jam.code}/join`, guestCookie)
    expect(back.statusCode).toBe(200)
    const me = (back.json().participants as Array<{ userId: string; canControl: boolean }>).find(
      (p) => p.userId === guestId,
    )
    expect(me?.canControl).toBe(false)

    const push = await call('POST', `/api/v1/jam/${jam.id}/state`, guestCookie, {
      isPlaying: false,
      currentTrack: null,
      positionSec: 0,
    })
    expect(push.statusCode).toBe(403)
  })
})
