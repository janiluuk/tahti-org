// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'profile-test-'

describe('M12 — artist profile API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'profile-test-artist',
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('PATCH /api/me/profile updates fields and records @mentions in bio', async () => {
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}mentioned@example.com`,
      username: 'profile-mentioned',
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: { cookie },
      payload: {
        displayName: 'Profile Artist',
        bio: 'Thanks @profile-mentioned for the collab',
        tipJarUrl: 'https://ko-fi.com/test',
        publicAttribution: false,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().displayName).toBe('Profile Artist')
    expect(res.json().publicAttribution).toBe(false)

    await new Promise((r) => setTimeout(r, 50))
    const mention = await prisma.mention.findFirst({
      where: { mentionerUserId: userId, targetUserId: target.id },
    })
    expect(mention?.surface).toBe('BIO')

    const empty = await app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: { cookie },
      payload: {},
    })
    expect(empty.statusCode).toBe(400)

    void target
  })

  it('PATCH /api/me/channel/meta-stream toggles opt-out', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/meta-stream',
      headers: { cookie },
      payload: { optOut: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().metaStreamOptOut).toBe(true)

    const channel = await prisma.channel.findUnique({ where: { userId } })
    expect(channel?.metaStreamOptOut).toBe(true)

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/meta-stream',
      headers: { cookie },
      payload: { optOut: 'yes' },
    })
    expect(bad.statusCode).toBe(400)
  })
})
