// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'radio-rotation-test-'

describe('M16 — Tahti Radio proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  it('proxies now-playing from the radio service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            live: true,
            channel: { slug: 'radio-artist', displayName: 'On Air' },
          }),
          { status: 200 },
        ),
      ),
    )

    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json().live).toBe(true)
    expect(res.json().channel.slug).toBe('radio-artist')
  })

  it('returns offline state when radio service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ live: false, channel: null })
  })

  it('returns an empty rotation when Tahti Selects has no channel yet', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/rotation' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('STREAM-011 — Tahti Selects rotation preview', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let selectsChannelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const selectsArtist = await createTestArtist(prisma, {
      email: `${PREFIX}selects@example.com`,
      username: TAHTI_SELECTS_SLUG,
      displayName: 'Tahti Selects',
    })
    selectsChannelId = selectsArtist.channel!.id

    const trackArtist = await createTestArtist(prisma, {
      email: `${PREFIX}track-artist@example.com`,
      username: `${PREFIX}track-artist`,
      displayName: 'Rotation Test Artist',
    })

    const first = await prisma.archiveItem.create({
      data: {
        channelId: trackArtist.channel!.id,
        title: 'Rotation Track One',
        status: 'READY',
        isPublic: true,
      },
    })
    const second = await prisma.archiveItem.create({
      data: {
        channelId: trackArtist.channel!.id,
        title: 'Rotation Track Two',
        status: 'READY',
        isPublic: true,
      },
    })

    await prisma.curatedRotationItem.create({
      data: {
        channelId: selectsChannelId,
        archiveItemId: second.id,
        position: 1,
        addedById: selectsArtist.id,
      },
    })
    await prisma.curatedRotationItem.create({
      data: {
        channelId: selectsChannelId,
        archiveItemId: first.id,
        position: 0,
        addedById: selectsArtist.id,
      },
    })
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('returns the curated rotation in admin-set position order', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/rotation' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ title: string; artistName: string }>
    expect(body.map((b) => b.title)).toEqual(['Rotation Track One', 'Rotation Track Two'])
    expect(body.every((b) => b.artistName === 'Rotation Test Artist')).toBe(true)
  })
})
