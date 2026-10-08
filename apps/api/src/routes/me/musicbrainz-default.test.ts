// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'mb-default-'

describe('/api/me/musicbrainz/default', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'MB Artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('starts with no remembered answer, then saves and clears one', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ defaultRegisterToMusicbrainz: null })

    const saved = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
      payload: { defaultRegisterToMusicbrainz: true },
    })
    expect(saved.statusCode).toBe(200)
    expect(saved.json()).toEqual({ defaultRegisterToMusicbrainz: true })

    const cleared = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
      payload: { defaultRegisterToMusicbrainz: null },
    })
    expect(cleared.json()).toEqual({ defaultRegisterToMusicbrainz: null })
  })

  it('answers 400, not 500, when the body is missing or the wrong type', async () => {
    const noBody = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
    })
    expect(noBody.statusCode).toBe(400)

    const wrongType = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
      payload: { defaultRegisterToMusicbrainz: 'yes' },
    })
    expect(wrongType.statusCode).toBe(400)
  })
})
