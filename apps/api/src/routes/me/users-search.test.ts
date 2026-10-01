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

const PREFIX = 'users-search-avatar-'

describe('GET /api/me/users/search', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const me = await createTestArtist(prisma, {
      email: `${PREFIX}me@example.com`,
      username: 'usav-me',
    })
    cookie = await sessionCookieFor(prisma, me.id)
    const tagged = await createTestArtist(prisma, {
      email: `${PREFIX}tagged@example.com`,
      username: 'usav-tagged',
      displayName: 'Tagged Artist',
    })
    await prisma.user.update({
      where: { id: tagged.id },
      data: { avatarUrl: 'https://cdn.example.com/tagged.png' },
    })
    const legacy = await createTestArtist(prisma, {
      email: `${PREFIX}legacy@example.com`,
      username: 'usav-legacy',
    })
    await prisma.user.update({
      where: { id: legacy.id },
      data: { displayName: 'legacy@example.com' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns each match with its avatar and never an email as the name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/users/search?q=usav-',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const byName = Object.fromEntries(
      (res.json() as Array<{ username: string }>).map((u) => [u.username, u]),
    )
    expect(byName['usav-tagged']).toEqual({
      username: 'usav-tagged',
      displayName: 'Tagged Artist',
      avatarUrl: 'https://cdn.example.com/tagged.png',
    })
    expect(byName['usav-legacy']).toEqual({
      username: 'usav-legacy',
      displayName: 'usav-legacy',
      avatarUrl: null,
    })
  })
})
