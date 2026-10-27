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

const PREFIX = 'embed-import-ban-'

describe('An upload ban covers hearthis.at, Mixcloud and Spotify imports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let channelId: string
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    userId = artist.id
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.accountRestriction.create({
      data: { userId, type: 'UPLOAD', reason: 'Copyright strikes' },
    })
  })

  afterAll(async () => {
    await prisma.sound.deleteMany({ where: { channelId } })
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it.each([
    [
      '/api/v1/imports/hearthis/add',
      { collectionId: 'c1', trackUrl: 'https://hearthis.at/dj/set/' },
    ],
    [
      '/api/v1/imports/mixcloud/add',
      { collectionId: 'c1', cloudcastUrl: 'https://www.mixcloud.com/dj/set/' },
    ],
    ['/api/v1/imports/spotify/add', { collectionId: 'c1', spotifyUri: 'spotify:track:abc123' }],
  ])('refuses %s', async (url, payload) => {
    const res = await app.inject({ method: 'POST', url, headers: { cookie }, payload })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Uploads is blocked: Copyright strikes')
    expect(await prisma.sound.count({ where: { channelId } })).toBe(0)
  })
})
