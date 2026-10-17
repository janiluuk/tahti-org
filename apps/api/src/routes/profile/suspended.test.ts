// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'profile-susp-'

describe("a suspended artist's public profile", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const username = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is served while the account is in good standing', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${username}/profile` })
    expect(res.statusCode).toBe(200)
  })

  it('is not found once the account is suspended', async () => {
    await prisma.user.update({
      where: { username },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${username}/profile` })
    expect(res.statusCode).toBe(404)
  })

  it("does not read a suspended artist's news feed", async () => {
    await prisma.user.update({
      where: { username },
      data: { newsFeedUrl: 'https://feeds.example.com/news.xml' },
    })
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${username}/news` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })
})
