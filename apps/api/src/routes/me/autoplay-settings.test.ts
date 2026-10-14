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

const PREFIX = 'autoplay-settings-'

describe('GET/PATCH /api/me/channel/autoplay', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let listenerCookie: string
  let artistId: string

  const patch = (body: unknown, c = cookie) =>
    app.inject({
      method: 'PATCH',
      url: '/api/me/channel/autoplay',
      headers: { cookie: c, 'content-type': 'application/json' },
      payload: body as object,
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'autoplay-settings-artist',
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const listener = await prisma.user.create({
      data: {
        email: `${PREFIX}listener@example.com`,
        passwordHash: 'x',
        username: 'autoplay-settings-listener',
        displayName: 'Listener',
      },
    })
    listenerCookie = await sessionCookieFor(prisma, listener.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/autoplay' })
    expect(res.statusCode).toBe(401)
  })

  it('is on by default', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/autoplay',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ autoplayEnabled: true })
  })

  it('switches off and back on', async () => {
    const off = await patch({ autoplayEnabled: false })
    expect(off.statusCode).toBe(200)
    expect(off.json()).toEqual({ autoplayEnabled: false })
    const stored = await prisma.channel.findUniqueOrThrow({ where: { userId: artistId } })
    expect(stored.autoplayEnabled).toBe(false)

    expect((await patch({ autoplayEnabled: true })).json()).toEqual({ autoplayEnabled: true })
  })

  it('rejects a body without the flag, and an account without a channel', async () => {
    expect((await patch({})).statusCode).toBe(400)
    expect((await patch({ autoplayEnabled: 'yes' })).statusCode).toBe(400)
    expect((await patch({ autoplayEnabled: false }, listenerCookie)).statusCode).toBe(404)
  })
})
