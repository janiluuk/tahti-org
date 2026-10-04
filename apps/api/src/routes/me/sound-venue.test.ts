// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-venue-test-'

describe('recorded-at venue on a sound', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let boardCookie: string
  let channelSlug: string
  let soundId: string
  let verifiedId: string
  let ownUnverifiedId: string
  let otherUnverifiedId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    boardCookie = await sessionCookieFor(prisma, board.id)
    channelSlug = artist.channel!.slug

    const venue = (slug: string, createdBy: string, verified: boolean) =>
      prisma.venue.create({
        data: {
          slug: `${PREFIX}${slug}`,
          name: slug,
          address: 'Street 1',
          city: 'Helsinki',
          createdBy,
          verifiedAt: verified ? new Date() : null,
        },
      })
    verifiedId = (await venue('verified', other.id, true)).id
    ownUnverifiedId = (await venue('own', artist.id, false)).id
    otherUnverifiedId = (await venue('others', other.id, false)).id

    soundId = (
      await prisma.sound.create({
        data: { channelId: artist.channel!.id, title: 'Live set', status: 'READY' },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.sound.deleteMany({ where: { id: soundId } })
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const patch = (venueId: string | null, cookie = artistCookie) =>
    app.inject({
      method: 'PATCH',
      url: `/api/me/sound/${soundId}`,
      headers: { cookie },
      payload: { venueId },
    })

  it('rejects a venue that does not exist with unknown_venue', async () => {
    const res = await patch('no-such-venue')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'unknown_venue' })
  })

  it("rejects another artist's unverified venue", async () => {
    const res = await patch(otherUnverifiedId)
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'unknown_venue' })
  })

  it('accepts a verified venue and the artist’s own unverified one, and clears with null', async () => {
    expect((await patch(verifiedId)).json().venueId).toBe(verifiedId)
    expect((await patch(ownUnverifiedId)).json().venueId).toBe(ownUnverifiedId)
    expect((await patch(null)).json().venueId).toBeNull()
  })

  it('keeps accepting the track’s current venue after it stops being pickable', async () => {
    await prisma.sound.update({ where: { id: soundId }, data: { venueId: otherUnverifiedId } })
    const res = await patch(otherUnverifiedId)
    expect(res.statusCode).toBe(200)
    expect(res.json().venueId).toBe(otherUnverifiedId)
  })

  it('lets the board pick any existing venue but not an unknown one', async () => {
    const url = `/api/admin/channels/${channelSlug}/sound/${soundId}`
    const ok = await app.inject({
      method: 'PATCH',
      url,
      headers: { cookie: boardCookie },
      payload: { venueId: ownUnverifiedId },
    })
    expect(ok.statusCode).toBe(200)
    const bad = await app.inject({
      method: 'PATCH',
      url,
      headers: { cookie: boardCookie },
      payload: { venueId: 'no-such-venue' },
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toMatchObject({ code: 'unknown_venue' })
  })

  it('rejects an unknown venue when completing an upload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      headers: { cookie: artistCookie },
      payload: {
        uploadId: `raw/${channelSlug}/set.wav`,
        etag: 'etag',
        title: 'New set',
        metadata: { venueId: 'no-such-venue' },
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'unknown_venue' })
  })
})
