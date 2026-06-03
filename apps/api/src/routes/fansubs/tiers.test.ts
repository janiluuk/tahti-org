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

const PREFIX = 'tiers-test-'

describe('Fan tier API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    username = 'tiers-test-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates, lists, disables, and hides inactive tiers from public API', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie },
      payload: { name: 'Gold', amountCents: 1000, description: 'All access' },
    })
    expect(create.statusCode).toBe(201)
    const tierId = create.json().id

    const mine = await app.inject({
      method: 'GET',
      url: '/api/me/fan-tiers',
      headers: { cookie },
    })
    expect(mine.json().some((t: { id: string }) => t.id === tierId)).toBe(true)

    const pub1 = await app.inject({ method: 'GET', url: `/api/v1/u/${username}/tiers` })
    expect(pub1.json().tiers).toHaveLength(1)

    await app.inject({
      method: 'PATCH',
      url: `/api/me/fan-tiers/${tierId}`,
      headers: { cookie },
      payload: { active: false },
    })

    const pub2 = await app.inject({ method: 'GET', url: `/api/v1/u/${username}/tiers` })
    expect(pub2.json().tiers).toHaveLength(0)
  })

  it('rejects tier price below minimum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie },
      payload: { name: 'Cheap', amountCents: 50 },
    })
    expect(res.statusCode).toBe(400)
  })
})
