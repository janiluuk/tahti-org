// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/stream-key-enc.js', () => ({
  encryptStreamKey: (plain: string) => Buffer.from(`enc:${plain}`).toString('base64'),
  decryptStreamKey: (enc: string) =>
    Buffer.from(enc, 'base64').toString('utf8').replace(/^enc:/, ''),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'rtmp-test-'

describe('M6 — RTMP multistream targets', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'rtmp-test-artist',
      tier: 'STUDIO',
      isMember: true,
      memberNumber: 98390,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = artist.channel!.id
  })

  afterAll(async () => {
    await prisma.rtmpTarget.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates, lists, and reveals stream keys for RTMP targets', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/rtmp-targets',
      headers: { cookie },
      payload: {
        provider: 'YOUTUBE',
        label: 'My YouTube',
        streamKey: 'yt-secret-key-123',
      },
    })
    expect(create.statusCode).toBe(201)
    const targetId = create.json().id
    expect(create.json().rtmpUrl).toContain('youtube')

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/rtmp-targets',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toHaveLength(1)

    const reveal = await app.inject({
      method: 'GET',
      url: `/api/me/rtmp-targets/${targetId}/stream-key`,
      headers: { cookie },
    })
    expect(reveal.statusCode).toBe(200)
    expect(reveal.json().streamKey).toBe('yt-secret-key-123')
  })

  it('rejects invalid provider and missing label', async () => {
    const badProvider = await app.inject({
      method: 'POST',
      url: '/api/me/rtmp-targets',
      headers: { cookie },
      payload: { provider: 'NOT_A_PLATFORM', label: 'X', streamKey: 'k' },
    })
    expect(badProvider.statusCode).toBe(400)

    const noLabel = await app.inject({
      method: 'POST',
      url: '/api/me/rtmp-targets',
      headers: { cookie },
      payload: { provider: 'TWITCH', streamKey: 'k' },
    })
    expect(noLabel.statusCode).toBe(400)
  })

  it('STUDIO tier can disable a target via PATCH', async () => {
    const target = await prisma.rtmpTarget.findFirst({ where: { channelId } })
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/rtmp-targets/${target!.id}`,
      headers: { cookie },
      payload: { enabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().ok).toBe(true)

    const updated = await prisma.rtmpTarget.findUnique({ where: { id: target!.id } })
    expect(updated?.enabled).toBe(false)
  })
})
