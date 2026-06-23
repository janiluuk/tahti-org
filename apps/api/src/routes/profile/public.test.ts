// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'public-profile-'

describe('GET /api/v1/u/:username/profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'public-profile-artist',
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { countryCode: 'FI', pronouns: 'she/her' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns countryCode and pronouns on the public artist object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { artist: { countryCode?: string | null; pronouns?: string | null } }
    expect(body.artist.countryCode).toBe('FI')
    expect(body.artist.pronouns).toBe('she/her')
  })
})
