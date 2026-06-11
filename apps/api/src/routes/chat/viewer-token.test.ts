// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-viewer-'

describe('POST /api/chat/:slug/viewer-token', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    slug = `${PREFIX}artist`
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98451,
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('issues a read-only Centrifugo token for anonymous visitors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/viewer-token`,
      headers: { 'user-agent': 'vitest-viewer/1.0' },
    })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().token).toBe('string')
    expect(res.json().token.split('.').length).toBe(3)
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/missing-channel-slug/viewer-token',
    })
    expect(res.statusCode).toBe(404)
  })
})
