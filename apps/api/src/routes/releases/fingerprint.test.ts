// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { runFingerprintReleaseTrack } = vi.hoisted(() => ({ runFingerprintReleaseTrack: vi.fn() }))
vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return { ...actual, runFingerprintReleaseTrack }
})

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'fingerprint-track-'

describe('release track fingerprinting', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let releaseId: string
  let readyTrackId: string
  let noAudioTrackId: string
  let scanningTrackId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Fingerprint Owner',
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Someone Else',
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    otherCookie = await sessionCookieFor(prisma, other.id)

    const release = await prisma.release.create({
      data: {
        userId: owner.id,
        title: 'Fingerprint Test Release',
        type: 'SINGLE',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `${PREFIX}release`,
        tracks: {
          create: [
            {
              position: 1,
              title: 'Ready Track',
              status: 'READY',
              sourceKey: `${PREFIX}ready.mp3`,
              durationSec: 200,
            },
            { position: 2, title: 'No Audio Track', status: 'PENDING' },
            {
              position: 3,
              title: 'Scanning Track',
              status: 'SCANNING',
              sourceKey: `${PREFIX}scanning.mp3`,
            },
          ],
        },
      },
      include: { tracks: true },
    })
    releaseId = release.id
    readyTrackId = release.tracks.find((t) => t.title === 'Ready Track')!.id
    noAudioTrackId = release.tracks.find((t) => t.title === 'No Audio Track')!.id
    scanningTrackId = release.tracks.find((t) => t.title === 'Scanning Track')!.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires ownership', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${readyTrackId}/fingerprint`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects a track with no uploaded audio', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${noAudioTrackId}/fingerprint`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a track that is still processing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${scanningTrackId}/fingerprint`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('re-fingerprints and persists the result', async () => {
    runFingerprintReleaseTrack.mockResolvedValueOnce({
      fingerprint: 'AQADtMk...',
      match: { acoustidId: 'abc-123', score: 0.92, title: 'Some Song', artist: 'Some Artist' },
      persisted: true,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${readyTrackId}/fingerprint`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      fingerprint: 'AQADtMk...',
      match: { acoustidId: 'abc-123', score: 0.92, title: 'Some Song', artist: 'Some Artist' },
      persisted: true,
    })
    expect(runFingerprintReleaseTrack).toHaveBeenCalledWith(readyTrackId, true)
  })

  it('checks for a match without persisting', async () => {
    runFingerprintReleaseTrack.mockResolvedValueOnce({
      fingerprint: 'AQADtMk...',
      match: null,
      persisted: false,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${readyTrackId}/fingerprint/check`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().persisted).toBe(false)
    expect(runFingerprintReleaseTrack).toHaveBeenCalledWith(readyTrackId, false)
  })

  it('surfaces a timeout as a 503', async () => {
    runFingerprintReleaseTrack.mockRejectedValueOnce(new Error('job timed out'))

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/tracks/${readyTrackId}/fingerprint`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(503)
  })
})
