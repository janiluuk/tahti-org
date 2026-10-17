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

const PREFIX = 'dl-susp-'
const headers = { 'x-forwarded-for': '203.0.113.77' }

describe("downloading a suspended artist's track", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let itemId: string
  const slug = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
    })
    artistId = artist.id
    itemId = (await createReadySound(prisma, artist.channel!.id, 'Free download')).id
  })

  afterAll(async () => {
    await prisma.download.deleteMany({ where: { soundId: itemId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('works in good standing and is refused once suspended', async () => {
    const url = `/api/v1/c/${slug}/sounds/${itemId}/download?fp=susp`
    const before = await app.inject({ method: 'GET', url, headers })
    expect(before.statusCode).toBe(200)

    await prisma.user.update({
      where: { id: artistId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const after = await app.inject({ method: 'GET', url, headers })
    expect(after.statusCode).toBe(404)
  })
})
