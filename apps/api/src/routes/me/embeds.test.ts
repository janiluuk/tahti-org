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

const PREFIX = 'embed-thumb-'
const THUMB = 'https://i1.sndcdn.com/artworks-embed-thumb.jpg'

describe('PATCH /api/me/embeds/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let embedId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
    const embed = await prisma.artistEmbed.create({
      data: {
        userId: owner.id,
        provider: 'soundcloud',
        url: 'https://soundcloud.com/tahti/night-drive',
        title: 'Night Drive',
        thumbnailUrl: null,
      },
    })
    embedId = embed.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('stores an https thumbnail on the owner embed', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/embeds/${embedId}`,
      headers: { cookie: ownerCookie },
      payload: { thumbnailUrl: THUMB },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: embedId, thumbnailUrl: THUMB })
    const stored = await prisma.artistEmbed.findUnique({ where: { id: embedId } })
    expect(stored?.thumbnailUrl).toBe(THUMB)
  })

  it('rejects a non-https thumbnail', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/embeds/${embedId}`,
      headers: { cookie: ownerCookie },
      payload: { thumbnailUrl: 'http://example.com/cover.jpg' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('hides another account’s embed', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/embeds/${embedId}`,
      headers: { cookie: otherCookie },
      payload: { thumbnailUrl: THUMB },
    })
    expect(res.statusCode).toBe(404)
  })

  it('requires a session', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/embeds/${embedId}`,
      payload: { thumbnailUrl: THUMB },
    })
    expect(res.statusCode).toBe(401)
  })
})
