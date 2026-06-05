// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'

const PREFIX = 'item-ready-'

describe('POST /internal/webhooks/item-ready', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let itemId: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash: 'hash',
        username: `${PREFIX}artist`,
        displayName: 'Item Ready Artist',
        tier: 'ARTIST',
        channel: {
          create: {
            slug: `${PREFIX}slug`,
            liveSourceMount: '/live/x',
            liveSourcePass: 'pass',
            liveSourcePassHash: 'hash',
            rtmpStreamKey: 'key',
            rtmpStreamKeyHash: 'hash',
          },
        },
      },
      include: { channel: true },
    })
    channelId = user.channel!.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Test mix',
        rawKey: `raw/${channelId}.wav`,
        status: 'PROCESSING',
        fileSizeBytes: 1024,
      },
    })
    itemId = item.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('rejects missing auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/webhooks/item-ready',
      payload: { itemId },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/webhooks/item-ready',
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for unknown item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/webhooks/item-ready',
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { itemId: 'missing-item' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('acknowledges a known archive item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/webhooks/item-ready',
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { itemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
