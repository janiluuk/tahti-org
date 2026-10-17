// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'embed-susp-'

describe("a suspended artist's embeds", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let releaseId: string
  let trackId: string
  const username = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
    })
    artistId = artist.id
    const release = await createPublishedReleaseWithTrack(prisma, artist.id, {
      smartLinkSlug: `${PREFIX}album`,
      streamKey: 'streams/embed-susp.opus',
    })
    releaseId = release.id
    trackId = release.tracks[0]!.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const urls = () => [
    `/api/v1/embed/r/${releaseId}`,
    `/api/v1/embed/r/${releaseId}/tracks/${trackId}/play`,
    `/api/v1/embed/c/${username}`,
  ]

  it('serves the embeds in good standing', async () => {
    for (const url of urls()) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(200)
    }
  })

  it('serves none of them once the artist is suspended', async () => {
    await prisma.user.update({
      where: { id: artistId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    for (const url of urls()) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(404)
    }
  })
})
