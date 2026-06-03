// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-venues-'

describe('M17 — admin venue verification', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let venueSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-venues-board',
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const venue = await prisma.venue.create({
      data: {
        slug: `admin-venues-${Date.now()}`,
        name: 'Test Club',
        address: 'Testikatu 1',
        city: 'Helsinki',
        countryCode: 'FI',
        createdBy: board.id,
      },
    })
    venueSlug = venue.slug
  })

  afterAll(async () => {
    await prisma.venue.deleteMany({ where: { slug: venueSlug } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists venues for board and verifies', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/venues',
      headers: { cookie: boardCookie },
    })
    expect(list.statusCode).toBe(200)
    expect(Array.isArray(list.json())).toBe(true)

    const verify = await app.inject({
      method: 'POST',
      url: `/api/admin/venues/${venueSlug}/verify`,
      headers: { cookie: boardCookie },
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().verifiedAt).toBeTruthy()
  })
})
