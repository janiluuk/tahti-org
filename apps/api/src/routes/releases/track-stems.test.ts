// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'release-track-stems-'

describe('release track stems', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let boardCookie: string
  let otherCookie: string
  let artistId: string
  let releaseId: string
  let trackId: string
  let smartLinkSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-track-stems-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'release-track-stems-board',
      tier: 'ARTIST',
      isMember: true,
      isBoard: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'release-track-stems-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  beforeEach(async () => {
    await prisma.release.deleteMany({ where: { userId: artistId } })
    const release = await prisma.release.create({
      data: {
        userId: artistId,
        title: 'Stems EP',
        type: 'EP',
        state: 'PUBLISHED',
        releaseDate: new Date('2026-06-01'),
        smartLinkSlug: `stems-ep-${Date.now()}`,
        tracks: {
          create: [
            {
              position: 1,
              title: 'Main',
              status: 'READY',
              sourceKey: 'releases/mock/main.wav',
              streamKey: 'releases/mock/main.opus',
            },
          ],
        },
      },
      include: { tracks: true },
    })
    releaseId = release.id
    trackId = release.tracks[0]!.id
    smartLinkSlug = release.smartLinkSlug
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets the owner prepare, complete, list, replace and delete a stem', async () => {
    const prepare = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/prepare`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        role: 'vocals',
        filename: 'vocals.wav',
        contentType: 'audio/wav',
      },
    })
    expect(prepare.statusCode).toBe(200)
    const prepared = prepare.json() as {
      uploadId: string
      uploadUrl: string
      role: string
    }
    expect(prepared.role).toBe('vocals')
    expect(prepared.uploadId).toContain(`-stem-vocals-`)
    expect(prepared.uploadUrl).toMatch(/^https?:\/\//)

    const complete = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/complete`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { role: 'vocals', uploadId: prepared.uploadId, durationSec: 120 },
    })
    expect(complete.statusCode).toBe(201)
    const stem = complete.json() as {
      id: string
      role: string
      status: string
      audioUrl: string | null
    }
    expect(stem).toMatchObject({ role: 'vocals', status: 'READY' })
    expect(stem.audioUrl).toMatch(/^https?:\/\//)

    const listed = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems`,
      headers: { cookie },
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toHaveLength(1)

    const me = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().tracks[0].stems[0].role).toBe('vocals')

    const prepareReplace = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/prepare`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        role: 'vocals',
        filename: 'vocals-v2.wav',
        contentType: 'audio/wav',
      },
    })
    const replacedUpload = prepareReplace.json().uploadId as string
    const replaced = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/complete`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { role: 'vocals', uploadId: replacedUpload },
    })
    expect(replaced.statusCode).toBe(201)
    expect(replaced.json().id).toBe(stem.id)

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/${stem.id}`,
      headers: { cookie },
    })
    expect(removed.statusCode).toBe(204)

    const empty = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems`,
      headers: { cookie },
    })
    expect(empty.json()).toEqual([])
  })

  it('lets a board member manage stems on another artist release', async () => {
    const prepare = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/prepare`,
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: {
        role: 'drums',
        filename: 'drums.wav',
        contentType: 'audio/wav',
      },
    })
    expect(prepare.statusCode).toBe(200)
    const complete = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems/complete`,
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { role: 'drums', uploadId: prepare.json().uploadId },
    })
    expect(complete.statusCode).toBe(201)
  })

  it('hides stems from other artists and exposes them on the public smart link', async () => {
    await prisma.releaseTrackStem.create({
      data: {
        releaseTrackId: trackId,
        role: 'bass',
        sourceKey: `releases/mock/${trackId}-bass.wav`,
        streamKey: `releases/mock/${trackId}-bass.wav`,
        status: 'READY',
        durationSec: 90,
      },
    })

    const denied = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/stems`,
      headers: { cookie: otherCookie },
    })
    expect(denied.statusCode).toBe(404)

    const smart = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${smartLinkSlug}`,
    })
    expect(smart.statusCode).toBe(200)
    const publicStem = smart.json().release.tracks[0].stems[0]
    expect(publicStem).toMatchObject({ role: 'bass' })
    expect(publicStem.audioUrl).toMatch(/^https?:\/\//)
    expect(publicStem.playUrl).toBe(publicStem.audioUrl)
  })

  it('drops stems when the track is removed', async () => {
    await prisma.releaseTrackStem.create({
      data: {
        releaseTrackId: trackId,
        role: 'other',
        sourceKey: `releases/mock/${trackId}-other.wav`,
        status: 'READY',
      },
    })

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}`,
      headers: { cookie },
    })
    expect(removed.statusCode).toBe(204)
    expect(await prisma.releaseTrackStem.count({ where: { releaseTrackId: trackId } })).toBe(0)
  })
})
