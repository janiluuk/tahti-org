// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'track-love-once-'

describe('POST /api/reactions/track/:id LOVE announcements', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let fanCookie: string
  let otherFanCookie: string
  let soundId: string

  const love = (cookie: string, positionSec: number) =>
    app.inject({
      method: 'POST',
      url: `/api/reactions/track/${soundId}`,
      headers: { cookie },
      payload: { type: 'LOVE', positionSec },
    })
  const settle = () => new Promise((r) => setTimeout(r, 0))

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const otherFan = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    fanCookie = await sessionCookieFor(prisma, fan.id)
    otherFanCookie = await sessionCookieFor(prisma, otherFan.id)
    const item = await prisma.sound.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Loved Once Track',
        status: 'READY',
        isPublic: true,
        durationSec: 200,
      },
    })
    soundId = item.id
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('announces the first LOVE from each listener and stores every marker', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    expect((await love(fanCookie, 5)).statusCode).toBe(201)
    await settle()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect((await love(fanCookie, 40)).statusCode).toBe(201)
    expect((await love(fanCookie, 90)).statusCode).toBe(201)
    await settle()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect((await love(otherFanCookie, 12)).statusCode).toBe(201)
    await settle()
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    expect(await prisma.trackReaction.count({ where: { soundId, type: 'LOVE' } })).toBe(4)
  })
})
