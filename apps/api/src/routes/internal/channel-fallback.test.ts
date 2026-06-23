// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { createReadyArchiveItem, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channel-fallback-'

describe('GET /internal/channels/:channelId/fallback.m3u', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98392,
    })
    channelId = artist.channel!.id
    await createReadyArchiveItem(prisma, channelId, 'Fallback track')
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('requires internal auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
    })
    expect(res.statusCode).toBe(401)
    expect(res.body).toBe('unauthorized')
  })

  it('returns extended M3U for ready archive items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('audio/x-mpegurl')
    expect(res.body).toContain('#EXTM3U')
    expect(res.body).toContain('Fallback track')
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/channels/missing-channel/fallback.m3u',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('M33: returns an empty playlist when fallbackEnabled is false', async () => {
    await prisma.channel.update({ where: { id: channelId }, data: { fallbackEnabled: false } })

    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('Fallback track')
    expect(res.body).toContain('no items yet')

    await prisma.channel.update({ where: { id: channelId }, data: { fallbackEnabled: true } })
  })
})
