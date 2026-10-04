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

const PREFIX = 'press-kit-'

describe('M12/M19 — press kit and privacy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'press-kit-artist',
      displayName: 'Press Kit Artist',
    })
    username = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)

    await prisma.user.update({
      where: { id: artist.id },
      data: { bio: 'Electronic producer from Helsinki.' },
    })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET public press kit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/press-kit.json`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { displayName: string; email?: string }
    expect(body.displayName).toBe('Press Kit Artist')
    expect(body.email).toBeUndefined()
  })

  it('GET /api/me/press-kit.json includes email', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/press-kit.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toContain('@example.com')
  })

  it('POST account deletion request creates support ticket', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/account/deletion-request',
      headers: { cookie },
      payload: { reason: 'Leaving the platform' },
    })
    expect(res.statusCode).toBe(200)
    const ticketId = (res.json() as { ticketId: string }).ticketId
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: BigInt(ticketId) },
    })
    expect(ticket?.subject).toBe('Account deletion request')
  })

  it('hides the public press kit, gallery and zip of a suspended or deleted artist', async () => {
    const gone = await createTestArtist(prisma, {
      email: `${PREFIX}gone@example.com`,
      username: 'press-kit-gone',
      displayName: 'Press Kit Gone',
    })
    await prisma.channel.update({
      where: { id: gone.channel!.id },
      data: { pressKitGalleryPublic: true },
    })
    await prisma.pressKitImage.create({
      data: {
        channelId: gone.channel!.id,
        imageKey: 'press/gone.jpg',
        title: 'Promo',
        position: 0,
      },
    })
    const statuses = async () => {
      const kit = await app.inject({
        method: 'GET',
        url: '/api/v1/u/press-kit-gone/press-kit.json',
      })
      const zip = await app.inject({ method: 'GET', url: '/api/v1/u/press-kit-gone/press-kit.zip' })
      const images = await app.inject({
        method: 'GET',
        url: '/api/v1/u/press-kit-gone/press-kit-images.json',
      })
      return [kit.statusCode, zip.statusCode, (images.json() as unknown[]).length]
    }
    const before = await statuses()
    expect(before[0]).toBe(200)
    expect(before[2]).toBe(1)

    await prisma.user.update({ where: { id: gone.id }, data: { suspendedAt: new Date() } })
    expect(await statuses()).toEqual([404, 404, 0])

    await prisma.user.update({
      where: { id: gone.id },
      data: { suspendedAt: null, deletedAt: new Date() },
    })
    expect(await statuses()).toEqual([404, 404, 0])
  })
})
