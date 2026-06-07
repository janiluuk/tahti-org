// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-message-'

describe('POST /api/chat/message — Centrifugo proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    slug = 'chat-message-artist'
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98395,
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('accepts publish proxy without fingerprint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: `channel:${slug}`, data: { text: 'hello chat' } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ result: {} })
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: 'channel:missing-slug', data: { text: 'hello' } },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects messages over 500 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: `channel:${slug}`, data: { text: 'x'.repeat(501) } },
    })
    expect(res.statusCode).toBe(400)
  })
})
