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

const PREFIX = 'channel-get-autoplay-'

describe('the public channel says whether it may start playing on its own', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let cookie: string

  const channel = async () =>
    (await app.inject({ method: 'GET', url: `/api/channels/${slug}` })).json()

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'channel-get-autoplay',
    })
    slug = artist.channel!.slug
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is on for a channel that never touched the setting', async () => {
    expect((await channel()).autoplayEnabled).toBe(true)
  })

  it('follows the artist switching it off', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/autoplay',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { autoplayEnabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect((await channel()).autoplayEnabled).toBe(false)
  })
})
