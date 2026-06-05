// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'radio-api-'

describe('M16 — internal radio API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const user = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'radio-api-artist',
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { isMember: true },
    })
    const channel = await prisma.channel.update({
      where: { userId: user.id },
      data: { state: 'LIVE', metaStreamOptOut: false },
    })
    channelId = channel.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/v1/internal/radio/current-live requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/internal/radio/current-live' })
    expect(res.statusCode).toBe(401)
  })

  it('lists eligible live channels', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/radio/current-live',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ channelId: string; slug: string }>
    expect(body.some((c) => c.channelId === channelId)).toBe(true)
  })

  it('PATCH featured updates rotation', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/internal/radio/featured',
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { channelId },
    })
    expect(patch.statusCode).toBe(200)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    expect(channel?.lastFeaturedAt).not.toBeNull()

    const history = await app.inject({ method: 'GET', url: '/api/v1/radio/history' })
    expect(history.statusCode).toBe(200)
    const rows = history.json() as Array<{ channelId: string }>
    expect(rows.some((r) => r.channelId === channelId)).toBe(true)
  })
})
