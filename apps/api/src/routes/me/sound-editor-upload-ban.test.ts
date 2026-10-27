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

const PREFIX = 'editor-upload-ban-'

describe('An upload ban covers editor output that becomes a new track', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let soundId: string
  let releaseId: string
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
    cookie = await sessionCookieFor(prisma, artist.id)
    const sound = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Set',
        status: 'READY',
        rawKey: 'raw/set.wav',
        durationSec: 120,
      },
    })
    soundId = sound.id
    const release = await prisma.release.create({
      data: {
        userId,
        title: 'EP',
        type: 'EP',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}ep`,
      },
    })
    releaseId = release.id
    await prisma.accountRestriction.create({
      data: { userId, type: 'UPLOAD', reason: 'Copyright strikes' },
    })
  })

  afterAll(async () => {
    await prisma.releaseTrack.deleteMany({ where: { releaseId } })
    await prisma.release.deleteMany({ where: { id: releaseId } })
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses to publish a sound into a release', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Uploads is blocked: Copyright strikes')
    expect(await prisma.releaseTrack.count({ where: { releaseId } })).toBe(0)
  })

  it('refuses to cut a clip', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/create-clip`,
      headers: { cookie },
      payload: { startSec: 0, endSec: 10 },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Uploads is blocked: Copyright strikes')
  })
})
