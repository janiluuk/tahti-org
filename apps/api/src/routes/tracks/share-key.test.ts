// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-share-key-test-'
const OPEN_KEY = 'share-key-test-open-aaaaaaaaaaaaaa'
const GRANTEE_KEY = 'share-key-test-grantee-bbbbbbbbbbb'
const EXPIRED_KEY = 'share-key-test-expired-cccccccccccc'

describe('share-link keys on private tracks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let granteeCookie: string
  let strangerCookie: string
  let soundId: string
  let otherSoundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'share-key-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    const grantee = await createTestArtist(prisma, {
      email: `${PREFIX}grantee@example.com`,
      username: 'share-key-grantee',
      memberNumber: await allocateMemberNumber(prisma),
    })
    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: 'share-key-stranger',
      memberNumber: await allocateMemberNumber(prisma),
    })
    granteeCookie = await sessionCookieFor(prisma, grantee.id)
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
    const sound = await createReadySound(prisma, artist.channel!.id, 'Private demo')
    const other = await createReadySound(prisma, artist.channel!.id, 'Other private demo')
    await prisma.sound.updateMany({
      where: { id: { in: [sound.id, other.id] } },
      data: { isPublic: false },
    })
    soundId = sound.id
    otherSoundId = other.id
    await prisma.soundShare.createMany({
      data: [
        { soundId, token: OPEN_KEY },
        { soundId, token: GRANTEE_KEY, granteeUsername: 'share-key-grantee' },
        { soundId, token: EXPIRED_KEY, expiresAt: new Date(Date.now() - 1000) },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  function getTrack(id: string, key?: string, cookie?: string) {
    return app.inject({
      method: 'GET',
      url: `/api/tracks/${id}${key ? `?key=${key}` : ''}`,
      headers: cookie ? { cookie } : {},
    })
  }

  it('hides a private track without a key', async () => {
    expect((await getTrack(soundId)).statusCode).toBe(404)
  })

  it('opens it with an open link', async () => {
    const res = await getTrack(soundId, OPEN_KEY)
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Private demo')
  })

  it('does not open a different sound with that key', async () => {
    expect((await getTrack(otherSoundId, OPEN_KEY)).statusCode).toBe(404)
  })

  it('refuses an expired link', async () => {
    expect((await getTrack(soundId, EXPIRED_KEY)).statusCode).toBe(404)
  })

  it('limits a grantee link to that member', async () => {
    expect((await getTrack(soundId, GRANTEE_KEY)).statusCode).toBe(404)
    expect((await getTrack(soundId, GRANTEE_KEY, strangerCookie)).statusCode).toBe(404)
    expect((await getTrack(soundId, GRANTEE_KEY, granteeCookie)).statusCode).toBe(200)
  })

  it('lets key holders read and post comments', async () => {
    const noKey = await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })
    expect(noKey.statusCode).toBe(404)

    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}?key=${OPEN_KEY}`,
      headers: { cookie: strangerCookie },
      payload: { body: 'Sounds great' },
    })
    expect(post.statusCode).toBeLessThan(300)

    const list = await app.inject({
      method: 'GET',
      url: `/api/comments/track/${soundId}?key=${OPEN_KEY}`,
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().comments.map((c: { body: string }) => c.body)).toEqual(['Sounds great'])
  })
})
