// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'track-susp-'

describe("a suspended artist's track page", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let soundId: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    soundId = (await createReadySound(prisma, artist.channel!.id, 'Public single')).id
    await prisma.sound.update({ where: { id: soundId }, data: { isPublic: true } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is served in good standing and not found once suspended', async () => {
    const before = await app.inject({ method: 'GET', url: `/api/tracks/${soundId}` })
    expect(before.statusCode).toBe(200)

    await prisma.user.update({
      where: { id: artistId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const after = await app.inject({ method: 'GET', url: `/api/tracks/${soundId}` })
    expect(after.statusCode).toBe(404)
  })
})
