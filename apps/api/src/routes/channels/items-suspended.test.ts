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

const PREFIX = 'items-susp-'

describe("a suspended artist's channel archive", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
    })
    const sound = await createReadySound(prisma, artist.channel!.id, 'Archive set')
    await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the archive in good standing and is not found once suspended', async () => {
    const before = await app.inject({ method: 'GET', url: `/api/channels/${slug}/items` })
    expect(before.statusCode).toBe(200)
    expect(JSON.stringify(before.json())).toContain('Archive set')

    await prisma.user.update({
      where: { username: slug },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const after = await app.inject({ method: 'GET', url: `/api/channels/${slug}/items` })
    expect(after.statusCode).toBe(404)
  })
})
