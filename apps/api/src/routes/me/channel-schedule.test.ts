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

const PREFIX = 'schedule-test-'

describe('LISTENER-002 — channel next broadcast schedule', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'schedule-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('PATCH and GET schedule, exposed on public channel', async () => {
    const at = new Date(Date.now() + 86_400_000).toISOString()

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/schedule',
      headers: { cookie },
      payload: { nextBroadcastAt: at, nextBroadcastNote: 'Thursday 22:00 EET' },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().nextBroadcastNote).toBe('Thursday 22:00 EET')

    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/schedule',
      headers: { cookie },
    })
    expect(get.statusCode).toBe(200)
    expect(get.json().nextBroadcastAt).toBeTruthy()

    const pub = await app.inject({
      method: 'GET',
      url: '/api/channels/schedule-artist',
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().nextBroadcastNote).toBe('Thursday 22:00 EET')
  })
})
