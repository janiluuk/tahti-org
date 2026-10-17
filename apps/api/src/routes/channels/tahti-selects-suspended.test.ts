// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'selects-susp-'

describe('Tahti Selects gallery and suspended artists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const selects = await createTestArtist(prisma, {
      email: `${PREFIX}selects@example.com`,
      username: TAHTI_SELECTS_SLUG,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    const kept = await createReadySound(prisma, artist.channel!.id, 'Still selected')
    const gone = await createReadySound(prisma, suspended.channel!.id, 'By a suspended artist')
    await prisma.curatedRotationItem.createMany({
      data: [
        { channelId: selects.channel!.id, soundId: kept.id, position: 1, addedById: selects.id },
        { channelId: selects.channel!.id, soundId: gone.id, position: 2, addedById: selects.id },
      ],
    })
    await prisma.user.update({
      where: { id: suspended.id },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("leaves a suspended artist's track out of the gallery", async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/tahti-selects/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.map((i: { title: string }) => i.title)).toEqual(['Still selected'])
  })
})
