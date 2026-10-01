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

const PREFIX = 'collection-create-details-'

describe('POST /api/me/collections — details set at creation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'collection-create-details',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const create = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/me/collections', headers: { cookie }, payload })

  it('keeps visibility, release date, genres and the collaborative flag', async () => {
    const res = await create({
      name: 'Late night picks',
      style: 'PLAYLIST',
      visibility: 'UNLISTED',
      releaseDate: '2026-11-20',
      genres: ['house', 'ambient'],
      collaborative: true,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      visibility: 'UNLISTED',
      isPublic: false,
      releaseDate: '2026-11-20',
      genres: ['house', 'ambient'],
      collaborative: true,
    })
  })

  it('makes a draft private', async () => {
    const res = await create({ name: 'Work in progress', visibility: 'DRAFT' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ visibility: 'DRAFT', isPublic: false })
  })

  it('still defaults to public with no details', async () => {
    const res = await create({ name: 'Plain mix' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      visibility: 'PUBLIC',
      isPublic: true,
      releaseDate: null,
      genres: [],
      collaborative: false,
    })
  })

  it('refuses a release date that is not YYYY-MM-DD', async () => {
    const res = await create({ name: 'Bad date', releaseDate: '20/11/2026' })
    expect(res.statusCode).toBe(400)
  })
})
