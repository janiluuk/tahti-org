// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'jam-test-'

describe('Tahti Jam', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostId: string
  let hostCookie: string
  let guestId: string
  let guestCookie: string
  let collectionSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: `${PREFIX}host`,
      tier: 'ARTIST',
    })
    hostId = host.id
    hostCookie = await sessionCookieFor(prisma, host.id)

    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: `${PREFIX}guest`,
      tier: 'FREE',
    })
    guestId = guest.id
    guestCookie = await sessionCookieFor(prisma, guest.id)

    const collection = await prisma.collection.create({
      data: { userId: hostId, slug: `${PREFIX}playlist`, name: 'Jam Test Playlist', isPublic: true },
    })
    collectionSlug = collection.slug
  })

  afterAll(async () => {
    await prisma.jamParticipant.deleteMany({ where: { session: { hostUserId: hostId } } })
    await prisma.jamSession.deleteMany({ where: { hostUserId: hostId } })
    await prisma.collection.deleteMany({ where: { userId: hostId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects starting a jam from a private playlist you do not own', async () => {
    const privateCollection = await prisma.collection.create({
      data: { userId: hostId, slug: `${PREFIX}private`, name: 'Private', isPublic: false },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: guestCookie },
      payload: { collectionSlug: privateCollection.slug },
    })
    expect(res.statusCode).toBe(404)
    await prisma.collection.delete({ where: { id: privateCollection.id } })
  })

  it('starts a jam, and the host is its first HOST participant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
    expect(body.hostUserId).toBe(hostId)
    expect(body.participants).toHaveLength(1)
    expect(body.participants[0]).toMatchObject({ userId: hostId, role: 'HOST', canControl: true })
  })

  it('lets a guest join by code, and reports state to both participants', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    const { id: sessionId, code } = create.json()

    const join = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${code}/join`,
      headers: { cookie: guestCookie },
    })
    expect(join.statusCode).toBe(200)
    const joined = join.json()
    expect(joined.participants).toHaveLength(2)
    const guestRow = joined.participants.find((p: { userId: string }) => p.userId === guestId)
    expect(guestRow).toMatchObject({ role: 'GUEST', canControl: false })

    // Idempotent: joining again doesn't duplicate the participant.
    const rejoin = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${code}/join`,
      headers: { cookie: guestCookie },
    })
    expect(rejoin.json().participants).toHaveLength(2)

    const view = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: guestCookie },
    })
    expect(view.statusCode).toBe(200)
  })

  it('rejects a non-participant reading session state', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    const { id: sessionId } = create.json()

    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: `${PREFIX}outsider`,
    })
    const outsiderCookie = await sessionCookieFor(prisma, outsider.id)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: outsiderCookie },
    })
    expect(res.statusCode).toBe(404)
    await prisma.user.delete({ where: { id: outsider.id } })
  })

  it('only the host can push playback state; a guest is rejected', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    const { id: sessionId, code } = create.json()
    await app.inject({ method: 'POST', url: `/api/v1/jam/${code}/join`, headers: { cookie: guestCookie } })

    const guestPush = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${sessionId}/state`,
      headers: { cookie: guestCookie },
      payload: { isPlaying: true, currentTrack: null, positionSec: 0 },
    })
    expect(guestPush.statusCode).toBe(403)

    const track = { id: 'track-1', title: 'Test Track', artistName: 'Test Artist', coverUrl: null }
    const hostPush = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${sessionId}/state`,
      headers: { cookie: hostCookie },
      payload: { isPlaying: true, currentTrack: track, positionSec: 12.5 },
    })
    expect(hostPush.statusCode).toBe(200)
    expect(hostPush.json()).toMatchObject({ isPlaying: true, positionSec: 12.5, currentTrack: track })
  })

  it('only the host can end the jam', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    const { id: sessionId, code } = create.json()
    await app.inject({ method: 'POST', url: `/api/v1/jam/${code}/join`, headers: { cookie: guestCookie } })

    const guestEnd = await app.inject({
      method: 'DELETE',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: guestCookie },
    })
    expect(guestEnd.statusCode).toBe(403)

    const hostEnd = await app.inject({
      method: 'DELETE',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: hostCookie },
    })
    expect(hostEnd.statusCode).toBe(204)

    const afterEnd = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: hostCookie },
    })
    expect(afterEnd.statusCode).toBe(404)
  })

  it('lets a participant leave without ending the jam for others', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/jam',
      headers: { cookie: hostCookie },
      payload: { collectionSlug },
    })
    const { id: sessionId, code } = create.json()
    await app.inject({ method: 'POST', url: `/api/v1/jam/${code}/join`, headers: { cookie: guestCookie } })

    const leave = await app.inject({
      method: 'POST',
      url: `/api/v1/jam/${sessionId}/leave`,
      headers: { cookie: guestCookie },
    })
    expect(leave.statusCode).toBe(204)

    const guestView = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: guestCookie },
    })
    expect(guestView.statusCode).toBe(404)

    const hostView = await app.inject({
      method: 'GET',
      url: `/api/v1/jam/${sessionId}`,
      headers: { cookie: hostCookie },
    })
    expect(hostView.statusCode).toBe(200)
    expect(hostView.json().participants).toHaveLength(1)
  })
})
