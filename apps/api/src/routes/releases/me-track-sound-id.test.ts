// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'release-track-sound-id-test-'

describe('release tracks carry their linked library sound', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string
  let linkedTrackId: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-track-sound-id-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const release = await createPublishedReleaseWithTrack(prisma, artist.id)
    releaseId = release.id
    linkedTrackId = release.tracks[0]!.id
    const sound = await createReadySound(prisma, artist.channel!.id, 'Main Track')
    soundId = sound.id
    await prisma.releaseTrack.update({ where: { id: linkedTrackId }, data: { soundId } })
    await prisma.releaseTrack.create({
      data: { releaseId, position: 2, title: 'Unlinked', status: 'READY' },
    })
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns soundId on each track of the release list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/releases', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const release = res.json().releases.find((r: { id: string }) => r.id === releaseId)
    expect(release.tracks.map((t: { soundId: string | null }) => t.soundId)).toEqual([
      soundId,
      null,
    ])
  })

  it('returns soundId on the release detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const linked = res.json().tracks.find((t: { id: string }) => t.id === linkedTrackId)
    expect(linked.soundId).toBe(soundId)
  })
})
